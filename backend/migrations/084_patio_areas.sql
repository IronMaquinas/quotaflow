-- 084_patio_areas.sql — etapa 18z.6: 📦 áreas de armazenagem do pátio (área útil em m²) + CNPJ do cliente no bem
-- Idempotente. O tipo de tenants.id é lido do banco.
--   Área útil = o que dá para armazenar (sem corredor de manobra). Ocupação = soma da área dos equipamentos no pátio naquela área.
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a
   WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.patio_areas (
      id bigserial PRIMARY KEY,
      tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      nome text NOT NULL,
      area_util_m2 numeric(12,2) NOT NULL CHECK (area_util_m2 > 0),
      coberta boolean NOT NULL DEFAULT false,
      obs text,
      ativo boolean NOT NULL DEFAULT true,
      criado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now()
    )$f$, tid);
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS patio_areas_nome_uq ON public.patio_areas (tenant_id, upper(nome)) WHERE ativo;
ALTER TABLE public.patio_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patio_bens ADD COLUMN IF NOT EXISTS area_id bigint REFERENCES public.patio_areas(id) ON DELETE SET NULL;
ALTER TABLE public.patio_bens ADD COLUMN IF NOT EXISTS cliente_documento text;
