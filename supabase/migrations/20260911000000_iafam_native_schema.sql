-- =====================================================================
-- IAFAM Jobs - Esquema nativo de Supabase
--
-- Diferencias con el esquema anterior (Flask + SQLite):
--   * No hay tabla `users` con password_hash. La identidad vive en
--     auth.users (gestionada por Supabase Auth) y los datos de perfil
--     en public.profiles, enlazados por el mismo UUID.
--   * Toda la autorizacion es RLS en la base de datos, no `if` en Python.
--   * Los SERIAL que apuntaban a usuarios pasan a UUID.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. HELPERS
--
-- is_admin() no esta aqui sino justo despues de CREATE TABLE profiles:
-- es una funcion LANGUAGE sql y Postgres valida su cuerpo al crearla,
-- asi que la tabla tiene que existir antes.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 2. PROFILES  (sustituye a la antigua tabla `users`)
-- ---------------------------------------------------------------------
CREATE TABLE public.profiles (
    id                UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email             TEXT,
    name              TEXT NOT NULL DEFAULT '',
    role              TEXT NOT NULL DEFAULT 'USER'
                      CHECK (role IN ('USER', 'ADMIN')),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    career            TEXT,
    university        TEXT,
    graduation_year   INTEGER,
    experience_level  TEXT CHECK (experience_level IN
                        ('INTERNSHIP','JUNIOR','MID','SENIOR')),
    preferred_mode    TEXT CHECK (preferred_mode IN ('REMOTE','HYBRID','ON_SITE')),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- is_admin() es SECURITY DEFINER a proposito: lee profiles saltandose RLS,
-- lo que evita la recursion infinita de una politica sobre profiles que a
-- su vez consultaria profiles.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'ADMIN' AND is_active
  );
$fn$;

-- Cuando Supabase Auth crea un usuario, creamos su perfil automaticamente.
-- El `name` viene de los metadatos que manda signUp(); si no, del email.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NULLIF(NEW.raw_user_meta_data->>'name', ''),
             split_part(NEW.email, '@', 1))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Mantiene profiles.email en sincronia si el usuario cambia su email.
CREATE OR REPLACE FUNCTION public.handle_user_email_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  UPDATE public.profiles SET email = NEW.email WHERE id = NEW.id;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER on_auth_user_email_changed
  AFTER UPDATE OF email ON auth.users
  FOR EACH ROW
  WHEN (OLD.email IS DISTINCT FROM NEW.email)
  EXECUTE FUNCTION public.handle_user_email_change();

-- Sin esto, cualquier usuario podria hacerse ADMIN con un UPDATE a su
-- propio perfil: la politica RLS le deja escribir su fila, asi que los
-- campos sensibles se congelan aqui.
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NOT public.is_admin() THEN
    NEW.id        := OLD.id;
    NEW.role      := OLD.role;
    NEW.is_active := OLD.is_active;
    NEW.email     := OLD.email;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER profiles_protect
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_profile_fields();

