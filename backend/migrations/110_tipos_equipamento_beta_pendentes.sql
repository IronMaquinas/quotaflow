-- 110_tipos_equipamento_beta_pendentes.sql — etapa B2.0
--   🚛 tipos de equipamento/ativo POR EMPRESA (lista inicial pelo segmento; o tenant personaliza) + equipamentos.tipo_id e placa
--   👋 beta_pendentes: perguntas que a Beta ainda não sabe responder (vão para o Console da Plataforma — só o admin da plataforma)
-- Idempotente; tipos de id lidos do banco.
ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS placa text;
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.tipos_equipamento') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.tipos_equipamento (
        id          bigserial PRIMARY KEY,
        tenant_id   %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        nome        text NOT NULL,
        sinonimos   text[] NOT NULL DEFAULT '{}',   -- apelidos que a Beta entende ("carreta" = "semirreboque", "baú"…)
        icone       text,
        ativo       boolean NOT NULL DEFAULT true,
        ordem       integer NOT NULL DEFAULT 0,
        criado_em   timestamptz NOT NULL DEFAULT now()
      )$f$, tid);
  END IF;
  IF to_regclass('public.beta_pendentes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.beta_pendentes (
        id            bigserial PRIMARY KEY,
        tenant_id     %1$s REFERENCES public.tenants(id) ON DELETE CASCADE,
        usuario_id    text,
        usuario_nome  text,
        perfis        text,
        pergunta      text NOT NULL,
        conversa      jsonb,
        status        text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'atendida', 'descartada')),
        nota          text,
        criado_em     timestamptz NOT NULL DEFAULT now(),
        resolvido_em  timestamptz
      )$f$, tid);
  END IF;
END $$;
ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS tipo_id bigint REFERENCES public.tipos_equipamento(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS tipos_equipamento_nome_uk ON public.tipos_equipamento (tenant_id, lower(nome));
CREATE INDEX IF NOT EXISTS beta_pendentes_status_idx ON public.beta_pendentes (status, criado_em DESC);
NOTIFY pgrst, 'reload schema';
