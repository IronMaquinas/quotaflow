-- 099_gestao_usuario_responsavel.sql — etapa 18zz.7: "Elaborado/Aprovado por" também pode ser um USUÁRIO do sistema
-- sem cadastro de funcionário. Idempotente. O tipo acompanha usuarios.id (lido do catálogo).
DO $$
DECLARE t text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t FROM pg_attribute a
   WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format('ALTER TABLE public.documentos_gestao ADD COLUMN IF NOT EXISTS elaborado_por_usuario_id %s', t);
  EXECUTE format('ALTER TABLE public.documentos_gestao ADD COLUMN IF NOT EXISTS aprovado_por_usuario_id %s', t);
  EXECUTE format('ALTER TABLE public.documentos_gestao_versoes ADD COLUMN IF NOT EXISTS elaborado_por_usuario_id %s', t);
  EXECUTE format('ALTER TABLE public.documentos_gestao_versoes ADD COLUMN IF NOT EXISTS aprovado_por_usuario_id %s', t);
END $$;
NOTIFY pgrst, 'reload schema';
