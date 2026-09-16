-- =====================================================================
-- Backoffice, Etapa C: portal de empresas
-- Especificación: docs/02-backoffice.md (requisitos BO-100 en adelante)
--
--   1. Configuración: límite de empresas por persona; revisión pública
--   2. Equipos de empresa (company_members) y funciones de pertenencia
--   3. Empresas: alta desde el portal, edición por su equipo, nota de revisión
--   4. Ofertas: autor, nota de revisión, transiciones permitidas a empresas
--   5. jobs_guard y companies_guard con el camino "empresa"
--   6. Tecnologías de ofertas editadas por empresas
--   7. RLS para miembros
--   8. Funciones del portal y de moderación actualizadas
--   9. Vista pública con el sello de empresa verificada
--  10. Privilegios
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. CONFIGURACIÓN
-- ---------------------------------------------------------------------
INSERT INTO public.app_settings (key, value, description, is_public) VALUES
  ('companies.max_per_user', '1', 'Empresas que puede crear una misma persona desde el portal', FALSE);

-- El portal necesita saber si las ofertas pasan por revisión para ofrecer
-- "Enviar a revisión" o "Publicar". No es un dato sensible.
UPDATE public.app_settings SET is_public = TRUE
 WHERE key = 'moderation.company_jobs_require_review';

