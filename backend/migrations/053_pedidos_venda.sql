-- 053_pedidos_venda.sql — etapa 15c: Pedido de Venda (PV-AAAA-NNNN) + aditivos pelo link do cliente
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 052.
--   pedidos_venda  → nasce SOZINHO quando o cliente aceita o BID (link ou aceite fora do sistema): itens e valores da versão
--                    aceita, status por item (a programar → programado → em execução → concluído | cancelado), rastreio BID/versão.
--   pv_aditivos    → cada aditivo aceito: antes × depois, o que mudou, valor antes → depois, hash do aceite.
--   bids (+)       → tipo ('proposta' | 'aditivo'), pv_id, aditivo_numero. O ADITIVO é um BID do tipo 'aditivo' (PV-…-A1):
--                    mesmo fluxo da 15b (enviar, visualizado, resposta por item, código + assinatura). Aceito → aplica no PV.
-- Ver/alterar: admin, gestor, comercial (a operação verá o serviço SEM valores na AT, etapa 16a).
BEGIN;
DO $$
DECLARE t_tenant text; t_usuario text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';
  IF to_regclass('public.pedidos_venda') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.pedidos_venda (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        numero            text NOT NULL,
        bid_id            bigint REFERENCES public.bids(id) ON DELETE SET NULL,
        bid_numero        text,
        bid_versao        integer,
        cliente_id        bigint REFERENCES public.clientes(id) ON DELETE SET NULL,
        cliente_nome      text NOT NULL,
        contato_nome      text,
        contato_email     text,
        titulo            text,
        referencia        text,
        conteudo          jsonb NOT NULL DEFAULT '{}'::jsonb,   -- colunas, condições, textos (da versão aceita)
        grupos            jsonb NOT NULL DEFAULT '[]'::jsonb,   -- itens por trecho, cada item com status
        condicoes         jsonb NOT NULL DEFAULT '{}'::jsonb,
        valor_total_manual numeric,
        valor_total       numeric,
        aditivo_atual     integer NOT NULL DEFAULT 0,
        status            text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto','em_execucao','concluido','cancelado')),
        cancelado_motivo  text,
        aceite_nome       text,
        aceite_em         timestamptz,
        aceite_hash       text,
        responsavel_id    %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        responsavel_nome  text,
        criado_em         timestamptz NOT NULL DEFAULT now(),
        atualizado_em     timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario);
  END IF;
  IF to_regclass('public.pv_aditivos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.pv_aditivos (
        id            bigserial PRIMARY KEY,
        tenant_id     %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        pv_id         bigint NOT NULL REFERENCES public.pedidos_venda(id) ON DELETE CASCADE,
        numero        integer NOT NULL,
        bid_id        bigint REFERENCES public.bids(id) ON DELETE SET NULL,
        bid_versao    integer,
        antes         jsonb NOT NULL,
        depois        jsonb NOT NULL,
        mudancas      jsonb NOT NULL DEFAULT '[]'::jsonb,
        valor_antes   numeric,
        valor_depois  numeric,
        aceite_nome   text,
        aceite_em     timestamptz,
        aceite_hash   text,
        criado_em     timestamptz NOT NULL DEFAULT now(),
        UNIQUE (pv_id, numero)
      )$f$, t_tenant);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_venda_numero_unico ON public.pedidos_venda (tenant_id, numero);
CREATE UNIQUE INDEX IF NOT EXISTS pedidos_venda_bid_unico ON public.pedidos_venda (bid_id) WHERE bid_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS pedidos_venda_cliente_idx ON public.pedidos_venda (tenant_id, cliente_id);

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS tipo text NOT NULL DEFAULT 'proposta';
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS pv_id bigint REFERENCES public.pedidos_venda(id) ON DELETE SET NULL;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS aditivo_numero integer;
CREATE INDEX IF NOT EXISTS bids_pv_idx ON public.bids (tenant_id, pv_id);
COMMIT;
