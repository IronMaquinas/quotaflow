-- 115_auditoria_execucao.sql — etapa A1.1: 🔎 auditoria feita no sistema — execução, fotos, assinaturas e NC de auditoria
--   auditorias: iniciada_em, encerrada_em (execução fechada → aguardando assinaturas), aprovada_em, assinaturas (auditor + responsável da área).
--   auditoria_constatacoes: fotos (evidência), nc_id (NC aberta no módulo de Não Conformidades), atualizado_em (rascunho salvo).
--   nao_conformidades.origem passa a aceitar 'auditoria' (se houver CHECK de origem, é recriado com o valor novo). Idempotente.
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS iniciada_em timestamptz;
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS encerrada_em timestamptz;
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS aprovada_em timestamptz;
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS assinaturas jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.auditoria_constatacoes ADD COLUMN IF NOT EXISTS fotos jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.auditoria_constatacoes ADD COLUMN IF NOT EXISTS nc_id text;
ALTER TABLE public.auditoria_constatacoes ADD COLUMN IF NOT EXISTS atualizado_em timestamptz;
DO $$
DECLARE c record;
BEGIN
  IF to_regclass('public.nao_conformidades') IS NULL THEN RETURN; END IF;
  FOR c IN SELECT conname, pg_get_constraintdef(oid) AS def FROM pg_constraint WHERE conrelid = 'public.nao_conformidades'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%origem%' LOOP
    IF c.def NOT ILIKE '%auditoria%' THEN
      EXECUTE format('ALTER TABLE public.nao_conformidades DROP CONSTRAINT %I', c.conname);
      EXECUTE $q$ALTER TABLE public.nao_conformidades ADD CONSTRAINT nao_conformidades_origem_check CHECK (origem IN ('recebimento','os_material','os_servico','inspecao','pos_venda','auditoria')) NOT VALID$q$;
    END IF;
  END LOOP;
END $$;
