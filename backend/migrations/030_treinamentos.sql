-- 030_treinamentos.sql — etapa 12e.1: treinamentos (catálogo, turmas, presença assinada, registro manual)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 029.
--
--   treinamentos               → catálogo. tenant_id NULL = BIBLIOTECA do QuotaFlow (conteúdo + prova — 12e.2);
--                                tenant_id preenchido = treinamento da empresa. codigo (único por tenant) é o que
--                                as funções usam em funcoes.treinamentos [{ codigo }]. validade_meses NULL = não vence.
--   treinamento_turmas         → uma realização: data, carga horária, instrutor, local, modalidade
--                                ('presencial' | 'online' | 'manual' = registro de treinamento já feito, com evidência anexa),
--                                status ('agendada' | 'concluida' | 'cancelada'), cópia do nome e da validade.
--   treinamento_participacoes  → quem participou: presença, assinatura na tela (lista de presença) + hash,
--                                aprovado/nota (prova — 12e.2), valido_ate (data da turma + validade).
--   Evidências (lista escaneada, certificado) vão no bucket privado "documentos": tenant-{id}/trein-{turma}/…

BEGIN;

DO $$
DECLARE t_tenant text; t_usuario text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';

  IF to_regclass('public.treinamentos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.treinamentos (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s REFERENCES public.tenants(id) ON DELETE CASCADE,   -- NULL = biblioteca
        codigo            text NOT NULL,
        nome              text NOT NULL,
        norma             text,                     -- NR-35, NR-20, Resolução ANTT…
        carga_horaria     numeric CHECK (carga_horaria IS NULL OR carga_horaria > 0),
        validade_meses    integer CHECK (validade_meses IS NULL OR (validade_meses BETWEEN 1 AND 240)),
        conteudo          text,                     -- conteúdo programático
        tipo              text NOT NULL DEFAULT 'regulatorio' CHECK (tipo IN ('regulatorio', 'desenvolvimento', 'integracao')),
        origem_id         bigint REFERENCES public.treinamentos(id) ON DELETE SET NULL,
        origem_versao     integer,
        versao            integer NOT NULL DEFAULT 1,
        ativo             boolean NOT NULL DEFAULT true,
        criado_em         timestamptz NOT NULL DEFAULT now(),
        atualizado_em     timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant);
  END IF;

  IF to_regclass('public.treinamento_turmas') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.treinamento_turmas (
        id                 bigserial PRIMARY KEY,
        tenant_id          %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        treinamento_id     bigint REFERENCES public.treinamentos(id) ON DELETE SET NULL,
        treinamento_nome   text NOT NULL,           -- cópia (prova legal)
        validade_meses     integer,                 -- cópia na data
        data               date NOT NULL,
        data_fim           date,
        carga_horaria      numeric,
        instrutor          text,
        local              text,
        modalidade         text NOT NULL DEFAULT 'presencial' CHECK (modalidade IN ('presencial', 'online', 'manual')),
        status             text NOT NULL DEFAULT 'agendada' CHECK (status IN ('agendada', 'concluida', 'cancelada')),
        evidencia_path     text,
        evidencia_nome     text,
        evidencia_mime     text,
        obs                text,
        criado_por         %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        concluida_em       timestamptz,
        criado_em          timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT treinamento_turmas_datas CHECK (data_fim IS NULL OR data_fim >= data)
      )$f$, t_tenant, t_usuario);
  END IF;

  IF to_regclass('public.treinamento_participacoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.treinamento_participacoes (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        turma_id          bigint NOT NULL REFERENCES public.treinamento_turmas(id) ON DELETE CASCADE,
        colaborador_id    bigint NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
        presente          boolean NOT NULL DEFAULT false,
        assinatura_png    text,
        assinatura_hash   text,
        assinado_em       timestamptz,
        aprovado          boolean,                  -- NULL = sem avaliação
        nota              numeric,
        valido_ate        date,
        obs               text,
        criado_em         timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS treinamentos_codigo_unico ON public.treinamentos (COALESCE(tenant_id::text, '-'), codigo);
CREATE INDEX IF NOT EXISTS treinamento_turmas_tenant_idx ON public.treinamento_turmas (tenant_id, data);
CREATE UNIQUE INDEX IF NOT EXISTS treinamento_participacoes_unica ON public.treinamento_participacoes (turma_id, colaborador_id);
CREATE INDEX IF NOT EXISTS treinamento_participacoes_colab_idx ON public.treinamento_participacoes (tenant_id, colaborador_id);

COMMIT;
