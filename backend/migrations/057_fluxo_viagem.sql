-- 057_fluxo_viagem.sql — etapa 16e: 🧭 FLUXO DA VIAGEM (etapas em ordem, com inspeções) na AT
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 056.
--   execucoes.fluxo      → etapas na ordem definida pela programação:
--                          [{ id, tipo: 'inspecao'|'marco', marco, rotulo, modelo_id, modelo_nome, modelo_tipo, equipamento_id, equipamento_tag,
--                             status: 'pendente'|'feita'|'reprovada', feita_em, gps, por, inspecao_id, inspecao_numero, resultado,
--                             liberacao: { por, em, motivo } }]
--                          a próxima só abre com a anterior feita; inspeção REPROVADA trava a seguinte até o gestor liberar.
--                          1ª etapa feita → AT "em execução"; última → "concluída" (e o pedido acompanha).
--   inspecoes.execucao_id / etapa_id → a inspeção feita dentro do fluxo aponta para a AT e a etapa (rastreabilidade)
BEGIN;
ALTER TABLE public.execucoes ADD COLUMN IF NOT EXISTS fluxo jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.inspecoes ADD COLUMN IF NOT EXISTS execucao_id bigint;
ALTER TABLE public.inspecoes ADD COLUMN IF NOT EXISTS etapa_id text;
CREATE INDEX IF NOT EXISTS inspecoes_execucao_idx ON public.inspecoes (tenant_id, execucao_id) WHERE execucao_id IS NOT NULL;
COMMIT;
