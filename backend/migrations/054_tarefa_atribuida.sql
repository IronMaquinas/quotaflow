-- 054_tarefa_atribuida.sql — etapa 15c.1: tarefa do Comercial atribuída a um usuário (admin, gestor ou comercial)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 053.
--   bid_atividades (+) atribuido_id, atribuido_nome → "⏰ Tarefa para Fulano" (quem recebe é avisado por e-mail)
DO $$
DECLARE t_usuario text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'bid_atividades' AND column_name = 'atribuido_id') THEN
    EXECUTE format('ALTER TABLE public.bid_atividades ADD COLUMN atribuido_id %s REFERENCES public.usuarios(id) ON DELETE SET NULL', t_usuario);
  END IF;
END $$;
ALTER TABLE public.bid_atividades ADD COLUMN IF NOT EXISTS atribuido_nome text;
CREATE INDEX IF NOT EXISTS bid_atividades_atribuido_idx ON public.bid_atividades (tenant_id, atribuido_id) WHERE concluida_em IS NULL;
