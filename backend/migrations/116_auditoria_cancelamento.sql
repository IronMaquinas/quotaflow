-- 116_auditoria_cancelamento.sql — etapa A1.1.3: 🔎 cancelar auditoria exige MOTIVO (fica na ficha e no relatório). Idempotente.
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS motivo_cancelamento text;
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS cancelada_em timestamptz;
ALTER TABLE public.auditorias ADD COLUMN IF NOT EXISTS cancelada_por text;
