-- =====================================================================
-- Backoffice, Etapa A: cimientos
-- Especificación: docs/02-backoffice.md (requisitos BO-xxx)
--
--   1. Roles: USER, MODERATOR, ADMIN
--   2. Permisos: catálogo, matriz por rol, has_permission(), my_permissions()
--   3. Estados de ofertas: tabla de transiciones + trigger jobs_guard
--   4. Perfiles: reglas de roles y suspensión (BO-001..007)
--   5. Configuración: app_settings
--   6. Auditoría: audit_log + trigger genérico
--   7. RLS reescrito con permisos
--   8. Permisos de ejecución y lectura
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. ROLES
-- ---------------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT profiles_role_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_role_check CHECK (role IN ('USER', 'MODERATOR', 'ADMIN'));

-- ---------------------------------------------------------------------
-- 2. PERMISOS
-- ---------------------------------------------------------------------
CREATE TABLE public.permissions (
    code         TEXT PRIMARY KEY,
    module       TEXT NOT NULL,
    description  TEXT NOT NULL
);

-- ADMIN no aparece: tiene todos los permisos de forma implícita, así no
-- puede quedarse fuera por un error al editar la matriz.
CREATE TABLE public.role_permissions (
    role        TEXT NOT NULL CHECK (role IN ('USER', 'MODERATOR')),
    permission  TEXT NOT NULL REFERENCES public.permissions(code) ON DELETE CASCADE,
    PRIMARY KEY (role, permission)
);

INSERT INTO public.permissions (code, module, description) VALUES
  ('dashboard.view',     'Resumen',       'Ver el resumen y sus cifras'),
  ('jobs.view_all',      'Ofertas',       'Ver ofertas en cualquier estado'),
  ('jobs.edit',          'Ofertas',       'Crear ofertas y editar su contenido'),
  ('jobs.publish',       'Ofertas',       'Cambiar el estado de las ofertas'),
  ('jobs.verify',        'Ofertas',       'Cambiar el estado de verificación'),
  ('jobs.delete',        'Ofertas',       'Eliminar ofertas'),
  ('companies.view_all', 'Empresas',      'Ver empresas desactivadas'),
  ('companies.edit',     'Empresas',      'Crear y editar empresas'),
  ('companies.delete',   'Empresas',      'Eliminar empresas'),
  ('reports.view',       'Reportes',      'Ver reportes de usuarios'),
  ('reports.resolve',    'Reportes',      'Resolver reportes'),
  ('users.view',         'Usuarios',      'Ver usuarios y su actividad'),
  ('users.suspend',      'Usuarios',      'Suspender y reactivar usuarios'),
  ('users.change_role',  'Usuarios',      'Cambiar roles (nunca el de administrador)'),
  ('catalog.edit',       'Catálogos',     'Editar áreas, skills, ubicaciones y fuentes'),
  ('settings.edit',      'Configuración', 'Cambiar la configuración'),
  ('audit.view',         'Auditoría',     'Consultar la auditoría');

INSERT INTO public.role_permissions (role, permission) VALUES
  ('MODERATOR', 'dashboard.view'),
  ('MODERATOR', 'jobs.view_all'),
  ('MODERATOR', 'jobs.edit'),
  ('MODERATOR', 'jobs.publish'),
  ('MODERATOR', 'jobs.verify'),
  ('MODERATOR', 'companies.view_all'),
  ('MODERATOR', 'companies.edit'),
  ('MODERATOR', 'reports.view'),
  ('MODERATOR', 'reports.resolve'),
  ('MODERATOR', 'users.view');

-- BO-010 / BO-012. SECURITY DEFINER para leer profiles y la matriz sin
-- depender del RLS de quien pregunta (y sin recursión en políticas).
CREATE OR REPLACE FUNCTION public.has_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM public.profiles pr
      JOIN public.permissions p ON p.code = p_permission
     WHERE pr.id = auth.uid()
       AND pr.is_active
       AND (
         pr.role = 'ADMIN'
         OR EXISTS (
           SELECT 1 FROM public.role_permissions rp
            WHERE rp.role = pr.role AND rp.permission = p_permission
         )
       )
  );
