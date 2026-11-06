-- UniVersus: esquema base de tablas.
-- Ejecuta este archivo primero en una instalación nueva de Supabase.
-- La tabla de eventos del proyecto se llama public.torneos, no public.eventos.
-- No elimina ni trunca datos. Los ALTER TABLE IF NOT EXISTS permiten completar
-- columnas que falten en una instalación existente, sin reemplazar sus filas.

BEGIN;

-- TABLA: perfiles.
-- Guarda los datos académicos y el rol asociado a cada cuenta de Supabase Auth.
CREATE TABLE IF NOT EXISTS public.perfiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  nombre text NOT NULL,
  programa text NOT NULL,
  rol text NOT NULL DEFAULT 'participante'
);

-- COMPLEMENTO COMPATIBLE: asegura las columnas de perfil que utiliza la aplicación.
ALTER TABLE public.perfiles
  ADD COLUMN IF NOT EXISTS nombre text,
  ADD COLUMN IF NOT EXISTS programa text,
  ADD COLUMN IF NOT EXISTS rol text NOT NULL DEFAULT 'participante';

-- TABLA: torneos.
-- Guarda los eventos deportivos publicados, sus fechas, cupos y una imagen opcional.
CREATE TABLE IF NOT EXISTS public.torneos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nombre text NOT NULL,
  deporte text NOT NULL,
  modalidad text NOT NULL DEFAULT 'individual',
  inscripciones_inicio date,
  inscripciones_fin date,
  fecha_inicio date,
  fecha_fin date,
  cupos integer,
  estado text NOT NULL DEFAULT 'abierto',
  imagen_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT torneos_modalidad_check
    CHECK (modalidad IN ('individual', 'equipos')),
  CONSTRAINT torneos_cupos_check
    CHECK (cupos IS NULL OR cupos > 0),
  CONSTRAINT torneos_rango_inscripciones_check
    CHECK (
      inscripciones_inicio IS NULL
      OR inscripciones_fin IS NULL
      OR inscripciones_inicio <= inscripciones_fin
    ),
  CONSTRAINT torneos_rango_evento_check
    CHECK (fecha_inicio IS NULL OR fecha_fin IS NULL OR fecha_inicio <= fecha_fin),
  CONSTRAINT torneos_cierre_inscripciones_check
    CHECK (
      inscripciones_fin IS NULL
      OR fecha_inicio IS NULL
      OR inscripciones_fin <= fecha_inicio
    )
);

-- TABLA: inscripciones.
-- Almacena la inscripción de un usuario a un torneo y sus datos de contacto.
-- La clave única evita que una misma cuenta se inscriba dos veces al mismo torneo.
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

-- COMPLEMENTO COMPATIBLE: añade columnas de torneos que pudieran faltar.
-- En instalaciones nuevas estas columnas ya fueron declaradas en CREATE TABLE.
ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS modalidad text NOT NULL DEFAULT 'individual',
  ADD COLUMN IF NOT EXISTS inscripciones_inicio date,
  ADD COLUMN IF NOT EXISTS inscripciones_fin date,
  ADD COLUMN IF NOT EXISTS fecha_fin date,
  ADD COLUMN IF NOT EXISTS imagen_url text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- RESTRICCIONES: asegura la modalidad permitida y los rangos válidos de fechas/cupos.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'torneos_modalidad_check'
      AND conrelid = 'public.torneos'::regclass
  ) THEN
    ALTER TABLE public.torneos
      ADD CONSTRAINT torneos_modalidad_check
      CHECK (modalidad IN ('individual', 'equipos'));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'torneos_cupos_check'
      AND conrelid = 'public.torneos'::regclass
  ) THEN
    ALTER TABLE public.torneos
      ADD CONSTRAINT torneos_cupos_check
      CHECK (cupos IS NULL OR cupos > 0);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
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
    SELECT 1 FROM pg_constraint
    WHERE conname = 'torneos_rango_evento_check'
      AND conrelid = 'public.torneos'::regclass
  ) THEN
    ALTER TABLE public.torneos
      ADD CONSTRAINT torneos_rango_evento_check
      CHECK (fecha_fin IS NULL OR fecha_inicio <= fecha_fin);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
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
END;
$$;

-- COMPLEMENTO COMPATIBLE: añade datos de inscripción faltantes sin borrar registros.
ALTER TABLE public.inscripciones
  ADD COLUMN IF NOT EXISTS nombre_equipo text,
  ADD COLUMN IF NOT EXISTS nombre_capitan text,
  ADD COLUMN IF NOT EXISTS codigo_estudiante text,
  ADD COLUMN IF NOT EXISTS correo_institucional text,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now();

-- ÍNDICE: acelera el listado de inscripciones por torneo y su orden cronológico.
CREATE INDEX IF NOT EXISTS inscripciones_torneo_fecha_idx
  ON public.inscripciones (torneo_id, created_at DESC);

-- COMENTARIO: describe la tabla de perfiles en el catálogo de PostgreSQL.
COMMENT ON TABLE public.perfiles IS
  'Datos académicos y rol de cada usuario de UniVersus; el identificador referencia auth.users.';

-- COMENTARIO: describe la tabla de torneos en el catálogo de PostgreSQL.
COMMENT ON TABLE public.torneos IS
  'Eventos deportivos de UniVersus, con fechas de inscripción, fechas del evento, cupos e imagen opcional.';

-- COMENTARIO: documenta la URL opcional de imagen deportiva.
COMMENT ON COLUMN public.torneos.imagen_url IS
  'URL opcional de la imagen representativa del deporte que se muestra en la tarjeta pública.';

-- COMENTARIO: describe la tabla privada de inscripciones.
COMMENT ON TABLE public.inscripciones IS
  'Inscripciones de usuarios a torneos; contiene datos personales visibles solo al participante y gestores autorizados.';

COMMIT;
