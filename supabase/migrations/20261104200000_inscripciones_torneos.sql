ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS inscripciones_inicio date,
  ADD COLUMN IF NOT EXISTS inscripciones_fin date,
  ADD COLUMN IF NOT EXISTS fecha_fin date;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'torneos_rango_inscripciones_check'
      AND conrelid = 'public.torneos'::regclass
  ) THEN
    ALTER TABLE public.torneos
      ADD CONSTRAINT torneos_rango_inscripciones_check
      CHECK (
        inscripciones_inicio IS NULL
        OR inscripciones_fin IS NULL
        OR inscripciones_inicio <= inscripciones_fin
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'torneos_rango_evento_check'
      AND conrelid = 'public.torneos'::regclass
  ) THEN
    ALTER TABLE public.torneos
      ADD CONSTRAINT torneos_rango_evento_check
      CHECK (fecha_fin IS NULL OR fecha_inicio <= fecha_fin);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'torneos_cierre_inscripciones_check'
      AND conrelid = 'public.torneos'::regclass
  ) THEN
    ALTER TABLE public.torneos
      ADD CONSTRAINT torneos_cierre_inscripciones_check
      CHECK (
        inscripciones_fin IS NULL
        OR fecha_inicio IS NULL
        OR inscripciones_fin <= fecha_inicio
      );
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS public.inscripciones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  torneo_id uuid NOT NULL REFERENCES public.torneos(id) ON DELETE CASCADE,
  usuario_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre_equipo text,
  nombre_capitan text NOT NULL,
  codigo_estudiante text NOT NULL,
  correo_institucional text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inscripciones_un_usuario_por_torneo UNIQUE (torneo_id, usuario_id)
);

ALTER TABLE public.inscripciones
  ADD COLUMN IF NOT EXISTS nombre_equipo text,
  ADD COLUMN IF NOT EXISTS nombre_capitan text,
  ADD COLUMN IF NOT EXISTS codigo_estudiante text,
  ADD COLUMN IF NOT EXISTS correo_institucional text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

ALTER TABLE public.inscripciones ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT ON public.inscripciones TO authenticated;

DROP POLICY IF EXISTS inscripciones_ver_propia ON public.inscripciones;
CREATE POLICY inscripciones_ver_propia
  ON public.inscripciones
  FOR SELECT
  TO authenticated
  USING (usuario_id = auth.uid());

CREATE OR REPLACE FUNCTION public.registrar_inscripcion(
  p_torneo_id uuid,
  p_nombre_equipo text,
  p_nombre_capitan text,
  p_codigo_estudiante text,
  p_correo_institucional text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_torneo public.torneos%ROWTYPE;
  v_total_inscripciones integer;
  v_inscripcion_id uuid;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para inscribirte.'
      USING ERRCODE = '28000';
  END IF;

  IF length(trim(coalesce(p_nombre_capitan, ''))) = 0
    OR length(trim(coalesce(p_codigo_estudiante, ''))) = 0
    OR length(trim(coalesce(p_correo_institucional, ''))) = 0
    OR length(trim(coalesce(p_nombre_equipo, ''))) > 100
    OR length(trim(coalesce(p_nombre_capitan, ''))) > 150
    OR length(trim(coalesce(p_codigo_estudiante, ''))) > 40
    OR length(trim(coalesce(p_correo_institucional, ''))) > 254
    OR trim(p_correo_institucional) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Los datos de inscripción están incompletos o tienen un formato inválido.'
      USING ERRCODE = '22023';
  END IF;

  SELECT *
  INTO v_torneo
  FROM public.torneos
  WHERE id = p_torneo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El torneo ya no está disponible.'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_torneo.estado IS DISTINCT FROM 'abierto' THEN
    RAISE EXCEPTION 'Este torneo no está abierto para inscripciones.'
      USING ERRCODE = '22023';
  END IF;

  IF v_torneo.inscripciones_inicio IS NOT NULL
    AND current_date < v_torneo.inscripciones_inicio THEN
    RAISE EXCEPTION 'Las inscripciones aún no han comenzado.'
      USING ERRCODE = '22023';
  END IF;

  IF v_torneo.inscripciones_fin IS NOT NULL
    AND current_date > v_torneo.inscripciones_fin THEN
    RAISE EXCEPTION 'El periodo de inscripciones ya terminó.'
      USING ERRCODE = '22023';
  END IF;

  IF v_torneo.modalidad = 'equipos'
    AND length(trim(coalesce(p_nombre_equipo, ''))) = 0 THEN
    RAISE EXCEPTION 'Indica el nombre del equipo.'
      USING ERRCODE = '22023';
  END IF;

  IF v_torneo.cupos IS NOT NULL THEN
    SELECT count(*)
    INTO v_total_inscripciones
    FROM public.inscripciones
    WHERE torneo_id = p_torneo_id;

    IF v_total_inscripciones >= v_torneo.cupos THEN
      RAISE EXCEPTION 'Ya se completaron los cupos de este torneo.'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  INSERT INTO public.inscripciones (
    torneo_id,
    usuario_id,
    nombre_equipo,
    nombre_capitan,
    codigo_estudiante,
    correo_institucional
  )
  VALUES (
    p_torneo_id,
    v_usuario_id,
    nullif(trim(p_nombre_equipo), ''),
    trim(p_nombre_capitan),
    trim(p_codigo_estudiante),
    lower(trim(p_correo_institucional))
  )
  RETURNING id INTO v_inscripcion_id;

  RETURN v_inscripcion_id;
END;
$$;

REVOKE ALL ON FUNCTION public.registrar_inscripcion(uuid, text, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.registrar_inscripcion(uuid, text, text, text, text) TO authenticated;

NOTIFY pgrst, 'reload schema';