$fn$;

-- BO-011: lo que la interfaz necesita para decidir qué mostrar.
CREATE OR REPLACE FUNCTION public.my_permissions()
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT COALESCE(array_agg(p.code ORDER BY p.code), ARRAY[]::TEXT[])
    FROM public.permissions p
    JOIN public.profiles pr ON pr.id = auth.uid() AND pr.is_active
   WHERE pr.role = 'ADMIN'
      OR EXISTS (
        SELECT 1 FROM public.role_permissions rp
         WHERE rp.role = pr.role AND rp.permission = p.code
      );
$fn$;

CREATE OR REPLACE FUNCTION public.is_staff()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
     WHERE id = auth.uid() AND is_active AND role IN ('ADMIN', 'MODERATOR')
  );
$fn$;

-- Acción del sistema: sin usuario y sin ser una petición anónima. Cubre el
-- SQL Editor, las Edge Functions con service_role y las tareas
-- programadas. Una petición anónima NUNCA cuenta como sistema, aunque
-- tampoco tenga auth.uid().
CREATE OR REPLACE FUNCTION public.is_system_actor()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT auth.uid() IS NULL
     AND COALESCE(NULLIF(auth.role(), ''), 'system') NOT IN ('anon', 'authenticated');
$fn$;

-- ---------------------------------------------------------------------
-- 3. ESTADOS DE OFERTAS
-- ---------------------------------------------------------------------
CREATE TABLE public.job_status_transitions (
    from_status  TEXT NOT NULL,
    to_status    TEXT NOT NULL,
    PRIMARY KEY (from_status, to_status),
    CHECK (from_status <> to_status)
);

INSERT INTO public.job_status_transitions (from_status, to_status) VALUES
  ('DRAFT',          'PENDING_REVIEW'),
  ('DRAFT',          'ACTIVE'),
  ('DRAFT',          'REJECTED'),
  ('PENDING_REVIEW', 'ACTIVE'),
  ('PENDING_REVIEW', 'REJECTED'),
  ('PENDING_REVIEW', 'DRAFT'),
  ('ACTIVE',         'CLOSED'),
  ('ACTIVE',         'EXPIRED'),
  ('ACTIVE',         'REJECTED'),
  ('EXPIRED',        'ACTIVE'),
  ('EXPIRED',        'CLOSED'),
  ('CLOSED',         'ACTIVE'),
  ('REJECTED',       'DRAFT'),
  ('REJECTED',       'PENDING_REVIEW');

