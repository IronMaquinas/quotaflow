-- 111_ia_config_empresa.sql — etapa B5.0: 💲 controle de custo da IA por empresa (Console da Plataforma)
--   tenants.ia_config: { chat_mic, chat_fala, conversa (desligado|neural|ao_vivo), cortesia_ate, cortesia_modo, teto_mes_brl }
--   O custo é calculado a partir de ia_uso (tokens; voz: caracteres falados / segundos ouvidos). Idempotente.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS ia_config jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$ BEGIN IF to_regclass('public.ia_uso') IS NOT NULL THEN CREATE INDEX IF NOT EXISTS ia_uso_em_idx ON public.ia_uso (em); END IF; END $$;
