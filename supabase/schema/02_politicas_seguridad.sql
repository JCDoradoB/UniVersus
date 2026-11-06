-- UniVersus: permisos SQL y políticas de seguridad por fila (RLS).
-- Ejecuta este archivo después de 01_tablas.sql.
-- RLS separa la lectura pública de torneos de los datos privados de perfiles e inscripciones.

BEGIN;

-- FUNCIÓN AUXILIAR: es_gestor_inscripciones.
-- Comprueba el rol del usuario autenticado sin abrir lectura general de perfiles.
CREATE OR REPLACE FUNCTION public.es_gestor_inscripciones()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.perfiles AS perfil
    WHERE perfil.id = (SELECT auth.uid())
      AND lower(btrim(perfil.rol)) IN ('organizador', 'administrador', 'admin')
  );
$$;

-- PERMISOS: permite a los roles de aplicación usar el esquema público.
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- PERMISOS: permite consultar el propio perfil e insertar únicamente el perfil de registro.
GRANT SELECT, INSERT ON public.perfiles TO authenticated;

-- PERMISOS: impide que una cuenta cliente cambie su rol o elimine perfiles.
REVOKE UPDATE, DELETE ON public.perfiles FROM authenticated;

-- PERMISOS: permite consultar torneos públicamente y administrarlos a usuarios autenticados
-- que superen las políticas RLS definidas abajo.
GRANT SELECT ON public.torneos TO anon, authenticated;
GRANT INSERT, UPDATE ON public.torneos TO authenticated;

-- PERMISOS: los clientes solo pueden leer inscripciones autorizadas; el alta se realiza
-- exclusivamente por la función registrar_inscripcion con privilegios controlados.
GRANT SELECT ON public.inscripciones TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.inscripciones FROM anon, authenticated;

-- SEGURIDAD: activa RLS para perfiles, torneos e inscripciones.
ALTER TABLE public.perfiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.torneos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inscripciones ENABLE ROW LEVEL SECURITY;

-- POLÍTICA: cada usuario autenticado puede leer únicamente su propio perfil.
DROP POLICY IF EXISTS perfiles_ver_propio_perfil ON public.perfiles;
CREATE POLICY perfiles_ver_propio_perfil
  ON public.perfiles
  FOR SELECT
  TO authenticated
  USING (id = (SELECT auth.uid()));

-- POLÍTICA: un usuario solo puede crear su propio perfil y no puede autoasignarse
-- un rol administrativo o de organización desde el cliente.
DROP POLICY IF EXISTS perfiles_crear_propio_perfil ON public.perfiles;
CREATE POLICY perfiles_crear_propio_perfil
  ON public.perfiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    id = (SELECT auth.uid())
    AND lower(btrim(rol)) = 'participante'
  );

-- POLÍTICA: los torneos publicados se pueden leer sin iniciar sesión.
DROP POLICY IF EXISTS torneos_ver_publicos ON public.torneos;
CREATE POLICY torneos_ver_publicos
  ON public.torneos
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- POLÍTICA: solo organizadores y administradores pueden crear torneos.
DROP POLICY IF EXISTS torneos_crear_como_organizador ON public.torneos;
CREATE POLICY torneos_crear_como_organizador
  ON public.torneos
  FOR INSERT
  TO authenticated
  WITH CHECK (public.es_gestor_inscripciones());

-- POLÍTICA: solo organizadores y administradores pueden editar, aplazar o cancelar torneos.
DROP POLICY IF EXISTS torneos_actualizar_como_organizador ON public.torneos;
CREATE POLICY torneos_actualizar_como_organizador
  ON public.torneos
  FOR UPDATE
  TO authenticated
  USING (public.es_gestor_inscripciones())
  WITH CHECK (public.es_gestor_inscripciones());

-- POLÍTICA: los participantes pueden ver sus propias inscripciones; gestores pueden
-- consultar las inscripciones de todos los torneos desde el panel de administración.
DROP POLICY IF EXISTS inscripciones_ver_propia ON public.inscripciones;
CREATE POLICY inscripciones_ver_propia
  ON public.inscripciones
  FOR SELECT
  TO authenticated
  USING (
    usuario_id = (SELECT auth.uid())
    OR public.es_gestor_inscripciones()
  );

-- PERMISOS: solo cuentas autenticadas pueden invocar la comprobación de rol.
REVOKE ALL ON FUNCTION public.es_gestor_inscripciones() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.es_gestor_inscripciones() TO authenticated;

COMMIT;
