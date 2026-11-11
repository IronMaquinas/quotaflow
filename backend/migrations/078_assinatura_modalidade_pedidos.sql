-- 078_assinatura_modalidade_pedidos.sql — etapa 18w: 💳 modalidade (como a Adobe) + pedido de plano pelo cliente
-- Idempotente. Rodar depois da 077. O tipo de tenants.id é lido do banco.
--   Modalidade: mensal (sem fidelidade, sem data de fim) · anual_mensal (compromisso de 12 meses, cobra todo mês) ·
--   anual_prepago (paga o ano de uma vez, maior desconto). Datas calculadas: próxima cobrança e fim do compromisso.
--   plataforma_planos.preco_anual_mensal: valor MENSAL do anual pago por mês (preco_mensal = mensal; preco_anual = pré-pago).
--   plataforma_planos.publico: aparece para o cliente em ⭐ Meu plano (planos internos/customizados: false).
--   tenant_plano_pedidos: o cliente escolhe "Quero este" → pedido pendente → a plataforma confirma no Console.
ALTER TABLE public.plataforma_planos ADD COLUMN IF NOT EXISTS preco_anual_mensal numeric(12,2);
ALTER TABLE public.plataforma_planos ADD COLUMN IF NOT EXISTS publico boolean NOT NULL DEFAULT true;
ALTER TABLE public.tenant_assinaturas ADD COLUMN IF NOT EXISTS modalidade text NOT NULL DEFAULT 'mensal';
ALTER TABLE public.tenant_assinaturas ADD COLUMN IF NOT EXISTS proxima_cobranca date;
ALTER TABLE public.tenant_assinaturas ADD COLUMN IF NOT EXISTS fim_compromisso date;
DO $$ BEGIN
  ALTER TABLE public.tenant_assinaturas ADD CONSTRAINT tenant_assinaturas_modalidade_ck CHECK (modalidade IN ('mensal','anual_mensal','anual_prepago'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
-- assinaturas da 18v: ciclo anual vira "anual pré-pago"; a renovação vira fim do compromisso (mensal: sem fim)
UPDATE public.tenant_assinaturas SET modalidade = 'anual_prepago' WHERE ciclo = 'anual' AND modalidade = 'mensal' AND proxima_cobranca IS NULL;
-- mensal: próxima cobrança = próximo "aniversário" mensal do início, sem fim (ignora renovação de 1 ano digitada na 18v)
UPDATE public.tenant_assinaturas SET fim_compromisso = NULL,
  proxima_cobranca = (inicio + make_interval(months => (extract(year from age(current_date, inicio)) * 12 + extract(month from age(current_date, inicio)))::int + 1))::date
 WHERE modalidade = 'mensal' AND proxima_cobranca IS NULL AND inicio IS NOT NULL;
UPDATE public.tenant_assinaturas SET proxima_cobranca = proxima_renovacao, fim_compromisso = proxima_renovacao
 WHERE modalidade <> 'mensal' AND proxima_cobranca IS NULL AND proxima_renovacao IS NOT NULL;

DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a
   WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.tenant_plano_pedidos (
      id bigserial PRIMARY KEY,
      tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      plano_id bigint REFERENCES public.plataforma_planos(id) ON DELETE SET NULL,
      plano_nome text,
      modalidade text NOT NULL DEFAULT 'mensal',
      valor numeric(12,2),
      moeda text NOT NULL DEFAULT 'BRL',
      obs text,
      status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','confirmado','recusado','cancelado')),
      pedido_por text,
      pedido_por_email text,
      criado_em timestamptz NOT NULL DEFAULT now(),
      decidido_em timestamptz,
      decidido_por text,
      motivo text
    )$f$, tid);
END $$;
CREATE INDEX IF NOT EXISTS tenant_plano_pedidos_idx ON public.tenant_plano_pedidos (status, criado_em DESC);
ALTER TABLE public.tenant_plano_pedidos ENABLE ROW LEVEL SECURITY;
