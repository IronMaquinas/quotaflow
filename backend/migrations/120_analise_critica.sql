-- 120_analise_critica.sql — etapa R2: 🧭 ANÁLISE CRÍTICA PELA DIREÇÃO (ISO 9001 9.3)
--   Uma análise por período: participantes, entradas montadas pelo sistema (congeladas ao encerrar), comentário da direção por entrada,
--   saídas/decisões (melhoria · mudança no sistema · recursos) que viram tarefa tipo AC, assinaturas (direção + qualidade) e ata em PDF.
-- Idempotente; tipos de id lidos do banco.
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.analises_criticas') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.analises_criticas (
        id             bigserial PRIMARY KEY,
        tenant_id      %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        numero         text,
        titulo         text NOT NULL,
        periodo_de     date NOT NULL,
        periodo_ate    date NOT NULL,
        data_reuniao   date,
        participantes  jsonb NOT NULL DEFAULT '[]'::jsonb,
        status         text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'encerrada', 'concluida', 'cancelada')),
        entradas       jsonb,
        comentarios    jsonb NOT NULL DEFAULT '{}'::jsonb,
        saidas         jsonb NOT NULL DEFAULT '[]'::jsonb,
        conclusao      text,
        assinaturas    jsonb NOT NULL DEFAULT '[]'::jsonb,
        encerrada_em   timestamptz,
        aprovada_em    timestamptz,
        cancelada_em   timestamptz,
        cancelada_por  text,
        cancelamento_motivo text,
        criado_por     text,
        criado_em      timestamptz NOT NULL DEFAULT now(),
        atualizado_em  timestamptz NOT NULL DEFAULT now()
      )$f$, tid);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS analises_criticas_tenant_idx ON public.analises_criticas (tenant_id, periodo_ate);
-- tarefa tipo AC (🧭 Análise crítica) para as decisões
ALTER TABLE public.tarefas DROP CONSTRAINT IF EXISTS tarefas_tipo_check;
ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_tipo_check CHECK (tipo IS NULL OR tipo IN ('TR','NC','AU','MT','CM','HR','GN','KPI','AC'));
NOTIFY pgrst, 'reload schema';
