-- =====================================================================
-- Backoffice, Etapa B: control
-- Especificación: docs/02-backoffice.md (requisitos BO-050 en adelante)
--
--   1. Permiso nuevo: companies.verify
--   2. Empresas: verificación y borrado protegido
--   3. Reportes: resolución obligatoria con nota, un reporte abierto por
--      usuario y oferta
--   4. Notas internas del equipo
--   5. Acciones de moderación (guardan el motivo en la auditoría)
--   6. Consultas del backoffice: historial, auditoría, usuarios, contadores
--   7. Privilegios
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. PERMISOS
-- ---------------------------------------------------------------------
INSERT INTO public.permissions (code, module, description) VALUES
  ('companies.verify', 'Empresas', 'Verificar o rechazar empresas');

INSERT INTO public.role_permissions (role, permission) VALUES
  ('MODERATOR', 'companies.verify');

-- ---------------------------------------------------------------------
-- 2. EMPRESAS
-- ---------------------------------------------------------------------
ALTER TABLE public.companies
  ADD COLUMN verification_status TEXT NOT NULL DEFAULT 'UNVERIFIED'
    CHECK (verification_status IN ('UNVERIFIED', 'PENDING', 'VERIFIED', 'REJECTED')),
  ADD COLUMN verified_at TIMESTAMPTZ,
  ADD COLUMN verified_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN updated_at  TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX companies_verification_status_idx ON public.companies (verification_status);

-- BO-052 / BO-053: la verificación exige companies.verify y sus campos
-- los escribe solo la base de datos.
CREATE OR REPLACE FUNCTION public.companies_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_system BOOLEAN := public.is_system_actor();
  v_meta TEXT[] := ARRAY['verification_status', 'verified_at', 'verified_by', 'updated_at'];
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NOT v_system
       AND (to_jsonb(NEW) - v_meta) IS DISTINCT FROM (to_jsonb(OLD) - v_meta)
       AND NOT public.has_permission('companies.edit') THEN
      RAISE EXCEPTION 'No tienes permiso para editar empresas.' USING ERRCODE = '42501';
    END IF;
    NEW.updated_at := now();
  END IF;

  IF TG_OP = 'INSERT' OR NEW.verification_status IS DISTINCT FROM OLD.verification_status THEN
    IF NOT v_system
       AND NOT public.has_permission('companies.verify')
       AND (TG_OP = 'UPDATE' OR NEW.verification_status NOT IN ('UNVERIFIED', 'PENDING')) THEN
      RAISE EXCEPTION 'No tienes permiso para verificar empresas.' USING ERRCODE = '42501';
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
    NEW.verified_by := OLD.verified_by;
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER companies_guard
  BEFORE INSERT OR UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.companies_guard();

-- BO-054: borrar una empresa borraría en cascada sus ofertas. Con ofertas,
-- se desactiva; solo se puede borrar una empresa vacía.
CREATE OR REPLACE FUNCTION public.companies_protect_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF EXISTS (SELECT 1 FROM public.jobs WHERE company_id = OLD.id) THEN
    RAISE EXCEPTION 'Esta empresa tiene ofertas: desactívala en lugar de borrarla.'
      USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$fn$;

CREATE TRIGGER companies_protect_delete
  BEFORE DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.companies_protect_delete();

-- Quien solo puede verificar también necesita poder actualizar la fila.
DROP POLICY companies_update ON public.companies;
CREATE POLICY companies_update ON public.companies
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('companies.edit'))
      OR (SELECT public.has_permission('companies.verify')))
  WITH CHECK ((SELECT public.has_permission('companies.edit'))
      OR (SELECT public.has_permission('companies.verify')));

-- ---------------------------------------------------------------------
-- 3. REPORTES
-- ---------------------------------------------------------------------
ALTER TABLE public.reports ADD COLUMN resolution_note TEXT;

-- BO-061: evita que un mismo usuario inunde la bandeja con la misma oferta.
CREATE UNIQUE INDEX reports_one_open_per_user_idx
  ON public.reports (job_id, user_id) WHERE status = 'OPEN';
CREATE INDEX reports_status_idx ON public.reports (status);

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
    NEW.resolved_by := OLD.resolved_by;
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER reports_guard
  BEFORE INSERT OR UPDATE ON public.reports
  FOR EACH ROW EXECUTE FUNCTION public.reports_guard();

-- ---------------------------------------------------------------------
-- 4. NOTAS INTERNAS (BO-070..072)
-- ---------------------------------------------------------------------
CREATE TABLE public.internal_notes (
    id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    entity      TEXT NOT NULL CHECK (entity IN ('jobs', 'companies', 'profiles')),
    entity_id   TEXT NOT NULL,
    body        TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 2000),
    author_id   UUID DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX internal_notes_entity_idx ON public.internal_notes (entity, entity_id, created_at DESC);
