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

NOTIFY pgrst, 'reload schema';
