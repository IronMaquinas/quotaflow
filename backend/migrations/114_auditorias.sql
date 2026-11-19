-- 114_auditorias.sql — etapa A1: 🔎 auditorias do sistema de gestão (programa anual + auditoria + constatações → TSK AU)
--   Simples de propósito: plano do ano, escopo/processos/requisitos (ISO 9001 4–10), auditor e auditados (do cadastro),
--   constatações (NC maior, NC menor, observação, oportunidade de melhoria, conforme) com evidência; NC/observação vira tarefa AU.
-- Idempotente; tipos de id lidos do banco.
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.auditorias') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.auditorias (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        numero            text,
        tipo              text NOT NULL DEFAULT 'interna' CHECK (tipo IN ('interna', 'externa', 'certificacao', 'fornecedor', 'cliente')),
        norma             text NOT NULL DEFAULT 'ISO 9001:2015',
        titulo            text NOT NULL,
        escopo            text,
        processos         jsonb NOT NULL DEFAULT '[]'::jsonb,
        requisitos        jsonb NOT NULL DEFAULT '[]'::jsonb,
        auditor_nome      text,
        auditor_colaborador_id text,
        auditor_usuario_id     text,
        auditor_externo   text,
        auditados         jsonb NOT NULL DEFAULT '[]'::jsonb,
        data_prevista     date,
        data_realizada    date,
        status            text NOT NULL DEFAULT 'planejada' CHECK (status IN ('planejada', 'em_andamento', 'concluida', 'cancelada')),
        conclusao         text,
        criado_por        text,
        criado_em         timestamptz NOT NULL DEFAULT now(),
        atualizado_em     timestamptz NOT NULL DEFAULT now()
      )$f$, tid);
  END IF;
  IF to_regclass('public.auditoria_constatacoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.auditoria_constatacoes (
        id            bigserial PRIMARY KEY,
        tenant_id     %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        auditoria_id  bigint NOT NULL REFERENCES public.auditorias(id) ON DELETE CASCADE,
        tipo          text NOT NULL CHECK (tipo IN ('nc_maior', 'nc_menor', 'observacao', 'oportunidade', 'conforme')),
        requisito     text,
        processo      text,
        descricao     text NOT NULL,
        evidencia     text,
        tarefa_id     text,
        criado_por    text,
        criado_em     timestamptz NOT NULL DEFAULT now()
      )$f$, tid);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS auditorias_tenant_idx ON public.auditorias (tenant_id, data_prevista);
CREATE INDEX IF NOT EXISTS auditoria_constatacoes_aud_idx ON public.auditoria_constatacoes (tenant_id, auditoria_id);
