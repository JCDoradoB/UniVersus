GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.inscripciones TO authenticated;

DROP POLICY IF EXISTS inscripciones_ver_propia ON public.inscripciones;
CREATE POLICY inscripciones_ver_propia
  ON public.inscripciones
  FOR SELECT
  TO authenticated
  USING (
    usuario_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.perfiles AS p
      WHERE p.id = auth.uid()
        AND p.rol IN ('organizador', 'administrador')
    )
  );

NOTIFY pgrst, 'reload schema';
