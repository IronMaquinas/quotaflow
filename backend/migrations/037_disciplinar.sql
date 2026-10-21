-- 037_disciplinar.sql — etapa 12h: medidas disciplinares (orientação, advertência, suspensão, justa causa)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 036.
--
--   medidas_disciplinares → tipo, categoria, fato (data + descrição), aplicação, suspensão (dias, início/fim),
--                           multa ligada (opcional), CIÊNCIA do colaborador assinada na tela — ou RECUSA com
--                           2 testemunhas (nome + assinatura) —, texto do documento (cópia), anexo, cancelamento
--                           (medida anulada fica no histórico) e histórico (jsonb).

BEGIN;
DO $$
DECLARE t_tenant text; t_usuario text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';
  IF to_regclass('public.medidas_disciplinares') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.medidas_disciplinares (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        colaborador_id    bigint NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
        colaborador_nome  text NOT NULL,
        tipo              text NOT NULL CHECK (tipo IN ('orientacao', 'advertencia', 'suspensao', 'justa_causa')),
        categoria         text NOT NULL,
        data_fato         date NOT NULL,
        data_aplicacao    date NOT NULL,
        descricao         text NOT NULL,
        dias_suspensao    integer CHECK (dias_suspensao IS NULL OR dias_suspensao BETWEEN 1 AND 30),
        suspensao_inicio  date,
        suspensao_fim     date,
        multa_id          bigint REFERENCES public.multas(id) ON DELETE SET NULL,
        texto             text NOT NULL,          -- documento como foi apresentado (cópia)
        ciencia           text NOT NULL CHECK (ciencia IN ('assinada', 'recusa', 'verbal')),
        ciencia_png       text,
        ciencia_hash      text,
        ciencia_em        timestamptz,
        testemunhas       jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ nome, png, hash }]
        arquivo_path      text,
        arquivo_nome      text,
        arquivo_mime      text,
        status            text NOT NULL DEFAULT 'vigente' CHECK (status IN ('vigente', 'cancelada')),
        cancelamento_motivo text,
        aplicado_por      %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        aplicado_por_nome text,
        historico         jsonb NOT NULL DEFAULT '[]'::jsonb,
        criado_em         timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS medidas_disciplinares_colab_idx ON public.medidas_disciplinares (tenant_id, colaborador_id, data_aplicacao);
COMMIT;
