-- 072_spot_mensagens.sql — etapa 18l: 💬 conversa na demanda spot (comprador ↔ fornecedor, uma por interesse)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 071.
--   spot_mensagens: uma linha por mensagem; id crescente (a tela pede "o que veio depois do id X").
--   lida_em: quando o OUTRO lado leu (para o contador de não lidas).
DO $$
DECLARE t_tenant text; t_int text; t_dem text; t_forn text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_int FROM pg_attribute a WHERE a.attrelid = 'public.interesses_spot'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_dem FROM pg_attribute a WHERE a.attrelid = 'public.demandas_spot'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_forn FROM pg_attribute a WHERE a.attrelid = 'public.interesses_spot'::regclass AND a.attname = 'fornecedor_id' AND NOT a.attisdropped;
  IF to_regclass('public.spot_mensagens') IS NULL THEN
    EXECUTE format($f$CREATE TABLE public.spot_mensagens (
      id bigserial PRIMARY KEY,
      interesse_id %s NOT NULL REFERENCES public.interesses_spot(id) ON DELETE CASCADE,
      demanda_id %s REFERENCES public.demandas_spot(id) ON DELETE CASCADE,
      tenant_id %s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      fornecedor_id %s,
      lado text NOT NULL CHECK (lado IN ('comprador','fornecedor')),
      autor_nome text,
      texto text NOT NULL,
      lida_em timestamptz,
      criado_em timestamptz NOT NULL DEFAULT now())$f$, t_int, t_dem, t_tenant, t_forn);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS spot_mensagens_interesse_idx ON public.spot_mensagens (interesse_id, id);
CREATE INDEX IF NOT EXISTS spot_mensagens_tenant_idx ON public.spot_mensagens (tenant_id, demanda_id);
ALTER TABLE public.spot_mensagens ENABLE ROW LEVEL SECURITY; -- só o backend (service role) acessa
