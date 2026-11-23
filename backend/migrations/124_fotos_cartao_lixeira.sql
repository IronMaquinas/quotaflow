-- 124_fotos_cartao_lixeira.sql — etapa E2.2: 🗑 LIXEIRA das fotos com cartão (30 dias para restaurar; depois some de vez). Idempotente.
ALTER TABLE public.fotos_cartao ADD COLUMN IF NOT EXISTS excluida_em timestamptz;
ALTER TABLE public.fotos_cartao ADD COLUMN IF NOT EXISTS excluida_por text;
ALTER TABLE public.fotos_cartao ADD COLUMN IF NOT EXISTS exclusao_motivo text;
NOTIFY pgrst, 'reload schema';
