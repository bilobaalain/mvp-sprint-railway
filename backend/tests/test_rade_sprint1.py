# Sprint 1 regression tests: auth (#2), collectes list/detail (#4,#6), publish (#1), one-click inscription (#7)
import os
import uuid
from datetime import date, timedelta

import pytest
import requests

BASE_URL = os.environ.get("REACT_APP_BACKEND_URL").rstrip("/")
API = f"{BASE_URL}/api"

CREATED = {"users": [], "collectes": []}


def _register(role="ramasseur", prenom="TEST_User"):
    email = f"test_{uuid.uuid4().hex[:10]}@example.com"
    r = requests.post(f"{API}/auth/register", json={"email": email, "password": "secret123", "prenom": prenom, "role": role})
    assert r.status_code == 200, r.text
    d = r.json()
    CREATED["users"].append(d["user"]["id"])
    return email, d["token"], d


def _h(tok):
    return {"Authorization": f"Bearer {tok}"}


def _payload(**kw):
    p = {"titre": "TEST_Collecte", "lieu": "TEST plage", "commune": "Brest", "point_rdv": "Parking",
         "lat": 48.39, "lng": -4.43, "date": (date.today() + timedelta(days=20)).isoformat(),
         "heure_debut": "09:00", "heure_fin": "11:00", "places": 2,
         "materiel_fourni": "Gants", "materiel_a_apporter": "Bottes"}
    p.update(kw)
    return p


@pytest.fixture(scope="module")
def orga():
    return _register("organisateur", "TEST_Orga")


@pytest.fixture(scope="module")
def ramasseur():
    return _register("ramasseur", "TEST_Ram")


# --- Auth (#2)
class TestAuth:
    def test_register_returns_token_and_user(self):
        email, tok, d = _register()
        assert d["user"]["email"] == email and d["user"]["role"] == "ramasseur"
        assert d["welcome_email_sent"] is False
        assert "password_hash" not in d["user"]
        me = requests.get(f"{API}/auth/me", headers=_h(tok))
        assert me.status_code == 200 and me.json()["email"] == email

    def test_duplicate_email_409(self, ramasseur):
        r = requests.post(f"{API}/auth/register", json={"email": ramasseur[0].upper(), "password": "secret123", "prenom": "X"})
        assert r.status_code == 409

    def test_register_validation(self):
        r = requests.post(f"{API}/auth/register", json={"email": "bad", "password": "1", "prenom": ""})
        assert r.status_code == 422

    def test_login_ok_and_bad(self, ramasseur):
        r = requests.post(f"{API}/auth/login", json={"email": ramasseur[0], "password": "secret123"})
        assert r.status_code == 200 and r.json()["user"]["prenom"] == "TEST_Ram"
        r = requests.post(f"{API}/auth/login", json={"email": ramasseur[0], "password": "wrong!!"})
        assert r.status_code == 401

    def test_me_requires_token(self):
        assert requests.get(f"{API}/auth/me").status_code == 401
        assert requests.get(f"{API}/auth/me", headers=_h("garbage")).status_code == 401


# --- List/detail (#4, #6)
class TestList:
    def test_list_future_sorted(self):
        r = requests.get(f"{API}/collectes")
        assert r.status_code == 200
        lst = r.json()
        assert len(lst) >= 3
        today = date.today().isoformat()
        assert all(c["date"] >= today for c in lst)
        keys = [(c["date"], c["heure_debut"]) for c in lst]
        assert keys == sorted(keys)
        assert all("_id" not in c and "inscrits" not in c for c in lst)

    def test_limit_3(self):
        r = requests.get(f"{API}/collectes", params={"limit": 3})
        assert r.status_code == 200 and len(r.json()) == 3

    def test_detail_and_404(self):
        c = requests.get(f"{API}/collectes").json()[0]
        d = requests.get(f"{API}/collectes/{c['id']}").json()
        for k in ("lieu", "heure_debut", "heure_fin", "point_rdv", "materiel_fourni", "places_restantes"):
            assert k in d
        assert requests.get(f"{API}/collectes/does-not-exist").status_code == 404


