# Test de fumée Sprint 2 sur base simulée : python backend/tests/sprint2_smoke.py backend
import os, sys, re, asyncio
from datetime import datetime, timedelta
os.environ.update(MONGO_URL="mongodb://x", DB_NAME="t", JWT_SECRET="s"*40, CORS_ORIGINS="*", REMINDER_INTERVAL_S="3600")
sys.path.insert(0, sys.argv[1])
import mongomock_motor, motor.motor_asyncio
motor.motor_asyncio.AsyncIOMotorClient = mongomock_motor.AsyncMongoMockClient
import server
sent = []
server.send_email = lambda to, subj, html: sent.append((to, subj, html)) or True
from fastapi.testclient import TestClient
P = server.PARIS
def H(t): return {"Authorization": f"Bearer {t}"}
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
    reg = lambda e, r: c.post("/api/auth/register", json={"email": e, "password": "secret1", "prenom": e[:3], "role": r, "consentement": True}).json()
    o = reg("orga@x.fr", "organisateur"); a = reg("alice@x.fr", "ramasseur"); b = reg("bob@x.fr", "ramasseur")
    # #3 reset
    sent.clear()
    r = c.post("/api/auth/forgot-password", json={"email": "alice@x.fr"}); assert r.status_code == 200
    r2 = c.post("/api/auth/forgot-password", json={"email": "nobody@x.fr"}); assert r2.json() == r.json()
    tok = re.search(r"token=([\w-]+)", sent[-1][2]).group(1)
    assert c.post("/api/auth/reset-password", json={"token": tok, "password": "nouveau1"}).status_code == 200
    assert c.post("/api/auth/reset-password", json={"token": tok, "password": "nouveau2"}).status_code == 400
    assert c.post("/api/auth/login", json={"email": "alice@x.fr", "password": "nouveau1"}).status_code == 200
    assert c.post("/api/auth/login", json={"email": "alice@x.fr", "password": "secret1"}).status_code == 401
    print("#3 reset OK")
    # future collecte
    future = (datetime.now(P) + timedelta(days=5)).date().isoformat()
    col = c.post("/api/collectes", headers=H(o["token"]), json={"titre": "Test", "lieu": "Plage", "commune": "Brest", "point_rdv": "Parking", "lat": 48.4, "lng": -4.4, "date": future, "heure_debut": "09:00", "heure_fin": "11:00", "places": 2}).json()
    assert len(col["consignes"]) == 5 and col["statut"] == "a_venir"; print("#8 consignes OK")
    sent.clear()
    r = c.post(f"/api/collectes/{col['id']}/inscription", headers=H(a["token"])); assert r.status_code == 200, r.text
    assert any("Inscription confirmée" in s[1] and "Consignes" in s[2] for s in sent); print("#9 confirmation OK")
    c.post(f"/api/collectes/{col['id']}/inscription", headers=H(b["token"]))
    r = c.delete(f"/api/collectes/{col['id']}/inscription", headers=H(b["token"])); assert r.json()["places_restantes"] == 1 and not r.json()["est_inscrit"]
    assert c.delete(f"/api/collectes/{col['id']}/inscription", headers=H(b["token"])).status_code == 409; print("#10 désinscription OK")
    assert c.put(f"/api/collectes/{col['id']}/presences", headers=H(o["token"]), json={"presents": []}).status_code == 409
    assert c.put(f"/api/collectes/{col['id']}/bilan", headers=H(o["token"]), json={"kg": 3, "sacs": 1}).status_code == 409
    assert c.get(f"/api/collectes/{col['id']}/participants", headers=H(a["token"])).status_code == 403
    # reminder: collecte tomorrow morning within 24h
    soon = datetime.now(P) + timedelta(hours=20)
    db = server.db
    async def setup():
        await db.collectes.update_one({"id": col["id"]}, {"$set": {"date": soon.date().isoformat(), "heure_debut": soon.strftime("%H:%M"), "heure_fin": "23:59" if soon.strftime("%H:%M") < "23:00" else soon.strftime("%H:%M")}})
    c.portal.call(setup)
    sent.clear()
    n1 = c.portal.call(server.send_due_reminders); n2 = c.portal.call(server.send_due_reminders)
    assert n1 == 1 and n2 == 0 and "Rappel" in sent[0][1], (n1, n2); print("#9 rappel J-1 OK (une seule fois)")
    # past collecte -> presences & bilan
    past = (datetime.now(P) - timedelta(days=1)).date().isoformat()
    async def to_past(): await db.collectes.update_one({"id": col["id"]}, {"$set": {"date": past, "heure_debut": "09:00", "heure_fin": "11:00"}})
    c.portal.call(to_past)
    parts = c.get(f"/api/collectes/{col['id']}/participants", headers=H(o["token"])).json()
    assert [p["prenom"] for p in parts] == ["ali"]
    assert c.put(f"/api/collectes/{col['id']}/presences", headers=H(o["token"]), json={"presents": [b["user"]["id"]]}).status_code == 422
    r = c.put(f"/api/collectes/{col['id']}/presences", headers=H(o["token"]), json={"presents": [a["user"]["id"]]}); assert r.json()["presences_validees"]
    print("#11 présences OK")
    r = c.put(f"/api/collectes/{col['id']}/bilan", headers=H(o["token"]), json={"kg": 12.34, "sacs": 4}); assert r.status_code == 200, r.text
    print("#12 bilan OK")
    d = c.get(f"/api/collectes/{col['id']}", headers=H(a["token"])).json()
    assert d["bilan"] == {"kg": 12.3, "sacs": 4, "participants": 1} and d["est_present"] and d["statut"] == "terminee"
    print("#13 bilan visible OK")
    assert c.delete(f"/api/collectes/{col['id']}/inscription", headers=H(a["token"])).status_code == 409
    mine = c.get("/api/me/collectes", headers=H(a["token"])).json(); assert [m["id"] for m in mine] == [col["id"]]
    mine_o = c.get("/api/me/collectes", headers=H(o["token"])).json(); assert len(mine_o) == 1
    print("mes collectes OK")
    # #16 RGPD
    r = c.post("/api/auth/register", json={"email": "z@x.fr", "password": "secret1", "prenom": "Z", "role": "ramasseur"}); assert r.status_code == 422
    assert c.patch("/api/me", headers=H(a["token"]), json={"prenom": "Alice"}).json()["prenom"] == "Alice"
    assert c.request("DELETE", "/api/me", headers=H(a["token"]), json={"password": "faux"}).status_code == 401
    assert c.request("DELETE", "/api/me", headers=H(a["token"]), json={"password": "nouveau1"}).status_code == 200
    assert c.get("/api/auth/me", headers=H(a["token"])).status_code == 401
    d = c.get(f"/api/collectes/{col['id']}").json(); assert d["inscrits_count"] == 0 and d["bilan"]["participants"] == 1
    assert c.request("DELETE", "/api/me", headers=H(o["token"]), json={"password": "secret1"}).status_code == 200
    d = c.get(f"/api/collectes/{col['id']}").json(); assert d["organisateur_prenom"] == "Compte supprimé"
    print("#16 consentement, profil, suppression OK — tout est vert")
