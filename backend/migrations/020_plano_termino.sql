-- 020_plano_termino.sql — etapa 12b.1: data de término do plano de manutenção
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 019.
--   termina_em NULL = sem término. Com data, nenhuma OS é gerada depois dela.

BEGIN;

ALTER TABLE public.planos_manutencao ADD COLUMN IF NOT EXISTS termina_em date;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planos_manutencao_termino_valido') THEN
    ALTER TABLE public.planos_manutencao
      ADD CONSTRAINT planos_manutencao_termino_valido CHECK (termina_em IS NULL OR termina_em >= proxima_data);
  END IF;
END $$;

COMMIT;
