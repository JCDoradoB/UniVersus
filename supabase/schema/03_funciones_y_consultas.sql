-- UniVersus: funciones RPC para inscripciones y datos agregados.
-- Ejecuta este archivo después de 01_tablas.sql y 02_politicas_seguridad.sql.
-- Cada función SECURITY DEFINER fija un search_path vacío y valida el acceso necesario.

BEGIN;

-- FUNCIÓN: registrar_inscripcion.
-- Registra al usuario autenticado en un torneo, valida fechas, modalidad, cupos y duplicados.
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
  v_total_inscripciones bigint;
  v_inscripcion_id uuid;
BEGIN
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Debes iniciar sesión para inscribirte.'
      USING ERRCODE = '28000';
  END IF;

  IF length(btrim(coalesce(p_nombre_capitan, ''))) = 0
    OR length(btrim(coalesce(p_codigo_estudiante, ''))) = 0
    OR length(btrim(coalesce(p_correo_institucional, ''))) = 0
    OR length(btrim(coalesce(p_nombre_equipo, ''))) > 100
    OR length(btrim(coalesce(p_nombre_capitan, ''))) > 150
    OR length(btrim(coalesce(p_codigo_estudiante, ''))) > 40
    OR length(btrim(coalesce(p_correo_institucional, ''))) > 254
    OR btrim(p_correo_institucional) !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' THEN
    RAISE EXCEPTION 'Los datos de inscripción están incompletos o tienen un formato inválido.'
      USING ERRCODE = '22023';
  END IF;

  -- Bloquea el torneo para evitar que solicitudes simultáneas excedan los cupos.
  SELECT *
  INTO v_torneo
  FROM public.torneos
  WHERE id = p_torneo_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'El torneo ya no está disponible.'
      USING ERRCODE = 'P0002';
  END IF;

  IF lower(btrim(v_torneo.estado)) IS DISTINCT FROM 'abierto' THEN
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
    AND length(btrim(coalesce(p_nombre_equipo, ''))) = 0 THEN
    RAISE EXCEPTION 'Indica el nombre del equipo.'
      USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.inscripciones AS inscripcion
    WHERE inscripcion.torneo_id = p_torneo_id
      AND inscripcion.usuario_id = v_usuario_id
  ) THEN
    RAISE EXCEPTION 'Ya tienes una inscripción para este torneo.'
      USING ERRCODE = '23505';
  END IF;

  IF v_torneo.cupos IS NOT NULL THEN
    SELECT count(*)
    INTO v_total_inscripciones
    FROM public.inscripciones AS inscripcion
    WHERE inscripcion.torneo_id = p_torneo_id;

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
    nullif(btrim(p_nombre_equipo), ''),
    btrim(p_nombre_capitan),
    btrim(p_codigo_estudiante),
    lower(btrim(p_correo_institucional))
  )
  RETURNING id INTO v_inscripcion_id;

  RETURN v_inscripcion_id;
END;
$$;

-- FUNCIÓN: contar_inscripciones_por_torneo.
-- Devuelve solo cantidades agregadas para mostrar cupos en el catálogo público.
CREATE OR REPLACE FUNCTION public.contar_inscripciones_por_torneo()
RETURNS TABLE (torneo_id uuid, inscritos bigint)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT inscripcion.torneo_id, count(*)::bigint
  FROM public.inscripciones AS inscripcion
  GROUP BY inscripcion.torneo_id;
$$;

-- FUNCIÓN: total_usuarios_registrados.
-- Devuelve el número de cuentas de Supabase Auth únicamente a un administrador.
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
    FROM public.perfiles AS perfil
    WHERE perfil.id = (SELECT auth.uid())
      AND lower(btrim(perfil.rol)) IN ('administrador', 'admin')
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar el total de usuarios.'
      USING ERRCODE = '42501';
  END IF;

  RETURN (SELECT count(*) FROM auth.users);
END;
$$;

-- FUNCIÓN: listar_usuarios_registrados.
-- Devuelve nombre, correo, programa y fecha de creación solo para administradores.
CREATE OR REPLACE FUNCTION public.listar_usuarios_registrados()
RETURNS TABLE (
  nombre text,
  correo text,
  programa text,
  fecha_registro timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil_admin
    WHERE perfil_admin.id = (SELECT auth.uid())
      AND lower(btrim(perfil_admin.rol)) IN ('administrador', 'admin')
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar la lista de usuarios.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    coalesce(
      nullif(btrim(perfil.nombre), ''),
      nullif(btrim(usuario.raw_user_meta_data ->> 'nombre'), ''),
      'Sin nombre'
    ),
    usuario.email::text,
    coalesce(
      nullif(btrim(perfil.programa), ''),
      nullif(btrim(usuario.raw_user_meta_data ->> 'programa'), ''),
      'Sin especificar'
    ),
    usuario.created_at
  FROM auth.users AS usuario
  LEFT JOIN public.perfiles AS perfil
    ON perfil.id = usuario.id
  ORDER BY usuario.created_at DESC;
END;
$$;

-- PERMISOS: la inscripción solo se ejecuta por usuarios autenticados.
REVOKE ALL ON FUNCTION public.registrar_inscripcion(uuid, text, text, text, text)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.registrar_inscripcion(uuid, text, text, text, text)
  TO authenticated;

-- PERMISOS: la consulta agregada expone cantidades, no los datos personales del participante.
REVOKE ALL ON FUNCTION public.contar_inscripciones_por_torneo()
  FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.contar_inscripciones_por_torneo()
  TO anon, authenticated;

-- PERMISOS: el total de usuarios es información exclusiva de administradores.
REVOKE ALL ON FUNCTION public.total_usuarios_registrados()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.total_usuarios_registrados()
  TO authenticated;

-- PERMISOS: el listado con correos y datos académicos es exclusivo de administradores.
REVOKE ALL ON FUNCTION public.listar_usuarios_registrados()
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.listar_usuarios_registrados()
  TO authenticated;

-- ACTUALIZACIÓN: solicita a PostgREST recargar las funciones y el esquema expuesto.
NOTIFY pgrst, 'reload schema';

COMMIT;
