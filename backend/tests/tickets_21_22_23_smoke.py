# Tickets #21 (validation par l'association) et #22 (annulation) sur base simulée :
#   python backend/tests/tickets_21_22_23_smoke.py backend
# (#23 « copier le lien » est purement frontend.)
import os, sys
from datetime import datetime, timedelta
os.environ.update(MONGO_URL="mongodb://x", DB_NAME="t", JWT_SECRET="s"*40, CORS_ORIGINS="*", REMINDER_INTERVAL_S="3600",
                  ADMIN_EMAILS="asso@x.fr")
sys.path.insert(0, sys.argv[1])
import mongomock_motor, motor.motor_asyncio
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
import server
sent = []
server.send_email = lambda to, subj, html: sent.append((to, subj, html)) or True
from fastapi.testclient import TestClient

P = server.PARIS
H = lambda t: {"Authorization": f"Bearer {t}"}
future = (datetime.now(P) + timedelta(days=5)).date().isoformat()
COL = {"titre": "Test", "lieu": "Plage", "commune": "Brest", "point_rdv": "Parking", "lat": 48.4, "lng": -4.4,
       "date": future, "heure_debut": "09:00", "heure_fin": "11:00", "places": 5}

def patch_expr():
    """mongomock ne gère pas $expr (inscription atomique) : même contournement que sprint2_smoke.py."""
    cls = type(server.db.collectes)
    orig = cls.find_one_and_update
    async def foau(self, flt, upd, **kw):
        if "$expr" in flt:
            ne = flt["inscrits"]["$ne"]
            flt = {"id": flt["id"]}
            doc = await self.find_one(flt)
            if not doc or ne in doc.get("inscrits", []) or len(doc.get("inscrits", [])) >= doc["places"]:
                return None
        return await orig(self, flt, upd, **kw)
    cls.find_one_and_update = foau


