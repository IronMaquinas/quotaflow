-- 038_disciplinar_ciencia.sql — etapa 12h.1: ciência "pendente" (preenche no escritório, colhe depois) e "papel" (assinou impresso, anexo)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 037.

BEGIN;
ALTER TABLE public.medidas_disciplinares DROP CONSTRAINT IF EXISTS medidas_disciplinares_ciencia_check;
ALTER TABLE public.medidas_disciplinares ADD CONSTRAINT medidas_disciplinares_ciencia_check CHECK (ciencia IN ('assinada', 'recusa', 'verbal', 'pendente', 'papel'));
COMMIT;
