-- 097_treinamento_procedimentos.sql — etapa 18zz.5: 📘 treinamento cita procedimentos (documentos de gestão) como material de apoio
-- Idempotente. procedimentos = [ids de documentos_gestao] — aparece na aula como "Leia também" e na lista de treinamentos.
ALTER TABLE public.treinamentos ADD COLUMN IF NOT EXISTS procedimentos jsonb NOT NULL DEFAULT '[]'::jsonb;
NOTIFY pgrst, 'reload schema';
