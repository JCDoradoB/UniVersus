GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT SELECT ON public.perfiles TO authenticated;
GRANT SELECT ON public.torneos TO anon, authenticated;
GRANT INSERT ON public.torneos TO authenticated;

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.torneos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS torneos_ver_publicos ON public.torneos;
CREATE POLICY torneos_ver_publicos
  ON public.torneos
  FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS torneos_crear_como_organizador ON public.torneos;
CREATE POLICY torneos_crear_como_organizador
  ON public.torneos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.perfiles AS p
      WHERE p.id = auth.uid()
        AND p.rol IN ('organizador', 'administrador')
    )
  );
