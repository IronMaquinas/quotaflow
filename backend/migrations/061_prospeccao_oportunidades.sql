-- 061_prospeccao_oportunidades.sql — etapa 18b.2: 📣 prospecção com início, meio e fim
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 060.
--   comercial_prospeccoes → por evento × ano: a linha do EVENTO (cliente_id nulo) e as dos CLIENTES.
--                           situacao aberta | cancelada (com motivo, quem e quando); delegação (responsável, prazo, tarefa do ✅ Plano).
--                           "BID criado" vem do próprio BID (bids.evento_id) — não é gravado aqui.
--   tarefas.origem / origem_ref → tarefa do Plano que nasceu de outra tela (ex.: 'prospeccao', '12') — só se encerra na origem.
--   remove as ⏰ tarefas antigas do calendário comercial (bid_atividades criadas pelo lembrete da 18a).
BEGIN;
DO $$
DECLARE t_tenant text; t_cliente text; t_usuario text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_cliente FROM pg_attribute a WHERE a.attrelid = 'public.clientes'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';
  IF to_regclass('public.comercial_prospeccoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.comercial_prospeccoes (
        id               bigserial PRIMARY KEY,
        tenant_id        %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        evento_id        bigint NOT NULL REFERENCES public.comercial_eventos(id) ON DELETE CASCADE,
        ano              integer NOT NULL,
        cliente_id       %2$s REFERENCES public.clientes(id) ON DELETE CASCADE,
        situacao         text NOT NULL DEFAULT 'aberta' CHECK (situacao IN ('aberta','cancelada')),
        motivo           text,
        cancelado_por    text,
        cancelado_em     timestamptz,
        responsavel_id   %3$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        responsavel_nome text,
        prazo            date,
        tarefa_id        text,
        historico        jsonb NOT NULL DEFAULT '[]'::jsonb,
        criado_em        timestamptz NOT NULL DEFAULT now(),
        atualizado_em    timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_cliente, t_usuario);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS comercial_prospeccoes_uk ON public.comercial_prospeccoes (tenant_id, evento_id, ano, (coalesce(cliente_id::text, '*')));
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS origem text;
ALTER TABLE public.tarefas ADD COLUMN IF NOT EXISTS origem_ref text;
DELETE FROM public.bid_atividades WHERE tipo = 'tarefa' AND usuario_nome = 'QuotaFlow · 📅 calendário comercial';
COMMIT;
