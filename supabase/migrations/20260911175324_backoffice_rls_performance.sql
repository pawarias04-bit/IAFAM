-- =====================================================================
-- Backoffice, Etapa A: ajustes de rendimiento del RLS
-- (avisos del Performance Advisor de Supabase tras backoffice_foundation)
--
--   1. auth.uid() → (SELECT auth.uid()): se evalúa una vez por consulta,
--      no una vez por fila.
--   2. Las políticas FOR ALL de catálogos también cubrían SELECT y se
--      sumaban a la de lectura pública: se separan por acción.
--   3. Índices para las claves foráneas que se usan al filtrar o al
--      borrar en cascada.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. auth.uid() una vez por consulta
-- ---------------------------------------------------------------------
DROP POLICY profiles_select ON public.profiles;
DROP POLICY profiles_update ON public.profiles;

CREATE POLICY profiles_select ON public.profiles
  FOR SELECT TO authenticated
  USING (id = (SELECT auth.uid()) OR (SELECT public.has_permission('users.view')));
CREATE POLICY profiles_update ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid())
      OR (SELECT public.has_permission('users.suspend'))
      OR (SELECT public.has_permission('users.change_role')))
  WITH CHECK (id = (SELECT auth.uid())
      OR (SELECT public.has_permission('users.suspend'))
      OR (SELECT public.has_permission('users.change_role')));

DROP POLICY favorites_own    ON public.favorites;
DROP POLICY applications_own ON public.applications;
DROP POLICY alerts_own       ON public.alerts;
DROP POLICY alert_skills_own ON public.alert_skills;
DROP POLICY user_skills_own  ON public.user_skills;

CREATE POLICY favorites_own ON public.favorites
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.has_permission('users.view')))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY applications_own ON public.applications
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.has_permission('users.view')))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY alerts_own ON public.alerts
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.has_permission('users.view')))
  WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY alert_skills_own ON public.alert_skills
  FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.alerts a
                  WHERE a.id = alert_id
                    AND (a.user_id = (SELECT auth.uid()) OR (SELECT public.has_permission('users.view')))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.alerts a
                       WHERE a.id = alert_id AND a.user_id = (SELECT auth.uid())));
CREATE POLICY user_skills_own ON public.user_skills
  FOR ALL TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.has_permission('users.view')))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY reports_insert_own ON public.reports;
DROP POLICY reports_select     ON public.reports;

CREATE POLICY reports_insert_own ON public.reports
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY reports_select ON public.reports
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()) OR (SELECT public.has_permission('reports.view')));

-- ---------------------------------------------------------------------
-- 2. Catálogos: escritura separada de la lectura
-- ---------------------------------------------------------------------
DROP POLICY categories_write ON public.categories;
DROP POLICY skills_write     ON public.skills;
DROP POLICY locations_write  ON public.locations;
DROP POLICY sources_write    ON public.sources;

CREATE POLICY categories_insert ON public.categories FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_permission('catalog.edit')));
CREATE POLICY categories_update ON public.categories FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('catalog.edit')))
  WITH CHECK ((SELECT public.has_permission('catalog.edit')));
CREATE POLICY categories_delete ON public.categories FOR DELETE TO authenticated
  USING ((SELECT public.has_permission('catalog.edit')));

CREATE POLICY skills_insert ON public.skills FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_permission('catalog.edit')));
CREATE POLICY skills_update ON public.skills FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('catalog.edit')))
  WITH CHECK ((SELECT public.has_permission('catalog.edit')));
CREATE POLICY skills_delete ON public.skills FOR DELETE TO authenticated
  USING ((SELECT public.has_permission('catalog.edit')));

CREATE POLICY locations_insert ON public.locations FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_permission('catalog.edit')));
CREATE POLICY locations_update ON public.locations FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('catalog.edit')))
  WITH CHECK ((SELECT public.has_permission('catalog.edit')));
CREATE POLICY locations_delete ON public.locations FOR DELETE TO authenticated
  USING ((SELECT public.has_permission('catalog.edit')));

CREATE POLICY sources_insert ON public.sources FOR INSERT TO authenticated
  WITH CHECK ((SELECT public.has_permission('catalog.edit')));
CREATE POLICY sources_update ON public.sources FOR UPDATE TO authenticated
  USING ((SELECT public.has_permission('catalog.edit')))
  WITH CHECK ((SELECT public.has_permission('catalog.edit')));
CREATE POLICY sources_delete ON public.sources FOR DELETE TO authenticated
  USING ((SELECT public.has_permission('catalog.edit')));

-- ---------------------------------------------------------------------
-- 3. Índices en claves foráneas usadas al filtrar o en cascadas
-- ---------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS favorites_job_id_idx          ON public.favorites (job_id);
CREATE INDEX IF NOT EXISTS applications_job_id_idx       ON public.applications (job_id);
CREATE INDEX IF NOT EXISTS reports_job_id_idx            ON public.reports (job_id);
CREATE INDEX IF NOT EXISTS reports_user_id_idx           ON public.reports (user_id);
CREATE INDEX IF NOT EXISTS alerts_user_id_idx            ON public.alerts (user_id);
CREATE INDEX IF NOT EXISTS job_skills_skill_id_idx       ON public.job_skills (skill_id);
CREATE INDEX IF NOT EXISTS user_skills_skill_id_idx      ON public.user_skills (skill_id);
CREATE INDEX IF NOT EXISTS alert_skills_skill_id_idx     ON public.alert_skills (skill_id);
CREATE INDEX IF NOT EXISTS role_permissions_permission_idx ON public.role_permissions (permission);
