import asyncio
import hashlib
import os
import logging
import secrets
import uuid
from contextlib import suppress
from datetime import datetime, timezone, timedelta, date
from html import escape
from pathlib import Path
from zoneinfo import ZoneInfo
from typing import List, Optional, Literal

import bcrypt
import jwt
import requests
from dotenv import load_dotenv
from fastapi import FastAPI, APIRouter, HTTPException, Depends, Request, BackgroundTasks
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr
from pymongo import ASCENDING, IndexModel, ReturnDocument
from starlette.middleware.cors import CORSMiddleware

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

client = AsyncIOMotorClient(os.environ['MONGO_URL'])
db = client[os.environ['DB_NAME']]
JWT_SECRET = os.environ['JWT_SECRET']
FRONTEND_URL = os.environ.get("FRONTEND_URL", "http://localhost:3000").rstrip("/")
REMINDER_INTERVAL_S = int(os.environ.get("REMINDER_INTERVAL_S", "600"))

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
        IndexModel([("parent_token_hash", ASCENDING)], name="parent_token", sparse=True),
    ],
    "collectes": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("date", ASCENDING), ("heure_debut", ASCENDING)], name="date_heure"),
    ],
    "password_resets": [
        IndexModel([("token_hash", ASCENDING)], name="token_hash", unique=True),
        IndexModel([("expires_at", ASCENDING)], name="ttl", expireAfterSeconds=0),
    ],
}


async def ensure_indexes() -> None:
    for collection, models in INDEXES.items():
        for model in models:
            try:
                await db[collection].create_indexes([model])
            except Exception as exc:
                logger.error("ensure_indexes(%s.%s): %s", collection, model.document["name"], exc)


app = FastAPI(title="Ensemble pour sauver la rade")
api_router = APIRouter(prefix="/api")

PARIS = ZoneInfo("Europe/Paris")

# Ticket #8 : consignes communes à toutes les collectes (affichées sur la fiche et dans l'e-mail)
CONSIGNES_SECURITE = [
    "Portez des gants pendant toute la collecte et ne ramassez jamais d'objet coupant à mains nues.",
    "Ne touchez pas aux seringues, bouteilles de gaz, fusées ou munitions : signalez-les à l'organisateur.",
    "Restez hors des zones de vase et des rochers glissants ; surveillez la marée montante.",
    "Ne laissez pas un mineur seul sur l'estran ; restez en vue du groupe.",
    "Lavez-vous les mains après la collecte, avant de manger ou de boire.",
]


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    prenom: str = Field(min_length=1, max_length=60)
    role: Literal["ramasseur", "organisateur"] = "ramasseur"
    consentement: bool = False
    date_naissance: date
    email_parent: Optional[EmailStr] = None


class ParentDecisionIn(BaseModel):
    decision: Literal["accepter", "refuser"]


class ParentResendIn(BaseModel):
    email_parent: Optional[EmailStr] = None


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class ForgotIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str = Field(min_length=10, max_length=200)
    password: str = Field(min_length=6)


class ProfileIn(BaseModel):
    prenom: str = Field(min_length=1, max_length=60)


class PasswordChangeIn(BaseModel):
    ancien: str
    nouveau: str = Field(min_length=6)


class DeleteAccountIn(BaseModel):
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    prenom: str
    role: str
    # Ticket #17 : un compte mineur reste « en_attente_parent » jusqu'à l'accord du parent
    statut: Literal["actif", "en_attente_parent"] = "actif"
    email_parent: Optional[str] = None


class AuthOut(BaseModel):
    token: str
    user: UserOut
    welcome_email_sent: bool = False


class CollecteIn(BaseModel):
    titre: str = Field(min_length=3, max_length=120)
    lieu: str = Field(min_length=2, max_length=160)
    commune: str = Field(min_length=2, max_length=80)
    point_rdv: str = Field(min_length=2, max_length=200)
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    date: date
    heure_debut: str = Field(pattern=r"^\d{2}:\d{2}$")
    heure_fin: str = Field(pattern=r"^\d{2}:\d{2}$")
    places: int = Field(ge=1, le=500)
    materiel_fourni: str = Field(default="", max_length=500)
    materiel_a_apporter: str = Field(default="", max_length=500)
    description: str = Field(default="", max_length=2000)


class BilanIn(BaseModel):
    kg: float = Field(ge=0, le=100000)
    sacs: int = Field(ge=0, le=10000)


class BilanOut(BaseModel):
    kg: float
    sacs: int
    participants: int


