-- 096_gestao_distribuicao.sql — etapa 18zz.2: 📣 DISTRIBUIÇÃO dos documentos de gestão para leitura dos colaboradores
-- Idempotente. distribuicao = { todos: bool, funcoes: [ids de função] } — quem tem login de colaborador vê no app
-- (📘 Procedimentos) e confirma "Li e entendi". Nula = não distribuído (só quem acessa 📁 Documentos).
ALTER TABLE public.documentos_gestao ADD COLUMN IF NOT EXISTS distribuicao jsonb;