-- Para que los errores se lean en español y no con el código interno.
CREATE OR REPLACE FUNCTION public.job_status_label(p_status TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $fn$
  SELECT CASE p_status
    WHEN 'DRAFT'          THEN 'Borrador'
    WHEN 'PENDING_REVIEW' THEN 'En revisión'
    WHEN 'ACTIVE'         THEN 'Publicada'
    WHEN 'EXPIRED'        THEN 'Expirada'
    WHEN 'CLOSED'         THEN 'Cerrada'
    WHEN 'REJECTED'       THEN 'Rechazada'
    ELSE p_status
  END;
$fn$;

-- BO-030..034. El sistema (is_system_actor) se salta los permisos, pero
-- NO las transiciones de estado.
CREATE OR REPLACE FUNCTION public.jobs_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_system BOOLEAN := public.is_system_actor();
  -- Columnas que no son "contenido": tienen su propio permiso o las
  -- mantiene la base de datos.
  v_meta TEXT[] := ARRAY['status', 'verification_status', 'verified_at',
                         'verified_by', 'updated_at', 'fts', 'publication_date'];
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.status NOT IN ('DRAFT', 'PENDING_REVIEW', 'ACTIVE') THEN
      RAISE EXCEPTION 'Una oferta nueva solo puede empezar como Borrador, En revisión o Publicada.'
        USING ERRCODE = 'P0001';
    END IF;
    IF NOT v_system THEN
      IF NOT public.has_permission('jobs.edit') THEN
        RAISE EXCEPTION 'No tienes permiso para crear ofertas.' USING ERRCODE = '42501';
      END IF;
      IF NEW.status = 'ACTIVE' AND NOT public.has_permission('jobs.publish') THEN
        RAISE EXCEPTION 'No tienes permiso para publicar ofertas.' USING ERRCODE = '42501';
      END IF;
      IF NEW.verification_status <> 'PENDING' AND NOT public.has_permission('jobs.verify') THEN
        RAISE EXCEPTION 'No tienes permiso para verificar ofertas.' USING ERRCODE = '42501';
      END IF;
    END IF;
  ELSE
    -- Contenido: se compara antes de que este trigger toque nada.
    IF NOT v_system
       AND (to_jsonb(NEW) - v_meta) IS DISTINCT FROM (to_jsonb(OLD) - v_meta)
       AND NOT public.has_permission('jobs.edit') THEN
      RAISE EXCEPTION 'No tienes permiso para editar el contenido de las ofertas.'
        USING ERRCODE = '42501';
    END IF;

    IF NEW.status IS DISTINCT FROM OLD.status THEN
      IF NOT EXISTS (
        SELECT 1 FROM public.job_status_transitions t
         WHERE t.from_status = OLD.status AND t.to_status = NEW.status
      ) THEN
        RAISE EXCEPTION 'Una oferta no puede pasar de % a %.',
          public.job_status_label(OLD.status), public.job_status_label(NEW.status)
          USING ERRCODE = 'P0001';
      END IF;
      IF NOT v_system AND NOT public.has_permission('jobs.publish') THEN
        RAISE EXCEPTION 'No tienes permiso para cambiar el estado de las ofertas.'
          USING ERRCODE = '42501';
      END IF;
      IF NEW.status = 'ACTIVE' THEN
        NEW.publication_date := CURRENT_DATE;
      END IF;
    ELSIF NEW.publication_date IS DISTINCT FROM OLD.publication_date
          AND NOT v_system AND NOT public.has_permission('jobs.publish') THEN
      RAISE EXCEPTION 'No tienes permiso para cambiar la fecha de publicación.'
        USING ERRCODE = '42501';
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
    NEW.verified_by := OLD.verified_by;
  END IF;

  RETURN NEW;
END;
$fn$;

CREATE TRIGGER jobs_guard
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.jobs_guard();

-- ---------------------------------------------------------------------
-- 4. PERFILES (BO-001..007)
--
-- Sustituye a la versión anterior, que revertía los cambios en silencio.
-- Ahora un cambio no permitido falla con un mensaje explicando por qué.
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_profile_fields()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_actor UUID := auth.uid();
  v_personal_excluded TEXT[] := ARRAY['role', 'is_active', 'updated_at'];
BEGIN
  NEW.id := OLD.id;
  NEW.updated_at := now();

  -- BO-002: también protege del SQL Editor. Si de verdad hay que quitar al
  -- último administrador, primero se nombra a otro.
  IF OLD.role = 'ADMIN' AND OLD.is_active
     AND (NEW.role <> 'ADMIN' OR NOT NEW.is_active)
     AND NOT EXISTS (
       SELECT 1 FROM public.profiles
        WHERE role = 'ADMIN' AND is_active AND id <> OLD.id
     ) THEN
    RAISE EXCEPTION 'Debe quedar al menos un administrador activo.' USING ERRCODE = 'P0001';
  END IF;

  IF public.is_system_actor() THEN
    RETURN NEW; -- incluye el cambio de email que llega desde Auth
  END IF;

  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'Necesitas iniciar sesión.' USING ERRCODE = '42501';
  END IF;

  -- BO-007
  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'El email se cambia desde la cuenta de acceso, no desde el perfil.'
      USING ERRCODE = '42501';
  END IF;

  -- BO-006
  IF NEW.id <> v_actor
     AND (to_jsonb(NEW) - v_personal_excluded) IS DISTINCT FROM (to_jsonb(OLD) - v_personal_excluded) THEN
    RAISE EXCEPTION 'Los datos personales de un perfil solo los edita su dueño.'
      USING ERRCODE = '42501';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    IF NOT public.has_permission('users.change_role') THEN
      RAISE EXCEPTION 'No tienes permiso para cambiar roles.' USING ERRCODE = '42501';
    END IF;
    -- BO-001
    IF (OLD.role = 'ADMIN' OR NEW.role = 'ADMIN') AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Solo un administrador puede dar o quitar el rol de administrador.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
    IF NOT public.has_permission('users.suspend') THEN
      RAISE EXCEPTION 'No tienes permiso para suspender o reactivar usuarios.' USING ERRCODE = '42501';
    END IF;
    -- BO-003
    IF NEW.id = v_actor THEN
      RAISE EXCEPTION 'No puedes suspender tu propia cuenta.' USING ERRCODE = 'P0001';
    END IF;
    -- BO-004
    IF OLD.role = 'ADMIN' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Solo un administrador puede suspender a otro administrador.'
        USING ERRCODE = '42501';
    END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

-- BO-002 también al borrar.
CREATE OR REPLACE FUNCTION public.protect_last_admin_delete()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
BEGIN
  IF OLD.role = 'ADMIN' AND OLD.is_active AND NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE role = 'ADMIN' AND is_active AND id <> OLD.id
  ) THEN
    RAISE EXCEPTION 'Debe quedar al menos un administrador activo.' USING ERRCODE = 'P0001';
  END IF;
  RETURN OLD;
