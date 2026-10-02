-- ═══════════════════════════════════════════════════════════════════════
-- M4.3 — Recebimento: histórico de contagens, entrada no estoque
-- Data: 01/10/2026
--
-- Reúne as alterações de schema aplicadas manualmente no SQL Editor do
-- Supabase durante a sessão de M4.3. Rodar este arquivo do zero num
-- banco novo reproduz o estado atual (idempotente onde possível).
--
-- ⚠️ O SQL Editor do Supabase NÃO respeita BEGIN/COMMIT de forma
-- confiável para DDL — rodar comando por comando se algo falhar.
-- ═══════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────
-- 1. historico_contagens_cegas: renomeia status_quarentena → resultado_contagem
--    Motivo: distinguir "resultado da contagem" (aprovado/divergente/NC)
--    de "estado de segregação do item" (ISO 9001). São conceitos
--    diferentes.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE historico_contagens_cegas
  RENAME COLUMN status_quarentena TO resultado_contagem;

-- Migra valores antigos para o novo vocabulário
UPDATE historico_contagens_cegas
SET resultado_contagem = CASE
  WHEN resultado_contagem = 'rejeitado' AND observacao LIKE 'NC:%' THEN 'nao_conformidade'
  WHEN resultado_contagem = 'rejeitado' THEN 'divergente_esgotado'
  WHEN resultado_contagem = 'pendente' THEN 'divergente_pendente'
  ELSE resultado_contagem
END;

-- Constraint com os 4 valores válidos
ALTER TABLE historico_contagens_cegas
  ADD CONSTRAINT historico_contagens_cegas_resultado_chk
  CHECK (resultado_contagem IN (
    'aprovado', 'divergente_pendente', 'divergente_esgotado', 'nao_conformidade'
  ));


-- ─────────────────────────────────────────────────────────────────────
-- 2. historico_contagens_cegas.contado_em → timestamptz
--    Motivo: `timestamp without time zone` faz o driver pg devolver a
--    string sem 'Z', e o Node interpreta como TZ local do servidor
--    (America/Sao_Paulo no Railway/local). Resultado: hora errada por
--    3h em qualquer formatação. `timestamptz` carrega o fuso no dado.
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE historico_contagens_cegas
  ALTER COLUMN contado_em TYPE timestamp with time zone
  USING contado_em AT TIME ZONE 'UTC';


-- ─────────────────────────────────────────────────────────────────────
-- 3. ordem_venda_itens: colunas de rastreio da entrada no estoque
--    Motivo: permitir "quem/quando deu entrada" direto no item,
--    espelhando miro_por/miro_em e migo_por/migo_em. Usadas no modal
--    "Ver entrada" (M4.3-ab).
-- ─────────────────────────────────────────────────────────────────────
ALTER TABLE ordem_venda_itens
  ADD COLUMN IF NOT EXISTS entrada_por uuid,
  ADD COLUMN IF NOT EXISTS entrada_em timestamp with time zone;

-- Alinha miro_em e migo_em com o padrão timestamptz (eram `without
-- time zone` em algum ponto; hoje já estão certos, mas garante)
ALTER TABLE ordem_venda_itens
  ALTER COLUMN miro_em TYPE timestamp with time zone
    USING miro_em AT TIME ZONE 'America/Sao_Paulo',
  ALTER COLUMN migo_em TYPE timestamp with time zone
    USING migo_em AT TIME ZONE 'America/Sao_Paulo';


-- ─────────────────────────────────────────────────────────────────────
-- 4. Trigger atualizar_historico_contagens()
--    Motivo: a função antiga referenciava `status_quarentena` (coluna
--    renomeada no passo 1). Como o trigger é AFTER INSERT, o INSERT na
--    historico_contagens_cegas era ABORTADO quando a função quebrava
--    ("column status_quarentena does not exist"). Reescrita apontando
--    para `resultado_contagem`, mantendo a chave 'status' no JSON
--    (o frontend lê `h.status` de `ordem_venda_itens.historico_contagens`).
-- ─────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.atualizar_historico_contagens()
RETURNS trigger
LANGUAGE plpgsql
AS $function$
BEGIN
  WITH contagens AS (
    SELECT
      tentativa,
      quantidade_contada,
      resultado_contagem,
      contado_em,
      contado_por
    FROM historico_contagens_cegas
    WHERE ordem_venda_item_id = NEW.ordem_venda_item_id
    ORDER BY tentativa ASC
  )
  UPDATE ordem_venda_itens
  SET historico_contagens = (
    SELECT jsonb_agg(
      jsonb_build_object(
        'tentativa', tentativa,
        'quantidade', quantidade_contada,
        'status', resultado_contagem,
        'data', contado_em,
        'contado_por', contado_por
      )
    )
    FROM contagens
  )
  WHERE id = NEW.ordem_venda_item_id;

  RETURN NEW;
END;
$function$;