with TestClient(server.app) as c:
    patch_expr()
    reg =lambda e, r: c.post("/api/auth/register", json={"email": e, "password": "secret1", "prenom": e[:4], "role": r,
                                                          "consentement": True, "date_naissance": "1990-01-01"}).json()
    asso, orga, ram, autre = reg("asso@x.fr", "ramasseur"), reg("orga@x.fr", "organisateur"), reg("ram@x.fr", "ramasseur"), reg("autre@x.fr", "organisateur")
    assert asso["user"]["admin"] and not orga["user"]["admin"]
    ids = lambda path, tok=None: [x["id"] for x in c.get(path, headers=H(tok) if tok else {}).json()]

    # ---------- #21 : une nouvelle collecte attend la validation ----------
    sent.clear()
    col = c.post("/api/collectes", headers=H(orga["token"]), json=COL).json()
    assert col["validation"] == "en_attente"
    assert any(to == "asso@x.fr" and "à valider" in subj for to, subj, _ in sent), sent
    assert col["id"] not in ids("/api/collectes")                                    # invisible du public
    assert c.get(f"/api/collectes/{col['id']}").status_code == 404                     # même par lien direct
    assert c.get(f"/api/collectes/{col['id']}", headers=H(ram["token"])).status_code == 404
    assert c.get(f"/api/collectes/{col['id']}", headers=H(orga["token"])).status_code == 200   # l'organisateur la voit
    assert c.get(f"/api/collectes/{col['id']}", headers=H(asso["token"])).status_code == 200   # l'association aussi
    assert c.post(f"/api/collectes/{col['id']}/inscription", headers=H(ram["token"])).status_code in (404, 409)
    assert c.get("/api/association/collectes", headers=H(orga["token"])).status_code == 403
    assert ids("/api/association/collectes", asso["token"]) == [col["id"]]

    # refus : motif obligatoire, e-mail à l'organisateur
    url = f"/api/association/collectes/{col['id']}/validation"
    assert c.post(url, headers=H(orga["token"]), json={"decision": "valider"}).status_code == 403
    assert c.post(url, headers=H(asso["token"]), json={"decision": "refuser"}).status_code == 422
    sent.clear()
    r = c.post(url, headers=H(asso["token"]), json={"decision": "refuser", "motif": "Zone protégée en période de nidification"})
    assert r.status_code == 200 and r.json()["validation"] == "refusee", r.text
    assert any(to == "orga@x.fr" and "refusée" in subj and "nidification" in html for to, subj, html in sent), sent
    assert c.get(f"/api/collectes/{col['id']}", headers=H(orga["token"])).json()["motif_refus"].startswith("Zone")
    assert c.post(url, headers=H(asso["token"]), json={"decision": "valider"}).status_code == 409   # déjà traitée
    print("#21 refus OK")

    # l'organisateur corrige : la collecte repart en validation
    sent.clear()
    r = c.put(f"/api/collectes/{col['id']}", headers=H(orga["token"]), json={**COL, "lieu": "Plage du Moulin Blanc"})
    assert r.status_code == 200 and r.json()["validation"] == "en_attente" and r.json()["motif_refus"] is None, r.text
    assert any(to == "asso@x.fr" for to, _, _ in sent)
    sent.clear()
    r = c.post(url, headers=H(asso["token"]), json={"decision": "valider"})
    assert r.status_code == 200 and r.json()["validation"] == "validee"
    assert any(to == "orga@x.fr" and "validée" in subj for to, subj, _ in sent)
    assert col["id"] in ids("/api/collectes") and ids("/api/association/collectes", asso["token"]) == []
    assert c.post(f"/api/collectes/{col['id']}/inscription", headers=H(ram["token"])).status_code == 200
    print("#21 nouvelle soumission puis validation OK")

    # être de l'association ne donne pas le droit de publier sans le rôle organisateur
    # (la validation d'office d'un organisateur de l'association est couverte par sprint2_smoke.py)
    assert c.post("/api/collectes", headers=H(asso["token"]), json=COL).status_code == 403
    print("#21 OK")

    # ---------- #22 : annulation ----------
    an = f"/api/collectes/{col['id']}/annulation"
    assert c.get(f"/api/collectes/{col['id']}", headers=H(orga["token"])).json()["annulable"]
    assert c.post(an, headers=H(autre["token"]), json={"motif": "Je ne suis pas l'organisateur"}).status_code == 403
    assert c.post(an, headers=H(orga["token"]), json={}).status_code == 422          # 1 inscrit → motif obligatoire
    sent.clear()
    r = c.post(an, headers=H(orga["token"]), json={"motif": "Alerte tempête sur la rade"})
    assert r.status_code == 200 and r.json()["annulee"] and not r.json()["modifiable"] and not r.json()["annulable"], r.text
    assert any(to == "ram@x.fr" and "annulée" in subj and "tempête" in html for to, subj, html in sent), sent
    assert c.post(an, headers=H(orga["token"]), json={"motif": "Encore une fois"}).status_code == 409
    assert col["id"] not in ids("/api/collectes")                                    # retirée des listes
    d = c.get(f"/api/collectes/{col['id']}").json()                                  # mais le lien de l'e-mail marche
    assert d["annulee"] and d["motif_annulation"] == "Alerte tempête sur la rade"
    assert c.put(f"/api/collectes/{col['id']}", headers=H(orga["token"]), json={**COL, "titre": "Autre"}).status_code == 409
    c.delete(f"/api/collectes/{col['id']}/inscription", headers=H(ram["token"]))
    assert c.post(f"/api/collectes/{col['id']}/inscription", headers=H(ram["token"])).json()["detail"] == "Cette collecte a été annulée"
    assert col["id"] in ids("/api/me/collectes", orga["token"])                      # reste dans « Mes collectes »

    # sans inscrit, le motif est facultatif ; pas de rappel J-1 pour une collecte annulée
    col2 = c.post("/api/collectes", headers=H(orga["token"]), json=COL).json()
    c.post(f"/api/association/collectes/{col2['id']}/validation", headers=H(asso["token"]), json={"decision": "valider"})
    assert c.post(f"/api/collectes/{col2['id']}/annulation", headers=H(orga["token"]), json={}).status_code == 200
    soon = datetime.now(P) + timedelta(hours=20)
    async def bientot():
        await server.db.collectes.update_many({"annulee": True}, {"$set": {"date": soon.date().isoformat(), "heure_debut": soon.strftime("%H:%M"),
                                                            "heure_fin": "23:59" if soon.strftime("%H:%M") < "23:00" else soon.strftime("%H:%M"),
                                                            "inscrits": [ram["user"]["id"]]}})
    c.portal.call(bientot)
    assert c.portal.call(server.send_due_reminders) == 0
    print("#22 annulation OK — tout est vert")
