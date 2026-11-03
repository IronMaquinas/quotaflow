-- 064_frota_dias_operacao.sql — etapa 18f: 🚛 dias operacionais da frota (base dos indicadores de utilização × alocação)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 063.
--   tenants.frota_dias_semana        → dias da semana em que a frota opera, 0=dom … 6=sáb (padrão: seg a sáb = '1,2,3,4,5,6')
--   tenants.frota_descontar_feriados → feriados de ⚙️ Configurações › Feriados não contam como dia operacional (padrão: sim)
BEGIN;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS frota_dias_semana text NOT NULL DEFAULT '1,2,3,4,5,6';
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS frota_descontar_feriados boolean NOT NULL DEFAULT true;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_frota_dias_semana_check') THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_frota_dias_semana_check CHECK (frota_dias_semana ~ '^[0-6](,[0-6]){0,6}$');
  END IF;
END $$;
COMMIT;
