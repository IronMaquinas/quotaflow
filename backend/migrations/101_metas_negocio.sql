-- 101_metas_negocio.sql — etapa SC2: 🎯 METAS DO NEGÓCIO (KPIs) de cada empresa + fotografia diária para a tendência
-- Idempotente. A medida (chave) é calculada pelo sistema (services/metas.js); a empresa define meta e limites do semáforo.
--   sentido 'maior' (maior é melhor): valor ≥ meta 🟢 · ≥ limite 🟡 · abaixo 🔴
--   sentido 'menor' (menor é melhor): valor ≤ meta 🟢 · ≤ limite 🟡 · acima 🔴
DO $$
DECLARE t text; uid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO uid FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format($f$CREATE TABLE IF NOT EXISTS public.metas_negocio (
    id bigserial PRIMARY KEY,
    tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    chave text NOT NULL,
    nome text NOT NULL,
    area text NOT NULL DEFAULT 'geral',
    sentido text NOT NULL DEFAULT 'maior' CHECK (sentido IN ('maior','menor')),
    meta numeric,
    limite numeric,
    responsavel_usuario_id %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
    responsavel_nome text,
    observacao text,
    ordem int NOT NULL DEFAULT 0,
    ativo boolean NOT NULL DEFAULT true,
    criado_em timestamptz NOT NULL DEFAULT now(),
    atualizado_em timestamptz NOT NULL DEFAULT now()
  )$f$, t, uid);
  EXECUTE format($f$CREATE TABLE IF NOT EXISTS public.metas_fotografias (
    id bigserial PRIMARY KEY,
    tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    chave text NOT NULL,
    dia date NOT NULL,
    valor numeric
  )$f$, t);
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS metas_negocio_tenant_chave_uq ON public.metas_negocio (tenant_id, chave);
CREATE UNIQUE INDEX IF NOT EXISTS metas_fotografias_uq ON public.metas_fotografias (tenant_id, chave, dia);
NOTIFY pgrst, 'reload schema';
