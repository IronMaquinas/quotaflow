-- 085_contrato_armazenagem.sql — etapa 18za: 📦 guarda no pátio cobrada pelo contrato
-- Idempotente.
--   locacao_contratos: cobrar guarda (sim/não), preço por m² (ao mês ou ao dia) e mínimo contratado (m² por mês).
--     A medição do ciclo puxa o m²·dia de cada equipamento do cliente no pátio (patio_bens) × preço, + complemento do mínimo.
--   patio_areas: preço de referência (tabela) do m² ao mês — sugestão para contrato novo e valor do espaço livre.
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS arm_ativo boolean NOT NULL DEFAULT false;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS arm_preco numeric(12,4);
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS arm_unidade text NOT NULL DEFAULT 'm2_mes';
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS arm_minimo_m2 numeric(12,2);
ALTER TABLE public.locacao_contratos DROP CONSTRAINT IF EXISTS locacao_contratos_arm_unidade_ck;
ALTER TABLE public.locacao_contratos ADD CONSTRAINT locacao_contratos_arm_unidade_ck CHECK (arm_unidade IN ('m2_mes','m2_dia'));
ALTER TABLE public.patio_areas ADD COLUMN IF NOT EXISTS preco_ref_m2_mes numeric(12,2);