-- ---------------------------------------------------------------------
-- 3. CATALOGOS
-- ---------------------------------------------------------------------
CREATE TABLE public.categories (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.skills (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL UNIQUE,
    slug        TEXT NOT NULL UNIQUE,
    category_id INTEGER REFERENCES public.categories(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.locations (
    id          SERIAL PRIMARY KEY,
    country     TEXT,
    city        TEXT,
    region      TEXT,
    UNIQUE (country, city)
);

CREATE TABLE public.companies (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    slug        TEXT NOT NULL UNIQUE,
    description TEXT,
    website     TEXT,
    logo_url    TEXT,
    location_id INTEGER REFERENCES public.locations(id) ON DELETE SET NULL,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.sources (
    id          SERIAL PRIMARY KEY,
    name        TEXT NOT NULL,
    type        TEXT NOT NULL
                CHECK (type IN ('MANUAL','API','RSS','WEB','UNIVERSITY','IMPORT')),
    url         TEXT,
    is_active   BOOLEAN NOT NULL DEFAULT TRUE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_skills (
    user_id   UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    skill_id  INTEGER NOT NULL REFERENCES public.skills(id)   ON DELETE CASCADE,
    PRIMARY KEY (user_id, skill_id)
);

-- ---------------------------------------------------------------------
-- 4. JOBS
-- ---------------------------------------------------------------------
CREATE TABLE public.jobs (
    id                  SERIAL PRIMARY KEY,
    title               TEXT NOT NULL,
    description         TEXT NOT NULL,
    company_id          INTEGER NOT NULL REFERENCES public.companies(id)  ON DELETE CASCADE,
    category_id         INTEGER REFERENCES public.categories(id) ON DELETE SET NULL,
    location_id         INTEGER REFERENCES public.locations(id)  ON DELETE SET NULL,
    employment_type     TEXT CHECK (employment_type IN
                          ('FULL_TIME','PART_TIME','INTERNSHIP','FREELANCE','CONTRACT')),
    work_mode           TEXT CHECK (work_mode IN ('REMOTE','HYBRID','ON_SITE')),
    experience_level    TEXT CHECK (experience_level IN
                          ('INTERNSHIP','JUNIOR','MID','SENIOR')),
    salary_min          NUMERIC(12,2),
    salary_max          NUMERIC(12,2),
    currency            TEXT,
    publication_date    DATE DEFAULT CURRENT_DATE,
    deadline            DATE,
    status              TEXT NOT NULL DEFAULT 'DRAFT'
                        CHECK (status IN
                          ('DRAFT','PENDING_REVIEW','ACTIVE','EXPIRED','CLOSED','REJECTED')),
    verification_status TEXT NOT NULL DEFAULT 'PENDING'
                        CHECK (verification_status IN ('VERIFIED','PENDING','REPORTED')),
    verified_at         TIMESTAMPTZ,
    verified_by         UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    contact_email       TEXT,
    contact_phone       TEXT,
    apply_url           TEXT,
    original_text       TEXT,
    original_url        TEXT,
    -- Vector de busqueda. No es GENERATED porque incluye el nombre de la
    -- empresa, que vive en otra tabla; lo mantienen los triggers de abajo.
    fts                 TSVECTOR,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT jobs_salary_range CHECK (
      salary_min IS NULL OR salary_max IS NULL OR salary_min <= salary_max)
);

CREATE INDEX jobs_status_idx           ON public.jobs (status);
CREATE INDEX jobs_category_id_idx      ON public.jobs (category_id);
CREATE INDEX jobs_publication_date_idx ON public.jobs (publication_date DESC);
CREATE INDEX jobs_company_id_idx       ON public.jobs (company_id);
CREATE INDEX jobs_fts_idx              ON public.jobs USING GIN (fts);

CREATE OR REPLACE FUNCTION public.jobs_refresh_fts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  company_name TEXT;
BEGIN
  SELECT name INTO company_name
    FROM public.companies WHERE id = NEW.company_id;

  NEW.fts :=
      setweight(to_tsvector('spanish', coalesce(NEW.title, '')),       'A')
   || setweight(to_tsvector('spanish', coalesce(company_name, '')),    'B')
   || setweight(to_tsvector('spanish', coalesce(NEW.description, '')), 'C');
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER jobs_fts_trigger
  BEFORE INSERT OR UPDATE OF title, description, company_id ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_refresh_fts();

CREATE TRIGGER jobs_touch
  BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- Si una empresa se renombra, hay que recalcular el fts de sus ofertas.
-- El `SET title = title` parece inutil, pero dispara jobs_fts_trigger.
CREATE OR REPLACE FUNCTION public.companies_refresh_jobs_fts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  UPDATE public.jobs SET title = title WHERE company_id = NEW.id;
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER companies_name_changed
  AFTER UPDATE OF name ON public.companies
  FOR EACH ROW
  WHEN (OLD.name IS DISTINCT FROM NEW.name)
  EXECUTE FUNCTION public.companies_refresh_jobs_fts();

CREATE TABLE public.job_skills (
    job_id    INTEGER NOT NULL REFERENCES public.jobs(id)   ON DELETE CASCADE,
    skill_id  INTEGER NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE public.job_sources (
    job_id     INTEGER NOT NULL REFERENCES public.jobs(id)    ON DELETE CASCADE,
    source_id  INTEGER NOT NULL REFERENCES public.sources(id) ON DELETE CASCADE,
    url        TEXT,
    PRIMARY KEY (job_id, source_id)
);

-- ---------------------------------------------------------------------
-- 5. ACTIVIDAD DEL USUARIO
-- ---------------------------------------------------------------------
CREATE TABLE public.favorites (
    user_id     UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id      INTEGER NOT NULL REFERENCES public.jobs(id)     ON DELETE CASCADE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, job_id)
);

CREATE TABLE public.applications (
    id          SERIAL PRIMARY KEY,
    user_id     UUID    NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    job_id      INTEGER NOT NULL REFERENCES public.jobs(id)     ON DELETE CASCADE,
    status      TEXT NOT NULL DEFAULT 'APPLIED'
                CHECK (status IN ('APPLIED','INTERVIEW','ACCEPTED','REJECTED')),
    notes       TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, job_id)
);

CREATE TRIGGER applications_touch
  BEFORE UPDATE ON public.applications
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE TABLE public.alerts (
    id                SERIAL PRIMARY KEY,
    user_id           UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name              TEXT,
    category_id       INTEGER REFERENCES public.categories(id) ON DELETE SET NULL,
    experience_level  TEXT CHECK (experience_level IN
                        ('INTERNSHIP','JUNIOR','MID','SENIOR')),
    work_mode         TEXT CHECK (work_mode IN ('REMOTE','HYBRID','ON_SITE')),
    is_active         BOOLEAN NOT NULL DEFAULT TRUE,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.alert_skills (
    alert_id  INTEGER NOT NULL REFERENCES public.alerts(id) ON DELETE CASCADE,
    skill_id  INTEGER NOT NULL REFERENCES public.skills(id) ON DELETE CASCADE,
    PRIMARY KEY (alert_id, skill_id)
);

CREATE TABLE public.reports (
    id          SERIAL PRIMARY KEY,
    job_id      INTEGER NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
    user_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    reason      TEXT NOT NULL
                CHECK (reason IN ('FAKE','DUPLICATE','EXPIRED','INCORRECT','BROKEN_LINK')),
    description TEXT,
    status      TEXT NOT NULL DEFAULT 'OPEN'
                CHECK (status IN ('OPEN','RESOLVED','DISMISSED')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    resolved_at TIMESTAMPTZ,
    resolved_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

-- =====================================================================
-- 6. ROW LEVEL SECURITY
--
-- Regla general: RLS activo en TODAS las tablas. Sin politica que lo
-- permita, nadie lee ni escribe nada. Los catalogos son de lectura
-- publica; el resto depende de auth.uid() o de is_admin().
-- =====================================================================

ALTER TABLE public.profiles     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.skills       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.locations    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sources      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_skills  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_skills   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_sources  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alerts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports      ENABLE ROW LEVEL SECURITY;

-- ----- PROFILES -----
CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid() OR public.is_admin())
  WITH CHECK (id = auth.uid() OR public.is_admin());

-- El INSERT lo hace el trigger handle_new_user (SECURITY DEFINER),
-- por eso no hay politica de INSERT: nadie crea perfiles a mano.

CREATE POLICY profiles_delete_admin ON public.profiles
  FOR DELETE TO authenticated
  USING (public.is_admin());

-- ----- CATALOGOS: lectura publica, escritura solo admin -----
CREATE POLICY categories_read ON public.categories
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY categories_write ON public.categories
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY skills_read ON public.skills
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY skills_write ON public.skills
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY locations_read ON public.locations
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY locations_write ON public.locations
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY companies_read ON public.companies
  FOR SELECT TO anon, authenticated USING (is_active OR public.is_admin());
CREATE POLICY companies_write ON public.companies
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- sources es interno (de donde sale cada oferta): solo admin.
CREATE POLICY sources_admin ON public.sources
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ----- JOBS: publico ve solo ACTIVE; admin ve y edita todo -----
CREATE POLICY jobs_read_active ON public.jobs
  FOR SELECT TO anon, authenticated
  USING (status = 'ACTIVE' OR public.is_admin());

CREATE POLICY jobs_write_admin ON public.jobs
  FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Las tablas puente de jobs siguen la visibilidad de su oferta.
CREATE POLICY job_skills_read ON public.job_skills
  FOR SELECT TO anon, authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j
                 WHERE j.id = job_id AND (j.status = 'ACTIVE' OR public.is_admin())));
CREATE POLICY job_skills_write ON public.job_skills
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY job_sources_admin ON public.job_sources
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ----- USER_SKILLS: cada quien las suyas -----
CREATE POLICY user_skills_own ON public.user_skills
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid());

-- ----- FAVORITES -----
CREATE POLICY favorites_own ON public.favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid());

-- ----- APPLICATIONS -----
CREATE POLICY applications_own ON public.applications
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid());

-- ----- ALERTS -----
CREATE POLICY alerts_own ON public.alerts
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR public.is_admin())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY alert_skills_own ON public.alert_skills
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.alerts a
                 WHERE a.id = alert_id AND (a.user_id = auth.uid() OR public.is_admin())))
  WITH CHECK (EXISTS (SELECT 1 FROM public.alerts a
                      WHERE a.id = alert_id AND a.user_id = auth.uid()));

