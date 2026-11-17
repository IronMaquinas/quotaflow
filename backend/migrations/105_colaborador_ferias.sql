-- 105_colaborador_ferias.sql — etapa B1.5: 🏖 férias do colaborador (Pessoas → aba Férias; a 👋 Beta consulta)
-- Idempotente. Um período por linha (férias fracionadas = várias linhas). Situação calculada pela data: programada · em gozo · concluída.
DO $$
DECLARE tid text; cid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO cid FROM pg_attribute a WHERE a.attrelid = 'public.colaboradores'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.colaborador_ferias') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.colaborador_ferias (
        id               bigserial PRIMARY KEY,
        tenant_id        %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        colaborador_id   %2$s NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
        inicio           date NOT NULL,
        fim              date NOT NULL,
        periodo_aquisitivo text,                -- ex.: "2025/2026" (opcional)
        abono_dias       integer NOT NULL DEFAULT 0 CHECK (abono_dias BETWEEN 0 AND 10),   -- dias vendidos
        obs              text,
        criado_por_nome  text,
        criado_em        timestamptz NOT NULL DEFAULT now(),
        atualizado_em    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT colaborador_ferias_datas CHECK (fim >= inicio)
      )$f$, tid, cid);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS colaborador_ferias_tenant_idx ON public.colaborador_ferias (tenant_id, inicio);
CREATE INDEX IF NOT EXISTS colaborador_ferias_colab_idx ON public.colaborador_ferias (colaborador_id);
NOTIFY pgrst, 'reload schema';