-- Lectura de ajustes desde funciones y triggers.
CREATE OR REPLACE FUNCTION public.setting_bool(p_key TEXT, p_default BOOLEAN)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE((SELECT (value #>> '{}')::BOOLEAN FROM public.app_settings WHERE key = p_key), p_default);
$fn$;

CREATE OR REPLACE FUNCTION public.setting_int(p_key TEXT, p_default INTEGER)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE((SELECT (value #>> '{}')::INTEGER FROM public.app_settings WHERE key = p_key), p_default);
$fn$;

-- ---------------------------------------------------------------------
-- 2. EQUIPOS DE EMPRESA (BO-100..105)
-- ---------------------------------------------------------------------
CREATE TABLE public.company_members (
    company_id  INTEGER NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id     UUID    NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
    role        TEXT    NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'MEMBER')),
    added_by    UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (company_id, user_id)
);

CREATE INDEX company_members_user_idx     ON public.company_members (user_id);
CREATE INDEX company_members_added_by_idx ON public.company_members (added_by);

-- Empresas de quien pregunta (solo si su cuenta está activa). Se usa en
-- las políticas como `company_id IN (SELECT my_company_ids())`.
CREATE OR REPLACE FUNCTION public.my_company_ids()
RETURNS SETOF INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT cm.company_id
    FROM public.company_members cm
    JOIN public.profiles p ON p.id = cm.user_id
   WHERE cm.user_id = auth.uid() AND p.is_active;
$fn$;

CREATE OR REPLACE FUNCTION public.is_company_member(p_company_id INTEGER, p_role TEXT DEFAULT NULL)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM public.company_members cm
      JOIN public.profiles p ON p.id = cm.user_id
     WHERE cm.company_id = p_company_id
       AND cm.user_id = auth.uid()
       AND p.is_active
       AND (p_role IS NULL OR cm.role = p_role)
  );
$fn$;

ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;

-- Altas, bajas y cambios de rol solo por funciones (sección 8).
CREATE POLICY company_members_read ON public.company_members
  FOR SELECT TO authenticated
  USING (company_id IN (SELECT public.my_company_ids())
      OR (SELECT public.has_permission('companies.view_all')));

CREATE TRIGGER audit_company_members
  AFTER INSERT OR UPDATE OR DELETE ON public.company_members
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('company_id');

-- ---------------------------------------------------------------------
-- 3. EMPRESAS
-- ---------------------------------------------------------------------
-- Motivo visible para la empresa cuando se rechaza su verificación.
ALTER TABLE public.companies ADD COLUMN review_note TEXT;

CREATE OR REPLACE FUNCTION public.companies_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_system BOOLEAN := public.is_system_actor();
  v_meta TEXT[] := ARRAY['verification_status', 'verified_at', 'verified_by', 'updated_at', 'review_note'];
  -- Lo único que el equipo de una empresa puede cambiar de su ficha.
  v_member_fields TEXT[] := ARRAY['name', 'description', 'website', 'logo_url'];
  v_staff_edit BOOLEAN;
  v_staff_verify BOOLEAN;
  v_member BOOLEAN := FALSE;
  v_reverify BOOLEAN := FALSE;
BEGIN
  IF v_system THEN
    v_staff_edit := TRUE;
    v_staff_verify := TRUE;
  ELSE
    v_staff_edit := public.has_permission('companies.edit');
    v_staff_verify := public.has_permission('companies.verify');
  END IF;

  IF TG_OP = 'UPDATE' THEN
    v_member := public.is_company_member(OLD.id);

    IF (to_jsonb(NEW) - v_meta) IS DISTINCT FROM (to_jsonb(OLD) - v_meta) AND NOT v_staff_edit THEN
      IF NOT v_member THEN
        RAISE EXCEPTION 'No tienes permiso para editar empresas.' USING ERRCODE = '42501';
      END IF;
      IF NOT public.setting_bool('features.company_portal', FALSE) THEN
        RAISE EXCEPTION 'El portal de empresas está cerrado.' USING ERRCODE = 'P0001';
      END IF;
      -- BO-111
      IF (to_jsonb(NEW) - v_meta - v_member_fields) IS DISTINCT FROM (to_jsonb(OLD) - v_meta - v_member_fields) THEN
        RAISE EXCEPTION 'Ese dato solo lo puede cambiar el equipo de IAFAM.' USING ERRCODE = '42501';
      END IF;
      -- BO-112: una empresa verificada que cambia de nombre o web vuelve a revisión.
      IF OLD.verification_status = 'VERIFIED'
         AND (NEW.name IS DISTINCT FROM OLD.name OR NEW.website IS DISTINCT FROM OLD.website) THEN
        NEW.verification_status := 'PENDING';
        v_reverify := TRUE;
      END IF;
    END IF;

    IF NEW.review_note IS DISTINCT FROM OLD.review_note AND NOT v_staff_verify THEN
      RAISE EXCEPTION 'La nota de revisión la escribe el equipo de IAFAM.' USING ERRCODE = '42501';
    END IF;

    NEW.updated_at := now();
  END IF;

  IF TG_OP = 'INSERT' OR NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NOT v_staff_verify THEN
      IF TG_OP = 'INSERT' THEN
        IF NEW.verification_status NOT IN ('UNVERIFIED', 'PENDING') THEN
          RAISE EXCEPTION 'No tienes permiso para verificar empresas.' USING ERRCODE = '42501';
        END IF;
      -- BO-110: la empresa solo puede pedir (o volver a pedir) la verificación.
      ELSIF NOT (v_member AND NEW.verification_status = 'PENDING'
                 AND (v_reverify OR OLD.verification_status IN ('UNVERIFIED', 'REJECTED'))) THEN
        RAISE EXCEPTION 'La verificación la decide el equipo de IAFAM.' USING ERRCODE = '42501';
      END IF;
    END IF;
    IF NEW.verification_status IN ('VERIFIED', 'REJECTED') THEN
      NEW.verified_at := now();
      NEW.verified_by := auth.uid();
    ELSE
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
    END IF;
  ELSE
    NEW.verified_at := OLD.verified_at;
    -- Si quien verificó borra su perfil, la cascada SET NULL debe poder aplicarse.
    NEW.verified_by := CASE WHEN NEW.verified_by IS NULL THEN NULL ELSE OLD.verified_by END;
  END IF;

  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 4. OFERTAS: autor, nota de revisión y transiciones de empresa
-- ---------------------------------------------------------------------
ALTER TABLE public.jobs
  ADD COLUMN created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN review_note TEXT;

CREATE INDEX jobs_created_by_idx ON public.jobs (created_by);

ALTER TABLE public.job_status_transitions
  ADD COLUMN company_allowed BOOLEAN NOT NULL DEFAULT FALSE;

-- Caminos de vuelta a revisión: una oferta publicada que se edita, o una
-- cerrada o caducada que se quiere reabrir, pasa otra vez por moderación.
INSERT INTO public.job_status_transitions (from_status, to_status) VALUES
  ('ACTIVE',  'PENDING_REVIEW'),
  ('CLOSED',  'PENDING_REVIEW'),
  ('EXPIRED', 'PENDING_REVIEW');

-- BO-121: lo que una empresa puede hacer con sus ofertas. Pasar a
-- Publicada además exige que no haga falta revisión y que la empresa esté
-- verificada (lo comprueba jobs_guard).
UPDATE public.job_status_transitions SET company_allowed = TRUE
 WHERE (from_status, to_status) IN (
   ('DRAFT', 'PENDING_REVIEW'), ('DRAFT', 'ACTIVE'),
   ('PENDING_REVIEW', 'DRAFT'),
   ('REJECTED', 'DRAFT'), ('REJECTED', 'PENDING_REVIEW'),
   ('ACTIVE', 'CLOSED'), ('ACTIVE', 'PENDING_REVIEW'),
   ('CLOSED', 'PENDING_REVIEW'), ('CLOSED', 'ACTIVE'),
   ('EXPIRED', 'PENDING_REVIEW'), ('EXPIRED', 'ACTIVE'), ('EXPIRED', 'CLOSED')
 );

-- ---------------------------------------------------------------------
-- 5. jobs_guard con el camino "empresa" (BO-120..126)
--
-- Quien tiene algún permiso de ofertas sigue el camino del equipo (igual
-- que en la Etapa A). Quien no, solo puede actuar como miembro de la
-- empresa de la oferta, con reglas más estrictas.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.jobs_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_system BOOLEAN := public.is_system_actor();
  v_meta TEXT[] := ARRAY['status', 'verification_status', 'verified_at', 'verified_by',
                         'updated_at', 'fts', 'publication_date', 'review_note', 'created_by'];
  v_staff BOOLEAN;
  v_company_status TEXT;
  v_company_active BOOLEAN;
  v_review BOOLEAN := public.setting_bool('moderation.company_jobs_require_review', TRUE);
BEGIN
  v_staff := v_system OR public.has_permission('jobs.edit')
          OR public.has_permission('jobs.publish') OR public.has_permission('jobs.verify');

  SELECT verification_status, is_active INTO v_company_status, v_company_active
    FROM public.companies WHERE id = NEW.company_id;

  -- ================= Alta =================
  IF TG_OP = 'INSERT' THEN
    IF NOT v_system THEN
      NEW.created_by := auth.uid();
      NEW.review_note := NULL;
    END IF;

    IF NEW.status NOT IN ('DRAFT', 'PENDING_REVIEW', 'ACTIVE') THEN
      RAISE EXCEPTION 'Una oferta nueva solo puede empezar como Borrador, En revisión o Publicada.'
        USING ERRCODE = 'P0001';
    END IF;

    IF NOT v_system THEN
      IF public.has_permission('jobs.edit') THEN
        IF NEW.status = 'ACTIVE' AND NOT public.has_permission('jobs.publish') THEN
          RAISE EXCEPTION 'No tienes permiso para publicar ofertas.' USING ERRCODE = '42501';
        END IF;
        IF NEW.verification_status <> 'PENDING' AND NOT public.has_permission('jobs.verify') THEN
          RAISE EXCEPTION 'No tienes permiso para verificar ofertas.' USING ERRCODE = '42501';
        END IF;
      ELSIF public.is_company_member(NEW.company_id) THEN
        IF NOT public.setting_bool('features.company_portal', FALSE) THEN
          RAISE EXCEPTION 'El portal de empresas está cerrado.' USING ERRCODE = 'P0001';
        END IF;
        IF NOT v_company_active OR v_company_status = 'REJECTED' THEN
          RAISE EXCEPTION 'Tu empresa no puede publicar ofertas ahora mismo. Revisa el estado de su verificación.'
            USING ERRCODE = 'P0001';
        END IF;
        NEW.verification_status := 'PENDING';
        IF NEW.status = 'ACTIVE' AND (v_review OR v_company_status <> 'VERIFIED') THEN
          RAISE EXCEPTION 'Tus ofertas pasan por revisión antes de publicarse.' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.status = 'PENDING_REVIEW' AND v_company_status NOT IN ('PENDING', 'VERIFIED') THEN
          RAISE EXCEPTION 'Solicita la verificación de tu empresa antes de enviar ofertas a revisión.'
            USING ERRCODE = 'P0001';
        END IF;
      ELSE
        RAISE EXCEPTION 'No tienes permiso para crear ofertas.' USING ERRCODE = '42501';
      END IF;
    END IF;

  -- ================= Modificación =================
  ELSE
    -- Se conserva el autor salvo que el perfil se borre (cascada SET NULL).
    NEW.created_by := CASE WHEN NEW.created_by IS NULL THEN NULL ELSE OLD.created_by END;

    IF NOT v_staff THEN
      -- Camino empresa
      IF NOT public.is_company_member(OLD.company_id) THEN
        RAISE EXCEPTION 'No tienes permiso para modificar esta oferta.' USING ERRCODE = '42501';
      END IF;
      IF NOT public.setting_bool('features.company_portal', FALSE) THEN
        RAISE EXCEPTION 'El portal de empresas está cerrado.' USING ERRCODE = 'P0001';
      END IF;
      IF NEW.company_id IS DISTINCT FROM OLD.company_id THEN
        RAISE EXCEPTION 'Una oferta no se puede mover a otra empresa.' USING ERRCODE = '42501';
      END IF;
      IF NEW.verification_status IS DISTINCT FROM OLD.verification_status
         OR NEW.review_note IS DISTINCT FROM OLD.review_note
         OR NEW.publication_date IS DISTINCT FROM OLD.publication_date THEN
        RAISE EXCEPTION 'Eso lo decide el equipo de IAFAM.' USING ERRCODE = '42501';
      END IF;

      -- BO-124: editar una oferta publicada la devuelve a revisión.
      IF v_review AND OLD.status = 'ACTIVE' AND NEW.status = 'ACTIVE'
         AND (to_jsonb(NEW) - v_meta) IS DISTINCT FROM (to_jsonb(OLD) - v_meta) THEN
        NEW.status := 'PENDING_REVIEW';
      END IF;

      IF NEW.status IS DISTINCT FROM OLD.status THEN
        IF NOT EXISTS (
          SELECT 1 FROM public.job_status_transitions t
           WHERE t.from_status = OLD.status AND t.to_status = NEW.status AND t.company_allowed
        ) THEN
          RAISE EXCEPTION 'Tu empresa no puede pasar una oferta de % a %.',
            public.job_status_label(OLD.status), public.job_status_label(NEW.status)
            USING ERRCODE = 'P0001';
        END IF;
        IF NEW.status = 'ACTIVE' AND (v_review OR v_company_status <> 'VERIFIED') THEN
          RAISE EXCEPTION 'Tus ofertas pasan por revisión antes de publicarse.' USING ERRCODE = 'P0001';
        END IF;
        IF NEW.status = 'PENDING_REVIEW' AND v_company_status NOT IN ('PENDING', 'VERIFIED') THEN
          RAISE EXCEPTION 'Solicita la verificación de tu empresa antes de enviar ofertas a revisión.'
            USING ERRCODE = 'P0001';
        END IF;
      END IF;
    ELSIF NOT v_system THEN
      -- Camino equipo (Etapa A)
      IF (to_jsonb(NEW) - v_meta) IS DISTINCT FROM (to_jsonb(OLD) - v_meta)
         AND NOT public.has_permission('jobs.edit') THEN
        RAISE EXCEPTION 'No tienes permiso para editar el contenido de las ofertas.' USING ERRCODE = '42501';
      END IF;
      IF (NEW.status IS DISTINCT FROM OLD.status
          OR NEW.publication_date IS DISTINCT FROM OLD.publication_date
          OR NEW.review_note IS DISTINCT FROM OLD.review_note)
         AND NOT public.has_permission('jobs.publish') THEN
        RAISE EXCEPTION 'No tienes permiso para cambiar el estado de las ofertas.' USING ERRCODE = '42501';
      END IF;
    END IF;

    -- Para todos, también el sistema: solo transiciones definidas.
    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.job_status_transitions t
         WHERE t.from_status = OLD.status AND t.to_status = NEW.status
      ) THEN
        RAISE EXCEPTION 'Una oferta no puede pasar de % a %.',
          public.job_status_label(OLD.status), public.job_status_label(NEW.status)
          USING ERRCODE = 'P0001';
      END IF;
      IF NEW.status = 'ACTIVE' THEN
        NEW.publication_date := CURRENT_DATE;
      END IF;
    END IF;
  END IF;

  -- Verificación (BO-034): los campos verified_* los escribe solo la BD.
  IF TG_OP = 'INSERT' OR NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF TG_OP = 'UPDATE' AND NOT v_system AND NOT public.has_permission('jobs.verify') THEN
      RAISE EXCEPTION 'No tienes permiso para verificar ofertas.' USING ERRCODE = '42501';
    END IF;
    IF NEW.verification_status = 'VERIFIED' THEN
      NEW.verified_at := now();
      NEW.verified_by := auth.uid();
    ELSE
      NEW.verified_at := NULL;
      NEW.verified_by := NULL;
    END IF;
  ELSE
    NEW.verified_at := OLD.verified_at;
    -- Si quien verificó borra su perfil, la cascada SET NULL debe poder aplicarse.
    NEW.verified_by := CASE WHEN NEW.verified_by IS NULL THEN NULL ELSE OLD.verified_by END;
  END IF;

  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 6. TECNOLOGÍAS DE OFERTAS EDITADAS POR EMPRESAS
-- ---------------------------------------------------------------------
-- Si una empresa cambia las tecnologías de una oferta publicada, también
-- vuelve a revisión (BO-124).
CREATE OR REPLACE FUNCTION public.job_skills_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_job_id INTEGER := COALESCE(NEW.job_id, OLD.job_id);
  v_company_id INTEGER;
  v_status TEXT;
BEGIN
  IF public.is_system_actor() OR public.has_permission('jobs.edit') THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT company_id, status INTO v_company_id, v_status FROM public.jobs WHERE id = v_job_id;

  -- La oferta ya no existe: es el borrado en cascada de una oferta que ya
  -- pasó sus propias comprobaciones (una empresa solo borra borradores).
  IF v_company_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  IF NOT public.is_company_member(v_company_id) THEN
    RAISE EXCEPTION 'No tienes permiso para modificar esta oferta.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.setting_bool('features.company_portal', FALSE) THEN
    RAISE EXCEPTION 'El portal de empresas está cerrado.' USING ERRCODE = 'P0001';
  END IF;

  IF v_status = 'ACTIVE' AND public.setting_bool('moderation.company_jobs_require_review', TRUE) THEN
    UPDATE public.jobs SET status = 'PENDING_REVIEW' WHERE id = v_job_id AND status = 'ACTIVE';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

CREATE TRIGGER job_skills_guard
  BEFORE INSERT OR DELETE ON public.job_skills
  FOR EACH ROW EXECUTE FUNCTION public.job_skills_guard();

-- ---------------------------------------------------------------------
-- 7. RLS PARA MIEMBROS DE EMPRESA
-- ---------------------------------------------------------------------
DROP POLICY companies_read_auth ON public.companies;
CREATE POLICY companies_read_auth ON public.companies
  FOR SELECT TO authenticated
  USING (is_active
      OR (SELECT public.has_permission('companies.view_all'))
      OR id IN (SELECT public.my_company_ids()));

DROP POLICY companies_update ON public.companies;
CREATE POLICY companies_update ON public.companies
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('companies.edit'))
      OR (SELECT public.has_permission('companies.verify'))
      OR id IN (SELECT public.my_company_ids()))
  WITH CHECK ((SELECT public.has_permission('companies.edit'))
      OR (SELECT public.has_permission('companies.verify'))
      OR id IN (SELECT public.my_company_ids()));