END;
$fn$;

CREATE TRIGGER profiles_protect_delete
  BEFORE DELETE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.protect_last_admin_delete();

-- ---------------------------------------------------------------------
-- 5. CONFIGURACIÓN
-- ---------------------------------------------------------------------
CREATE TABLE public.app_settings (
    key          TEXT PRIMARY KEY,
    value        JSONB NOT NULL,
    description  TEXT NOT NULL,
    is_public    BOOLEAN NOT NULL DEFAULT FALSE,
    updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by   UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

INSERT INTO public.app_settings (key, value, description, is_public) VALUES
  ('features.company_portal', 'false',
   'Abre el registro y el panel de empresas', TRUE),
  ('features.job_alerts', 'false',
   'Activa las alertas de ofertas para usuarios', TRUE),
  ('features.telegram_channel', 'false',
   'Publica automáticamente en Telegram las ofertas aprobadas', FALSE),
  ('jobs.expiry_days', '30',
   'Días hasta que caduca una oferta publicada sin fecha límite', FALSE),
  ('moderation.company_jobs_require_review', 'true',
   'Las ofertas creadas por empresas entran como En revisión', FALSE);

CREATE OR REPLACE FUNCTION public.app_settings_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $fn$
BEGIN
  NEW.key := OLD.key; -- las claves las definen las migraciones
  NEW.updated_at := now();
  NEW.updated_by := auth.uid();
  RETURN NEW;
END;
$fn$;

CREATE TRIGGER app_settings_touch
  BEFORE UPDATE ON public.app_settings
  FOR EACH ROW EXECUTE FUNCTION public.app_settings_touch();

-- ---------------------------------------------------------------------
-- 6. AUDITORÍA (BO-020..026)
-- ---------------------------------------------------------------------
CREATE TABLE public.audit_log (
    id           BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    occurred_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Sin clave foránea a propósito: la auditoría es un histórico y no
    -- debe cambiar (ni fallar) si el perfil del autor se borra después.
    actor_id     UUID,
    actor_role   TEXT,
    action       TEXT NOT NULL CHECK (action IN ('INSERT', 'UPDATE', 'DELETE')),
    entity       TEXT NOT NULL,
    entity_id    TEXT,
    changes      JSONB NOT NULL,
    reason       TEXT
);

CREATE INDEX audit_log_occurred_at_idx ON public.audit_log (occurred_at DESC);
CREATE INDEX audit_log_entity_idx      ON public.audit_log (entity, entity_id);
CREATE INDEX audit_log_actor_idx       ON public.audit_log (actor_id);

-- Trigger genérico. TG_ARGV[0] = columna que identifica la fila (por
-- defecto "id"; en tablas puente, la del padre, p. ej. job_skills → job_id).
--
-- BO-023: una función de moderación puede adjuntar el motivo antes de
-- escribir, dentro de la misma transacción:
--   PERFORM set_config('iafam.audit_reason', 'Oferta duplicada', true);
CREATE OR REPLACE FUNCTION public.audit_row_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $fn$
DECLARE
  v_ignored TEXT[] := ARRAY['updated_at', 'fts'];
  v_key     TEXT   := COALESCE(TG_ARGV[0], 'id');
  v_old     JSONB;
  v_new     JSONB;
  v_changes JSONB;
  v_actor   UUID   := auth.uid();
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN v_old := to_jsonb(OLD) - v_ignored; END IF;
  IF TG_OP IN ('INSERT', 'UPDATE') THEN v_new := to_jsonb(NEW) - v_ignored; END IF;

  IF TG_OP = 'UPDATE' THEN
    -- BO-022: solo lo que cambió, con antes y después.
    SELECT jsonb_object_agg(n.key, jsonb_build_object('old', v_old -> n.key, 'new', n.value))
      INTO v_changes
      FROM jsonb_each(v_new) AS n
     WHERE (v_old -> n.key) IS DISTINCT FROM n.value;

    IF v_changes IS NULL THEN
      RETURN NEW; -- solo cambiaron columnas ignoradas
    END IF;
  ELSE
    v_changes := COALESCE(v_new, v_old);
  END IF;

  INSERT INTO public.audit_log (actor_id, actor_role, action, entity, entity_id, changes, reason)
  VALUES (
    v_actor,
    (SELECT role FROM public.profiles WHERE id = v_actor),
    TG_OP,
    TG_TABLE_NAME,
    COALESCE(v_new, v_old) ->> v_key,
    v_changes,
    NULLIF(current_setting('iafam.audit_reason', TRUE), '')
  );

  RETURN COALESCE(NEW, OLD);
END;
$fn$;

CREATE TRIGGER audit_jobs          AFTER INSERT OR UPDATE OR DELETE ON public.jobs             FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_job_skills    AFTER INSERT OR UPDATE OR DELETE ON public.job_skills       FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('job_id');
CREATE TRIGGER audit_companies     AFTER INSERT OR UPDATE OR DELETE ON public.companies        FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_profiles      AFTER INSERT OR UPDATE OR DELETE ON public.profiles         FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_categories    AFTER INSERT OR UPDATE OR DELETE ON public.categories       FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_skills        AFTER INSERT OR UPDATE OR DELETE ON public.skills           FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_locations     AFTER INSERT OR UPDATE OR DELETE ON public.locations        FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_sources       AFTER INSERT OR UPDATE OR DELETE ON public.sources          FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_reports       AFTER INSERT OR UPDATE OR DELETE ON public.reports          FOR EACH ROW EXECUTE FUNCTION public.audit_row_change();
CREATE TRIGGER audit_role_perms    AFTER INSERT OR UPDATE OR DELETE ON public.role_permissions FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('role');
CREATE TRIGGER audit_app_settings  AFTER INSERT OR UPDATE OR DELETE ON public.app_settings     FOR EACH ROW EXECUTE FUNCTION public.audit_row_change('key');

-- ---------------------------------------------------------------------
-- 7. RLS CON PERMISOS
--
-- (SELECT has_permission(...)) entre paréntesis: Postgres lo evalúa una
-- vez por consulta en lugar de una vez por fila.
-- Las políticas de `anon` no se tocan: nunca llaman a funciones.
-- ---------------------------------------------------------------------
ALTER TABLE public.permissions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.job_status_transitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log              ENABLE ROW LEVEL SECURITY;

-- ----- Tablas nuevas -----
CREATE POLICY permissions_read_staff ON public.permissions
  FOR SELECT TO authenticated USING ((SELECT public.is_staff()));

CREATE POLICY role_permissions_read_staff ON public.role_permissions
  FOR SELECT TO authenticated USING ((SELECT public.is_staff()));
CREATE POLICY role_permissions_write_admin ON public.role_permissions
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin()));
CREATE POLICY role_permissions_delete_admin ON public.role_permissions
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

