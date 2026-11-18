-- 108_colaborador_escala.sql — etapa B1.14: escala do colaborador (5x2 · 6x1 · 12x36); vazio = jornada padrão da empresa
-- Usada nas férias: a lei proíbe começar nos 2 dias antes do repouso semanal (5x2 → quinta/sexta/sábado; 6x1 → sexta/sábado).
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS escala text;
NOTIFY pgrst, 'reload schema';
