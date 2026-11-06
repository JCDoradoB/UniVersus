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
      AND lower(btrim(perfil_admin.rol::text)) = 'administrador'
  ) THEN
    RAISE EXCEPTION 'Solo un administrador puede consultar la lista de usuarios.'
      USING ERRCODE = '42501';
  END IF;

  RETURN QUERY
  SELECT
    COALESCE(
      NULLIF(btrim(perfil.nombre), ''),
      NULLIF(btrim(usuario.raw_user_meta_data ->> 'nombre'), ''),
      'Sin nombre'
    ),
    usuario.email::text,
    COALESCE(
      NULLIF(btrim(perfil.programa::text), ''),
      NULLIF(btrim(usuario.raw_user_meta_data ->> 'programa'), ''),
      'Sin especificar'
    ),
    usuario.created_at
  FROM auth.users AS usuario
  LEFT JOIN public.perfiles AS perfil
    ON perfil.id = usuario.id
  ORDER BY usuario.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.listar_usuarios_registrados() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.listar_usuarios_registrados() TO authenticated;

NOTIFY pgrst, 'reload schema';
