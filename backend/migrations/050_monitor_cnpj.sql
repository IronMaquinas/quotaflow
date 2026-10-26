-- 050_monitor_cnpj.sql — etapa 14e: Monitor de CNPJs (compliance) + trava de cadastro do fornecedor
-- Idempotente. Rodar no SQL Editor do Supabase, depois da 049.
--
-- cnpj_monitor          → situação de cada CNPJ na Receita (um por CNPJ, da plataforma inteira): situação, quando mudou,
--                         revisão da plataforma (para fornecedor global). Verificado nos ciclos (01 e 15) e na hora de
--                         enviar cotação / emitir OC (resultado vale 24 h).
-- cnpj_monitor_ciclos   → ciclos quinzenais (início, fim, quantos verificados, e-mails enviados).
-- cnpj_liberacoes       → JUSTIFICATIVA registrada para seguir com OC / lançamento de nota de fornecedor com CNPJ irregular
--                         (quem, quando, situação naquele momento, motivo). É o rastro de compliance.
-- fornecedor_alteracoes → histórico dos dados cadastrais do fornecedor (o fornecedor não troca CNPJ nem razão social).
-- cotacao_fornecedores.bloqueado_cnpj → envio da cotação bloqueado (situação na Receita naquele momento).

CREATE TABLE IF NOT EXISTS public.cnpj_monitor (
  documento          text PRIMARY KEY,               -- 14 dígitos
  situacao           text,                            -- ATIVA, BAIXADA, SUSPENSA, INAPTA, NULA…
  situacao_anterior  text,
  razao_social       text,
  verificado_em      timestamptz,
  mudou_em           timestamptz,
  ultima_falha       text,                            -- Receita fora do ar na última tentativa
  revisao_status     text,                            -- plataforma: em_revisao | revisado | suspenso
  revisao_nota       text,
  revisao_por        text,
  revisao_em         timestamptz
);
CREATE INDEX IF NOT EXISTS cnpj_monitor_situacao_idx ON public.cnpj_monitor (situacao);

CREATE TABLE IF NOT EXISTS public.cnpj_monitor_ciclos (
  id            bigserial PRIMARY KEY,
  inicio        date NOT NULL UNIQUE,                 -- 01 ou 15 do mês
  concluido_em  timestamptz,
  total         integer,
  irregulares   integer,
  emails        integer,
  criado_em     timestamptz NOT NULL DEFAULT now()
);

DO $$
DECLARE tt text; tf text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tt FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO tf FROM pg_attribute a WHERE a.attrelid = 'public.fornecedores'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.cnpj_liberacoes (
      id             bigserial PRIMARY KEY,
      tenant_id      %s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      fornecedor_id  %s REFERENCES public.fornecedores(id) ON DELETE SET NULL,
      documento      text NOT NULL,
      situacao       text,
      contexto       text NOT NULL,                     -- oc (emitir OC) | nota (lançar nota / pagamento)
      referencia     text,                              -- cotação ou OC
      justificativa  text NOT NULL,
      usuario_id     text,
      usuario_nome   text,
      criado_em      timestamptz NOT NULL DEFAULT now()
    )$f$, tt, tf);
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.fornecedor_alteracoes (
      id             bigserial PRIMARY KEY,
      fornecedor_id  %s NOT NULL REFERENCES public.fornecedores(id) ON DELETE CASCADE,
      campo          text NOT NULL,
      antes          text,
      depois         text,
      origem         text NOT NULL DEFAULT 'fornecedor', -- fornecedor | tenant | plataforma
      usuario_nome   text,
      criado_em      timestamptz NOT NULL DEFAULT now()
    )$f$, tf);
END $$;
CREATE INDEX IF NOT EXISTS cnpj_liberacoes_tenant_idx ON public.cnpj_liberacoes (tenant_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS cnpj_liberacoes_ref_idx ON public.cnpj_liberacoes (tenant_id, contexto, referencia);
CREATE INDEX IF NOT EXISTS fornecedor_alteracoes_idx ON public.fornecedor_alteracoes (fornecedor_id, criado_em DESC);

ALTER TABLE public.cotacao_fornecedores ADD COLUMN IF NOT EXISTS bloqueado_cnpj text;

-- Ponto de partida: o que já se sabe dos fornecedores (situacao_cnpj das consultas anteriores)
INSERT INTO public.cnpj_monitor (documento, situacao, razao_social, verificado_em)
SELECT DISTINCT ON (d) d, f.situacao_cnpj, COALESCE(f.razao_social, f.nome), f.ultima_consulta_cnpj
FROM (SELECT regexp_replace(COALESCE(cnpj, ''), '\D', '', 'g') AS d, * FROM public.fornecedores) f
WHERE length(d) = 14 AND f.situacao_cnpj IS NOT NULL
ORDER BY d, f.ultima_consulta_cnpj DESC NULLS LAST
ON CONFLICT (documento) DO NOTHING;
