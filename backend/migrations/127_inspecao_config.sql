-- 127_inspecao_config.sql — etapa E6: ⚙ vocabulário da INSPEÇÃO DE CAMPO por empresa (eólica: Aerogerador/Pá · tubulação: Linha/Junta ·
--   soldagem: Peça/Cordão · estruturas · genérico: Ativo/Componente). Usado nas telas, no mapa e no relatório. Idempotente.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS inspecao_config jsonb;
NOTIFY pgrst, 'reload schema';
