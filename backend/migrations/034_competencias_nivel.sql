-- 034_competencias_nivel.sql — etapa 12e.3.1: nota de 1 a 4 na avaliação de competência + treinamentos como evidência
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 033.
--
--   colaborador_competencias.nivel                  → 1 não atende · 2 em desenvolvimento · 3 atende · 4 referência
--                                                     (as avaliações antigas viram 3 = atende / 1 = não atende)
--   colaborador_competencias.nivel_esperado         → cópia do nível esperado pela função no momento
--   colaborador_competencias.evidencia_treinamentos → treinamentos ligados à competência que estavam em dia na avaliação
--   (funcoes.competencias ganha nivel_esperado e treinamentos [códigos] — é jsonb, não precisa de coluna)

BEGIN;
ALTER TABLE public.colaborador_competencias ADD COLUMN IF NOT EXISTS nivel integer CHECK (nivel IS NULL OR nivel BETWEEN 1 AND 4);
ALTER TABLE public.colaborador_competencias ADD COLUMN IF NOT EXISTS nivel_esperado integer;
ALTER TABLE public.colaborador_competencias ADD COLUMN IF NOT EXISTS evidencia_treinamentos jsonb;
UPDATE public.colaborador_competencias SET nivel = CASE WHEN atende THEN 3 ELSE 1 END WHERE nivel IS NULL;
COMMIT;
