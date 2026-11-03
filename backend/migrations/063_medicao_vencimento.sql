-- 063_medicao_vencimento.sql — etapa 18d.2: 📏 medição simplificada — dia de vencimento da cobrança no contrato
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 062.
--   locacao_contratos.medicao_vencimento_dia (1–31) → aparece no Boletim de Medição ("vencimento dia 05").
BEGIN;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS medicao_vencimento_dia integer;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locacao_contratos_medicao_venc_check') THEN
    ALTER TABLE public.locacao_contratos ADD CONSTRAINT locacao_contratos_medicao_venc_check CHECK (medicao_vencimento_dia IS NULL OR medicao_vencimento_dia BETWEEN 1 AND 31);
  END IF;
END $$;
COMMIT;
