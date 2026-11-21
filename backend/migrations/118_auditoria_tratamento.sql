-- 118_auditoria_tratamento.sql — etapa A1.3: 🔎 tratamento de constatação fora do ciclo: encerrar com CONTENÇÃO ou levar ao PRÓXIMO CICLO;
--   justificativa quando o prazo da ação passa do fim do ciclo. Idempotente.
ALTER TABLE public.auditoria_constatacoes ADD COLUMN IF NOT EXISTS tratamento text;
ALTER TABLE public.auditoria_constatacoes ADD COLUMN IF NOT EXISTS tratamento_texto text;
ALTER TABLE public.auditoria_constatacoes ADD COLUMN IF NOT EXISTS tratamento_por text;
ALTER TABLE public.auditoria_constatacoes ADD COLUMN IF NOT EXISTS tratamento_em timestamptz;
ALTER TABLE public.auditoria_constatacoes ADD COLUMN IF NOT EXISTS ciclo_destino integer;
ALTER TABLE public.auditoria_constatacoes ADD COLUMN IF NOT EXISTS prazo_justificativa text;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'auditoria_constatacoes_tratamento_check') THEN
    ALTER TABLE public.auditoria_constatacoes ADD CONSTRAINT auditoria_constatacoes_tratamento_check CHECK (tratamento IS NULL OR tratamento IN ('contencao', 'transferida'));
  END IF;
END $$;
