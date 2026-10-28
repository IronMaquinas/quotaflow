-- 052_bid_cliente.sql — etapa 15b: o BID com o cliente (link, visualizado, resposta por item, aceite com código + assinatura)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 051.
--   bids (+)            → fases novas (quem faz o BID andar é o cliente), link com token, visualizado, revisão em andamento, aceite
--   bid_versoes (+)     → quando cada versão foi enviada, vista, respondida, substituída + a resposta do cliente (por item)
--   bid_visualizacoes   → cada abertura do link (versão, quando, IP) — base do "✓✓ visualizado" e dos indicadores
-- Fases: elaboracao · aguardando_cliente · revisao_solicitada · aguardando_aceite · aceito · perdido
--   (as da 15a viram: enviado → aguardando_cliente, negociacao → revisao_solicitada, proposta_final → aguardando_aceite)
BEGIN;
ALTER TABLE public.bids DROP CONSTRAINT IF EXISTS bids_fase_check;
UPDATE public.bids SET fase = 'aguardando_cliente' WHERE fase = 'enviado';
UPDATE public.bids SET fase = 'revisao_solicitada' WHERE fase = 'negociacao';
UPDATE public.bids SET fase = 'aguardando_aceite' WHERE fase = 'proposta_final';
ALTER TABLE public.bids ADD CONSTRAINT bids_fase_check CHECK (fase IN ('elaboracao','aguardando_cliente','revisao_solicitada','aguardando_aceite','aceito','perdido'));

ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS token text;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS versao_enviada integer NOT NULL DEFAULT 0;   -- a versão que o cliente vê no link
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS em_revisao boolean NOT NULL DEFAULT false;   -- comercial preparando a próxima versão (o cliente segue vendo a enviada)
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS envio_para text;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS visto_primeiro_em timestamptz;              -- da versão enviada
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS visto_ultimo_em timestamptz;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS visto_qtd integer NOT NULL DEFAULT 0;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS respondido_em timestamptz;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS codigo_hash text;                           -- código do aceite (só o hash)
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS codigo_expira timestamptz;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS codigo_tentativas integer NOT NULL DEFAULT 0;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS aceite_nome text;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS aceite_cargo text;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS aceite_email text;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS aceite_em timestamptz;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS aceite_png text;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS aceite_hash text;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS aceite_versao integer;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS aceite_ip text;
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS aceite_canal text;                          -- link | fora_sistema
ALTER TABLE public.bids ADD COLUMN IF NOT EXISTS aceite_obs text;
CREATE UNIQUE INDEX IF NOT EXISTS bids_token_unico ON public.bids (token) WHERE token IS NOT NULL;

ALTER TABLE public.bid_versoes ADD COLUMN IF NOT EXISTS enviada_em timestamptz;
ALTER TABLE public.bid_versoes ADD COLUMN IF NOT EXISTS enviada_para text;
ALTER TABLE public.bid_versoes ADD COLUMN IF NOT EXISTS mensagem text;
ALTER TABLE public.bid_versoes ADD COLUMN IF NOT EXISTS vista_em timestamptz;
ALTER TABLE public.bid_versoes ADD COLUMN IF NOT EXISTS vista_qtd integer NOT NULL DEFAULT 0;
ALTER TABLE public.bid_versoes ADD COLUMN IF NOT EXISTS respondida_em timestamptz;
ALTER TABLE public.bid_versoes ADD COLUMN IF NOT EXISTS resposta jsonb;                      -- { nome, cargo, geral, itens: { item_id: { decisao, motivo, comentario } } }
ALTER TABLE public.bid_versoes ADD COLUMN IF NOT EXISTS substituida_em timestamptz;

DO $$
DECLARE t_tenant text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id';
  IF to_regclass('public.bid_visualizacoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.bid_visualizacoes (
        id         bigserial PRIMARY KEY,
        tenant_id  %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        bid_id     bigint NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
        versao     integer NOT NULL,
        ip         text,
        agente     text,
        em         timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS bid_visualizacoes_bid_idx ON public.bid_visualizacoes (tenant_id, bid_id, versao);
COMMIT;
