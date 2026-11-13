-- 083_patio_area.sql — etapa 18z.5: 📦 área ocupada no pátio (m²) — base para cobrança da guarda por m²·dia na ficha de movimentação
-- Idempotente.
ALTER TABLE public.patio_bens ADD COLUMN IF NOT EXISTS area_m2 numeric(10,2);
