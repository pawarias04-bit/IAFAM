-- =====================================================================
-- Politicas separadas por rol
--
-- Problema: las politicas de lectura publica tenian la forma
--     USING (status = 'ACTIVE' OR public.is_admin())
-- y se aplicaban tanto a `anon` como a `authenticated`. Al revocarle
-- EXECUTE sobre is_admin() al rol `anon` (migracion anterior), cualquier
-- SELECT anonimo fallaba con "permission denied for function is_admin":
-- para decidir la politica, Postgres tiene que poder ejecutar la funcion.
--
-- Solucion: una politica por rol. `anon` nunca puede ser admin, asi que
-- su politica no menciona is_admin(). Ademas de arreglar el permiso,
-- evita una llamada a funcion por fila en el camino publico.
-- =====================================================================

-- ----- JOBS -----
DROP POLICY IF EXISTS jobs_read_active ON public.jobs;

CREATE POLICY jobs_read_anon ON public.jobs
  FOR SELECT TO anon
  USING (status = 'ACTIVE');

CREATE POLICY jobs_read_auth ON public.jobs
  FOR SELECT TO authenticated
  USING (status = 'ACTIVE' OR public.is_admin());

-- ----- COMPANIES -----
DROP POLICY IF EXISTS companies_read ON public.companies;

CREATE POLICY companies_read_anon ON public.companies
  FOR SELECT TO anon
  USING (is_active);

CREATE POLICY companies_read_auth ON public.companies
  FOR SELECT TO authenticated
  USING (is_active OR public.is_admin());

-- ----- JOB_SKILLS -----
DROP POLICY IF EXISTS job_skills_read ON public.job_skills;

CREATE POLICY job_skills_read_anon ON public.job_skills
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM public.jobs j
                 WHERE j.id = job_id AND j.status = 'ACTIVE'));

CREATE POLICY job_skills_read_auth ON public.job_skills
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.jobs j
                 WHERE j.id = job_id AND (j.status = 'ACTIVE' OR public.is_admin())));
