-- =====================================================================
-- IAFAM Jobs — Esquema de base de datos PostgreSQL (producción / Supabase)
--
-- Es la versión "hermana" de schema.sql (SQLite). El modelo de datos es
-- el mismo; cambian los tipos y alguna sintaxis:
--   SQLite                      PostgreSQL
--   INTEGER PRIMARY KEY AUTOINCREMENT  →  SERIAL PRIMARY KEY
--   TEXT NOT NULL DEFAULT (datetime('now'))  →  TIMESTAMPTZ DEFAULT now()
--   INTEGER (0/1)                →  BOOLEAN
--   INSERT OR IGNORE             →  INSERT ... ON CONFLICT DO NOTHING
--   datetime('now')              →  now() / CURRENT_TIMESTAMP
--
-- Para aplicarlo en Supabase: (lo hace database.py al arrancar si hay
-- DATABASE_URL, o manualmente en el SQL Editor del panel de Supabase).
-- =====================================================================

-- ---------------------------------------------------------------------
-- CATEGORÍAS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS categories (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- SKILLS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS skills (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- LOCATIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS locations (
    id          SERIAL PRIMARY KEY,
    country     TEXT,
    city        TEXT,
    region      TEXT,
    UNIQUE (country, city)
);

-- ---------------------------------------------------------------------
-- USERS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id                SERIAL PRIMARY KEY,
    name              TEXT NOT NULL,
    email             TEXT NOT NULL UNIQUE,
    password_hash     TEXT NOT NULL,
    role              TEXT NOT NULL DEFAULT 'USER'
                      CHECK (role IN ('USER', 'ADMIN')),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    career            TEXT,
    university        TEXT,
    graduation_year   INTEGER,
    experience_level  TEXT
                      CHECK (experience_level IN
                        ('INTERNSHIP','JUNIOR','MID','SENIOR')),
    preferred_mode    TEXT
                      CHECK (preferred_mode IN ('REMOTE','HYBRID','ON_SITE')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
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
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT,
    website     TEXT,
    logo_url    TEXT,
    location_id INTEGER REFERENCES locations(id) ON DELETE SET NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- SOURCES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS sources (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL
                CHECK (type IN ('MANUAL','API','RSS','WEB','UNIVERSITY','IMPORT')),
    url         TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- JOBS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jobs (
    id                  SERIAL PRIMARY KEY,
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
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS jobs_status_idx           ON jobs (status);
CREATE INDEX IF NOT EXISTS jobs_category_id_idx      ON jobs (category_id);
CREATE INDEX IF NOT EXISTS jobs_publication_date_idx ON jobs (publication_date DESC);
CREATE INDEX IF NOT EXISTS jobs_company_id_idx       ON jobs (company_id);

-- ---------------------------------------------------------------------
-- JOB_SKILLS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_skills (
    job_id    INTEGER NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
    skill_id  INTEGER NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (job_id, skill_id)
);

-- ---------------------------------------------------------------------
-- JOB_SOURCES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS job_sources (
    job_id     INTEGER NOT NULL REFERENCES jobs(id)   ON DELETE CASCADE,
    source_id  INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    url        TEXT,
    PRIMARY KEY (job_id, source_id)
);

-- ---------------------------------------------------------------------
-- FAVORITES
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS favorites (
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id      INTEGER NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, job_id)
);

-- ---------------------------------------------------------------------
-- APPLICATIONS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS applications (
    id          SERIAL PRIMARY KEY,
    user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    job_id      INTEGER NOT NULL REFERENCES jobs(id)  ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'APPLIED'
                CHECK (status IN ('APPLIED','INTERVIEW','ACCEPTED','REJECTED')),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, job_id)
);

-- ---------------------------------------------------------------------
-- ALERTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alerts (
    id                SERIAL PRIMARY KEY,
    user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name              TEXT,
    category_id       INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    experience_level  TEXT
                      CHECK (experience_level IN ('INTERNSHIP','JUNIOR','MID','SENIOR')),
    work_mode         TEXT
                      CHECK (work_mode IN ('REMOTE','HYBRID','ON_SITE')),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------
-- ALERT_SKILLS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS alert_skills (
    alert_id  INTEGER NOT NULL REFERENCES alerts(id)  ON DELETE CASCADE,
    skill_id  INTEGER NOT NULL REFERENCES skills(id)  ON DELETE CASCADE,
    PRIMARY KEY (alert_id, skill_id)
);

-- ---------------------------------------------------------------------
-- REPORTS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS reports (
    id          SERIAL PRIMARY KEY,
    job_id      INTEGER NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
    reason      TEXT NOT NULL
                CHECK (reason IN ('FAKE','DUPLICATE','EXPIRED','INCORRECT','BROKEN_LINK')),
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TEXT,
    resolved_by INTEGER REFERENCES users(id) ON DELETE SET NULL
);

-- =====================================================================
-- DATOS INICIALES (SEED)
-- =====================================================================

INSERT INTO categories (name, slug) VALUES
    ('Desarrollo',             'desarrollo'),
    ('Datos',                  'datos'),
    ('QA',                     'qa'),
    ('Diseño',                 'diseno'),
    ('Infraestructura',        'infraestructura'),
    ('Seguridad',              'seguridad'),
    ('Inteligencia Artificial','inteligencia-artificial'),
    ('Bioinformática',         'bioinformatica')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO skills (name, slug) VALUES
    ('Python',           'python'),
    ('SQL',              'sql'),
    ('JavaScript',       'javascript'),
    ('Docker',           'docker'),
    ('React',            'react'),
    ('PostgreSQL',       'postgresql'),
    ('Django',           'django'),
    ('Flask',            'flask'),
    ('Data Analysis',    'data-analysis'),
    ('Machine Learning', 'machine-learning')
ON CONFLICT (slug) DO NOTHING;

-- =====================================================================
-- FIN DEL ESQUEMA
-- =====================================================================