class PresencesIn(BaseModel):
    presents: List[str] = Field(default_factory=list, max_length=500)


class ParticipantOut(BaseModel):
    id: str
    prenom: str
    email: str
    present: bool


class CollecteOut(BaseModel):
    id: str
    titre: str
    lieu: str
    commune: str
    point_rdv: str
    lat: float
    lng: float
    date: str
    heure_debut: str
    heure_fin: str
    places: int
    inscrits_count: int
    places_restantes: int
    complet: bool
    materiel_fourni: str
    materiel_a_apporter: str
    description: str
    organisateur_prenom: str
    consignes: List[str] = Field(default_factory=lambda: list(CONSIGNES_SECURITE))
    statut: Literal["a_venir", "en_cours", "terminee"] = "a_venir"
    presences_validees: bool = False
    bilan: Optional[BilanOut] = None
    est_inscrit: bool = False
    est_present: bool = False
    est_organisateur: bool = False


# ---------- Date helpers ----------
def _at(doc: dict, hm_key: str) -> datetime:
    d = date.fromisoformat(doc["date"])
    h, m = map(int, doc[hm_key].split(":"))
    return datetime(d.year, d.month, d.day, h, m, tzinfo=PARIS)


def start_dt(doc: dict) -> datetime:
    return _at(doc, "heure_debut")


def end_dt(doc: dict) -> datetime:
    return _at(doc, "heure_fin")


def statut(doc: dict) -> str:
    now = datetime.now(PARIS)
    if now < start_dt(doc):
        return "a_venir"
    return "en_cours" if now < end_dt(doc) else "terminee"


def collecte_out(doc: dict, user_id: Optional[str] = None) -> CollecteOut:
    inscrits = doc.get("inscrits", [])
    restantes = max(doc["places"] - len(inscrits), 0)
    presents = doc.get("presents")
    bilan = doc.get("bilan")
    return CollecteOut(
        **{k: doc[k] for k in ("id", "titre", "lieu", "commune", "point_rdv", "lat", "lng", "date",
                               "heure_debut", "heure_fin", "places", "materiel_fourni",
                               "materiel_a_apporter", "description")},
        organisateur_prenom=doc.get("organisateur_prenom", ""),
        inscrits_count=len(inscrits),
        places_restantes=restantes,
        complet=restantes == 0,
        statut=statut(doc),
        presences_validees=presents is not None,
        # Ticket #11 : seuls les présents validés comptent comme participants
        bilan=BilanOut(kg=bilan["kg"], sacs=bilan["sacs"], participants=len(presents or [])) if bilan else None,
        est_inscrit=bool(user_id and user_id in inscrits),
        est_present=bool(user_id and presents and user_id in presents),
        est_organisateur=bool(user_id and user_id == doc.get("organisateur_id")),
    )


# ---------- Auth helpers ----------
def make_token(user_id: str) -> str:
    payload = {"sub": user_id, "exp": datetime.now(timezone.utc) + timedelta(days=7)}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