-- Ofertas: una política por acción que combina equipo y empresa (evita
-- políticas permisivas duplicadas).
DROP POLICY jobs_read_auth ON public.jobs;
DROP POLICY jobs_insert     ON public.jobs;
DROP POLICY jobs_update     ON public.jobs;
DROP POLICY jobs_delete     ON public.jobs;

CREATE POLICY jobs_read_auth ON public.jobs
  FOR SELECT TO authenticated
  USING (status = 'ACTIVE'
      OR (SELECT public.has_permission('jobs.view_all'))
      OR company_id IN (SELECT public.my_company_ids()));

CREATE POLICY jobs_insert ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_permission('jobs.edit'))
      OR company_id IN (SELECT public.my_company_ids()));

CREATE POLICY jobs_update ON public.jobs
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('jobs.edit'))
      OR (SELECT public.has_permission('jobs.publish'))
      OR (SELECT public.has_permission('jobs.verify'))
      OR company_id IN (SELECT public.my_company_ids()))
  WITH CHECK ((SELECT public.has_permission('jobs.edit'))
      OR (SELECT public.has_permission('jobs.publish'))
      OR (SELECT public.has_permission('jobs.verify'))
      OR company_id IN (SELECT public.my_company_ids()));

-- BO-125: una empresa solo borra borradores.
CREATE POLICY jobs_delete ON public.jobs
  FOR DELETE TO authenticated
  USING ((SELECT public.has_permission('jobs.delete'))
      OR (status = 'DRAFT' AND company_id IN (SELECT public.my_company_ids())));