CREATE POLICY job_status_transitions_read ON public.job_status_transitions
  FOR SELECT TO authenticated USING (true);

CREATE POLICY app_settings_read_anon ON public.app_settings
  FOR SELECT TO anon USING (is_public);
CREATE POLICY app_settings_read_auth ON public.app_settings
  FOR SELECT TO authenticated USING (is_public OR (SELECT public.is_staff()));
CREATE POLICY app_settings_update ON public.app_settings
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('settings.edit')))
  WITH CHECK ((SELECT public.has_permission('settings.edit')));

CREATE POLICY audit_log_read ON public.audit_log
  FOR SELECT TO authenticated USING ((SELECT public.has_permission('audit.view')));

-- ----- Ofertas -----
DROP POLICY jobs_read_auth   ON public.jobs;
DROP POLICY jobs_write_admin ON public.jobs;

CREATE POLICY jobs_read_auth ON public.jobs
  FOR SELECT TO authenticated
  USING (status = 'ACTIVE' OR (SELECT public.has_permission('jobs.view_all')));
CREATE POLICY jobs_insert ON public.jobs
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_permission('jobs.edit')));
-- El detalle de qué columna exige qué permiso lo resuelve jobs_guard.
CREATE POLICY jobs_update ON public.jobs
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('jobs.edit'))
      OR (SELECT public.has_permission('jobs.publish'))
      OR (SELECT public.has_permission('jobs.verify')))
  WITH CHECK ((SELECT public.has_permission('jobs.edit'))
      OR (SELECT public.has_permission('jobs.publish'))
      OR (SELECT public.has_permission('jobs.verify')));
