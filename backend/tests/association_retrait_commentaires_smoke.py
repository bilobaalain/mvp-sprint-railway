# Association : retrait d'une validation et commentaires (e-mail à l'organisateur) :
#   python backend/tests/association_retrait_commentaires_smoke.py backend
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
    reg = lambda e, r: c.post("/api/auth/register", json={"email": e, "password": "secret1", "prenom": e[:4], "role": r,
                                                           "consentement": True, "date_naissance": "1990-01-01"}).json()
    orga, asso, ram, autre = reg("orga@x.fr", "organisateur"), reg("asso@x.fr", "ramasseur"), reg("ram@x.fr", "ramasseur"), reg("aut@x.fr", "ramasseur")
    col = c.post("/api/collectes", headers=H(orga["token"]), json=COL).json()
    assert c.post(f"/api/association/collectes/{col['id']}/retrait", headers=H(asso["token"]), json={"motif": "pas encore validée"}).status_code == 409
    c.post(f"/api/association/collectes/{col['id']}/validation", headers=H(asso["token"]), json={"decision": "valider"})
    c.post(f"/api/collectes/{col['id']}/inscription", headers=H(ram["token"]))

    # retrait : association seulement, motif obligatoire
    assert c.post(f"/api/association/collectes/{col['id']}/retrait", headers=H(orga["token"]), json={"motif": "xxxxxxx"}).status_code == 403
    assert c.post(f"/api/association/collectes/{col['id']}/retrait", headers=H(asso["token"]), json={"motif": ""}).status_code == 422
    sent.clear()
    r = c.post(f"/api/association/collectes/{col['id']}/retrait", headers=H(asso["token"]), json={"motif": "Arrêté préfectoral"})
    assert r.status_code == 200 and r.json()["validation"] == "en_attente", r.text
    assert any(t == "orga@x.fr" and "Validation retirée" in s and "Arrêté préfectoral" in h for t, s, h in sent), sent
    assert any(t == "ram@x.fr" and "suspendue" in s for t, s, h in sent), sent
    assert c.get(f"/api/collectes/{col['id']}").status_code == 404                            # plus public
    assert col["id"] not in [x["id"] for x in c.get("/api/collectes").json()]
    vu = c.get(f"/api/collectes/{col['id']}", headers=H(ram["token"])).json()                 # l'inscrit la voit encore
    assert vu["retrait"] and vu["motif_retrait"] is None and vu["commentaires"] is None
    assert c.get(f"/api/collectes/{col['id']}", headers=H(orga["token"])).json()["motif_retrait"] == "Arrêté préfectoral"
    assert col["id"] in [x["id"] for x in c.get("/api/association/collectes", headers=H(asso["token"])).json()]
    assert c.post(f"/api/collectes/{col['id']}/inscription", headers=H(autre["token"])).status_code == 409
    r = c.post(f"/api/association/collectes/{col['id']}/validation", headers=H(asso["token"]), json={"decision": "valider"})
    assert r.json()["validation"] == "validee" and not r.json()["retrait"]
    print("retrait de validation OK")

    # commentaires : association seulement, e-mail à l'organisateur, visibles de l'orga et de l'asso
    assert c.post(f"/api/association/collectes/{col['id']}/commentaires", headers=H(orga["token"]), json={"texte": "x"}).status_code == 403
    sent.clear()
    r = c.post(f"/api/association/collectes/{col['id']}/commentaires", headers=H(asso["token"]), json={"texte": "Prévoyez un bac à verre <b>"})
    assert r.status_code == 200 and len(r.json()["commentaires"]) == 1 and r.json()["commentaires"][0]["peut_supprimer"]
    m = [x for x in sent if x[0] == "orga@x.fr"]; assert m and "Commentaire" in m[0][1] and "bac à verre &lt;b&gt;" in m[0][2], sent
    vo = c.get(f"/api/collectes/{col['id']}", headers=H(orga["token"])).json()["commentaires"]
    assert vo[0]["texte"].startswith("Prévoyez") and not vo[0]["peut_supprimer"]
    assert c.get(f"/api/collectes/{col['id']}", headers=H(ram["token"])).json()["commentaires"] is None
    assert c.get(f"/api/collectes/{col['id']}").json()["commentaires"] is None
    cid = vo[0]["id"]
    assert c.delete(f"/api/association/collectes/{col['id']}/commentaires/{cid}", headers=H(orga["token"])).status_code == 403
    assert c.delete(f"/api/association/collectes/{col['id']}/commentaires/{cid}", headers=H(asso["token"])).json()["commentaires"] == []
    assert c.delete(f"/api/association/collectes/{col['id']}/commentaires/{cid}", headers=H(asso["token"])).status_code == 404
    print("commentaires de l'association OK — tout est vert")
