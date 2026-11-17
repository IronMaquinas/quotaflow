-- 103_metas_resultados.sql — etapa SC2.4: 🎯 RESULTADO MENSAL de cada meta (1 por mês) + ajuste manual rastreado
-- Idempotente. origem: calculado (sistema fechou o mês) | informado (a empresa informou) | ajustado (corrigido à mão, com motivo).
--   valor_original guarda o primeiro valor (do sistema ou o informado) quando houver ajuste — nada se perde.
DO $$
DECLARE t text; uid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO uid FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format($f$CREATE TABLE IF NOT EXISTS public.metas_resultados (
    id bigserial PRIMARY KEY,
    tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    meta_id bigint NOT NULL REFERENCES public.metas_negocio(id) ON DELETE CASCADE,
    mes text NOT NULL,
    valor numeric,
    origem text NOT NULL DEFAULT 'calculado' CHECK (origem IN ('calculado','informado','ajustado')),
    valor_original numeric,
    origem_original text,
    por_nome text,
    por_id %2$s,
    motivo text,
    em timestamptz NOT NULL DEFAULT now()
  )$f$, t, uid);
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS metas_resultados_meta_mes_uq ON public.metas_resultados (meta_id, mes);
NOTIFY pgrst, 'reload schema';