DROP POLICY job_skills_read_auth ON public.job_skills;
DROP POLICY job_skills_insert    ON public.job_skills;
DROP POLICY job_skills_delete    ON public.job_skills;

CREATE POLICY job_skills_read_auth ON public.job_skills
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j
                  WHERE j.id = job_id
                    AND (j.status = 'ACTIVE'
                      OR (SELECT public.has_permission('jobs.view_all'))
                      OR j.company_id IN (SELECT public.my_company_ids()))));
CREATE POLICY job_skills_insert ON public.job_skills
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_permission('jobs.edit'))
      OR EXISTS (SELECT 1 FROM public.jobs j
                  WHERE j.id = job_id AND j.company_id IN (SELECT public.my_company_ids())));
CREATE POLICY job_skills_delete ON public.job_skills
  FOR DELETE TO authenticated
  USING ((SELECT public.has_permission('jobs.edit'))
      OR EXISTS (SELECT 1 FROM public.jobs j
                  WHERE j.id = job_id AND j.company_id IN (SELECT public.my_company_ids())));

-- ---------------------------------------------------------------------
-- 8. FUNCIONES DEL PORTAL
-- ---------------------------------------------------------------------

-- BO-101..103: alta de empresa desde el portal. Queda pendiente de
-- verificación, en la bandeja de moderación, y quien la crea es su
-- administradora (OWNER).
CREATE OR REPLACE FUNCTION public.create_company_account(
  p_name TEXT,
  p_website TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_logo_url TEXT DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_uid UUID := auth.uid();
  v_name TEXT := btrim(COALESCE(p_name, ''));
  v_max INTEGER := public.setting_int('companies.max_per_user', 1);
  v_base TEXT;
  v_slug TEXT;
  v_n INTEGER := 1;
  v_id INTEGER;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Necesitas iniciar sesión.' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = v_uid AND is_active) THEN
    RAISE EXCEPTION 'Tu cuenta está suspendida.' USING ERRCODE = '42501';
  END IF;
  IF NOT public.setting_bool('features.company_portal', FALSE) THEN
    RAISE EXCEPTION 'El portal de empresas todavía no está abierto.' USING ERRCODE = 'P0001';
  END IF;
  IF length(v_name) < 2 OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'Escribe el nombre de la empresa (entre 2 y 120 caracteres).' USING ERRCODE = 'P0001';
  END IF;
  IF (SELECT count(*) FROM public.company_members WHERE user_id = v_uid AND role = 'OWNER') >= v_max THEN
    RAISE EXCEPTION 'Ya administras el máximo de empresas permitido (%). Escribe al equipo de IAFAM si necesitas más.', v_max
      USING ERRCODE = 'P0001';
  END IF;
  -- RF-052: nombre único sin distinguir mayúsculas.
  IF EXISTS (SELECT 1 FROM public.companies WHERE lower(name) = lower(v_name)) THEN
    RAISE EXCEPTION 'Ya existe una empresa con ese nombre. Si es la tuya, pide a su equipo que te añada.'
      USING ERRCODE = 'P0001';
  END IF;

  v_base := trim(BOTH '-' FROM regexp_replace(
              lower(translate(v_name, 'áéíóúüñÁÉÍÓÚÜÑàèìòùÀÈÌÒÙ', 'aeiouunaeiouunaeiouaeiou')),
              '[^a-z0-9]+', '-', 'g'));
  IF v_base = '' THEN v_base := 'empresa'; END IF;
  v_slug := v_base;
  WHILE EXISTS (SELECT 1 FROM public.companies WHERE slug = v_slug) LOOP
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  END LOOP;

  INSERT INTO public.companies (name, slug, website, description, logo_url, verification_status)
  VALUES (v_name, v_slug, NULLIF(btrim(p_website), ''), NULLIF(btrim(p_description), ''),
          NULLIF(btrim(p_logo_url), ''), 'PENDING')
  RETURNING id INTO v_id;

  INSERT INTO public.company_members (company_id, user_id, role, added_by)
  VALUES (v_id, v_uid, 'OWNER', v_uid);

  RETURN v_id;
END;
$fn$;

-- Miembros con nombre y email (los perfiles ajenos no se leen por RLS).
CREATE OR REPLACE FUNCTION public.list_company_members(p_company_id INTEGER)
RETURNS TABLE (user_id UUID, name TEXT, email TEXT, role TEXT, is_active BOOLEAN, created_at TIMESTAMPTZ)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
#variable_conflict use_column
BEGIN
  IF NOT (public.is_company_member(p_company_id) OR public.has_permission('companies.view_all')) THEN
    RAISE EXCEPTION 'No tienes acceso a esta empresa.' USING ERRCODE = '42501';
  END IF;
  RETURN QUERY
    SELECT cm.user_id, p.name, p.email, cm.role, p.is_active, cm.created_at
      FROM public.company_members cm
      JOIN public.profiles p ON p.id = cm.user_id
     WHERE cm.company_id = p_company_id
     ORDER BY cm.role, cm.created_at;
END;
$fn$;

-- BO-104
CREATE OR REPLACE FUNCTION public.add_company_member(p_company_id INTEGER, p_email TEXT, p_role TEXT DEFAULT 'MEMBER')
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_staff BOOLEAN := public.has_permission('companies.edit');
  v_target UUID;
BEGIN
  IF NOT (v_staff OR public.is_company_member(p_company_id, 'OWNER')) THEN
    RAISE EXCEPTION 'Solo quien administra la empresa puede añadir personas.' USING ERRCODE = '42501';
  END IF;
  IF NOT v_staff AND NOT public.setting_bool('features.company_portal', FALSE) THEN
    RAISE EXCEPTION 'El portal de empresas está cerrado.' USING ERRCODE = 'P0001';
  END IF;
  IF p_role NOT IN ('OWNER', 'MEMBER') THEN
    RAISE EXCEPTION 'Rol no válido.' USING ERRCODE = '22023';
  END IF;

  SELECT id INTO v_target FROM public.profiles
   WHERE lower(email) = lower(btrim(COALESCE(p_email, ''))) AND is_active;
  IF v_target IS NULL THEN
    RAISE EXCEPTION 'No hay ninguna cuenta activa con ese email. Pídele que se registre primero.'
      USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.company_members WHERE company_id = p_company_id AND user_id = v_target) THEN
    RAISE EXCEPTION 'Esa persona ya forma parte del equipo.' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.company_members (company_id, user_id, role, added_by)
  VALUES (p_company_id, v_target, p_role, auth.uid());
