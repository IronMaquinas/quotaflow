-- 125_defeitos_foto.sql — etapa E3: 🔧 DEFEITOS (mapeados pelas fotos com cartão) e TRIAGEM da engenharia
--   Um defeito = projeto + aerogerador/referência + pá + nº do defeito (lidos do cartão — campos marcados como "identifica" no modelo).
--   Várias fotos do mesmo defeito ficam juntas (fotos_cartao.defeito_id). Triagem: sem_reparo · reparar · investigar (com justificativa,
--   quem, quando; histórico de reclassificações; "investigar" pode gerar tarefa).
-- Idempotente; tipos de id lidos do banco.
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.defeitos_foto') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.defeitos_foto (
        id               bigserial PRIMARY KEY,
        tenant_id        %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        projeto_id       bigint REFERENCES public.projetos_foto(id) ON DELETE CASCADE,
        chave            text NOT NULL,
        referencia       text,
        pa               text,
        numero           text NOT NULL,
        resumo           jsonb NOT NULL DEFAULT '{}'::jsonb,
        primeira_em      timestamptz,
        ultima_em        timestamptz,
        classificacao    text CHECK (classificacao IS NULL OR classificacao IN ('sem_reparo', 'reparar', 'investigar')),
        justificativa    text,
        classificado_por text,
        classificado_em  timestamptz,
        tarefa_id        text,
        historico        jsonb NOT NULL DEFAULT '[]'::jsonb,
        criado_em        timestamptz NOT NULL DEFAULT now(),
        atualizado_em    timestamptz NOT NULL DEFAULT now()
      )$f$, tid);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS defeitos_foto_chave_idx ON public.defeitos_foto (tenant_id, chave);
CREATE INDEX IF NOT EXISTS defeitos_foto_projeto_idx ON public.defeitos_foto (projeto_id, classificacao);
ALTER TABLE public.fotos_cartao ADD COLUMN IF NOT EXISTS defeito_id bigint REFERENCES public.defeitos_foto(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS fotos_cartao_defeito_idx ON public.fotos_cartao (defeito_id);
-- tarefa tipo DF (🔧 defeito em investigação)
ALTER TABLE public.tarefas DROP CONSTRAINT IF EXISTS tarefas_tipo_check;
ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_tipo_check CHECK (tipo IS NULL OR tipo IN ('TR','NC','AU','MT','CM','HR','GN','KPI','AC','DF'));
NOTIFY pgrst, 'reload schema';
