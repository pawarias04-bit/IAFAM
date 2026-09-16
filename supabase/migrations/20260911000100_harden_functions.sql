-- =====================================================================
-- Endurecimiento de funciones
--
-- Postgres concede EXECUTE a PUBLIC en cada funcion nueva. Como PostgREST
-- publica todo lo ejecutable de `public` en /rest/v1/rpc/<nombre>, las
-- funciones de trigger SECURITY DEFINER quedaban expuestas como endpoints
-- llamables por cualquiera. Aqui se revocan.
-- =====================================================================

-- touch_updated_at no fijaba search_path: un search_path manipulado puede
-- hacer que resuelva objetos que no son los suyos.
ALTER FUNCTION public.touch_updated_at() SET search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- Funciones de trigger: solo las invoca el motor, nadie mas.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.touch_updated_at()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user()             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_user_email_change()    FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.protect_profile_fields()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.jobs_refresh_fts()            FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.companies_refresh_jobs_fts()  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC de la aplicacion: fuera PUBLIC/anon, dentro authenticated.
-- ---------------------------------------------------------------------
REVOKE ALL ON FUNCTION public.is_admin()               FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_admin_stats()        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.toggle_favorite(INTEGER) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.is_admin()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_stats()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_favorite(INTEGER) TO authenticated;
