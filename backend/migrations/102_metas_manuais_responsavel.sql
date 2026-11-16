-- 102_metas_manuais_responsavel.sql — etapa SC2.1: 🎯 meta CRIADA PELA EMPRESA (valor informado à mão) + 👤 dono obrigatório ligado ao cadastro
-- Idempotente. origem 'sistema' (medida calculada) | 'manual' (a empresa informa o valor; histórico em metas_fotografias).
DO $$
DECLARE cid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO cid FROM pg_attribute a WHERE a.attrelid = 'public.colaboradores'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format('ALTER TABLE public.metas_negocio ADD COLUMN IF NOT EXISTS responsavel_colaborador_id %s REFERENCES public.colaboradores(id) ON DELETE SET NULL', cid);
END $$;
ALTER TABLE public.metas_negocio ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'sistema';
ALTER TABLE public.metas_negocio ADD COLUMN IF NOT EXISTS unidade text;
ALTER TABLE public.metas_fotografias ADD COLUMN IF NOT EXISTS informado_por text;
NOTIFY pgrst, 'reload schema';
