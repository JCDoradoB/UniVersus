ALTER TABLE public.torneos
  ADD COLUMN IF NOT EXISTS imagen_url text;

NOTIFY pgrst, 'reload schema';