CREATE INDEX internal_notes_author_idx ON public.internal_notes (author_id);

ALTER TABLE public.internal_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY internal_notes_read ON public.internal_notes
  FOR SELECT TO authenticated USING ((SELECT public.is_staff()));
CREATE POLICY internal_notes_insert ON public.internal_notes
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.is_staff()) AND author_id = (SELECT auth.uid()));
CREATE POLICY internal_notes_delete ON public.internal_notes
  FOR DELETE TO authenticated
  USING (author_id = (SELECT auth.uid()) OR (SELECT public.is_admin()));

CREATE TRIGGER audit_internal_notes
  AFTER INSERT OR UPDATE OR DELETE ON public.internal_notes
  FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();

-- ---------------------------------------------------------------------
-- 5. ACCIONES DE MODERACIÓN
--
-- SECURITY INVOKER: se ejecutan con los permisos de quien llama, así que
-- RLS y los triggers siguen decidiendo. Su trabajo es validar la decisión,
-- exigir motivo cuando toca y adjuntarlo a la auditoría (BO-023).
-- ---------------------------------------------------------------------

-- BO-050 / BO-051
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
     SET status = CASE p_decision WHEN 'APPROVE' THEN 'ACTIVE' ELSE 'REJECTED' END
   WHERE id = p_job_id AND status = 'PENDING_REVIEW';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Esta oferta ya no está pendiente de revisión.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('iafam.audit_reason', '', TRUE);
END;
$fn$;

