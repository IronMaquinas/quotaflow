-- 126_reparos.sql — etapa E4: 🛠 PROCEDIMENTOS DE REPARO (modelos de etapas) e REPAROS executados em campo
--   reparo_modelos → sequência de etapas da empresa (ex.: reparo de laminado de pá eólica): título, instrução, fotos mínimas, campos,
--                    materiais (produto, lote, validade, quantidade, proporção da mistura), condições ambientais, liberação da engenharia.
--   reparos        → um por defeito "b) Reparar": cópia das etapas (a engenharia pode ajustar), execução por etapa (valores, materiais,
--                    ambiente, comentário, quem/quando concluiu, liberação), status aberto · em_execucao · concluido · cancelado.
--   fotos_cartao.reparo_id / etapa_id → as fotos de cada etapa entram no reparo (e no relatório do E5).
-- Idempotente; tipos de id lidos do banco.
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.reparo_modelos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.reparo_modelos (
        id            bigserial PRIMARY KEY,
        tenant_id     %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        nome          text NOT NULL,
        descricao     text,
        etapas        jsonb NOT NULL DEFAULT '[]'::jsonb,
        ativo         boolean NOT NULL DEFAULT true,
        criado_por    text,
        criado_em     timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now()
      )$f$, tid);
  END IF;
  IF to_regclass('public.reparos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.reparos (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        numero            text,
        defeito_id        bigint REFERENCES public.defeitos_foto(id) ON DELETE SET NULL,
        projeto_id        bigint REFERENCES public.projetos_foto(id) ON DELETE SET NULL,
        modelo_id         bigint REFERENCES public.reparo_modelos(id) ON DELETE SET NULL,
        modelo_nome       text,
        cartao_modelo_id  bigint REFERENCES public.cartao_foto_modelos(id) ON DELETE SET NULL,
        etapas            jsonb NOT NULL DEFAULT '[]'::jsonb,
        execucao          jsonb NOT NULL DEFAULT '{}'::jsonb,
        status            text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'em_execucao', 'concluido', 'cancelado')),
        responsavel       text,
        responsavel_ref   text,
        prazo             date,
        criado_por        text,
        criado_em         timestamptz NOT NULL DEFAULT now(),
        concluido_em      timestamptz,
        concluido_por     text,
        cancelado_em      timestamptz,
        cancelamento_motivo text,
        atualizado_em     timestamptz NOT NULL DEFAULT now()
      )$f$, tid);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS reparos_tenant_idx ON public.reparos (tenant_id, status);
CREATE INDEX IF NOT EXISTS reparos_defeito_idx ON public.reparos (defeito_id);
ALTER TABLE public.fotos_cartao ADD COLUMN IF NOT EXISTS reparo_id bigint REFERENCES public.reparos(id) ON DELETE SET NULL;
ALTER TABLE public.fotos_cartao ADD COLUMN IF NOT EXISTS etapa_id text;
CREATE INDEX IF NOT EXISTS fotos_cartao_reparo_idx ON public.fotos_cartao (reparo_id, etapa_id);
NOTIFY pgrst, 'reload schema';