-- ----- REPORTS: el usuario crea y ve los suyos; el admin gestiona todos -----
CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY reports_select_own ON public.reports
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_admin());
CREATE POLICY reports_update_admin ON public.reports
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY reports_delete_admin ON public.reports
  FOR DELETE TO authenticated USING (public.is_admin());

-- =====================================================================
-- 7. VISTAS
--
-- security_invoker = true hace que la vista respete el RLS del que
-- consulta, en vez de ejecutarse con los permisos del dueno. Sin esto
-- una vista seria un agujero por el que saltarse las politicas.
-- =====================================================================

-- jobs_public aplana empresa, categoria y skills para que el frontend
-- reciba la misma forma que devolvia Flask (company_name, category_name,
-- skills[]) y JobCard.jsx no tenga que cambiar.
CREATE VIEW public.jobs_public
WITH (security_invoker = true) AS
SELECT
    j.id,
    j.title,
    j.description,
    j.company_id,
    c.name  AS company_name,
    c.logo_url AS company_logo_url,
    j.category_id,
    cat.name AS category_name,
    j.location_id,
    l.city   AS location_city,
    l.country AS location_country,
    j.employment_type,
    j.work_mode,
    j.experience_level,
    j.salary_min,
    j.salary_max,
    j.currency,
    j.publication_date,
    j.deadline,
    j.status,
    j.verification_status,
    j.contact_email,
    j.apply_url,
    j.original_url,
    j.created_at,
    j.fts,
    COALESCE(
      (SELECT array_agg(s.name ORDER BY s.name)
         FROM public.job_skills js
         JOIN public.skills s ON s.id = js.skill_id
        WHERE js.job_id = j.id),
      ARRAY[]::TEXT[]
    ) AS skills
