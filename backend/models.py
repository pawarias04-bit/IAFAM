"""Capa de acceso a datos: TODAS las consultas SQL viven aquí.

POR QUÉ TE SEPARAMOS ESTO (Paulo):
- routes.py (la API) DEBERÍA ser esbelta: recibe peticiones, valida y
  responde JSON.
- models.py (los datos) es donde vive el SQL: consultar/insertar/actualizar.

Así, si un día cambia la base de datos o una consulta, solo tocas este
archivo sin romper la API. Es un patrón ("repository") que verás en
muchos proyectos profesionales.

Fíjate que SIEMPRE usamos `?` (placeholders) en el SQL. NUNCA
interpolamos valores con f-strings dentro del SQL. Eso evita la
"Inyección SQL", un ataque donde el usuario mete código SQL en un campo.
"""
from database import get_connection


# =====================================================================
# USUARIOS
# =====================================================================

def find_user_by_email(email: str):
    conn = get_connection()
    row = conn.execute(
        "SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    conn.close()
    return dict(row) if row else None


def find_user_by_id(user_id: int):
    conn = get_connection()
    row = conn.execute(
        "SELECT id, name, email, role, is_active, career, university, "
        "graduation_year, experience_level, preferred_mode, created_at "
        "FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return dict(row) if row else None


def create_user(name: str, email: str, password_hash: str, role="USER",
                career=None):
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO users (name, email, password_hash, role, career) "
        "VALUES (?, ?, ?, ?, ?)",
        (name, email, password_hash, role, career))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id


def update_profile(user_id: int, fields: dict):
    """Actualiza solo los campos permitidos y no vacíos del perfil."""
    allowed = ["name", "career", "university", "graduation_year",
               "experience_level", "preferred_mode"]
    sets, values = [], []
    for key in allowed:
        if key in fields and fields[key] not in (None, ""):
            sets.append(f"{key} = ?")
            values.append(fields[key])
    if not sets:
        return
    values.append(user_id)
    conn = get_connection()
    conn.execute(
        f"UPDATE users SET {', '.join(sets)}, updated_at = "
        f"datetime('now') WHERE id = ?", values)
    conn.commit()
    conn.close()


# =====================================================================
# CATEGORÍAS Y SKILLS
# =====================================================================

def list_categories():
    conn = get_connection()
    rows = conn.execute("SELECT id, name, slug FROM categories "
                        "ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def list_skills():
    conn = get_connection()
    rows = conn.execute("SELECT id, name, slug FROM skills "
                        "ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def create_category(name: str, slug: str):
    conn = get_connection()
    cur = conn.execute("INSERT INTO categories (name, slug) VALUES (?, ?)",
                       (name, slug))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id


def create_skill(name: str, slug: str, category_id=None):
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO skills (name, slug, category_id) VALUES (?, ?, ?)",
        (name, slug, category_id))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id


# =====================================================================
# EMPRESAS
# =====================================================================

def list_companies():
    conn = get_connection()
    rows = conn.execute("SELECT * FROM companies WHERE is_active = 1 "
                        "ORDER BY name").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def find_company_by_name(name: str):
    conn = get_connection()
    row = conn.execute("SELECT * FROM companies WHERE lower(name) = lower(?)",
                       (name,)).fetchone()
    conn.close()
    return dict(row) if row else None


def create_company(name: str, slug: str, website=None, description=None,
                   location_id=None):
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO companies (name, slug, website, description, "
        "location_id) VALUES (?, ?, ?, ?, ?)",
        (name, slug, website, description, location_id))
    conn.commit()
    new_id = cur.lastrowid
    conn.close()
    return new_id


# =====================================================================
# OFERTAS (JOBS)
# =====================================================================

def list_jobs_public(filters: dict, page: int, per_page: int):
    """Lista de ofertas ACTIVAS visibles para el público, con filtros.

    Construimos la cláusula WHERE dinámicamente según los filtros que el
    usuario haya elegido (búsqueda, categoría, nivel, modalidad, tipo).
    """
    where = ["j.status = 'ACTIVE'"]
    params = []

    q = (filters.get("q") or "").strip()
    if q:
        # Busca en título, descripción, empresa y skills
        where.append("(j.title LIKE ? OR j.description LIKE ? OR "
                     "c.name LIKE ?)")
        like = f"%{q}%"
        params += [like, like, like]

    if filters.get("category_id"):
        where.append("j.category_id = ?")
        params.append(int(filters["category_id"]))

    if filters.get("level"):
        where.append("j.experience_level = ?")
        params.append(filters["level"])

    if filters.get("mode"):
        where.append("j.work_mode = ?")
        params.append(filters["mode"])

    if filters.get("type"):
        where.append("j.employment_type = ?")
        params.append(filters["type"])

    where_sql = " AND ".join(where)
    offset = (page - 1) * per_page

    conn = get_connection()

    # 1) Cuenta total (para la paginación)
    total = conn.execute(
        f"SELECT COUNT(*) AS n FROM jobs j "
        f"LEFT JOIN companies c ON c.id = j.company_id "
        f"WHERE {where_sql}", params).fetchone()["n"]

    # 2) Página actual de ofertas (con datos de empresa y categoría)
    rows = conn.execute(
        f"SELECT j.*, c.name AS company_name, cat.name AS category_name "
        f"FROM jobs j "
        f"LEFT JOIN companies c ON c.id = j.company_id "
        f"LEFT JOIN categories cat ON cat.id = j.category_id "
        f"WHERE {where_sql} ORDER BY j.publication_date DESC "
        f"LIMIT ? OFFSET ?", params + [per_page, offset]).fetchall()
    conn.close()

    jobs = [dict(r) for r in rows]
    for job in jobs:
        # Cada oferta trae sus skills como lista de nombres
        job["skills"] = list_job_skills(job["id"])

    return jobs, total


def get_job_public(job_id: int):
    """Detalle de una oferta activa (solo si es pública)."""
    conn = get_connection()
    row = conn.execute(
        "SELECT j.*, c.name AS company_name, cat.name AS category_name "
        "FROM jobs j "
        "LEFT JOIN companies c ON c.id = j.company_id "
        "LEFT JOIN categories cat ON cat.id = j.category_id "
        "WHERE j.id = ? AND j.status = 'ACTIVE'", (job_id,)).fetchone()
    conn.close()
    if not row:
        return None
    job = dict(row)
    job["skills"] = list_job_skills(job_id)
    return job


def list_job_skills(job_id: int) -> list:
    conn = get_connection()
    rows = conn.execute(
        "SELECT s.name FROM job_skills js "
        "JOIN skills s ON s.id = js.skill_id "
        "WHERE js.job_id = ? ORDER BY s.name", (job_id,)).fetchall()
    conn.close()
    return [r["name"] for r in rows]


def set_job_skills(job_id: int, skill_ids: list):
    """Sobrescribe la lista de skills de una oferta."""
    conn = get_connection()
    conn.execute("DELETE FROM job_skills WHERE job_id = ?", (job_id,))
    for sid in skill_ids:
        conn.execute("INSERT OR IGNORE INTO job_skills (job_id, skill_id) "
                     "VALUES (?, ?)", (job_id, sid))
    conn.commit()
    conn.close()


# ---------------------------------------------------------------------
# ADMIN: todas las ofertas (cualquier estado) + CRUD
# ---------------------------------------------------------------------

def list_jobs_admin():
    conn = get_connection()
    rows = conn.execute(
        "SELECT j.*, c.name AS company_name, cat.name AS category_name "
        "FROM jobs j "
        "LEFT JOIN companies c ON c.id = j.company_id "
        "LEFT JOIN categories cat ON cat.id = j.category_id "
        "ORDER BY j.created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def get_job_admin(job_id: int):
    conn = get_connection()
    row = conn.execute(
        "SELECT j.*, c.name AS company_name, cat.name AS category_name "
        "FROM jobs j "
        "LEFT JOIN companies c ON c.id = j.company_id "
        "LEFT JOIN categories cat ON cat.id = j.category_id "
        "WHERE j.id = ?", (job_id,)).fetchone()
    conn.close()
    if not row:
        return None
    job = dict(row)
    job["skills"] = list_job_skills(job_id)
    return job


def create_job(data: dict, creator_id: int):
    """Inserta una oferta. `data` ya viene validado por routes.py."""
    conn = get_connection()
    cur = conn.execute(
        "INSERT INTO jobs (title, description, company_id, category_id, "
        "location_id, employment_type, work_mode, experience_level, "
        "salary_min, salary_max, currency, publication_date, deadline, "
        "status, verification_status, contact_email, contact_phone, "
        "apply_url, original_text, original_url, verified_by) "
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        (data["title"], data["description"], data["company_id"],
         data.get("category_id"), data.get("location_id"),
         data.get("employment_type"), data.get("work_mode"),
         data.get("experience_level"), data.get("salary_min"),
         data.get("salary_max"), data.get("currency"),
         data.get("publication_date"), data.get("deadline"),
         data.get("status", "DRAFT"), data.get("verification_status", "PENDING"),
         data.get("contact_email"), data.get("contact_phone"),
         data.get("apply_url"), data.get("original_text"),
         data.get("original_url"), creator_id))
    conn.commit()
    new_id = cur.lastrowid

    # Asociar skills si vienen en el payload
    if data.get("skill_ids"):
        set_job_skills(new_id, data["skill_ids"])

    conn.close()
    return new_id


def update_job(job_id: int, data: dict):
    """Actualiza los campos de una oferta que vengan en `data`."""
    allowed = ["title", "description", "company_id", "category_id",
               "location_id", "employment_type", "work_mode",
               "experience_level", "salary_min", "salary_max", "currency",
               "publication_date", "deadline", "status",
               "verification_status", "contact_email", "contact_phone",
               "apply_url"]
    sets, values = [], []
    for key in allowed:
        if key in data:
            sets.append(f"{key} = ?")
            values.append(data[key])
    if not sets:
        return
    values.append(job_id)
    conn = get_connection()
    conn.execute(
        f"UPDATE jobs SET {', '.join(sets)}, updated_at = datetime('now') "
        f"WHERE id = ?", values)

    if data.get("skill_ids") is not None:
        set_job_skills(job_id, data["skill_ids"])

    conn.commit()
    conn.close()


def delete_job(job_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM jobs WHERE id = ?", (job_id,))
    conn.commit()
    conn.close()
    # ON DELETE CASCADE borra job_skills, favorites, etc. de forma
    # automática (por eso activamos foreign_keys = ON).


# =====================================================================
# FAVORITOS
# =====================================================================

def add_favorite(user_id: int, job_id: int):
    conn = get_connection()
    conn.execute("INSERT OR IGNORE INTO favorites (user_id, job_id) "
                 "VALUES (?, ?)", (user_id, job_id))
    conn.commit()
    conn.close()


def remove_favorite(user_id: int, job_id: int):
    conn = get_connection()
    conn.execute("DELETE FROM favorites WHERE user_id = ? AND job_id = ?",
                 (user_id, job_id))
    conn.commit()
    conn.close()


def list_favorites(user_id: int):
    conn = get_connection()
    rows = conn.execute(
        "SELECT j.id, j.title, c.name AS company_name "
        "FROM favorites f "
        "JOIN jobs j ON j.id = f.job_id "
        "LEFT JOIN companies c ON c.id = j.company_id "
        "WHERE f.user_id = ? ORDER BY f.created_at DESC", (user_id,)).fetchall()
    conn.close()
    return [dict(r) for r in rows]


# =====================================================================
# ESTADÍSTICAS DEL DASHBOARD ADMIN
# =====================================================================

def admin_stats():
    conn = get_connection()
    total = conn.execute("SELECT COUNT(*) FROM jobs").fetchone()[0]
    active = conn.execute(
        "SELECT COUNT(*) FROM jobs WHERE status = 'ACTIVE'").fetchone()[0]
    pending = conn.execute(
        "SELECT COUNT(*) FROM jobs WHERE status = 'PENDING_REVIEW'").fetchone()[0]
    expired = conn.execute(
        "SELECT COUNT(*) FROM jobs WHERE status = 'EXPIRED'").fetchone()[0]
    reported = conn.execute(
        "SELECT COUNT(*) FROM jobs WHERE verification_status = "
        "'REPORTED'").fetchone()[0]
    users = conn.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    conn.close()
    return {
        "total_jobs": total,
        "active_jobs": active,
        "pending_jobs": pending,
        "expired_jobs": expired,
        "reported_jobs": reported,
        "total_users": users,
    }


def list_users_admin():
    conn = get_connection()
    rows = conn.execute(
        "SELECT id, name, email, role, is_active, created_at "
        "FROM users ORDER BY created_at DESC").fetchall()
    conn.close()
    return [dict(r) for r in rows]


def set_user_active(user_id: int, is_active: bool):
    conn = get_connection()
    conn.execute("UPDATE users SET is_active = ? WHERE id = ?",
                 (1 if is_active else 0, user_id))
    conn.commit()
    conn.close()
