-- 109_ferias_historico.sql — etapa B1.15: 🏖 reprogramação e cancelamento de férias com motivo (rastreável, vai ao dossiê)
-- Idempotente. Cancelar não apaga: a linha fica com cancelada_em e sai do saldo.
ALTER TABLE public.colaborador_ferias ADD COLUMN IF NOT EXISTS cancelada_em timestamptz;
ALTER TABLE public.colaborador_ferias ADD COLUMN IF NOT EXISTS cancelada_por_nome text;
ALTER TABLE public.colaborador_ferias ADD COLUMN IF NOT EXISTS cancelamento_motivo text;
DO $$
DECLARE tid text; cid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO cid FROM pg_attribute a WHERE a.attrelid = 'public.colaboradores'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.colaborador_ferias_historico') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.colaborador_ferias_historico (
        id              bigserial PRIMARY KEY,
        tenant_id       %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        ferias_id       bigint NOT NULL REFERENCES public.colaborador_ferias(id) ON DELETE CASCADE,
        colaborador_id  %2$s NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
        acao            text NOT NULL CHECK (acao IN ('lancada', 'reprogramada', 'cancelada')),
        antes           jsonb,
        depois          jsonb,
        motivo          text,
        por_nome        text,
        em              timestamptz NOT NULL DEFAULT now()
      )$f$, tid, cid);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS colaborador_ferias_hist_idx ON public.colaborador_ferias_historico (tenant_id, ferias_id);
NOTIFY pgrst, 'reload schema';
