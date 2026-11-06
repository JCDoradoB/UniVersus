CREATE OR REPLACE FUNCTION public.es_gestor_inscripciones()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND lower(btrim(p.rol::text)) IN ('organizador', 'administrador')
  );
$$;

REVOKE ALL ON FUNCTION public.es_gestor_inscripciones() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.es_gestor_inscripciones() TO authenticated;

GRANT SELECT ON public.inscripciones TO authenticated;
DROP POLICY IF EXISTS inscripciones_ver_propia ON public.inscripciones;
CREATE POLICY inscripciones_ver_propia
  ON public.inscripciones
  FOR SELECT
  TO authenticated
  USING (
    usuario_id = (SELECT auth.uid())
    OR public.es_gestor_inscripciones()
  );

CREATE OR REPLACE FUNCTION public.contar_inscripciones_por_torneo()
RETURNS TABLE (torneo_id uuid, inscritos bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT i.torneo_id, count(*)::bigint
  FROM public.inscripciones AS i
  GROUP BY i.torneo_id;
$$;

REVOKE ALL ON FUNCTION public.contar_inscripciones_por_torneo() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contar_inscripciones_por_torneo() TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.total_usuarios_registrados()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS p
    WHERE p.id = (SELECT auth.uid())
      AND lower(btrim(p.rol::text)) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar el total de usuarios.'
      USING ERRCODE = '42501';
  END IF;

  RETURN (SELECT count(*) FROM auth.users);
END;
$$;

REVOKE ALL ON FUNCTION public.total_usuarios_registrados() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.total_usuarios_registrados() TO authenticated;

NOTIFY pgrst, 'reload schema';