CREATE POLICY jobs_delete ON public.jobs
  FOR DELETE TO authenticated
  USING ((SELECT public.has_permission('jobs.delete')));

DROP POLICY job_skills_read_auth ON public.job_skills;
DROP POLICY job_skills_write     ON public.job_skills;

CREATE POLICY job_skills_read_auth ON public.job_skills
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j
                  WHERE j.id = job_id
                    AND (j.status = 'ACTIVE' OR (SELECT public.has_permission('jobs.view_all')))));
CREATE POLICY job_skills_insert ON public.job_skills
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.has_permission('jobs.edit')));
CREATE POLICY job_skills_delete ON public.job_skills
  FOR DELETE TO authenticated USING ((SELECT public.has_permission('jobs.edit')));

DROP POLICY job_sources_admin ON public.job_sources;
CREATE POLICY job_sources_staff ON public.job_sources
  FOR ALL TO authenticated
  USING ((SELECT public.has_permission('jobs.view_all')))
  WITH CHECK ((SELECT public.has_permission('jobs.edit')));

-- ----- Empresas -----
DROP POLICY companies_read_auth ON public.companies;
DROP POLICY companies_write     ON public.companies;

CREATE POLICY companies_read_auth ON public.companies
  FOR SELECT TO authenticated
  USING (is_active OR (SELECT public.has_permission('companies.view_all')));
CREATE POLICY companies_insert ON public.companies
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.has_permission('companies.edit')));
CREATE POLICY companies_update ON public.companies
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('companies.edit')))
  WITH CHECK ((SELECT public.has_permission('companies.edit')));
CREATE POLICY companies_delete ON public.companies
  FOR DELETE TO authenticated USING ((SELECT public.has_permission('companies.delete')));

-- ----- Catálogos y fuentes -----
DROP POLICY categories_write ON public.categories;
DROP POLICY skills_write     ON public.skills;
DROP POLICY locations_write  ON public.locations;
DROP POLICY sources_admin    ON public.sources;

CREATE POLICY categories_write ON public.categories
  FOR ALL TO authenticated
  USING ((SELECT public.has_permission('catalog.edit')))
  WITH CHECK ((SELECT public.has_permission('catalog.edit')));
CREATE POLICY skills_write ON public.skills
  FOR ALL TO authenticated
  USING ((SELECT public.has_permission('catalog.edit')))
  WITH CHECK ((SELECT public.has_permission('catalog.edit')));
CREATE POLICY locations_write ON public.locations
  FOR ALL TO authenticated
  USING ((SELECT public.has_permission('catalog.edit')))
  WITH CHECK ((SELECT public.has_permission('catalog.edit')));
