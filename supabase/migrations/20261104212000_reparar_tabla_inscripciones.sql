ALTER TABLE public.inscripciones
  ADD COLUMN IF NOT EXISTS nombre_equipo text,
  ADD COLUMN IF NOT EXISTS nombre_capitan text,
  ADD COLUMN IF NOT EXISTS codigo_estudiante text,
  ADD COLUMN IF NOT EXISTS correo_institucional text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

DO $$
DECLARE
  v_inscripcion_id_type text;
  v_inscripcion_torneo_type text;
  v_torneo_id_type text;
  v_inscripcion_usuario_type text;
  v_usuario_id_type text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod)
  INTO v_inscripcion_id_type
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.inscripciones'::regclass
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod)
  INTO v_inscripcion_torneo_type
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.inscripciones'::regclass
    AND a.attname = 'torneo_id'
    AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod)
  INTO v_torneo_id_type
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.torneos'::regclass
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod)
  INTO v_inscripcion_usuario_type
  FROM pg_attribute AS a
  WHERE a.attrelid = 'public.inscripciones'::regclass
    AND a.attname = 'usuario_id'
    AND NOT a.attisdropped;

  SELECT format_type(a.atttypid, a.atttypmod)
  INTO v_usuario_id_type
  FROM pg_attribute AS a
  WHERE a.attrelid = 'auth.users'::regclass
    AND a.attname = 'id'
    AND NOT a.attisdropped;

  IF v_inscripcion_id_type IS DISTINCT FROM 'uuid' THEN
    RAISE EXCEPTION 'public.inscripciones.id debe ser uuid; tipo encontrado: %', v_inscripcion_id_type;
  END IF;

  IF v_inscripcion_torneo_type IS DISTINCT FROM v_torneo_id_type THEN
    RAISE EXCEPTION 'public.inscripciones.torneo_id (%) no coincide con public.torneos.id (%).', v_inscripcion_torneo_type, v_torneo_id_type;
  END IF;

  IF v_inscripcion_usuario_type IS DISTINCT FROM v_usuario_id_type THEN
    RAISE EXCEPTION 'public.inscripciones.usuario_id (%) no coincide con auth.users.id (%).', v_inscripcion_usuario_type, v_usuario_id_type;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_attrdef AS d
    JOIN pg_attribute AS a
      ON a.attrelid = d.adrelid
      AND a.attnum = d.adnum
    WHERE d.adrelid = 'public.inscripciones'::regclass
      AND a.attname = 'id'
  ) THEN
    ALTER TABLE public.inscripciones
      ALTER COLUMN id SET DEFAULT gen_random_uuid();
  END IF;
END
$$;

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

  IF EXISTS (
    SELECT 1
    FROM public.inscripciones
    WHERE torneo_id = p_torneo_id
      AND usuario_id = v_usuario_id
  ) THEN
    RAISE EXCEPTION 'Ya tienes una inscripción para este torneo.'
      USING ERRCODE = '23505';
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