-- BO-063 / BO-064
CREATE OR REPLACE FUNCTION public.resolve_report(
  p_report_id INTEGER,
  p_outcome TEXT,
  p_note TEXT,
  p_job_action TEXT DEFAULT 'NONE'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_job_id INTEGER;
BEGIN
  IF NOT public.has_permission('reports.resolve') THEN
    RAISE EXCEPTION 'No tienes permiso para resolver reportes.' USING ERRCODE = '42501';
  END IF;
  IF p_outcome NOT IN ('RESOLVED', 'DISMISSED') OR p_job_action NOT IN ('NONE', 'MARK_REPORTED', 'CLOSE_JOB') THEN
    RAISE EXCEPTION 'Decisión no válida.' USING ERRCODE = '22023';
  END IF;
  IF p_outcome = 'DISMISSED' AND p_job_action <> 'NONE' THEN
    RAISE EXCEPTION 'Un reporte descartado no cambia la oferta.' USING ERRCODE = 'P0001';
  END IF;
  IF COALESCE(btrim(p_note), '') = '' THEN
    RAISE EXCEPTION 'Indica cómo se resolvió el reporte.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('iafam.audit_reason', btrim(p_note), TRUE);

  UPDATE public.reports
     SET status = p_outcome, resolution_note = btrim(p_note)
   WHERE id = p_report_id AND status = 'OPEN'
  RETURNING job_id INTO v_job_id;

  IF v_job_id IS NULL THEN
    RAISE EXCEPTION 'Este reporte ya estaba resuelto.' USING ERRCODE = 'P0001';
  END IF;

  IF p_job_action = 'MARK_REPORTED' THEN
    UPDATE public.jobs SET verification_status = 'REPORTED' WHERE id = v_job_id;
  ELSIF p_job_action = 'CLOSE_JOB' THEN
    UPDATE public.jobs SET status = 'CLOSED' WHERE id = v_job_id AND status = 'ACTIVE';
  END IF;

  PERFORM set_config('iafam.audit_reason', '', TRUE);
END;
$fn$;

-- BO-052
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
         END
   WHERE id = p_company_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Empresa no encontrada.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('iafam.audit_reason', '', TRUE);
END;
$fn$;

-- BO-080 (el trigger protect_profile_fields aplica BO-001..004)
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id UUID, p_role TEXT, p_reason TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NOT public.has_permission('users.change_role') THEN
    RAISE EXCEPTION 'No tienes permiso para cambiar roles.' USING ERRCODE = '42501';
  END IF;
  IF COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Indica el motivo del cambio de rol.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('iafam.audit_reason', btrim(p_reason), TRUE);
  UPDATE public.profiles SET role = p_role WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('iafam.audit_reason', '', TRUE);
END;
$fn$;

-- BO-081. No se llama desde el navegador: la Edge Function manage-user la
-- invoca con la sesión de quien actúa y después bloquea el acceso en Auth.
CREATE OR REPLACE FUNCTION public.set_user_active(p_user_id UUID, p_active BOOLEAN, p_reason TEXT DEFAULT NULL)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF NOT public.has_permission('users.suspend') THEN
    RAISE EXCEPTION 'No tienes permiso para suspender o reactivar usuarios.' USING ERRCODE = '42501';
  END IF;
  IF NOT p_active AND COALESCE(btrim(p_reason), '') = '' THEN
    RAISE EXCEPTION 'Indica el motivo de la suspensión.' USING ERRCODE = 'P0001';
  END IF;

  PERFORM set_config('iafam.audit_reason', COALESCE(btrim(p_reason), ''), TRUE);
  UPDATE public.profiles SET is_active = p_active WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Usuario no encontrado.' USING ERRCODE = 'P0001';
  END IF;
  PERFORM set_config('iafam.audit_reason', '', TRUE);
END;
$fn$;

-- ---------------------------------------------------------------------
-- 6. CONSULTAS DEL BACKOFFICE
-- ---------------------------------------------------------------------

-- Pendientes de la bandeja. SECURITY INVOKER: cada contador respeta el RLS
-- de quien pregunta.
CREATE OR REPLACE FUNCTION public.moderation_counts()
RETURNS JSON
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_temp
AS $fn$
  SELECT json_build_object(
    'jobs',      (SELECT count(*) FROM public.jobs      WHERE status = 'PENDING_REVIEW'),
    'reports',   (SELECT count(*) FROM public.reports   WHERE status = 'OPEN'),
    'companies', (SELECT count(*) FROM public.companies WHERE verification_status = 'PENDING')
  );
$fn$;

-- BO-090: historial de una ficha. Quien puede ver la ficha puede ver su
-- historial, aunque no tenga acceso a la auditoría completa.
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
       AND (a.entity = p_entity OR (p_entity = 'jobs' AND a.entity = 'job_skills'))
     ORDER BY a.occurred_at DESC, a.id DESC
     LIMIT 200;
END;
$fn$;

-- BO-091: auditoría completa con filtros y paginación.
CREATE OR REPLACE FUNCTION public.audit_search(
  p_entity TEXT DEFAULT NULL,
  p_action TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL,
  p_from TIMESTAMPTZ DEFAULT NULL,
  p_to TIMESTAMPTZ DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id BIGINT, occurred_at TIMESTAMPTZ, actor_id UUID, actor_name TEXT, actor_email TEXT,
  actor_role TEXT, action TEXT, entity TEXT, entity_id TEXT, changes JSONB, reason TEXT,
  total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
#variable_conflict use_column
BEGIN
  IF NOT public.has_permission('audit.view') THEN
    RAISE EXCEPTION 'No tienes permiso para consultar la auditoría.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT a.id, a.occurred_at, a.actor_id, NULLIF(p.name, ''), p.email,
           a.actor_role, a.action, a.entity, a.entity_id, a.changes, a.reason,
           count(*) OVER ()
      FROM public.audit_log a
      LEFT JOIN public.profiles p ON p.id = a.actor_id
     WHERE (p_entity   IS NULL OR a.entity = p_entity)
       AND (p_action   IS NULL OR a.action = p_action)
       AND (p_actor_id IS NULL OR a.actor_id = p_actor_id)
       AND (p_from     IS NULL OR a.occurred_at >= p_from)
       AND (p_to       IS NULL OR a.occurred_at <  p_to)
     ORDER BY a.occurred_at DESC, a.id DESC
     LIMIT LEAST(GREATEST(p_limit, 1), 200)
    OFFSET GREATEST(p_offset, 0);
END;
$fn$;

-- BO-082: listado de usuarios con datos de acceso (auth.users no es
-- accesible desde la API, por eso SECURITY DEFINER con comprobación).
CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search TEXT DEFAULT NULL,
  p_role TEXT DEFAULT NULL,
  p_active BOOLEAN DEFAULT NULL,
  p_limit INTEGER DEFAULT 25,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  id UUID, email TEXT, name TEXT, role TEXT, is_active BOOLEAN, created_at TIMESTAMPTZ,
  last_sign_in_at TIMESTAMPTZ, banned_until TIMESTAMPTZ, total_count BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
#variable_conflict use_column
DECLARE
  v_pattern TEXT := '%' || replace(replace(replace(btrim(COALESCE(p_search, '')), '\', '\\'), '%', '\%'), '_', '\_') || '%';
BEGIN
  IF NOT public.has_permission('users.view') THEN
    RAISE EXCEPTION 'No tienes permiso para ver usuarios.' USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
    SELECT pr.id, pr.email, pr.name, pr.role, pr.is_active, pr.created_at,
           u.last_sign_in_at, u.banned_until, count(*) OVER ()
      FROM public.profiles pr
      LEFT JOIN auth.users u ON u.id = pr.id
     WHERE (COALESCE(btrim(p_search), '') = '' OR pr.name ILIKE v_pattern OR pr.email ILIKE v_pattern)
       AND (p_role   IS NULL OR pr.role = p_role)
       AND (p_active IS NULL OR pr.is_active = p_active)
     ORDER BY pr.created_at DESC
     LIMIT LEAST(GREATEST(p_limit, 1), 100)
    OFFSET GREATEST(p_offset, 0);
END;
$fn$;

-- BO-083: ficha de usuario con actividad.
CREATE OR REPLACE FUNCTION public.admin_user_detail(p_user_id UUID)
RETURNS JSON
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  result JSON;
BEGIN
  IF NOT public.has_permission('users.view') THEN
    RAISE EXCEPTION 'No tienes permiso para ver usuarios.' USING ERRCODE = '42501';
  END IF;

  SELECT json_build_object(
    'profile', to_jsonb(pr),
    'access', json_build_object(
      'created_at',         u.created_at,
      'last_sign_in_at',    u.last_sign_in_at,
      'email_confirmed_at', u.email_confirmed_at,
      'banned_until',       u.banned_until
    ),
    'activity', json_build_object(
      'favorites',    (SELECT count(*) FROM public.favorites    WHERE user_id = pr.id),
      'applications', (SELECT count(*) FROM public.applications WHERE user_id = pr.id),
      'alerts',       (SELECT count(*) FROM public.alerts       WHERE user_id = pr.id),
      'reports_sent', (SELECT count(*) FROM public.reports      WHERE user_id = pr.id)
    )
  )
    INTO result
    FROM public.profiles pr
    LEFT JOIN auth.users u ON u.id = pr.id
   WHERE pr.id = p_user_id;

  IF result IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado.' USING ERRCODE = 'P0001';
  END IF;
  RETURN result;
END;
$fn$;

-- Resumen: añade empresas pendientes de verificar.
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
  IF NOT public.has_permission('dashboard.view') THEN
    RAISE EXCEPTION 'No tienes permiso para ver el resumen.' USING ERRCODE = '42501';
  END IF;

  SELECT json_build_object(
    'total_jobs',        (SELECT count(*) FROM public.jobs),
    'active_jobs',       (SELECT count(*) FROM public.jobs WHERE status = 'ACTIVE'),
    'pending_jobs',      (SELECT count(*) FROM public.jobs WHERE status = 'PENDING_REVIEW'),
    'expired_jobs',      (SELECT count(*) FROM public.jobs WHERE status = 'EXPIRED'),
    'reported_jobs',     (SELECT count(*) FROM public.jobs WHERE verification_status = 'REPORTED'),
    'total_users',       (SELECT count(*) FROM public.profiles),
    'suspended_users',   (SELECT count(*) FROM public.profiles WHERE NOT is_active),
    'open_reports',      (SELECT count(*) FROM public.reports WHERE status = 'OPEN'),
    'total_companies',   (SELECT count(*) FROM public.companies),
    'pending_companies', (SELECT count(*) FROM public.companies WHERE verification_status = 'PENDING')
  ) INTO result;

  RETURN result;
END;
$fn$;

-- ---------------------------------------------------------------------
-- 7. PRIVILEGIOS
-- ---------------------------------------------------------------------
GRANT SELECT, INSERT, DELETE ON public.internal_notes TO authenticated;

REVOKE ALL ON FUNCTION public.companies_guard()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.companies_protect_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.reports_guard()            FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.moderate_job(INTEGER, TEXT, TEXT)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.resolve_report(INTEGER, TEXT, TEXT, TEXT)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.review_company(INTEGER, TEXT, TEXT)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_user_role(UUID, TEXT, TEXT)            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.set_user_active(UUID, BOOLEAN, TEXT)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.moderation_counts()                        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.entity_history(TEXT, TEXT)                 FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.audit_search(TEXT, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_users(TEXT, TEXT, BOOLEAN, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_user_detail(UUID)                    FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.moderate_job(INTEGER, TEXT, TEXT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_report(INTEGER, TEXT, TEXT, TEXT)  TO authenticated;
GRANT EXECUTE ON FUNCTION public.review_company(INTEGER, TEXT, TEXT)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_role(UUID, TEXT, TEXT)            TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_user_active(UUID, BOOLEAN, TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.moderation_counts()                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.entity_history(TEXT, TEXT)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.audit_search(TEXT, TEXT, UUID, TIMESTAMPTZ, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_users(TEXT, TEXT, BOOLEAN, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_user_detail(UUID)                    TO authenticated;
