-- 106_ferias_regras_faltas.sql — etapa B1.6: 🏖 férias com regras do país (saldo × programado, vencimento) + ⚠ faltas injustificadas
-- Idempotente. tenants.pais escolhe as regras (services/feriasRegras/<PAIS>.js) — definido no Console da Plataforma; padrão BR (CLT).
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS pais text NOT NULL DEFAULT 'BR';
DO $$
DECLARE tid text; cid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO cid FROM pg_attribute a WHERE a.attrelid = 'public.colaboradores'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.colaborador_faltas') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.colaborador_faltas (
        id               bigserial PRIMARY KEY,
        tenant_id        %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        colaborador_id   %2$s NOT NULL REFERENCES public.colaboradores(id) ON DELETE CASCADE,
        data             date NOT NULL,                       -- 1º dia da falta
        dias             integer NOT NULL DEFAULT 1 CHECK (dias BETWEEN 1 AND 60),
        obs              text,
        criado_por_nome  text,
        criado_em        timestamptz NOT NULL DEFAULT now()
      )$f$, tid, cid);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS colaborador_faltas_colab_idx ON public.colaborador_faltas (tenant_id, colaborador_id, data);
NOTIFY pgrst, 'reload schema';
