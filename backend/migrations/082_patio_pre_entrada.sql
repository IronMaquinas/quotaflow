-- 082_patio_pre_entrada.sql — etapa 18z.1: 📦 pré-entrada no pátio (pelo XML da NF) → a equipe do pátio confirma a chegada
-- Idempotente.
--   status: pre_entrada (lançada pelo suporte, aguardando chegada) → no_patio → saiu.
--   Na pré-entrada o nº de série e a data de entrada podem ficar em branco — o pátio confere na plaqueta ao confirmar a chegada.
ALTER TABLE public.patio_bens DROP CONSTRAINT IF EXISTS patio_bens_status_check;
ALTER TABLE public.patio_bens DROP CONSTRAINT IF EXISTS patio_bens_status_ck;
ALTER TABLE public.patio_bens ADD CONSTRAINT patio_bens_status_ck CHECK (status IN ('pre_entrada','no_patio','saiu'));
ALTER TABLE public.patio_bens ALTER COLUMN numero_serie DROP NOT NULL;
ALTER TABLE public.patio_bens ALTER COLUMN entrada_em DROP NOT NULL;
ALTER TABLE public.patio_bens ADD COLUMN IF NOT EXISTS nf_emitente_nome text;
ALTER TABLE public.patio_bens ADD COLUMN IF NOT EXISTS nf_emitente_cnpj text;
ALTER TABLE public.patio_bens ADD COLUMN IF NOT EXISTS nf_item text;
ALTER TABLE public.patio_bens ADD COLUMN IF NOT EXISTS previsto_em date;
ALTER TABLE public.patio_bens ADD COLUMN IF NOT EXISTS pre_por text;
ALTER TABLE public.patio_bens ADD COLUMN IF NOT EXISTS pre_em timestamptz;
DROP INDEX IF EXISTS public.patio_bens_serie_no_patio_uq;
CREATE UNIQUE INDEX IF NOT EXISTS patio_bens_serie_ativo_uq ON public.patio_bens (tenant_id, upper(numero_serie))
  WHERE status IN ('pre_entrada','no_patio') AND numero_serie IS NOT NULL AND numero_serie <> '';
