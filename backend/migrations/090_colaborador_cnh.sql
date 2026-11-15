-- 090_colaborador_cnh.sql — etapa 18zn: 🪪 dados da CNH no cadastro do colaborador (preenchidos pela leitura da CNH ou à mão)
-- Idempotente. O documento CNH (com arquivo e vencimento) continua sendo o controle de vencimento; aqui fica a ficha da pessoa.
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS rg text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS cnh_registro text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS cnh_validade date;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS cnh_emissao date;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS cnh_primeira_habilitacao date;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS cnh_observacoes text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS cnh_local_emissao text;
