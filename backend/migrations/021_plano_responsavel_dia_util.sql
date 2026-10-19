-- 021_plano_responsavel_dia_util.sql — etapa 12b.2: responsável + regra de dia útil
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 019 e da 020.
--
--   planos_manutencao.responsavel_id  → usuário responsável pelo plano (FK SET NULL)
--   planos_manutencao.regra_dia_util  → 'proximo' (padrão) | 'anterior' | 'manter'
--                                       data que cai em folga/feriado vai para o dia útil seguinte/anterior
--   chamados.responsavel_id           → responsável pela OS (herdado do plano; transferível) (FK SET NULL)
--   chamados.origem_plano_data        continua sendo a data NOMINAL da série (trava contra duplicar),
--                                       mesmo quando a OS foi movida para um dia útil.
-- O tipo de usuarios.id é lido do banco antes de criar as FKs.

BEGIN;

DO $$
DECLARE t_usuario text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario
    FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'planos_manutencao' AND column_name = 'responsavel_id') THEN
    EXECUTE format('ALTER TABLE public.planos_manutencao ADD COLUMN responsavel_id %s REFERENCES public.usuarios(id) ON DELETE SET NULL', t_usuario);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'chamados' AND column_name = 'responsavel_id') THEN
    EXECUTE format('ALTER TABLE public.chamados ADD COLUMN responsavel_id %s REFERENCES public.usuarios(id) ON DELETE SET NULL', t_usuario);
  END IF;
END $$;

ALTER TABLE public.planos_manutencao ADD COLUMN IF NOT EXISTS regra_dia_util text NOT NULL DEFAULT 'proximo';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'planos_manutencao_regra_dia_util_valida') THEN
    ALTER TABLE public.planos_manutencao
      ADD CONSTRAINT planos_manutencao_regra_dia_util_valida CHECK (regra_dia_util IN ('proximo', 'anterior', 'manter'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS chamados_responsavel_idx ON public.chamados (responsavel_id) WHERE responsavel_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS planos_manutencao_responsavel_idx ON public.planos_manutencao (responsavel_id) WHERE responsavel_id IS NOT NULL;

COMMIT;
