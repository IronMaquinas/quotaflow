-- 067_tarefa_responsavel.sql — etapa 18g.2a: 👤 responsável da tarefa ligado ao cadastro (usuário e/ou colaborador)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 066.
--   tarefas.responsavel_usuario_id     → usuário com login (permite "👤 Minhas tarefas" e avisos)
--   tarefas.responsavel_colaborador_id → colaborador de 👷 Pessoas (pode não ter login)
--   tarefas.responsavel (texto) continua: nome mostrado e responsável livre ("Time fiscal") quando não há cadastro.
DO $$
DECLARE t_usuario text; t_colab text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tarefas' AND column_name = 'responsavel_usuario_id') THEN
    EXECUTE format('ALTER TABLE public.tarefas ADD COLUMN responsavel_usuario_id %s REFERENCES public.usuarios(id) ON DELETE SET NULL', t_usuario);
  END IF;
  IF to_regclass('public.colaboradores') IS NOT NULL THEN
    SELECT format_type(a.atttypid, a.atttypmod) INTO t_colab FROM pg_attribute a WHERE a.attrelid = 'public.colaboradores'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tarefas' AND column_name = 'responsavel_colaborador_id') THEN
      EXECUTE format('ALTER TABLE public.tarefas ADD COLUMN responsavel_colaborador_id %s REFERENCES public.colaboradores(id) ON DELETE SET NULL', t_colab);
    END IF;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS tarefas_resp_usuario_idx ON public.tarefas (tenant_id, responsavel_usuario_id) WHERE responsavel_usuario_id IS NOT NULL;
