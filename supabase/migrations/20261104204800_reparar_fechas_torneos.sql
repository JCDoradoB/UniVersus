ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS inscripciones_inicio date,
  ADD COLUMN IF NOT EXISTS inscripciones_fin date,
  ADD COLUMN IF NOT EXISTS fecha_fin date;

NOTIFY pgrst, 'reload schema';
