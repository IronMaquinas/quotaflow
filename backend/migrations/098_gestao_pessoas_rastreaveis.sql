-- 098_gestao_pessoas_rastreaveis.sql — etapa 18zz.6: "Elaborado por" / "Aprovado por" ligados ao FUNCIONÁRIO do cadastro (rastreável)
-- Idempotente. O tipo acompanha colaboradores.id (lido do catálogo). O nome continua gravado (texto) como era na data.
DO $$
DECLARE t text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t FROM pg_attribute a
   WHERE a.attrelid = 'public.colaboradores'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format('ALTER TABLE public.documentos_gestao ADD COLUMN IF NOT EXISTS elaborado_por_id %s', t);
  EXECUTE format('ALTER TABLE public.documentos_gestao ADD COLUMN IF NOT EXISTS aprovado_por_id %s', t);
  EXECUTE format('ALTER TABLE public.documentos_gestao_versoes ADD COLUMN IF NOT EXISTS elaborado_por_id %s', t);
  EXECUTE format('ALTER TABLE public.documentos_gestao_versoes ADD COLUMN IF NOT EXISTS aprovado_por_id %s', t);
END $$;
NOTIFY pgrst, 'reload schema';
