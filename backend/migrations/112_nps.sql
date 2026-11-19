-- 112_nps.sql — etapa N1: ⭐ NPS — pesquisa de satisfação do cliente (link público, sem login)
--   Nasce sozinha quando um pedido (PV) fica Concluído, ou manual (qualquer cliente). Nota 0–10 + comentário + o que pesou.
--   Detrator (0–6) → aviso e tarefa para o gestor tratar. Idempotente; tipos de id lidos do banco.
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.nps_pesquisas') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.nps_pesquisas (
        id             bigserial PRIMARY KEY,
        tenant_id      %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        numero         text,
        origem_tipo    text NOT NULL DEFAULT 'manual' CHECK (origem_tipo IN ('pv', 'manual')),
        origem_id      text,
        origem_ref     text,
        cliente_id     text,
        cliente_nome   text,
        contato_nome   text,
        email          text,
        token          text NOT NULL UNIQUE,
        status         text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'enviada', 'respondida', 'cancelada')),
        enviada_em     timestamptz,
        aberta_em      timestamptz,
        respondida_em  timestamptz,
        expira_em      timestamptz,
        nota           integer CHECK (nota BETWEEN 0 AND 10),
        comentario     text,
        motivos        jsonb NOT NULL DEFAULT '[]'::jsonb,
        respondente    text,
        tarefa_id      text,
        criado_por     text,
        criado_em      timestamptz NOT NULL DEFAULT now()
      )$f$, tid);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS nps_pesquisas_tenant_idx ON public.nps_pesquisas (tenant_id, criado_em);
CREATE UNIQUE INDEX IF NOT EXISTS nps_pesquisas_origem_uq ON public.nps_pesquisas (tenant_id, origem_tipo, origem_id) WHERE origem_tipo = 'pv';
