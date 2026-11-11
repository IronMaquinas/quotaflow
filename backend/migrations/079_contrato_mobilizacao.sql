-- 079_contrato_mobilizacao.sql — etapa 18y: 🚛 mobilização do contrato de locação → pedido de transporte → AT
-- Idempotente. Rodar depois da 078.
--   A mobilização (levar a máquina até o cliente) e a desmobilização (trazer de volta) viram um PEDIDO DE VENDA de transporte
--   ligado ao contrato (pedidos_venda.contrato_id), com um trecho por movimento — a AT é programada pelo fluxo de sempre
--   (🚛 Programação). locacao_contratos.base_saida: de onde a máquina sai (pátio/base); valores de mobilização opcionais.
ALTER TABLE public.pedidos_venda ADD COLUMN IF NOT EXISTS contrato_id bigint REFERENCES public.locacao_contratos(id) ON DELETE SET NULL;
ALTER TABLE public.pedidos_venda ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'bid';
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS base_saida text;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS valor_mobilizacao numeric(12,2);
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS valor_desmobilizacao numeric(12,2);
CREATE INDEX IF NOT EXISTS pedidos_venda_contrato_idx ON public.pedidos_venda (tenant_id, contrato_id) WHERE contrato_id IS NOT NULL;
