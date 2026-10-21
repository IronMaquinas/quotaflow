-- 035_dossie.sql — etapa 12f: registro de cada dossiê do colaborador gerado (LGPD — quem gerou, quando, o quê)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 034.

BEGIN;
DO $$
DECLARE t_tenant text; t_usuario text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';
  IF to_regclass('public.dossie_registros') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.dossie_registros (
        id               bigserial PRIMARY KEY,
        tenant_id        %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        colaborador_id   bigint NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
        codigo           text NOT NULL,            -- código de verificação impresso no dossiê
        periodo_de       date,                     -- NULL = desde o início
        periodo_ate      date NOT NULL,
        secoes           jsonb NOT NULL,           -- seções incluídas
        motivo           text,                     -- auditoria ISO, processo trabalhista, pedido do colaborador…
        gerado_por       %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        gerado_por_nome  text,
        ip               text,
        criado_em        timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS dossie_registros_colab_idx ON public.dossie_registros (tenant_id, colaborador_id, criado_em);
COMMIT;
