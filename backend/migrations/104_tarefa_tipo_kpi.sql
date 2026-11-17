-- 104_tarefa_tipo_kpi.sql — etapa SC2.5: 🎯 tarefa tipo KPI — plano de ação de meta fora do alvo (TSK-KPI-2026-0001)
-- Idempotente. Só amplia a lista de tipos aceitos; a numeração (trigger da 065) já funciona por tipo/ano.
ALTER TABLE public.tarefas DROP CONSTRAINT IF EXISTS tarefas_tipo_check;
ALTER TABLE public.tarefas ADD CONSTRAINT tarefas_tipo_check CHECK (tipo IS NULL OR tipo IN ('TR','NC','AU','MT','CM','HR','GN','KPI'));
NOTIFY pgrst, 'reload schema';
