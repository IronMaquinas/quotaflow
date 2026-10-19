-- 022_colaboradores_documentos.sql — etapa 12c: colaboradores + documentos com vencimento
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase.
--
--   colaboradores     → pessoas da empresa (com ou sem login); ligação opcional a usuarios
--   documento_tipos   → tipos de documento; tenant_id NULL = lista padrão do sistema (todos veem);
--                       o tenant pode criar os seus
--   documentos        → um documento de pessoa, equipamento ou empresa, com vencimento e arquivo
--                       anexo (bucket privado "documentos"); renovar = novo documento que substitui o anterior
-- Tipos das chaves (tenants/equipamentos/usuarios) lidos do banco antes de criar as FKs.

BEGIN;

DO $$
DECLARE
  t_tenant  text;
  t_equip   text;
  t_usuario text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass      AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_equip   FROM pg_attribute a WHERE a.attrelid = 'public.equipamentos'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass     AND a.attname = 'id';

  IF to_regclass('public.colaboradores') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.colaboradores (
        id            bigserial PRIMARY KEY,
        tenant_id     %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        nome          text NOT NULL,
        cpf           text,                      -- só dígitos
        funcao        text,
        admissao      date,
        situacao      text NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo', 'afastado', 'desligado')),
        telefone      text,
        email         text,
        usuario_id    %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        obs           text,
        criado_em     timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario);
  END IF;

  IF to_regclass('public.documento_tipos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.documento_tipos (
        id                    bigserial PRIMARY KEY,
        tenant_id             %1$s REFERENCES public.tenants(id) ON DELETE CASCADE,   -- NULL = padrão do sistema
        alvo                  text NOT NULL CHECK (alvo IN ('colaborador', 'equipamento', 'empresa')),
        codigo                text NOT NULL,
        nome                  text NOT NULL,
        validade_meses_padrao integer CHECK (validade_meses_padrao IS NULL OR validade_meses_padrao BETWEEN 1 AND 240),
        ordem                 integer NOT NULL DEFAULT 100,
        ativo                 boolean NOT NULL DEFAULT true,
        criado_em             timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant);
  END IF;

  IF to_regclass('public.documentos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.documentos (
        id               bigserial PRIMARY KEY,
        tenant_id        %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        alvo_tipo        text NOT NULL CHECK (alvo_tipo IN ('colaborador', 'equipamento', 'empresa')),
        colaborador_id   bigint REFERENCES public.colaboradores(id) ON DELETE CASCADE,
        equipamento_id   %2$s REFERENCES public.equipamentos(id) ON DELETE CASCADE,
        tipo_id          bigint REFERENCES public.documento_tipos(id) ON DELETE SET NULL,
        tipo_nome        text NOT NULL,          -- cópia do nome do tipo (não some se o tipo for apagado)
        numero           text,
        emitido_em       date,
        vence_em         date,                   -- NULL = sem vencimento
        responsavel_id   %3$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        arquivo_path     text,                   -- path no bucket privado "documentos"
        arquivo_nome     text,
        arquivo_mime     text,
        obs              text,
        substituido_por  bigint REFERENCES public.documentos(id) ON DELETE SET NULL,   -- renovado por
        criado_por       text,
        criado_em        timestamptz NOT NULL DEFAULT now(),
        atualizado_em    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT documentos_alvo_consistente CHECK (
          (alvo_tipo = 'colaborador' AND colaborador_id IS NOT NULL AND equipamento_id IS NULL) OR
          (alvo_tipo = 'equipamento' AND equipamento_id IS NOT NULL AND colaborador_id IS NULL) OR
          (alvo_tipo = 'empresa'     AND colaborador_id IS NULL     AND equipamento_id IS NULL)
        ),
        CONSTRAINT documentos_datas_validas CHECK (vence_em IS NULL OR emitido_em IS NULL OR vence_em >= emitido_em)
      )$f$, t_tenant, t_equip, t_usuario);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS colaboradores_cpf_unico ON public.colaboradores (tenant_id, cpf) WHERE cpf IS NOT NULL AND cpf <> '';
CREATE INDEX IF NOT EXISTS colaboradores_tenant_idx ON public.colaboradores (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS documento_tipos_codigo_unico ON public.documento_tipos (COALESCE(tenant_id::text, '-'), alvo, codigo);
CREATE INDEX IF NOT EXISTS documentos_tenant_vence_idx ON public.documentos (tenant_id, vence_em);
CREATE INDEX IF NOT EXISTS documentos_colaborador_idx ON public.documentos (colaborador_id) WHERE colaborador_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS documentos_equipamento_idx ON public.documentos (equipamento_id) WHERE equipamento_id IS NOT NULL;

-- Lista padrão (tenant_id NULL). Validade = sugestão para preencher o vencimento; o usuário pode mudar.
INSERT INTO public.documento_tipos (tenant_id, alvo, codigo, nome, validade_meses_padrao, ordem)
SELECT NULL, v.alvo, v.codigo, v.nome, v.meses, v.ordem
FROM (VALUES
  ('colaborador', 'cnh',            'CNH',                                   60, 10),
  ('colaborador', 'mopp',           'MOPP (transporte de produtos perigosos)', 60, 20),
  ('colaborador', 'aso',            'ASO (atestado de saúde ocupacional)',   12, 30),
  ('colaborador', 'toxicologico',   'Exame toxicológico',                    30, 40),
  ('equipamento', 'crlv',           'CRLV (licenciamento)',                  12, 10),
  ('equipamento', 'antt',           'ANTT / RNTRC',                          60, 20),
  ('equipamento', 'seguro',         'Seguro',                                12, 30),
  ('equipamento', 'tacografo',      'Aferição do tacógrafo (INMETRO)',       24, 40),
  ('equipamento', 'calibracao',     'Certificado de calibração',             12, 50),
  ('empresa',     'alvara',         'Alvará de funcionamento',               12, 10),
  ('empresa',     'licenca_amb',    'Licença ambiental',                     48, 20),
  ('empresa',     'avcb',           'AVCB (bombeiros)',                      36, 30)
) AS v(alvo, codigo, nome, meses, ordem)
WHERE NOT EXISTS (
  SELECT 1 FROM public.documento_tipos t WHERE t.tenant_id IS NULL AND t.alvo = v.alvo AND t.codigo = v.codigo
);

-- Bucket privado para os arquivos (cartão CNH, CRLV, certificado…). Acesso só por link assinado.
INSERT INTO storage.buckets (id, name, public)
VALUES ('documentos', 'documentos', false)
ON CONFLICT (id) DO NOTHING;

COMMIT;
