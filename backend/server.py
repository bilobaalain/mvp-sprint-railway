import asyncio
import os
import logging
import uuid
from contextlib import suppress
from datetime import datetime, timezone, timedelta, date
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

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

INDEXES: dict[str, list[IndexModel]] = {
    "users": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("email", ASCENDING)], name="email", unique=True),
    ],
    "collectes": [
        IndexModel([("id", ASCENDING)], name="id", unique=True),
        IndexModel([("date", ASCENDING), ("heure_debut", ASCENDING)], name="date_heure"),
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


# ---------- Models ----------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6)
    prenom: str = Field(min_length=1, max_length=60)
    role: Literal["ramasseur", "organisateur"] = "ramasseur"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class UserOut(BaseModel):
    id: str
    email: str
    prenom: str
    role: str


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
    est_inscrit: bool = False
    est_organisateur: bool = False


def collecte_out(doc: dict, user_id: Optional[str] = None) -> CollecteOut:
    inscrits = doc.get("inscrits", [])
    restantes = max(doc["places"] - len(inscrits), 0)
    return CollecteOut(
        **{k: doc[k] for k in ("id", "titre", "lieu", "commune", "point_rdv", "lat", "lng", "date",
                               "heure_debut", "heure_fin", "places", "materiel_fourni",
                               "materiel_a_apporter", "description")},
        organisateur_prenom=doc.get("organisateur_prenom", ""),
        inscrits_count=len(inscrits),
        places_restantes=restantes,
        complet=restantes == 0,
        est_inscrit=bool(user_id and user_id in inscrits),
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
    return await db.users.find_one({"id": claims["sub"]}, {"_id": 0, "password_hash": 0})


async def require_user(user: Optional[dict] = Depends(optional_user)) -> dict:
    if not user:
        raise HTTPException(status_code=401, detail="Connexion requise")
    return user


def user_out(u: dict) -> UserOut:
    return UserOut(id=u["id"], email=u["email"], prenom=u["prenom"], role=u["role"])


# ---------- Email ----------
def send_welcome_email(email: str, prenom: str) -> bool:
    html = f"""
    <div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0F172A">
      <h2 style="color:#0D9488">Bienvenue {prenom} !</h2>
      <p>Votre compte <b>Ensemble pour sauver la rade</b> est créé.</p>
      <p>Retrouvez dès maintenant les prochaines collectes sur le littoral de la rade de Brest,
      de Plouzané à Plougastel-Daoulas, et inscrivez-vous en un clic.</p>
      <p>À très vite sur la plage,<br/>L'équipe Ensemble pour sauver la rade</p>
    </div>"""
    api_key = os.environ.get("RESEND_API_KEY", "")
    if not api_key:
        logger.info("[EMAIL MOCK] Bienvenue -> %s (RESEND_API_KEY absent)", email)
        return False
    try:
        r = requests.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={"from": os.environ.get("SENDER_EMAIL", "onboarding@resend.dev"), "to": [email],
                  "subject": "Bienvenue dans Ensemble pour sauver la rade", "html": html},
            timeout=10,
        )
        r.raise_for_status()
        return True
    except requests.RequestException as exc:
        logger.error("Welcome email failed for %s: %s", email, exc)
        return False


PARIS = ZoneInfo("Europe/Paris")


def upcoming_filter() -> dict:
    now = datetime.now(PARIS)
    today, hm = now.date().isoformat(), now.strftime("%H:%M")
    return {"$or": [{"date": {"$gt": today}}, {"date": today, "heure_fin": {"$gt": hm}}]}


# ---------- Routes ----------
@api_router.get("/")
async def root():
    return {"message": "Ensemble pour sauver la rade API"}


@api_router.post("/auth/register", response_model=AuthOut)
async def register(body: RegisterIn, background: BackgroundTasks):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=409, detail="Un compte existe déjà avec cet e-mail")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "prenom": body.prenom.strip(),
        "role": body.role,
        "password_hash": bcrypt.hashpw(body.password.encode(), bcrypt.gensalt()).decode(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    background.add_task(send_welcome_email, email, user["prenom"])
    return AuthOut(token=make_token(user["id"]), user=user_out(user),
                   welcome_email_sent=bool(os.environ.get("RESEND_API_KEY")))


@api_router.post("/auth/login", response_model=AuthOut)
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()}, {"_id": 0})
    if not user or not bcrypt.checkpw(body.password.encode(), user["password_hash"].encode()):
        raise HTTPException(status_code=401, detail="E-mail ou mot de passe incorrect")
    return AuthOut(token=make_token(user["id"]), user=user_out(user))


@api_router.get("/auth/me", response_model=UserOut)
async def me(user: dict = Depends(require_user)):
    return user_out(user)


@api_router.get("/collectes", response_model=List[CollecteOut])
async def list_collectes(limit: int = 100, user: Optional[dict] = Depends(optional_user)):
    docs = await db.collectes.find(upcoming_filter(), {"_id": 0}) \
        .sort([("date", 1), ("heure_debut", 1)]).limit(min(max(limit, 1), 200)).to_list(200)
    uid = user["id"] if user else None
    return [collecte_out(d, uid) for d in docs]


@api_router.get("/collectes/{collecte_id}", response_model=CollecteOut)
async def get_collecte(collecte_id: str, user: Optional[dict] = Depends(optional_user)):
    doc = await db.collectes.find_one({"id": collecte_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Collecte introuvable")
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
async def inscription(collecte_id: str, user: dict = Depends(require_user)):
    doc = await db.collectes.find_one({"id": collecte_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="Collecte introuvable")
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
    return collecte_out(updated, user["id"])


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
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


@app.on_event("shutdown")
async def shutdown_db_client():
    app.state.index_task.cancel()
    with suppress(asyncio.CancelledError):
        await app.state.index_task
    client.close()
