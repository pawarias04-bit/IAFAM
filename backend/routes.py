"""Rutas de la API HTTP.

Este archivo es la "puerta de entrada" del frontend. Cada función
corresponde a un endpoint de la API. Reciben la petición, la validan,
llaman a models.py (donde está el SQL) y devuelven JSON.

Convención de respuesta:
  Éxito  → { "data": ... }
  Error  → { "error": { "code": ..., "message": ... } }
"""
import re

from flask import Blueprint, jsonify, request
from werkzeug.security import check_password_hash

from auth import (generate_token, hash_password, require_admin,
                  require_auth, verify_password)
import models as db

api = Blueprint("api", __name__, url_prefix="/api")

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
SLUG_RE = re.compile(r"^[a-z0-9-]+$")

VALID_LEVELS = {"INTERNSHIP", "JUNIOR", "MID", "SENIOR"}
VALID_MODES = {"REMOTE", "HYBRID", "ON_SITE"}
VALID_TYPES = {"FULL_TIME", "PART_TIME", "INTERNSHIP", "FREELANCE", "CONTRACT"}
VALID_STATUS = {"DRAFT", "PENDING_REVIEW", "ACTIVE", "EXPIRED", "CLOSED", "REJECTED"}
VALID_VERIF = {"VERIFIED", "PENDING", "REPORTED"}


def _err(code, message, status=400):
    return jsonify({"error": {"code": code, "message": message}}), status


# =====================================================================
# AUTENTICACIÓN
# =====================================================================

@api.route("/auth/register", methods=["POST"])
def register():
    try:
        data = request.get_json()
    except Exception:
        return _err("BAD_REQUEST", "JSON inválido")
    if not data:
        return _err("BAD_REQUEST", "Cuerpo vacío")

    name = (data.get("name") or "").strip()
    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    career = data.get("career")

    if not name or not email or not password:
        return _err("VALIDATION", "Nombre, email y contraseña son obligatorios")
    if not EMAIL_RE.match(email):
        return _err("VALIDATION", "Email con formato inválido")
    if len(password) < 8:
        return _err("VALIDATION", "La contraseña debe tener al menos 8 caracteres")
    if db.find_user_by_email(email):
        return _err("EMAIL_TAKEN", "Ese email ya está registrado", 409)

    user_id = db.create_user(name, email, hash_password(password),
                             role="USER", career=career)
    token = generate_token(user_id, "USER")
    return jsonify({"data": {"token": token, "user": db.find_user_by_id(user_id)}}), 201


@api.route("/auth/login", methods=["POST"])
def login():
    try:
        data = request.get_json()
    except Exception:
        return _err("BAD_REQUEST", "JSON inválido")
    if not data:
        return _err("BAD_REQUEST", "Cuerpo vacío")

    email = (data.get("email") or "").strip().lower()
    password = data.get("password") or ""
    user = db.find_user_by_email(email)

    if not user or not verify_password(password, user["password_hash"]):
        return _err("INVALID_CREDENTIALS", "Email o contraseña incorrectos", 401)
    if not user["is_active"]:
        return _err("DISABLED", "Cuenta desactivada", 403)

    token = generate_token(user["id"], user["role"])
    return jsonify({"data": {"token": token, "user": db.find_user_by_id(user["id"])}})


@api.route("/auth/me", methods=["GET"])
@require_auth
def me(user_id, user_role):
    user = db.find_user_by_id(user_id)
    if not user:
        return _err("NOT_FOUND", "Usuario no encontrado", 404)
    return jsonify({"data": user})


# =====================================================================
# PERFIL
# =====================================================================

@api.route("/profile", methods=["GET", "PUT"])
@require_auth
def profile(user_id, user_role):
    if request.method == "GET":
        user = db.find_user_by_id(user_id)
        favorites = db.list_favorites(user_id)
        return jsonify({"data": {"user": user, "favorites": favorites}})

    try:
        data = request.get_json() or {}
    except Exception:
        return _err("BAD_REQUEST", "JSON inválido")
    db.update_profile(user_id, data)
    return jsonify({"data": db.find_user_by_id(user_id)})


# =====================================================================
# CATÁLOGOS PÚBLICOS
# =====================================================================

@api.route("/categories", methods=["GET"])
def categories():
    return jsonify({"data": db.list_categories()})


@api.route("/skills", methods=["GET"])
def skills():
    return jsonify({"data": db.list_skills()})


@api.route("/companies", methods=["GET"])
def companies():
    return jsonify({"data": db.list_companies()})


# =====================================================================
# OFERTAS PÚBLICAS
# =====================================================================