async def optional_user(request: Request) -> Optional[dict]:
    auth = request.headers.get("authorization", "")
    if not auth.lower().startswith("bearer "):
        return None
    try:
        claims = jwt.decode(auth[7:], JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Session expirée, reconnectez-vous")
    return await db.users.find_one({"id": claims["sub"]},
                                   {"_id": 0, "password_hash": 0, "parent_token_hash": 0, "parent_token_expires": 0})


async def require_user(user: Optional[dict] = Depends(optional_user)) -> dict:
    if not user:
        raise HTTPException(status_code=401, detail="Connexion requise")
    return user


def user_out(u: dict) -> UserOut:
    return UserOut(id=u["id"], email=u["email"], prenom=u["prenom"], role=u["role"],
                   statut=u.get("statut", "actif"), email_parent=u.get("email_parent"))


MAJORITE = 18
PARENT_LINK_DAYS = 7


def age_le(naissance: date, jour: date) -> int:
    return jour.year - naissance.year - ((jour.month, jour.day) < (naissance.month, naissance.day))


def new_parent_token() -> tuple[str, dict]:
    token = secrets.token_urlsafe(32)
    return token, {"parent_token_hash": hashlib.sha256(token.encode()).hexdigest(),
                   "parent_token_expires": (datetime.now(timezone.utc) + timedelta(days=PARENT_LINK_DAYS)).isoformat()}


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


async def get_collecte_or_404(collecte_id: str) -> dict:
    doc = await db.collectes.find_one({"id": collecte_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Collecte introuvable")
    return doc


async def get_own_collecte(collecte_id: str, user: dict) -> dict:
    doc = await get_collecte_or_404(collecte_id)
    if doc.get("organisateur_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Réservé à l'organisateur de la collecte")
    return doc


# ---------- Email ----------
def email_configured() -> bool:
    return bool(os.environ.get("BREVO_API_KEY") or os.environ.get("RESEND_API_KEY"))


def send_email(to: str, subject: str, html: str) -> bool:
    """Envoie via Brevo si BREVO_API_KEY est défini, sinon via Resend. Sans clé : simple log."""
    sender = os.environ.get("SENDER_EMAIL", "onboarding@resend.dev")
    sender_name = os.environ.get("SENDER_NAME", "Ensemble pour sauver la rade")
    if os.environ.get("BREVO_API_KEY"):
        provider, url = "Brevo", "https://api.brevo.com/v3/smtp/email"
        headers = {"api-key": os.environ["BREVO_API_KEY"], "Content-Type": "application/json"}
        payload = {"sender": {"email": sender, "name": sender_name}, "to": [{"email": to}],
                   "subject": subject, "htmlContent": html}
    elif os.environ.get("RESEND_API_KEY"):
        provider, url = "Resend", "https://api.resend.com/emails"
        headers = {"Authorization": f"Bearer {os.environ['RESEND_API_KEY']}", "Content-Type": "application/json"}
        payload = {"from": f"{sender_name} <{sender}>", "to": [to], "subject": subject, "html": html}
    else:
        logger.info("[EMAIL MOCK] %s -> %s (aucune clé d'envoi configurée)", subject, to)
        return False
    try:
        r = requests.post(url, headers=headers, json=payload, timeout=10)
    except requests.RequestException as exc:
        logger.error("Email '%s' -> %s : %s injoignable (%s)", subject, to, provider, exc)
        return False
    if r.status_code >= 300:
        # Le corps de la réponse donne la vraie cause (domaine non validé, expéditeur non vérifié…)
        logger.error("Email '%s' -> %s refusé par %s (%s) : %s", subject, to, provider, r.status_code, r.text[:300])
        return False
    logger.info("Email '%s' envoyé à %s via %s", subject, to, provider)
    return True


def _layout(title: str, body: str) -> str:
    return f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0F172A">
      <h2 style="color:#0D9488">{title}</h2>
      {body}
      <p>À très vite sur la plage,<br/>L'équipe Ensemble pour sauver la rade</p>
    </div>"""


def _collecte_block(c: dict) -> str:
    consignes = "".join(f"<li>{escape(x)}</li>" for x in CONSIGNES_SECURITE)
    d = date.fromisoformat(c["date"]).strftime("%d/%m/%Y")
    return f"""
      <p><b>{escape(c['titre'])}</b><br/>
      {d}, {c['heure_debut'].replace(':', 'h')} – {c['heure_fin'].replace(':', 'h')}<br/>
      {escape(c['lieu'])}, {escape(c['commune'])}<br/>
      Rendez-vous : {escape(c['point_rdv'])}</p>
      <p><b>À apporter :</b> {escape(c.get('materiel_a_apporter') or '—')}<br/>
      <b>Matériel fourni :</b> {escape(c.get('materiel_fourni') or '—')}</p>
      <p><b>Consignes de sécurité</b></p><ul>{consignes}</ul>
      <p><a href="{FRONTEND_URL}/collectes/{c['id']}">Voir la fiche de la collecte</a></p>"""


def send_welcome_email(email: str, prenom: str) -> bool:
    return send_email(email, "Bienvenue dans Ensemble pour sauver la rade", _layout(
        f"Bienvenue {escape(prenom)} !",
        """<p>Votre compte <b>Ensemble pour sauver la rade</b> est créé.</p>
      <p>Retrouvez dès maintenant les prochaines collectes sur le littoral de la rade de Brest,
      de Plouzané à Plougastel-Daoulas, et inscrivez-vous en un clic.</p>"""))


def send_confirmation_email(email: str, prenom: str, c: dict) -> bool:
    return send_email(email, f"Inscription confirmée : {c['titre']}", _layout(
        f"C'est noté, {escape(prenom)} !",
        "<p>Votre inscription à la collecte suivante est confirmée :</p>" + _collecte_block(c)
        + "<p>Un empêchement ? Désinscrivez-vous depuis la fiche pour libérer votre place.</p>"))


def send_reminder_email(email: str, prenom: str, c: dict) -> bool:
    return send_email(email, f"Rappel : {c['titre']} demain", _layout(
        f"C'est bientôt, {escape(prenom)} !",
        "<p>Petit rappel : vous participez à cette collecte dans moins de 24 h.</p>" + _collecte_block(c)))


def send_parent_request_email(email_parent: str, prenom: str, token: str) -> bool:
    link = f"{FRONTEND_URL}/autorisation-parentale?token={token}"
    consignes = "".join(f"<li>{escape(x)}</li>" for x in CONSIGNES_SECURITE)
    return send_email(email_parent, f"{prenom} souhaite participer aux collectes de la rade", _layout(
        "Votre accord est nécessaire",
        f"""<p>Bonjour,</p>
      <p><b>{escape(prenom)}</b> vient de créer un compte sur <b>Ensemble pour sauver la rade</b>, le site des collectes
      citoyennes de déchets sur le littoral de la rade de Brest, en indiquant votre adresse comme celle d'un parent.</p>
      <p>Comme {escape(prenom)} est mineur·e, son compte ne pourra servir à s'inscrire aux collectes qu'avec votre accord.
      Les collectes se déroulent en plein air, encadrées par un organisateur, avec ces consignes :</p><ul>{consignes}</ul>
      <p><a href="{link}"><b>Donner ou refuser mon accord</b></a></p>
      <p>Ce lien est valable {PARENT_LINK_DAYS} jours. Si vous ne connaissez pas {escape(prenom)}, refusez simplement : le compte sera supprimé.</p>"""))


def send_parent_decision_email(email: str, prenom: str, accepte: bool) -> bool:
    if accepte:
        return send_email(email, "Ton compte est activé", _layout(
            f"C'est parti, {escape(prenom)} !",
            f"""<p>Ton parent a donné son accord : tu peux maintenant t'inscrire aux collectes.</p>
          <p><a href="{FRONTEND_URL}/collectes">Voir les prochaines collectes</a></p>"""))
    return send_email(email, "Ton inscription n'a pas été autorisée", _layout(
        f"Bonjour {escape(prenom)},",
        "<p>Ton parent n'a pas donné son accord : ton compte et tes données ont été supprimés.</p>"))


def send_reset_email(email: str, prenom: str, token: str) -> bool:
    link = f"{FRONTEND_URL}/reinitialiser?token={token}"
    return send_email(email, "Réinitialisation de votre mot de passe", _layout(
        f"Bonjour {escape(prenom)},",
        f"""<p>Vous avez demandé à réinitialiser votre mot de passe.</p>
      <p><a href="{link}">Choisir un nouveau mot de passe</a></p>
      <p>Ce lien est valable 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>"""))


# ---------- Ticket #9 : rappel la veille ----------
async def send_due_reminders() -> int:
    now = datetime.now(PARIS)
    window = {"date": {"$gte": now.date().isoformat(), "$lte": (now + timedelta(days=1)).date().isoformat()}}
    sent = 0
    async for c in db.collectes.find(window, {"_id": 0}):
        if not (now < start_dt(c) <= now + timedelta(hours=24)):
            continue
        todo = [u for u in c.get("inscrits", []) if u not in c.get("rappels_envoyes", [])]
        if not todo:
            continue
        users = await db.users.find({"id": {"$in": todo}}, {"_id": 0, "id": 1, "email": 1, "prenom": 1}).to_list(500)
        for u in users:
            await asyncio.to_thread(send_reminder_email, u["email"], u["prenom"], c)
            sent += 1
        await db.collectes.update_one({"id": c["id"]}, {"$addToSet": {"rappels_envoyes": {"$each": todo}}})
    return sent


async def reminder_loop() -> None:
    while True:
        try:
            n = await send_due_reminders()
            if n:
                logger.info("Rappels J-1 envoyés : %d", n)
        except Exception as exc:
            logger.error("reminder_loop: %s", exc)
        await asyncio.sleep(REMINDER_INTERVAL_S)


def upcoming_filter() -> dict:
    now = datetime.now(PARIS)
    today, hm = now.date().isoformat(), now.strftime("%H:%M")
    return {"$or": [{"date": {"$gt": today}}, {"date": today, "heure_fin": {"$gt": hm}}]}


# ---------- Routes : auth ----------
@api_router.get("/")
async def root():
    return {"message": "Ensemble pour sauver la rade API"}


@api_router.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn, background: BackgroundTasks):
    # Ticket #16 : consentement obligatoire au traitement des données
    if not body.consentement:
        raise HTTPException(status_code=422, detail="Vous devez accepter les mentions légales et la politique de confidentialité")
    email = body.email.lower()
    today = datetime.now(PARIS).date()
    if body.date_naissance > today or age_le(body.date_naissance, today) > 120:
        raise HTTPException(status_code=422, detail="Date de naissance invalide")
    mineur = age_le(body.date_naissance, today) < MAJORITE
    email_parent = body.email_parent.lower() if body.email_parent else None
    # Ticket #17 : un mineur doit fournir l'e-mail d'un parent ; un organisateur doit être majeur
    if mineur and body.role == "organisateur":
        raise HTTPException(status_code=422, detail="Il faut être majeur pour organiser une collecte")
    if mineur and not email_parent:
        raise HTTPException(status_code=422, detail="L'e-mail d'un parent est obligatoire pour les moins de 18 ans")
    if mineur and email_parent == email:
        raise HTTPException(status_code=422, detail="L'e-mail du parent doit être différent du vôtre")
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Un compte existe déjà avec cet e-mail")
    parent_token, parent_fields = new_parent_token() if mineur else (None, {})
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "prenom": body.prenom.strip(),
        "role": body.role,
        "password_hash": hash_password(body.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "consentement_le": datetime.now(timezone.utc).isoformat(),
        "date_naissance": body.date_naissance.isoformat(),
        "statut": "en_attente_parent" if mineur else "actif",
        **({"email_parent": email_parent, **parent_fields} if mineur else {}),
    }
    await db.users.insert_one(user)
    background.add_task(send_welcome_email, email, user["prenom"])
    if mineur:
        background.add_task(send_parent_request_email, email_parent, user["prenom"], parent_token)
    return AuthOut(token=make_token(user["id"]), user=user_out(user),
                   welcome_email_sent=email_configured())


@api_router.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="E-mail ou mot de passe incorrect")
    return AuthOut(token=make_token(user["id"]), user=user_out(user))


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(require_user)):
    return user_out(user)


@api_router.patch("/me", response_model=UserOut)
async def update_profile(body: ProfileIn, user: dict = Depends(require_user)):
    prenom = body.prenom.strip()
    if not prenom:
        raise HTTPException(status_code=422, detail="Le prénom est obligatoire")
    await db.users.update_one({"id": user["id"]}, {"$set": {"prenom": prenom}})
    await db.collectes.update_many({"organisateur_id": user["id"]}, {"$set": {"organisateur_prenom": prenom}})
    return user_out({**user, "prenom": prenom})


@api_router.put("/me/password")
async def change_password(body: PasswordChangeIn, user: dict = Depends(require_user)):
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 1})
    if not bcrypt.checkpw(body.ancien.encode(), full["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Mot de passe actuel incorrect")
    if body.ancien == body.nouveau:
        raise HTTPException(status_code=422, detail="Le nouveau mot de passe doit être différent de l'actuel")
    await db.users.update_one({"id": user["id"]}, {"$set": {"password_hash": hash_password(body.nouveau)}})
    await db.password_resets.delete_many({"user_id": user["id"]})
    return {"message": "Mot de passe modifié"}


# Ticket #16 : suppression effective du compte (droit à l'effacement)
@api_router.delete("/me")
async def delete_account(body: DeleteAccountIn, user: dict = Depends(require_user)):
    full = await db.users.find_one({"id": user["id"]}, {"_id": 0, "password_hash": 1})
    if not full or not bcrypt.checkpw(body.password.encode(), full["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="Mot de passe incorrect")
    uid = user["id"]
    # Collectes organisées : les futures sont supprimées, les passées sont anonymisées (le bilan reste visible)
    now_filter = upcoming_filter()
    await db.collectes.delete_many({"organisateur_id": uid, **now_filter})
    await db.collectes.update_many({"organisateur_id": uid},
                                   {"$set": {"organisateur_id": None, "organisateur_prenom": "Compte supprimé"}})
    # Inscriptions : retrait partout ; dans les présences passées, l'identifiant est remplacé
    # par un jeton anonyme pour que le nombre de participants du bilan reste juste.
    await db.collectes.update_many({}, {"$pull": {"inscrits": uid, "rappels_envoyes": uid}})
    async for c in db.collectes.find({"presents": uid}, {"_id": 0, "id": 1, "presents": 1}):
        anon = [f"anonyme-{uuid.uuid4().hex[:8]}" if p == uid else p for p in c["presents"]]
        await db.collectes.update_one({"id": c["id"]}, {"$set": {"presents": anon}})
    await db.password_resets.delete_many({"user_id": uid})
    await db.users.delete_one({"id": uid})
    return {"message": "Votre compte et vos données personnelles ont été supprimés."}


# ---------- Ticket #17 : autorisation parentale ----------
async def find_by_parent_token(token: str) -> dict:
    user = await db.users.find_one({"parent_token_hash": hashlib.sha256(token.encode()).hexdigest(),
                                    "statut": "en_attente_parent"}, {"_id": 0})
    if not user or user.get("parent_token_expires", "") < datetime.now(timezone.utc).isoformat():
        raise HTTPException(status_code=404, detail="Lien invalide, expiré ou déjà utilisé")
    return user


@api_router.get("/autorisation-parentale/{token}")
async def parent_request_info(token: str):
    user = await find_by_parent_token(token)
    return {"prenom": user["prenom"], "consignes": CONSIGNES_SECURITE}


@api_router.post("/autorisation-parentale/{token}")
async def parent_decision(token: str, body: ParentDecisionIn, background: BackgroundTasks):
    user = await find_by_parent_token(token)
    if body.decision == "accepter":
        await db.users.update_one({"id": user["id"]}, {
            "$set": {"statut": "actif", "accord_parental_le": datetime.now(timezone.utc).isoformat()},
            "$unset": {"parent_token_hash": "", "parent_token_expires": ""}})
        background.add_task(send_parent_decision_email, user["email"], user["prenom"], True)
        return {"message": f"Merci ! Le compte de {user['prenom']} est activé."}
    # Refus : le compte (sans aucune inscription, puisqu'il était bloqué) est supprimé
    await db.password_resets.delete_many({"user_id": user["id"]})
    await db.users.delete_one({"id": user["id"]})
    background.add_task(send_parent_decision_email, user["email"], user["prenom"], False)
    return {"message": f"C'est noté : le compte de {user['prenom']} et ses données ont été supprimés."}


@api_router.post("/me/autorisation-parentale/renvoyer", response_model=UserOut)
async def parent_resend(body: ParentResendIn, background: BackgroundTasks, user: dict = Depends(require_user)):
    if user.get("statut") != "en_attente_parent":
        raise HTTPException(status_code=409, detail="Votre compte est déjà actif")
    email_parent = (body.email_parent or user["email_parent"]).lower()
    if email_parent == user["email"]:
        raise HTTPException(status_code=422, detail="L'e-mail du parent doit être différent du vôtre")
    token, fields = new_parent_token()
    await db.users.update_one({"id": user["id"]}, {"$set": {"email_parent": email_parent, **fields}})
    background.add_task(send_parent_request_email, email_parent, user["prenom"], token)
    return user_out({**user, "email_parent": email_parent})


# Ticket #3 : mot de passe oublié. Même réponse que le compte existe ou non (pas d'énumération des e-mails).
@api_router.post("/auth/forgot-password")
async def forgot_password(body: ForgotIn, background: BackgroundTasks):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0, "id": 1, "email": 1, "prenom": 1})
    if user:
        token = secrets.token_urlsafe(32)
        await db.password_resets.insert_one({
            "token_hash": hashlib.sha256(token.encode()).hexdigest(),
            "user_id": user["id"],
            "expires_at": datetime.now(timezone.utc) + timedelta(hours=1),
            "used": False,
        })
        background.add_task(send_reset_email, user["email"], user["prenom"], token)
    return {"message": "Si un compte existe avec cet e-mail, un lien de réinitialisation vient d'être envoyé."}


@api_router.post("/auth/reset-password")
async def reset_password(body: ResetIn):
    rec = await db.password_resets.find_one_and_update(
        {"token_hash": hashlib.sha256(body.token.encode()).hexdigest(), "used": False,
         "expires_at": {"$gt": datetime.now(timezone.utc)}},
        {"$set": {"used": True}},
    )
    if not rec:
        raise HTTPException(status_code=400, detail="Lien invalide ou expiré, refaites une demande")
    await db.users.update_one({"id": rec["user_id"]}, {"$set": {"password_hash": hash_password(body.password)}})
    return {"message": "Mot de passe modifié, vous pouvez vous connecter."}


# ---------- Routes : collectes ----------
@api_router.get("/collectes", response_model=List[CollecteOut])
async def list_collectes(limit: int = 100, user: Optional[dict] = Depends(optional_user)):
    docs = await db.collectes.find(upcoming_filter(), {"_id": 0}) \
        .sort([("date", 1), ("heure_debut", 1)]).limit(min(max(limit, 1), 200)).to_list(200)
    uid = user["id"] if user else None
    return [collecte_out(d, uid) for d in docs]


@api_router.get("/me/collectes", response_model=List[CollecteOut])
async def my_collectes(user: dict = Depends(require_user)):
    """Organisateur : ses collectes publiées. Ramasseur : ses inscriptions. Collectes passées incluses."""
    query = {"organisateur_id": user["id"]} if user["role"] == "organisateur" else {"inscrits": user["id"]}
    docs = await db.collectes.find(query, {"_id": 0}).sort([("date", -1), ("heure_debut", -1)]).to_list(500)
    return [collecte_out(d, user["id"]) for d in docs]


@api_router.get("/collectes/{collecte_id}", response_model=CollecteOut)
async def get_collecte(collecte_id: str, user: Optional[dict] = Depends(optional_user)):
    doc = await get_collecte_or_404(collecte_id)
    return collecte_out(doc, user["id"] if user else None)


@api_router.post("/collectes", response_model=CollecteOut, status_code=201)
async def create_collecte(body: CollecteIn, user: dict = Depends(require_user)):
    if user["role"] != "organisateur":
        raise HTTPException(status_code=403, detail="Seuls les organisateurs peuvent publier une collecte")
    if body.date < datetime.now(PARIS).date():
        raise HTTPException(status_code=422, detail="La date doit être aujourd'hui ou dans le futur")
    if body.heure_fin <= body.heure_debut:
        raise HTTPException(status_code=422, detail="L'heure de fin doit être après l'heure de début")
    doc = {
        **body.model_dump(),
        "date": body.date.isoformat(),
        "id": str(uuid.uuid4()),
        "organisateur_id": user["id"],
        "organisateur_prenom": user["prenom"],
        "inscrits": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.collectes.insert_one(doc)
    return collecte_out(doc, user["id"])


@api_router.post("/collectes/{collecte_id}/inscription", response_model=CollecteOut)
async def inscription(collecte_id: str, background: BackgroundTasks, user: dict = Depends(require_user)):
    if user.get("statut") == "en_attente_parent":
        raise HTTPException(status_code=403, detail="Votre compte attend l'accord de votre parent avant de pouvoir vous inscrire")
    doc = await get_collecte_or_404(collecte_id)
    if not await db.collectes.find_one({"id": collecte_id, **upcoming_filter()}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="Cette collecte est terminée")
    if doc.get("organisateur_id") == user["id"]:
        raise HTTPException(status_code=409, detail="Vous organisez cette collecte")
    if user["id"] in doc.get("inscrits", []):
        raise HTTPException(status_code=409, detail="Vous êtes déjà inscrit à cette collecte")
    updated = await db.collectes.find_one_and_update(
        {"id": collecte_id, "inscrits": {"$ne": user["id"]},
         "$expr": {"$lt": [{"$size": "$inscrits"}, "$places"]}},
        {"$push": {"inscrits": user["id"]}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER,
    )
    if not updated:
        raise HTTPException(status_code=409, detail="Inscription refusée : la collecte est complète")
    # Ticket #9 : confirmation immédiate, avec les consignes du ticket #8
    background.add_task(send_confirmation_email, user["email"], user["prenom"], updated)
    return collecte_out(updated, user["id"])


# Ticket #10 : désinscription, la place se libère aussitôt
@api_router.delete("/collectes/{collecte_id}/inscription", response_model=CollecteOut)
async def desinscription(collecte_id: str, user: dict = Depends(require_user)):
    doc = await get_collecte_or_404(collecte_id)
    if user["id"] not in doc.get("inscrits", []):
        raise HTTPException(status_code=409, detail="Vous n'êtes pas inscrit à cette collecte")
    if statut(doc) != "a_venir":
        raise HTTPException(status_code=409, detail="La collecte a déjà commencé")
    updated = await db.collectes.find_one_and_update(
        {"id": collecte_id},
        {"$pull": {"inscrits": user["id"], "rappels_envoyes": user["id"]}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER,
    )
    return collecte_out(updated, user["id"])


# Ticket #11 : l'organisateur voit les inscrits et valide les présences
@api_router.get("/collectes/{collecte_id}/participants", response_model=List[ParticipantOut])
async def participants(collecte_id: str, user: dict = Depends(require_user)):
    doc = await get_own_collecte(collecte_id, user)
    ids = doc.get("inscrits", [])
    presents = set(doc.get("presents") or [])
    users = await db.users.find({"id": {"$in": ids}}, {"_id": 0, "id": 1, "prenom": 1, "email": 1}).to_list(500)
    by_id = {u["id"]: u for u in users}
    return [ParticipantOut(id=i, prenom=by_id[i]["prenom"], email=by_id[i]["email"], present=i in presents)
            for i in ids if i in by_id]


@api_router.put("/collectes/{collecte_id}/presences", response_model=CollecteOut)
async def valider_presences(collecte_id: str, body: PresencesIn, user: dict = Depends(require_user)):
    doc = await get_own_collecte(collecte_id, user)
    if statut(doc) == "a_venir":
        raise HTTPException(status_code=409, detail="Les présences se valident à partir du début de la collecte")
    inscrits = set(doc.get("inscrits", []))
    if any(p not in inscrits for p in body.presents):
        raise HTTPException(status_code=422, detail="Certaines personnes ne sont pas inscrites à cette collecte")
    updated = await db.collectes.find_one_and_update(
        {"id": collecte_id}, {"$set": {"presents": list(dict.fromkeys(body.presents))}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER,
    )
    return collecte_out(updated, user["id"])


# Ticket #12 : saisie du bilan, seulement une fois la collecte terminée
@api_router.put("/collectes/{collecte_id}/bilan", response_model=CollecteOut)
async def saisir_bilan(collecte_id: str, body: BilanIn, user: dict = Depends(require_user)):
    doc = await get_own_collecte(collecte_id, user)
    if statut(doc) != "terminee":
        raise HTTPException(status_code=409, detail="Le bilan se saisit une fois la collecte terminée")
    updated = await db.collectes.find_one_and_update(
        {"id": collecte_id},
        {"$set": {"bilan": {"kg": round(body.kg, 1), "sacs": body.sacs,
                            "saisi_le": datetime.now(timezone.utc).isoformat()}}},
        projection={"_id": 0}, return_document=ReturnDocument.AFTER,
    )
    return collecte_out(updated, user["id"])


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=[o.strip() for o in os.environ.get('CORS_ORIGINS', '*').split(',') if o.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Seed (exemples éditables) ----------
SEED = [
    ("Grand nettoyage du Moulin Blanc", "Plage du Moulin Blanc", "Brest", "Parking du Moulin Blanc, près du poste de secours", 48.3936, -4.4318, 3, "09:30", "12:00", 30),
    ("Collecte à la pointe du Portzic", "Sainte-Anne-du-Portzic", "Plouzané", "Devant la cale de Sainte-Anne", 48.3597, -4.5520, 6, "14:00", "16:30", 20),
    ("Anse de Kerhuon propre", "Pointe du Passage", "Le Relecq-Kerhuon", "Cale du Passage, sous le pont Albert-Louppe", 48.3967, -4.3966, 10, "10:00", "12:00", 15),
    ("Rives de Plougastel", "Anse du Caro", "Plougastel-Daoulas", "Parking de l'anse du Caro", 48.3622, -4.4092, 13, "09:00", "11:30", 25),
    ("Port de commerce : opération filets", "Port du Château", "Brest", "Capitainerie du Port du Château", 48.3803, -4.4960, 17, "14:30", "17:00", 2),
]


async def seed_collectes() -> None:
    if await db.collectes.count_documents({}) > 0:
        return
    today = datetime.now(PARIS).date()
    docs = []
    for i, (titre, lieu, commune, rdv, lat, lng, days, hd, hf, places) in enumerate(SEED):
        docs.append({
            "id": str(uuid.uuid4()), "titre": titre, "lieu": lieu, "commune": commune, "point_rdv": rdv,
            "lat": lat, "lng": lng, "date": (today + timedelta(days=days)).isoformat(),
            "heure_debut": hd, "heure_fin": hf, "places": places,
            "materiel_fourni": "Gants, sacs poubelle, pinces de ramassage",
            "materiel_a_apporter": "Bottes ou chaussures fermées, gourde, coupe-vent",
            "description": "Collecte citoyenne sur le littoral de la rade. Ouverte à tous, débutants bienvenus.",
            "organisateur_id": "seed", "organisateur_prenom": "Association de la rade",
            "inscrits": ["seed-1", "seed-2"] if places == 2 else [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
    await db.collectes.insert_many(docs)


@app.on_event("startup")
async def startup():
    app.state.index_task = asyncio.create_task(ensure_indexes())
    await seed_collectes()
    app.state.reminder_task = asyncio.create_task(reminder_loop())


@app.on_event("shutdown")
async def shutdown_db_client():
    for task in (app.state.index_task, app.state.reminder_task):
        task.cancel()
        with suppress(asyncio.CancelledError):
            await task
    client.close()
