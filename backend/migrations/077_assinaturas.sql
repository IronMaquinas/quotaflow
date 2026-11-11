-- 077_assinaturas.sql — etapa 18v: 💳 preço nos planos · assinatura por empresa · fim do teste em "só leitura"
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 076. O tipo de tenants.id é lido do banco.
--   plataforma_planos: preço mensal/anual, moeda (BRL · USD · EUR · DKK — sem conversão, cada plano na sua), métrica de cobrança
--     (empresa = valor fixo · usuario · equipamento · uso = pay-per-use) com preço por unidade e franquia incluída.
--   tenant_assinaturas: uma por empresa — plano, situação (teste · ativa · inadimplente · suspensa · cancelada), ciclo, valor
--     negociado, desconto, início, próxima renovação. tenant_assinatura_historico: toda mudança com quem e quando.
--   tenants.teste_aviso_em: o aviso de "faltam 3 dias" do teste já saiu.
ALTER TABLE public.plataforma_planos ADD COLUMN IF NOT EXISTS preco_mensal numeric(12,2);
ALTER TABLE public.plataforma_planos ADD COLUMN IF NOT EXISTS preco_anual numeric(12,2);
ALTER TABLE public.plataforma_planos ADD COLUMN IF NOT EXISTS moeda text NOT NULL DEFAULT 'BRL';
ALTER TABLE public.plataforma_planos ADD COLUMN IF NOT EXISTS metrica text NOT NULL DEFAULT 'empresa';
ALTER TABLE public.plataforma_planos ADD COLUMN IF NOT EXISTS preco_unidade numeric(12,2);
ALTER TABLE public.plataforma_planos ADD COLUMN IF NOT EXISTS franquia integer;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS teste_aviso_em timestamptz;

DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a
   WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.tenant_assinaturas (
      id bigserial PRIMARY KEY,
      tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      plano_id bigint REFERENCES public.plataforma_planos(id) ON DELETE SET NULL,
      plano_nome text,
      situacao text NOT NULL DEFAULT 'teste' CHECK (situacao IN ('teste','ativa','inadimplente','suspensa','cancelada')),
      ciclo text NOT NULL DEFAULT 'mensal' CHECK (ciclo IN ('mensal','anual')),
      moeda text NOT NULL DEFAULT 'BRL',
      valor numeric(12,2),
      desconto_pct numeric(5,2),
      inicio date,
      proxima_renovacao date,
      obs text,
      atualizado_em timestamptz NOT NULL DEFAULT now()
    )$f$, tid);
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.tenant_assinatura_historico (
      id bigserial PRIMARY KEY,
      tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      evento text NOT NULL,
      detalhe jsonb NOT NULL DEFAULT '{}'::jsonb,
      quem text,
      em timestamptz NOT NULL DEFAULT now()
    )$f$, tid);
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS tenant_assinaturas_tenant_uq ON public.tenant_assinaturas (tenant_id);
CREATE INDEX IF NOT EXISTS tenant_assinatura_historico_idx ON public.tenant_assinatura_historico (tenant_id, em DESC);
ALTER TABLE public.tenant_assinaturas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_assinatura_historico ENABLE ROW LEVEL SECURITY;