FROM public.jobs j
LEFT JOIN public.companies  c   ON c.id   = j.company_id
LEFT JOIN public.categories cat ON cat.id = j.category_id
LEFT JOIN public.locations  l   ON l.id   = j.location_id;

-- =====================================================================
-- 8. RPC
-- =====================================================================

-- Los KPIs del dashboard en una sola llamada, con la misma forma que
-- devolvia /api/admin/stats.
CREATE OR REPLACE FUNCTION public.get_admin_stats()
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  result JSON;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'No autorizado' USING ERRCODE = '42501';
  END IF;

  SELECT json_build_object(
    'total_jobs',    (SELECT count(*) FROM public.jobs),
    'active_jobs',   (SELECT count(*) FROM public.jobs WHERE status = 'ACTIVE'),
    'pending_jobs',  (SELECT count(*) FROM public.jobs WHERE status = 'PENDING_REVIEW'),
    'expired_jobs',  (SELECT count(*) FROM public.jobs WHERE status = 'EXPIRED'),
    'reported_jobs', (SELECT count(*) FROM public.jobs WHERE verification_status = 'REPORTED'),
    'total_users',   (SELECT count(*) FROM public.profiles),
    'open_reports',  (SELECT count(*) FROM public.reports WHERE status = 'OPEN')
  ) INTO result;

  RETURN result;
END;
$fn$;

-- Alterna favorito y devuelve el estado final, para no hacer dos viajes
-- (comprobar + insertar/borrar) desde el navegador.
CREATE OR REPLACE FUNCTION public.toggle_favorite(p_job_id INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  existed BOOLEAN;
BEGIN
  DELETE FROM public.favorites
   WHERE user_id = auth.uid() AND job_id = p_job_id;
  GET DIAGNOSTICS existed = ROW_COUNT;

  IF existed THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.favorites (user_id, job_id)
  VALUES (auth.uid(), p_job_id);
  RETURN TRUE;
END;
$fn$;

-- =====================================================================
-- 9. PERMISOS
-- =====================================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated;

GRANT SELECT ON public.jobs_public TO anon, authenticated;

GRANT EXECUTE ON FUNCTION public.is_admin()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_favorite(INTEGER) TO authenticated;

GRANT SELECT ON public.categories, public.skills, public.locations,
                public.companies, public.jobs, public.job_skills
      TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON
      public.profiles, public.favorites, public.applications,
      public.alerts, public.alert_skills, public.user_skills,
      public.reports, public.jobs, public.job_skills, public.job_sources,
      public.categories, public.skills, public.locations,
      public.companies, public.sources
      TO authenticated;

GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================================
-- 10. SEED
-- =====================================================================

INSERT INTO public.categories (name, slug) VALUES
    ('Desarrollo',             'desarrollo'),
    ('Datos',                  'datos'),
    ('QA',                     'qa'),
    ('Diseno',                 'diseno'),
    ('Infraestructura',        'infraestructura'),
    ('Seguridad',              'seguridad'),
    ('Inteligencia Artificial','inteligencia-artificial'),
    ('Bioinformatica',         'bioinformatica')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.skills (name, slug) VALUES
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

INSERT INTO public.sources (name, type) VALUES
    ('Carga manual', 'MANUAL')
ON CONFLICT DO NOTHING;
