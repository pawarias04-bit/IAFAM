"""Tests del backend de IAFAM Jobs.

Cómo se ejecutan:
    .\.venv\Scripts\python -m pytest tests\test_app.py -q

Cada test usa una base de datos temporal ÚNICA (tmp_path de pytest) para
que ningún test dependa de otro. Así evitamos errores de "duplicado"
entre pruebas.
"""
import sys
from pathlib import Path

# Asegurarse de que se puedan importar los módulos del backend
BACKEND = Path(__file__).resolve().parent.parent / "backend"
sys.path.insert(0, str(BACKEND))

import pytest  # noqa: E402


@pytest.fixture()
def app(tmp_path):
    from config import Config
    from database import create_tables
    from app import app as flask_app

    # Base de datos temporal única para ESTE test
    Config.DATABASE_PATH = str(tmp_path / "test.db")

    flask_app.config.update(TESTING=True)
    create_tables()
    yield flask_app


@pytest.fixture()
def client(app):
    return app.test_client()


@pytest.fixture()
def admin_token(client):
    r = client.post("/api/auth/login", json={
        "email": "admin@iafam.dev", "password": "admin1234",
    })
    return r.get_json()["data"]["token"]


def _register(client, email="paulo@test.com", password="secreto123"):
    return client.post("/api/auth/register", json={
        "name": "Paulo", "email": email, "password": password,
    })


def _create_company(client, token, name="TechCorp"):
    return client.post("/api/admin/companies", json={"name": name},
                       headers={"Authorization": f"Bearer {token}"})


def _create_job(client, token, company_id, **extra):
    data = {
        "title": "Python Junior",
        "description": "Buscamos desarrollador junior",
        "company_id": company_id,
        "experience_level": "JUNIOR",
        "work_mode": "REMOTE",
        "employment_type": "FULL_TIME",
        "status": "ACTIVE",
    }
    data.update(extra)
    return client.post("/api/admin/jobs", json=data,
                       headers={"Authorization": f"Bearer {token}"})


# =====================================================================
# REGISTRO Y AUTENTICACIÓN
# =====================================================================

def test_register_ok(client):
    r = _register(client)
    assert r.status_code == 201
    assert "token" in r.get_json()["data"]
    assert r.get_json()["data"]["user"]["role"] == "USER"


def test_register_duplicate_email(client):
    _register(client)
    r = _register(client)
    assert r.status_code == 409


def test_register_short_password(client):
    r = _register(client, password="corta")
    assert r.status_code == 400


def test_login_ok(client):
    _register(client)
    r = client.post("/api/auth/login", json={
        "email": "paulo@test.com", "password": "secreto123"})
    assert r.status_code == 200
    assert "token" in r.get_json()["data"]


def test_login_wrong_password(client):
    _register(client)
    r = client.post("/api/auth/login", json={
        "email": "paulo@test.com", "password": "incorrecta1"})
    assert r.status_code == 401