END;
$fn$;

-- BO-105: siempre queda al menos una persona administradora.
CREATE OR REPLACE FUNCTION public.set_company_member_role(p_company_id INTEGER, p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NOT (public.has_permission('companies.edit') OR public.is_company_member(p_company_id, 'OWNER')) THEN
    RAISE EXCEPTION 'Solo quien administra la empresa puede cambiar roles.' USING ERRCODE = '42501';
  END IF;
  IF p_role NOT IN ('OWNER', 'MEMBER') THEN
    RAISE EXCEPTION 'Rol no válido.' USING ERRCODE = '22023';
  END IF;
  IF p_role = 'MEMBER' AND NOT EXISTS (
    SELECT 1 FROM public.company_members
     WHERE company_id = p_company_id AND role = 'OWNER' AND user_id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'La empresa debe tener al menos una persona administradora.' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.company_members SET role = p_role
   WHERE company_id = p_company_id AND user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esa persona no forma parte del equipo.' USING ERRCODE = 'P0001';
  END IF;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.remove_company_member(p_company_id INTEGER, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_role TEXT;
BEGIN
  -- Cualquiera puede salir de un equipo; echar a otra persona exige ser
  -- administradora de la empresa o del equipo de IAFAM.
  IF NOT (p_user_id = auth.uid()
          OR public.has_permission('companies.edit')
          OR public.is_company_member(p_company_id, 'OWNER')) THEN
    RAISE EXCEPTION 'Solo quien administra la empresa puede quitar personas.' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO v_role FROM public.company_members
   WHERE company_id = p_company_id AND user_id = p_user_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'Esa persona no forma parte del equipo.' USING ERRCODE = 'P0001';
  END IF;
  IF v_role = 'OWNER' AND NOT EXISTS (
    SELECT 1 FROM public.company_members
     WHERE company_id = p_company_id AND role = 'OWNER' AND user_id <> p_user_id
  ) THEN
    RAISE EXCEPTION 'La empresa debe tener al menos una persona administradora. Nombra a otra antes.'
      USING ERRCODE = 'P0001';
  END IF;

  DELETE FROM public.company_members WHERE company_id = p_company_id AND user_id = p_user_id;
END;
$fn$;

-- Moderación: la empresa ve el motivo del rechazo (BO-126).
CREATE OR REPLACE FUNCTION public.moderate_job(p_job_id INTEGER, p_decision TEXT, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NOT public.has_permission('jobs.publish') THEN
    RAISE EXCEPTION 'No tienes permiso para moderar ofertas.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('APPROVE', 'REJECT') THEN
    RAISE EXCEPTION 'Decisión no válida.' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'REJECT' AND COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Indica el motivo del rechazo.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('iafam.audit_reason', COALESCE(btrim(p_reason), ''), TRUE);

  UPDATE public.jobs
     SET status = CASE p_decision WHEN 'APPROVE' THEN 'ACTIVE' ELSE 'REJECTED' END,
         review_note = CASE p_decision WHEN 'APPROVE' THEN NULL ELSE btrim(p_reason) END
   WHERE id = p_job_id AND status = 'PENDING_REVIEW';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta oferta ya no está pendiente de revisión.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('iafam.audit_reason', '', TRUE);
END;
$fn$;

CREATE OR REPLACE FUNCTION public.review_company(p_company_id INTEGER, p_decision TEXT, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NOT public.has_permission('companies.verify') THEN
    RAISE EXCEPTION 'No tienes permiso para verificar empresas.' USING ERRCODE = '42501';
  END IF;
  IF p_decision NOT IN ('VERIFY', 'REJECT', 'RESET') THEN
    RAISE EXCEPTION 'Decisión no válida.' USING ERRCODE = '22023';
  END IF;
  IF p_decision = 'REJECT' AND COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Indica el motivo del rechazo.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('iafam.audit_reason', COALESCE(btrim(p_reason), ''), TRUE);

  UPDATE public.companies
     SET verification_status = CASE p_decision
           WHEN 'VERIFY' THEN 'VERIFIED'
           WHEN 'REJECT' THEN 'REJECTED'
           ELSE 'UNVERIFIED'
         END,
         review_note = CASE p_decision WHEN 'VERIFY' THEN NULL ELSE NULLIF(btrim(p_reason), '') END
   WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa no encontrada.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('iafam.audit_reason', '', TRUE);
END;
$fn$;

-- El historial de una ficha de empresa incluye los cambios de su equipo.
CREATE OR REPLACE FUNCTION public.entity_history(p_entity TEXT, p_entity_id TEXT)
RETURNS TABLE (
  id BIGINT, occurred_at TIMESTAMPTZ, actor_id UUID, actor_name TEXT, actor_role TEXT,
  action TEXT, entity TEXT, changes JSONB, reason TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
#variable_conflict use_column
DECLARE
  v_permission TEXT := CASE p_entity
    WHEN 'jobs'      THEN 'jobs.view_all'
    WHEN 'companies' THEN 'companies.view_all'
    WHEN 'profiles'  THEN 'users.view'
    WHEN 'reports'   THEN 'reports.view'
  END;
BEGIN
  IF v_permission IS NULL THEN
    RAISE EXCEPTION 'Entidad no válida.' USING ERRCODE = '22023';
  END IF;
  IF NOT (public.has_permission(v_permission) OR public.has_permission('audit.view')) THEN
    RAISE EXCEPTION 'No tienes permiso para ver este historial.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT a.id, a.occurred_at, a.actor_id, COALESCE(NULLIF(p.name, ''), p.email),
           a.actor_role, a.action, a.entity, a.changes, a.reason
      FROM public.audit_log a
      LEFT JOIN public.profiles p ON p.id = a.actor_id
     WHERE a.entity_id = p_entity_id
       AND (a.entity = p_entity
         OR (p_entity = 'jobs' AND a.entity = 'job_skills')
         OR (p_entity = 'companies' AND a.entity = 'company_members'))
     ORDER BY a.occurred_at DESC, a.id DESC
     LIMIT 200;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 9. VISTA PÚBLICA: sello de empresa verificada (BO-130)
-- ---------------------------------------------------------------------
CREATE OR REPLACE VIEW public.jobs_public
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
    ) AS skills,
    c.verification_status AS company_verification_status
FROM public.jobs j
LEFT JOIN public.companies  c   ON c.id   = j.company_id
LEFT JOIN public.categories cat ON cat.id = j.category_id
LEFT JOIN public.locations  l   ON l.id   = j.location_id;

-- ---------------------------------------------------------------------
-- 9b. CASCADAS "ON DELETE SET NULL" (corrige Etapas A y B)
--
-- Al borrar un perfil, Postgres pone a NULL las columnas que lo referencian
-- (resolved_by, user_id, updated_by…). Los triggers que protegen esas
-- columnas lo revertían y el borrado fallaba por clave foránea.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reports_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_system BOOLEAN := public.is_system_actor();
  v_fixed TEXT[] := ARRAY['status', 'resolution_note', 'resolved_at', 'resolved_by'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT v_system THEN
      -- BO-060: un reporte nace abierto y solo sobre ofertas publicadas.
      NEW.status := 'OPEN';
      NEW.resolution_note := NULL;
      NEW.resolved_at := NULL;
      NEW.resolved_by := NULL;
      IF NOT EXISTS (SELECT 1 FROM public.jobs WHERE id = NEW.job_id AND status = 'ACTIVE') THEN
        RAISE EXCEPTION 'Solo se pueden reportar ofertas publicadas.' USING ERRCODE = 'P0001';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  -- Quien reportó borró su cuenta: la cascada deja user_id a NULL.
  IF NEW.user_id IS NULL AND OLD.user_id IS NOT NULL THEN
    v_fixed := v_fixed || ARRAY['user_id'];
  END IF;

  -- BO-062: lo que escribió quien reporta no se toca; solo se resuelve.
  IF NOT v_system AND (to_jsonb(NEW) - v_fixed) IS DISTINCT FROM (to_jsonb(OLD) - v_fixed) THEN
    RAISE EXCEPTION 'Un reporte no se puede modificar, solo resolver.' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'OPEN' THEN
      NEW.resolved_at := NULL;
      NEW.resolved_by := NULL;
    ELSE
      -- BO-063
      IF NOT v_system AND COALESCE(btrim(NEW.resolution_note), '') = '' THEN
        RAISE EXCEPTION 'Indica cómo se resolvió el reporte.' USING ERRCODE = 'P0001';
      END IF;
      NEW.resolved_at := now();
      NEW.resolved_by := auth.uid();
    END IF;
  ELSE
    NEW.resolved_at := OLD.resolved_at;
    NEW.resolved_by := CASE WHEN NEW.resolved_by IS NULL THEN NULL ELSE OLD.resolved_by END;
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.app_settings_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  -- Cascada al borrar el perfil de quien cambió el ajuste: no es un cambio.
  IF NEW.updated_by IS NULL AND OLD.updated_by IS NOT NULL
     AND NEW.value IS NOT DISTINCT FROM OLD.value THEN
    RETURN NEW;
  END IF;
  NEW.key := OLD.key; -- las claves las definen las migraciones
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 10. PRIVILEGIOS
-- ---------------------------------------------------------------------
GRANT SELECT ON public.company_members TO authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.company_members FROM anon, authenticated;

REVOKE ALL ON FUNCTION public.job_skills_guard() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.setting_bool(TEXT, BOOLEAN) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.setting_int(TEXT, INTEGER)  FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.my_company_ids()                                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_company_member(INTEGER, TEXT)                     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.create_company_account(TEXT, TEXT, TEXT, TEXT)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.list_company_members(INTEGER)                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.add_company_member(INTEGER, TEXT, TEXT)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_company_member_role(INTEGER, UUID, TEXT)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.remove_company_member(INTEGER, UUID)                 FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.my_company_ids()                                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_company_member(INTEGER, TEXT)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_account(TEXT, TEXT, TEXT, TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_company_members(INTEGER)                     TO authenticated;
GRANT EXECUTE ON FUNCTION public.add_company_member(INTEGER, TEXT, TEXT)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_company_member_role(INTEGER, UUID, TEXT)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_company_member(INTEGER, UUID)              TO authenticated;
