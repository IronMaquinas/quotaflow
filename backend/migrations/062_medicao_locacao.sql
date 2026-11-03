-- 062_medicao_locacao.sql — etapa 18d: 📏 medição mensal do contrato de locação (programado × realizado)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 061.
--   locacao_contratos   → medicao_dia_inicio (1–28; nulo = mês do calendário) · checklist_locatario · medicao_locatario (toggles)
--   equipamento_locacoes → escopo da medição: medicao_unidade ('hora' | 'dia' | 'fixo') · medicao_qtd (programado por ciclo) · medicao_valor (unitário, informativo)
--   locacao_medicoes    → uma por contrato × ciclo: itens (programado × realizado × obs por equipamento), situação
--                          aberta → enviada → aprovada | devolvida, quem preencheu/enviou/aprovou, histórico.
BEGIN;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS medicao_dia_inicio integer;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS checklist_locatario boolean NOT NULL DEFAULT false;
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS medicao_locatario boolean NOT NULL DEFAULT false;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'locacao_contratos_medicao_dia_check') THEN
    ALTER TABLE public.locacao_contratos ADD CONSTRAINT locacao_contratos_medicao_dia_check CHECK (medicao_dia_inicio IS NULL OR medicao_dia_inicio BETWEEN 1 AND 28);
  END IF;
END $$;
ALTER TABLE public.equipamento_locacoes ADD COLUMN IF NOT EXISTS medicao_unidade text;
ALTER TABLE public.equipamento_locacoes ADD COLUMN IF NOT EXISTS medicao_qtd numeric;
ALTER TABLE public.equipamento_locacoes ADD COLUMN IF NOT EXISTS medicao_valor numeric;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'equipamento_locacoes_medicao_unidade_check') THEN
    ALTER TABLE public.equipamento_locacoes ADD CONSTRAINT equipamento_locacoes_medicao_unidade_check CHECK (medicao_unidade IS NULL OR medicao_unidade IN ('hora','dia','fixo'));
  END IF;
END $$;
DO $$
DECLARE t_tenant text; t_contrato text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant   FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_contrato FROM pg_attribute a WHERE a.attrelid = 'public.locacao_contratos'::regclass AND a.attname = 'id';
  IF to_regclass('public.locacao_medicoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.locacao_medicoes (
        id               bigserial PRIMARY KEY,
        tenant_id        %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        contrato_id      %2$s NOT NULL REFERENCES public.locacao_contratos(id) ON DELETE CASCADE,
        inicio           date NOT NULL,
        fim              date NOT NULL,
        status           text NOT NULL DEFAULT 'aberta' CHECK (status IN ('aberta','enviada','aprovada','devolvida')),
        itens            jsonb NOT NULL DEFAULT '[]'::jsonb,
        obs              text,
        informativo      jsonb,
        preenchido_por   text,
        preenchido_em    timestamptz,
        enviado_por      text,
        enviado_em       timestamptz,
        aprovado_por     text,
        aprovado_em      timestamptz,
        devolvido_motivo text,
        historico        jsonb NOT NULL DEFAULT '[]'::jsonb,
        criado_em        timestamptz NOT NULL DEFAULT now(),
        atualizado_em    timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_contrato);
  END IF;
END $$;
-- contratos que já tinham rotina feita pelo locatário continuam assim (o toggle nasce marcado neles)
DO $$ BEGIN
  IF to_regclass('public.equipamento_rotinas') IS NOT NULL THEN
    UPDATE public.locacao_contratos c SET checklist_locatario = true
     WHERE c.checklist_locatario = false AND EXISTS (SELECT 1 FROM public.equipamento_locacoes l JOIN public.equipamento_rotinas r ON r.locacao_id = l.id
                                                     WHERE l.contrato_id = c.id AND r.responsavel = 'locatario');
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS locacao_medicoes_uk ON public.locacao_medicoes (tenant_id, contrato_id, inicio);
COMMIT;
