-- 095_colaborador_vinculo.sql — etapa 18zw: 🚚 MOTORISTA AGREGADO / TERCEIRO no cadastro de pessoas
-- Idempotente. vinculo: proprio (CLT, padrão) · agregado (motorista com veículo/empresa própria que roda para a empresa)
--   · terceiro (prestador eventual). Agregado/terceiro: o selo de conformidade olha só os documentos (sem EPI/treinamento
--   de funcionário). RNTRC e empresa (razão social/CNPJ do agregado) para a ANTT/contrato.
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS vinculo text NOT NULL DEFAULT 'proprio';
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'colaboradores_vinculo_ck') THEN
    ALTER TABLE public.colaboradores ADD CONSTRAINT colaboradores_vinculo_ck CHECK (vinculo IN ('proprio','agregado','terceiro'));
  END IF;
END $$;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS rntrc text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS vinculo_empresa text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS vinculo_cnpj text;