@api.route("/jobs", methods=["GET"])
def list_jobs():
    """GET /api/jobs?q=&category_id=&level=&mode=&type=&page=
    Devuelve la página de ofertas activas + el total para paginar."""
    allowed_filters = ["q", "category_id", "level", "mode", "type"]
    filters = {k: request.args.get(k) for k in allowed_filters
               if request.args.get(k)}

    if filters.get("level") and filters["level"] not in VALID_LEVELS:
        return _err("VALIDATION", f"Nivel inválido. Válidos: {sorted(VALID_LEVELS)}")
    if filters.get("mode") and filters["mode"] not in VALID_MODES:
        return _err("VALIDATION", f"Modalidad inválida. Válidos: {sorted(VALID_MODES)}")
    if filters.get("type") and filters["type"] not in VALID_TYPES:
        return _err("VALIDATION", f"Tipo inválido. Válidos: {sorted(VALID_TYPES)}")

    try:
        page = int(request.args.get("page", 1))
        per_page = int(request.args.get("per_page", 20))
    except ValueError:
        return _err("VALIDATION", "'page' y 'per_page' deben ser enteros")
    if page < 1 or per_page < 1 or per_page > 50:
        return _err("VALIDATION", "Valores de paginación fuera de rango")

    jobs, total = db.list_jobs_public(filters, page, per_page)
    pages = (total + per_page - 1) // per_page
    return jsonify({"data": jobs, "meta": {
        "total": total, "page": page, "per_page": per_page, "pages": pages}})


@api.route("/jobs/<int:job_id>", methods=["GET"])
def get_job(job_id):
    job = db.get_job_public(job_id)
    if not job:
        return _err("NOT_FOUND", "Oferta no encontrada", 404)
    return jsonify({"data": job})


# =====================================================================
# FAVORITOS
# =====================================================================

@api.route("/favorites", methods=["GET"])
@require_auth
def list_favorites(user_id, user_role):
    return jsonify({"data": db.list_favorites(user_id)})


@api.route("/jobs/<int:job_id>/favorite", methods=["POST", "DELETE"])
@require_auth
def toggle_favorite(user_id, user_role, job_id):
    job = db.get_job_admin(job_id)
    if not job:
        return _err("NOT_FOUND", "Oferta no encontrada", 404)
    if request.method == "POST":
        db.add_favorite(user_id, job_id)
        return jsonify({"data": {"favorite": True}}), 201
    db.remove_favorite(user_id, job_id)
    return jsonify({"data": {"favorite": False}})


# =====================================================================
# CATÁLOGOS ADMIN
# =====================================================================

@api.route("/admin/categories", methods=["POST"])
@require_auth
@require_admin
def create_category(user_id, user_role):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    slug = (data.get("slug") or "").strip().lower()
    if not name or not slug:
        return _err("VALIDATION", "name y slug son obligatorios")
    if not SLUG_RE.match(slug):
        return _err("VALIDATION", "slug solo minúsculas, números y guiones")
    try:
        new_id = db.create_category(name, slug)
    except Exception:
        return _err("DUPLICATE", "Ese slug ya existe", 409)
    return jsonify({"data": {"id": new_id}}), 201


@api.route("/admin/skills", methods=["POST"])
@require_auth
@require_admin
def create_skill(user_id, user_role):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    slug = (data.get("slug") or "").strip().lower()
    if not name or not slug:
        return _err("VALIDATION", "name y slug son obligatorios")
    try:
        new_id = db.create_skill(name, slug, data.get("category_id"))
    except Exception:
        return _err("DUPLICATE", "Ese slug ya existe", 409)
    return jsonify({"data": {"id": new_id}}), 201


@api.route("/admin/companies", methods=["POST"])
@require_auth
@require_admin
def create_company(user_id, user_role):
    data = request.get_json() or {}
    name = (data.get("name") or "").strip()
    slug = (data.get("slug") or name.lower().replace(" ", "-")).strip().lower()
    if not name:
        return _err("VALIDATION", "El nombre de la empresa es obligatorio")
    if db.find_company_by_name(name):
        return _err("DUPLICATE", "Esa empresa ya existe", 409)
    new_id = db.create_company(name, slug, data.get("website"),
                               data.get("description"))
    return jsonify({"data": {"id": new_id}}), 201


@api.route("/admin/companies/<int:company_id>", methods=["PUT", "DELETE"])
@require_auth
@require_admin
def manage_company(user_id, user_role, company_id):
    if request.method == "DELETE":
        # Desactivamos la empresa (no la borramos, mejor práctica)
        return jsonify({"error": {"code": "NOT_IMPLEMENTED",
                                  "message": "Desactivar empresa aún no implementado"}}), 501
    return _err("NOT_IMPLEMENTED", "Editar empresa aún no implementado", 501)


# =====================================================================
# OFERTAS ADMIN (CRUD)
# =====================================================================

