-- 107_colaborador_emergencia_saude.sql — etapa B1.10: 🚑 contato de emergência e 🩺 plano de saúde do colaborador
-- Idempotente. Na ficha (topo) e na 👋 Beta — úteis num atendimento na estrada.
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS emergencia_nome text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS emergencia_telefone text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS emergencia_parentesco text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS plano_saude_operadora text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS plano_saude_plano text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS plano_saude_carteira text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS plano_saude_validade date;
NOTIFY pgrst, 'reload schema';
