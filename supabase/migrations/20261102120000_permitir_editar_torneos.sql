GRANT UPDATE ON public.torneos TO authenticated;

DROP POLICY IF EXISTS torneos_actualizar_como_organizador ON public.torneos;
CREATE POLICY torneos_actualizar_como_organizador
  ON public.torneos
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.perfiles AS p
      WHERE p.id = auth.uid()
        AND p.rol IN ('organizador', 'administrador')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.perfiles AS p
      WHERE p.id = auth.uid()
        AND p.rol IN ('organizador', 'administrador')
    )
  );
