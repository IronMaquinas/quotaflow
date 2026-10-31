-- 058_base_frota.sql — etapa 16e.3: 📍 pátio / base da frota (onde o conjunto é liberado antes de sair)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 057.
--   tenants.base_endereco → endereço do pátio/base (pode ser diferente do endereço fiscal da empresa). Usado como "local"
--                            sugerido na inspeção de liberação do fluxo da viagem (sem ele, a sugestão é a coleta da AT).
BEGIN;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS base_endereco text;
COMMIT;