# --- Publish (#1)
class TestPublish:
    def test_publish_and_appears_in_list(self, orga):
        r = requests.post(f"{API}/collectes", json=_payload(), headers=_h(orga[1]))
        assert r.status_code == 201, r.text
        c = r.json()
        CREATED["collectes"].append(c["id"])
        assert c["places_restantes"] == 2 and c["est_organisateur"] is True and c["organisateur_prenom"] == "TEST_Orga"
        ids = [x["id"] for x in requests.get(f"{API}/collectes").json()]
        assert c["id"] in ids
        g = requests.get(f"{API}/collectes/{c['id']}").json()
        assert g["titre"] == "TEST_Collecte" and g["materiel_a_apporter"] == "Bottes"

    def test_ramasseur_forbidden(self, ramasseur):
        r = requests.post(f"{API}/collectes", json=_payload(), headers=_h(ramasseur[1]))
        assert r.status_code == 403

    def test_no_token_401(self):
        assert requests.post(f"{API}/collectes", json=_payload()).status_code == 401

    def test_past_date_422(self, orga):
        r = requests.post(f"{API}/collectes", json=_payload(date=(date.today() - timedelta(days=2)).isoformat()), headers=_h(orga[1]))
        assert r.status_code == 422

    def test_fin_before_debut_422(self, orga):
        r = requests.post(f"{API}/collectes", json=_payload(heure_debut="12:00", heure_fin="10:00"), headers=_h(orga[1]))
        assert r.status_code == 422
        r = requests.post(f"{API}/collectes", json=_payload(heure_debut="10:00", heure_fin="10:00"), headers=_h(orga[1]))
        assert r.status_code == 422

    def test_bad_fields_422(self, orga):
        r = requests.post(f"{API}/collectes", json=_payload(places=0), headers=_h(orga[1]))
        assert r.status_code == 422
        r = requests.post(f"{API}/collectes", json=_payload(heure_debut="9h"), headers=_h(orga[1]))
        assert r.status_code == 422


# --- Inscription (#7)
class TestInscription:
    def test_flow_until_full(self, orga):
        r = requests.post(f"{API}/collectes", json=_payload(titre="TEST_Inscr"), headers=_h(orga[1]))
        cid = r.json()["id"]
        CREATED["collectes"].append(cid)
        _, t1, _ = _register()
        _, t2, _ = _register()
        _, t3, _ = _register()
        r = requests.post(f"{API}/collectes/{cid}/inscription", headers=_h(t1))
        assert r.status_code == 200 and r.json()["est_inscrit"] and r.json()["places_restantes"] == 1
        # duplicate
        r = requests.post(f"{API}/collectes/{cid}/inscription", headers=_h(t1))
        assert r.status_code == 409 and "déjà" in r.json()["detail"]
        r = requests.post(f"{API}/collectes/{cid}/inscription", headers=_h(t2))
        assert r.status_code == 200 and r.json()["complet"] is True
        r = requests.post(f"{API}/collectes/{cid}/inscription", headers=_h(t3))
        assert r.status_code == 409 and r.json()["detail"] == "Inscription refusée : la collecte est complète"
        g = requests.get(f"{API}/collectes/{cid}", headers=_h(t1)).json()
        assert g["inscrits_count"] == 2 and g["est_inscrit"] is True

    def test_seed_full_collecte_refused(self, ramasseur):
        lst = requests.get(f"{API}/collectes").json()
        full = [c for c in lst if c["titre"].startswith("Port de commerce")]
        assert full, "seed full collecte missing"
        assert full[0]["complet"] is True
        r = requests.post(f"{API}/collectes/{full[0]['id']}/inscription", headers=_h(ramasseur[1]))
        assert r.status_code == 409 and "complète" in r.json()["detail"]

    def test_inscription_requires_auth_and_404(self, ramasseur):
        c = requests.get(f"{API}/collectes").json()[0]
        assert requests.post(f"{API}/collectes/{c['id']}/inscription").status_code == 401
        assert requests.post(f"{API}/collectes/nope/inscription", headers=_h(ramasseur[1])).status_code == 404


def teardown_module(module):
    with open("/tmp/rade_created_ids.txt", "a") as f:
        for k, ids in CREATED.items():
            for i in ids:
                f.write(f"{k} {i}\n")
