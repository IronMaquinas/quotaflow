-- rota-trechos-bid-teste.sql — grava a COLETA e a ENTREGA nos trechos do seu BID/pedido de teste (Expo Minas).
-- Ida  (Vitória -> Minas Gerais, com ou sem o "s"): Capuaba ➜ Expominas · Volta (Minas Gerais -> Vitória): Expominas ➜ Capuaba.
-- Mexe no pedido (pedidos_venda) e no BID/aditivo atual (bids). NÃO mexe nas versões assinadas (bid_versoes).
-- Rode no SQL Editor do Supabase, depois da entrega 16b. Pode rodar mais de uma vez.
BEGIN;
CREATE TEMP TABLE rotas ON COMMIT DROP AS SELECT * FROM (VALUES
  ('Vitória -> Minas Gerais', 'Estrada de Capuaba, s/nº, Aribiri, Vila Velha - ES, CEP 29119-060', 'Av. Amazonas, 6020 - Gameleira, Belo Horizonte - MG, CEP 30510-000'),
  ('Vitória -> Minas Gerai',  'Estrada de Capuaba, s/nº, Aribiri, Vila Velha - ES, CEP 29119-060', 'Av. Amazonas, 6020 - Gameleira, Belo Horizonte - MG, CEP 30510-000'),
  ('Minas Gerais -> Vitória', 'Av. Amazonas, 6020 - Gameleira, Belo Horizonte - MG, CEP 30510-000', 'Estrada de Capuaba, s/nº, Aribiri, Vila Velha - ES, CEP 29119-060')
) AS r(titulo, coleta, entrega);

UPDATE public.pedidos_venda pv SET grupos = (
  SELECT jsonb_agg(CASE WHEN r.titulo IS NOT NULL THEN g || jsonb_build_object('coleta', r.coleta, 'entrega', r.entrega) ELSE g END ORDER BY o)
  FROM jsonb_array_elements(pv.grupos) WITH ORDINALITY AS x(g, o) LEFT JOIN rotas r ON r.titulo = g->>'titulo'), atualizado_em = now()
WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(pv.grupos) g JOIN rotas r ON r.titulo = g->>'titulo');

UPDATE public.bids b SET grupos = (
  SELECT jsonb_agg(CASE WHEN r.titulo IS NOT NULL THEN g || jsonb_build_object('coleta', r.coleta, 'entrega', r.entrega) ELSE g END ORDER BY o)
  FROM jsonb_array_elements(b.grupos) WITH ORDINALITY AS x(g, o) LEFT JOIN rotas r ON r.titulo = g->>'titulo')
WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(b.grupos) g JOIN rotas r ON r.titulo = g->>'titulo');

-- conferência
SELECT 'pedido' AS onde, numero, g->>'titulo' AS trecho, g->>'coleta' AS coleta, g->>'entrega' AS entrega FROM public.pedidos_venda, jsonb_array_elements(grupos) g WHERE g ? 'coleta'
UNION ALL
SELECT 'bid', numero, g->>'titulo', g->>'coleta', g->>'entrega' FROM public.bids, jsonb_array_elements(grupos) g WHERE g ? 'coleta' AND g->>'coleta' <> '';
COMMIT;