def test_admin_can_access_me(client, admin_token):
    r = client.get("/api/auth/me",
                   headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.get_json()["data"]["role"] == "ADMIN"


def test_no_token_gets_401(client):
    r = client.get("/api/auth/me")
    assert r.status_code == 401


def test_user_cannot_access_admin(client):
    _register(client)
    login = client.post("/api/auth/login", json={
        "email": "paulo@test.com", "password": "secreto123"})
    token = login.get_json()["data"]["token"]
    r = client.get("/api/admin/jobs",
                   headers={"Authorization": f"Bearer {token}"})
    assert r.status_code == 403


# =====================================================================
# OFERTAS PÚBLICAS
# =====================================================================

def test_list_jobs_empty(client):
    r = client.get("/api/jobs")
    assert r.status_code == 200
    assert r.get_json()["data"] == []
    assert r.get_json()["meta"]["total"] == 0


def test_public_only_sees_active_jobs(client, admin_token):
    cid = _create_company(client, admin_token).get_json()["data"]["id"]
    _create_job(client, admin_token, cid, status="ACTIVE")
    _create_job(client, admin_token, cid, status="DRAFT")

    r = client.get("/api/jobs")
    jobs = r.get_json()["data"]
    assert len(jobs) == 1
    assert jobs[0]["title"] == "Python Junior"


def test_search_by_text(client, admin_token):
    cid = _create_company(client, admin_token).get_json()["data"]["id"]
    _create_job(client, admin_token, cid, title="Data Analyst")
    r = client.get("/api/jobs?q=Data")
    assert r.get_json()["meta"]["total"] == 1


def test_filter_by_level(client, admin_token):
    cid = _create_company(client, admin_token).get_json()["data"]["id"]
    _create_job(client, admin_token, cid, experience_level="JUNIOR")
    _create_job(client, admin_token, cid, experience_level="SENIOR",
                title="Senior Dev")
    r = client.get("/api/jobs?level=JUNIOR")
    assert r.get_json()["meta"]["total"] == 1
    assert r.get_json()["data"][0]["experience_level"] == "JUNIOR"


def test_invalid_level_rejected(client):
    r = client.get("/api/jobs?level=GOD")
    assert r.status_code == 400


def test_job_detail_not_found(client):
    r = client.get("/api/jobs/9999")
    assert r.status_code == 404


# =====================================================================
# CRUD ADMIN
# =====================================================================

def test_create_job_ok(client, admin_token):
    cid = _create_company(client, admin_token).get_json()["data"]["id"]
    r = _create_job(client, admin_token, cid, skill_ids=[1, 2])
    assert r.status_code == 201
    job = r.get_json()["data"]
    assert job["skills"] == ["Python", "SQL"]


def test_create_job_requires_company(client, admin_token):
    r = _create_job(client, admin_token, company_id=None)
    assert r.status_code == 400


def test_update_job_status(client, admin_token):
    cid = _create_company(client, admin_token).get_json()["data"]["id"]
    jid = _create_job(client, admin_token, cid).get_json()["data"]["id"]
    r = client.patch(f"/api/admin/jobs/{jid}/status", json={"status": "CLOSED"},
                     headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    assert r.get_json()["data"]["status"] == "CLOSED"


def test_delete_job(client, admin_token):
    cid = _create_company(client, admin_token).get_json()["data"]["id"]
    jid = _create_job(client, admin_token, cid).get_json()["data"]["id"]
    r = client.delete(f"/api/admin/jobs/{jid}",
                      headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    # Al borrarse, el público ya no la ve
    r2 = client.get(f"/api/jobs/{jid}")
    assert r2.status_code == 404


# =====================================================================
# FAVORITOS
# =====================================================================

def test_add_and_list_favorite(client):
    _register(client)
    login = client.post("/api/auth/login", json={
        "email": "paulo@test.com", "password": "secreto123"})
    token = login.get_json()["data"]["token"]
    headers = {"Authorization": f"Bearer {token}"}

    # login admin para crear empresa y oferta
    r = client.post("/api/auth/login", json={
        "email": "admin@iafam.dev", "password": "admin1234"})
    atok = r.get_json()["data"]["token"]
    aheaders = {"Authorization": f"Bearer {atok}"}
    cid = _create_company(client, atok).get_json()["data"]["id"]
    jid = _create_job(client, atok, cid).get_json()["data"]["id"]

    r = client.post(f"/api/jobs/{jid}/favorite", headers=headers)
    assert r.status_code == 201

    r = client.get("/api/favorites", headers=headers)
    assert len(r.get_json()["data"]) == 1
    assert r.get_json()["data"][0]["id"] == jid

    # Quitar favorito
    r = client.delete(f"/api/jobs/{jid}/favorite", headers=headers)
    assert r.status_code == 200
    r = client.get("/api/favorites", headers=headers)
    assert r.get_json()["data"] == []


def test_favorite_requires_auth(client, admin_token):
    cid = _create_company(client, admin_token).get_json()["data"]["id"]
    jid = _create_job(client, admin_token, cid).get_json()["data"]["id"]
    r = client.post(f"/api/jobs/{jid}/favorite")
    assert r.status_code == 401


# =====================================================================
# ESTADÍSTICAS ADMIN
# =====================================================================

def test_admin_stats(client, admin_token):
    r = client.get("/api/admin/stats",
                   headers={"Authorization": f"Bearer {admin_token}"})
    assert r.status_code == 200
    data = r.get_json()["data"]
    assert "total_jobs" in data
    assert "active_jobs" in data
    assert "total_users" in data


def test_company_duplicate_rejected(client, admin_token):
    _create_company(client, admin_token)
    r = _create_company(client, admin_token)
    assert r.status_code == 409