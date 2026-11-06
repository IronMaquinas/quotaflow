-- 073_spot_prazo_desistencia.sql — etapa 18m: ⏳ prazo da demanda spot e "desistir" do fornecedor
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 072.
--   demandas_spot.renovada_em → o comprador renovou a demanda por mais 30 dias (o prazo conta daqui; sem renovação, da publicação)
--   interesses_spot.desistiu_em / desistencia_motivo → o fornecedor desistiu; a demanda sai das listas dele,
--     o comprador vê o interesse apagado, fora do ranking de menor valor
ALTER TABLE public.demandas_spot ADD COLUMN IF NOT EXISTS renovada_em timestamptz;
ALTER TABLE public.interesses_spot ADD COLUMN IF NOT EXISTS desistiu_em timestamptz;
ALTER TABLE public.interesses_spot ADD COLUMN IF NOT EXISTS desistencia_motivo text;
