-- 019_planos_manutencao.sql — etapa 12b: planos de manutenção recorrentes + valor da hora
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase.
--
-- Cria:
--   planos_manutencao          (plano recorrente por tempo: a cada N dias/semanas/meses)
--   chamados.origem_plano_id   (OS gerada pelo plano; FK SET NULL)
--   chamados.origem_plano_data (data da ocorrência — trava contra duplicar)
--   tenants.valor_hora         (R$/h da mão de obra própria — entra no custo do calendário)
--
-- Os tipos das chaves (tenants.id, equipamentos.id, os_templates.id, chamados.id)
-- são lidos do próprio banco, para as FKs sempre baterem.

BEGIN;

DO $$
DECLARE
  t_tenant   text;
  t_equip    text;
  t_template text;
  t_chamado  text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant
    FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_equip
    FROM pg_attribute a WHERE a.attrelid = 'public.equipamentos'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_template
    FROM pg_attribute a WHERE a.attrelid = 'public.os_templates'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_chamado
    FROM pg_attribute a WHERE a.attrelid = 'public.chamados'::regclass AND a.attname = 'id';

  IF to_regclass('public.planos_manutencao') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.planos_manutencao (
        id                    bigserial PRIMARY KEY,
        tenant_id             %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        equipamento_id        %2$s REFERENCES public.equipamentos(id) ON DELETE SET NULL,
        template_id           %3$s REFERENCES public.os_templates(id) ON DELETE SET NULL,
        nome                  text NOT NULL,
        descricao             text,
        categoria             text NOT NULL DEFAULT 'preventiva',
        urgencia              text NOT NULL DEFAULT 'media',
        periodicidade_valor   integer NOT NULL CHECK (periodicidade_valor BETWEEN 1 AND 3650),
        periodicidade_unidade text NOT NULL CHECK (periodicidade_unidade IN ('dias','semanas','meses')),
        proxima_data          date NOT NULL,
        hora_inicio           time NOT NULL DEFAULT '08:00',
        duracao_horas         numeric(6,2) NOT NULL DEFAULT 8 CHECK (duracao_horas > 0 AND duracao_horas <= 720),
        ativo                 boolean NOT NULL DEFAULT true,
        criado_por            text,
        criado_em             timestamptz NOT NULL DEFAULT now(),
        atualizado_em         timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_equip, t_template);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'chamados' AND column_name = 'origem_plano_id') THEN
    EXECUTE 'ALTER TABLE public.chamados ADD COLUMN origem_plano_id bigint '
         || 'REFERENCES public.planos_manutencao(id) ON DELETE SET NULL';
  END IF;
END $$;

ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS origem_plano_data date;
ALTER TABLE public.tenants  ADD COLUMN IF NOT EXISTS valor_hora numeric(10,2);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tenants_valor_hora_positivo') THEN
    ALTER TABLE public.tenants ADD CONSTRAINT tenants_valor_hora_positivo CHECK (valor_hora IS NULL OR valor_hora >= 0);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS planos_manutencao_tenant_idx ON public.planos_manutencao (tenant_id);
-- Nunca duas OS do mesmo plano na mesma data (a OS cancelada libera a data para regerar)
CREATE UNIQUE INDEX IF NOT EXISTS chamados_plano_data_unico
  ON public.chamados (origem_plano_id, origem_plano_data)
  WHERE origem_plano_id IS NOT NULL AND cancelada_em IS NULL;

COMMIT;
