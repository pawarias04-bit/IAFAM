-- =====================================================================
-- IAFAM Jobs — Esquema de base de datos SQLite  (MVP dev)
--
-- ELEGIDO A PROPÓSITO: SQLite para desarrollo (cero instalación, la app
-- corre al instante). El mismo SQL funciona en PostgreSQL en producción
-- con cambios mínimos (comentados en el archivo schema_postgres.sql).
--
-- Para crear la BD: se ejecuta desde Python (ver database.py del backend)
-- o con:
--   sqlite3 data.db < schema.sql
-- =====================================================================

-- ---------------------------------------------------------------------
-- CATEGORÍAS  (ej: Desarrollo, Datos, QA, Diseño, Infra, Seguridad, IA)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- SKILLS  (catálogo de tecnologías, ej: Python, SQL, Docker)
-- N:M con jobs mediante la tabla puente job_skills.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- LOCATIONS  (país + ciudad en una fila por ahora)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    country     TEXT,
    city        TEXT,
    region      TEXT,
    UNIQUE (country, city)
);

-- ---------------------------------------------------------------------
-- USERS  (la contraseña SOLO se guarda como hash, nunca en claro)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    name              TEXT NOT NULL,
    email             TEXT NOT NULL UNIQUE,
    password_hash     TEXT NOT NULL,
    role              TEXT NOT NULL DEFAULT 'USER'
                      CHECK (role IN ('USER', 'ADMIN')),
    is_active         INTEGER NOT NULL DEFAULT 1,
    career            TEXT,
    university        TEXT,
    graduation_year   INTEGER,
    experience_level  TEXT
                      CHECK (experience_level IN
                        ('INTERNSHIP','JUNIOR','MID','SENIOR')),
    preferred_mode    TEXT
                      CHECK (preferred_mode IN ('REMOTE','HYBRID','ON_SITE')),
    created_at        TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- USER_SKILLS  (tabla puente N:M usuarios <-> skills)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_skills (
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id  INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, skill_id)
);

-- ---------------------------------------------------------------------
-- COMPANIES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS companies (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT,
    website     TEXT,
    logo_url    TEXT,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- SOURCES  (F2, pero ya en el esquema)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sources (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL
                CHECK (type IN ('MANUAL','API','RSS','WEB','UNIVERSITY','IMPORT')),
    url         TEXT,
    is_active   INTEGER NOT NULL DEFAULT 1,
    created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- JOBS  (la tabla más importante: cada fila = una oferta)
-- Los CHECK limitan los valores válidos de status, work_mode, etc.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    company_id          INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
    category_id         INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    location_id         INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    employment_type     TEXT
                        CHECK (employment_type IN
                          ('FULL_TIME','PART_TIME','INTERNSHIP','FREELANCE','CONTRACT')),
    work_mode           TEXT
                        CHECK (work_mode IN ('REMOTE','HYBRID','ON_SITE')),
    experience_level    TEXT
                        CHECK (experience_level IN ('INTERNSHIP','JUNIOR','MID','SENIOR')),
    salary_min          REAL,
    salary_max          REAL,
    currency            TEXT,
    publication_date    TEXT,
    deadline            TEXT,
    status              TEXT NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN
                          ('DRAFT','PENDING_REVIEW','ACTIVE','EXPIRED','CLOSED','REJECTED')),
    verification_status TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (verification_status IN ('VERIFIED','PENDING','REPORTED')),
    verified_at         TEXT,
    verified_by         INTEGER REFERENCES users(id) ON DELETE SET NULL,
    contact_email       TEXT,
    contact_phone       TEXT,
    apply_url           TEXT,
    original_text       TEXT,
    original_url        TEXT,
    created_at          TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at          TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Índices: aceleran las búsquedas más frecuentes.
CREATE INDEX IF NOT EXISTS jobs_status_idx           ON jobs (status);
CREATE INDEX IF NOT EXISTS jobs_category_id_idx      ON jobs (category_id);
CREATE INDEX IF NOT EXISTS jobs_publication_date_idx ON jobs (publication_date DESC);
CREATE INDEX IF NOT EXISTS jobs_company_id_idx       ON jobs (company_id);

-- ---------------------------------------------------------------------
-- JOB_SKILLS  (tabla puente N:M jobs <-> skills)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_skills (
    job_id    INTEGER NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
    skill_id  INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (job_id, skill_id)
);

-- ---------------------------------------------------------------------
-- JOB_SOURCES  (N:M jobs <-> sources)  [F2]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_sources (
    job_id     INTEGER NOT NULL REFERENCES jobs(id)   ON DELETE CASCADE,
    source_id  INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    url        TEXT,
    PRIMARY KEY (job_id, source_id)
);

-- ---------------------------------------------------------------------
-- FAVORITES  (N:M users <-> jobs)  → "guardar oferta"
-- PRIMARY KEY (user_id, job_id) impide guardar la misma oferta 2 veces.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id      INTEGER NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (user_id, job_id)
);

-- ---------------------------------------------------------------------
-- APPLICATIONS  (postulaciones)  [F2]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id      INTEGER NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'APPLIED'
                CHECK (status IN ('APPLIED','INTERVIEW','ACCEPTED','REJECTED')),
    notes       TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE (user_id, job_id)
);

-- ---------------------------------------------------------------------
-- ALERTS  [F2]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              TEXT,
    category_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    experience_level  TEXT
                      CHECK (experience_level IN ('INTERNSHIP','JUNIOR','MID','SENIOR')),
    work_mode         TEXT
                      CHECK (work_mode IN ('REMOTE','HYBRID','ON_SITE')),
    is_active         INTEGER NOT NULL DEFAULT 1,
    created_at        TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ---------------------------------------------------------------------
-- ALERT_SKILLS  (N:M alerts <-> skills)  [F2]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_skills (
    alert_id  INTEGER NOT NULL REFERENCES alerts(id)  ON DELETE CASCADE,
    skill_id  INTEGER NOT NULL REFERENCES skills(id)  ON DELETE CASCADE,
    PRIMARY KEY (alert_id, skill_id)
);

-- ---------------------------------------------------------------------
-- REPORTS  [F2]
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason      TEXT NOT NULL
                CHECK (reason IN ('FAKE','DUPLICATE','EXPIRED','INCORRECT','BROKEN_LINK')),
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    resolved_at TEXT,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================================
-- DATOS INICIALES (SEED): para arrancar con contenido de ejemplo.
-- =====================================================================

INSERT OR IGNORE INTO categories (name, slug) VALUES
    ('Desarrollo',             'desarrollo'),
    ('Datos',                  'datos'),
    ('QA',                     'qa'),
    ('Diseño',                 'diseno'),
    ('Infraestructura',        'infraestructura'),
    ('Seguridad',              'seguridad'),
    ('Inteligencia Artificial','inteligencia-artificial'),
    ('Bioinformática',         'bioinformatica');

INSERT OR IGNORE INTO skills (name, slug) VALUES
    ('Python',           'python'),
    ('SQL',              'sql'),
    ('JavaScript',       'javascript'),
    ('Docker',           'docker'),
    ('React',            'react'),
    ('PostgreSQL',       'postgresql'),
    ('Django',           'django'),
    ('Flask',            'flask'),
    ('Data Analysis',    'data-analysis'),
    ('Machine Learning', 'machine-learning');

-- =====================================================================
-- FIN DEL ESQUEMA
-- =====================================================================
