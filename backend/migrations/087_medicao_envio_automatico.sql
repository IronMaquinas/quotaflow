-- 087_medicao_envio_automatico.sql — etapa 18zc: 📏 ENVIO AUTOMÁTICO DA MEDIÇÃO (por contrato — CL e CA)
-- Idempotente.
--   medicao_auto: liga o envio automático · medicao_auto_dias: quantos dias depois do fim do ciclo (1–10; padrão 1)
--   medicao_auto_desde: data em que foi ligado — só os ciclos que terminam a partir dela vão sozinhos (ligar não dispara medição antiga)
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS medicao_auto boolean NOT NULL DEFAULT false;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS medicao_auto_dias integer NOT NULL DEFAULT 1;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS medicao_auto_desde date;
ALTER TABLE public.locacao_contratos DROP CONSTRAINT IF EXISTS locacao_contratos_medicao_auto_dias_ck;
ALTER TABLE public.locacao_contratos ADD CONSTRAINT locacao_contratos_medicao_auto_dias_ck CHECK (medicao_auto_dias BETWEEN 1 AND 10);