CREATE POLICY sources_read_staff ON public.sources
  FOR SELECT TO authenticated USING ((SELECT public.has_permission('jobs.view_all')));
CREATE POLICY sources_write ON public.sources
  FOR ALL TO authenticated
  USING ((SELECT public.has_permission('catalog.edit')))
  WITH CHECK ((SELECT public.has_permission('catalog.edit')));

-- ----- Perfiles -----
DROP POLICY profiles_select_own    ON public.profiles;
DROP POLICY profiles_update_own    ON public.profiles;
DROP POLICY profiles_delete_admin  ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid() OR (SELECT public.has_permission('users.view')));
-- Qué campos puede tocar cada quien lo decide protect_profile_fields.
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = auth.uid()
      OR (SELECT public.has_permission('users.suspend'))
      OR (SELECT public.has_permission('users.change_role')))
  WITH CHECK (id = auth.uid()
      OR (SELECT public.has_permission('users.suspend'))
      OR (SELECT public.has_permission('users.change_role')));
CREATE POLICY profiles_delete ON public.profiles
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- ----- Actividad de usuarios: el equipo la ve con users.view -----
DROP POLICY favorites_own    ON public.favorites;
DROP POLICY applications_own ON public.applications;
DROP POLICY alerts_own       ON public.alerts;
DROP POLICY alert_skills_own ON public.alert_skills;
DROP POLICY user_skills_own  ON public.user_skills;

CREATE POLICY favorites_own ON public.favorites
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.has_permission('users.view')))
  WITH CHECK (user_id = auth.uid());
CREATE POLICY applications_own ON public.applications
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.has_permission('users.view')))
  WITH CHECK (user_id = auth.uid());
CREATE POLICY alerts_own ON public.alerts
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.has_permission('users.view')))
  WITH CHECK (user_id = auth.uid());
CREATE POLICY alert_skills_own ON public.alert_skills
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.alerts a
                  WHERE a.id = alert_id
                    AND (a.user_id = auth.uid() OR (SELECT public.has_permission('users.view')))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.alerts a
                       WHERE a.id = alert_id AND a.user_id = auth.uid()));
CREATE POLICY user_skills_own ON public.user_skills
  FOR ALL TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.has_permission('users.view')))
  WITH CHECK (user_id = auth.uid());

-- ----- Reportes -----
DROP POLICY reports_select_own   ON public.reports;
DROP POLICY reports_update_admin ON public.reports;
DROP POLICY reports_delete_admin ON public.reports;

CREATE POLICY reports_select ON public.reports
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR (SELECT public.has_permission('reports.view')));
CREATE POLICY reports_update ON public.reports
  FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('reports.resolve')))
  WITH CHECK ((SELECT public.has_permission('reports.resolve')));
CREATE POLICY reports_delete ON public.reports
  FOR DELETE TO authenticated USING ((SELECT public.is_admin()));

-- ----- Estadísticas: también para moderadores -----
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

-- ---------------------------------------------------------------------
-- 8. PRIVILEGIOS
-- ---------------------------------------------------------------------
GRANT SELECT ON public.permissions, public.job_status_transitions, public.audit_log TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.role_permissions TO authenticated;
GRANT SELECT, UPDATE ON public.app_settings TO authenticated;
GRANT SELECT ON public.app_settings TO anon;
-- La auditoría solo la escriben los triggers (BO-024).
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.audit_log FROM anon, authenticated;

-- Funciones de trigger: solo las invoca el motor.
REVOKE ALL ON FUNCTION public.jobs_guard()                FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_last_admin_delete() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.app_settings_touch()        FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.audit_row_change()          FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_fields()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.is_system_actor()           FROM PUBLIC, anon, authenticated;

-- RPC y funciones usadas por políticas: solo usuarios con sesión.
REVOKE ALL ON FUNCTION public.has_permission(TEXT)  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_permissions()      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.is_staff()            FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.job_status_label(TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_stats()     FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_permission(TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_permissions()       TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_staff()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.job_status_label(TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats()      TO authenticated;