def _validate_job_payload(data):
    """Valida y normaliza el payload de una oferta. Devuelve (data, error)."""
    title = (data.get("title") or "").strip()
    description = (data.get("description") or "").strip()
    company_id = data.get("company_id")

    if not title:
        return None, "El título es obligatorio"
    if not description:
        return None, "La descripción es obligatoria"
    if not company_id:
        return None, "La empresa es obligatoria"

    # Validar silenciosamente lo que venga, ignorando valores inválidos
    cleaned = {
        "title": title,
        "description": description,
        "company_id": int(company_id),
        "category_id": data.get("category_id"),
        "location_id": data.get("location_id"),
        "employment_type": data.get("employment_type"),
        "work_mode": data.get("work_mode"),
        "experience_level": data.get("experience_level"),
        "salary_min": data.get("salary_min"),
        "salary_max": data.get("salary_max"),
        "currency": data.get("currency"),
        "publication_date": data.get("publication_date"),
        "deadline": data.get("deadline"),
        "status": data.get("status", "DRAFT"),
        "verification_status": data.get("verification_status", "PENDING"),
        "contact_email": data.get("contact_email"),
        "contact_phone": data.get("contact_phone"),
        "apply_url": data.get("apply_url"),
        "skill_ids": data.get("skill_ids") or [],
    }
    # Limpieza: quitar claves None para que update_job no los pise
    cleaned = {k: v for k, v in cleaned.items() if v is not None}

    if cleaned.get("status") not in VALID_STATUS:
        return None, "Estado inválido"
    if cleaned.get("verification_status") not in VALID_VERIF:
        return None, "Estado de verificación inválido"
    if cleaned.get("experience_level") not in VALID_LEVELS:
        cleaned.pop("experience_level", None)
    if cleaned.get("work_mode") not in VALID_MODES:
        cleaned.pop("work_mode", None)
    if cleaned.get("employment_type") not in VALID_TYPES:
        cleaned.pop("employment_type", None)

    return cleaned, None


@api.route("/admin/jobs", methods=["GET", "POST"])
@require_auth
@require_admin
def admin_jobs(user_id, user_role):
    if request.method == "GET":
        return jsonify({"data": db.list_jobs_admin()})

    data = request.get_json() or {}
    cleaned, err = _validate_job_payload(data)
    if err:
        return _err("VALIDATION", err)
    new_id = db.create_job(cleaned, user_id)
    return jsonify({"data": db.get_job_admin(new_id)}), 201


@api.route("/admin/jobs/<int:job_id>", methods=["GET", "PUT", "DELETE"])
@require_auth
@require_admin
def admin_job(user_id, user_role, job_id):
    job = db.get_job_admin(job_id)
    if not job:
        return _err("NOT_FOUND", "Oferta no encontrada", 404)

    if request.method == "GET":
        return jsonify({"data": job})

    if request.method == "DELETE":
        db.delete_job(job_id)
        return jsonify({"data": {"deleted": True}})

    data = request.get_json() or {}
    cleaned, err = _validate_job_payload(data)
    if err:
        return _err("VALIDATION", err)
    db.update_job(job_id, cleaned)
    return jsonify({"data": db.get_job_admin(job_id)})


@api.route("/admin/jobs/<int:job_id>/status", methods=["PATCH"])
@require_auth
@require_admin
def admin_job_status(user_id, user_role, job_id):
    data = request.get_json() or {}
    status = data.get("status")
    if status not in VALID_STATUS:
        return _err("VALIDATION", f"Estado inválido. Válidos: {sorted(VALID_STATUS)}")
    db.update_job(job_id, {"status": status})
    return jsonify({"data": db.get_job_admin(job_id)})


# =====================================================================
# ADMIN GENERAL
# =====================================================================

@api.route("/admin/stats", methods=["GET"])
@require_auth
@require_admin
def admin_stats(user_id, user_role):
    return jsonify({"data": db.admin_stats()})


@api.route("/admin/users", methods=["GET"])
@require_auth
@require_admin
def admin_users(user_id, user_role):
    return jsonify({"data": db.list_users_admin()})


@api.route("/admin/users/<int:target_id>/status", methods=["PATCH"])
@require_auth
@require_admin
def admin_user_status(user_id, user_role, target_id):
    data = request.get_json() or {}
    is_active = data.get("is_active")
    if not isinstance(is_active, bool):
        return _err("VALIDATION", "is_active debe ser true o false")
    if target_id == user_id:
        return _err("VALIDATION", "No puedes desactivarte a ti mismo", 400)
    db.set_user_active(target_id, is_active)
    return jsonify({"data": {"id": target_id, "is_active": is_active}})


# =====================================================================
# HEALTH CHECK
# =====================================================================

@api.route("/health", methods=["GET"])
def health():
    return jsonify({"data": {"status": "ok"}})