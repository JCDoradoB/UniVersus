ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS modalidad text NOT NULL DEFAULT 'individual';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'torneos_modalidad_check'
      AND conrelid = 'public.torneos'::regclass
  ) THEN
    ALTER TABLE public.torneos
      ADD CONSTRAINT torneos_modalidad_check
      CHECK (modalidad IN ('individual', 'equipos'));
  END IF;
END
$$;

ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.torneos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS perfiles_ver_propio_perfil ON public.perfiles;
CREATE POLICY perfiles_ver_propio_perfil
  ON public.perfiles
  FOR SELECT
  TO authenticated
  USING (id = auth.uid());

DROP POLICY IF EXISTS perfiles_crear_propio_perfil ON public.perfiles;
CREATE POLICY perfiles_crear_propio_perfil
  ON public.perfiles
  FOR INSERT
  TO authenticated
  WITH CHECK (id = auth.uid());

DROP POLICY IF EXISTS perfiles_actualizar_propio_perfil ON public.perfiles;
CREATE POLICY perfiles_actualizar_propio_perfil
  ON public.perfiles
  FOR UPDATE
  TO authenticated
  USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

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
