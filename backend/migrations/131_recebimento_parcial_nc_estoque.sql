-- 131_recebimento_parcial_nc_estoque.sql — etapa Q2
--   1) ENTREGA PARCIAL: cada nota fiscal de um item da OC é uma "rodada" (fiscal → contagem → entrada); o que faltar
--      fica em aberto para a próxima NF. ordem_venda_itens.rodada_recebimento + historico_contagens_cegas.rodada.
--   2) NC × ESTOQUE: NC do recebimento encerrada com "uso como está"/"retrabalho" dá entrada no estoque; NC de material
--      que está no estoque (material_no_estoque) encerrada com "descarte"/"devolução" dá baixa. Registro do movimento.
--   Só acrescenta colunas (idempotente).
ALTER TABLE public.ordem_venda_itens ADD COLUMN IF NOT EXISTS rodada_recebimento integer NOT NULL DEFAULT 1;
ALTER TABLE public.historico_contagens_cegas ADD COLUMN IF NOT EXISTS rodada integer NOT NULL DEFAULT 1;
ALTER TABLE public.nao_conformidades ADD COLUMN IF NOT EXISTS ordem_venda_item_id bigint;
ALTER TABLE public.nao_conformidades ADD COLUMN IF NOT EXISTS material_no_estoque boolean NOT NULL DEFAULT false;
ALTER TABLE public.nao_conformidades ADD COLUMN IF NOT EXISTS estoque_movimentado_em timestamptz;
ALTER TABLE public.nao_conformidades ADD COLUMN IF NOT EXISTS estoque_movimento jsonb;
