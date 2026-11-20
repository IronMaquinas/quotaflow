-- 117_auditoria_periodo_docs_registros.sql — etapa A1.2: 🔎 período, dias de auditoria, documentos de referência e registros verificados
--   auditorias: data_prevista_fim (período previsto), dias [{data, inicio, fim}], documentos [{id, codigo, titulo, revisao, papel, origem}],
--   registros [{tipo, id, numero, rotulo, emissor, data, situacao, constatacao_id}] · auditoria_constatacoes: dia, registros. Idempotente.
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS data_prevista_fim date;
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS dias jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS documentos jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS registros jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.auditoria_constatacoes ADD COLUMN IF NOT EXISTS dia date;
ALTER TABLE public.auditoria_constatacoes ADD COLUMN IF NOT EXISTS registros jsonb NOT NULL DEFAULT '[]'::jsonb;
UPDATE public.auditorias SET data_prevista_fim = data_prevista WHERE data_prevista_fim IS NULL AND data_prevista IS NOT NULL;
