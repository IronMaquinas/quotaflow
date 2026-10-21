-- 036_multas.sql — etapa 12g: multas de trânsito (veículo, motorista, prazos, desconto com aceite assinado)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 035.
--
--   multas → auto de infração: veículo (equipamento da frota ou texto/placa), motorista responsável, data/hora, local,
--            órgão, infração (código CTB, descrição, gravidade, pontos), valor, vencimento, PRAZO DE INDICAÇÃO DO CONDUTOR,
--            situação ('recebida' → 'condutor_indicado' → 'em_recurso' → final: 'paga' | 'descontada' | 'cancelada'),
--            valores finais (pago / descontado do colaborador), ACEITE do desconto assinado na tela (opcional — o gestor
--            marca "aceite do colaborador requerido"), quem monitora (usuário) + tarefa no ✅ Plano, notificação anexa
--            (bucket "documentos": tenant-{id}/multa-{id}/…) e histórico das mudanças (jsonb).

BEGIN;
DO $$
DECLARE t_tenant text; t_usuario text; t_equip text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_equip   FROM pg_attribute a WHERE a.attrelid = 'public.equipamentos'::regclass AND a.attname = 'id';
  IF to_regclass('public.multas') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.multas (
        id                  bigserial PRIMARY KEY,
        tenant_id           %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        equipamento_id      %3$s REFERENCES public.equipamentos(id) ON DELETE SET NULL,
        veiculo             text,                     -- placa / descrição (cópia ou texto livre)
        colaborador_id      bigint REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
        colaborador_nome    text,                     -- cópia
        data_infracao       date NOT NULL,
        hora_infracao       text,
        local               text,
        auto_numero         text,
        orgao               text,
        infracao_codigo     text,
        infracao_descricao  text,
        gravidade           text CHECK (gravidade IS NULL OR gravidade IN ('leve', 'media', 'grave', 'gravissima')),
        pontos              integer CHECK (pontos IS NULL OR pontos BETWEEN 0 AND 40),
        valor               numeric CHECK (valor IS NULL OR valor >= 0),
        recebida_em         date NOT NULL,
        prazo_indicacao     date,
        vencimento          date,
        status              text NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida', 'condutor_indicado', 'em_recurso', 'paga', 'descontada', 'cancelada')),
        finalizada_em       date,
        valor_pago          numeric,
        valor_descontado    numeric,
        parcelas_desconto   integer,
        motivo_cancelamento text,
        aceite_requerido    boolean NOT NULL DEFAULT false,
        aceite_texto        text,
        aceite_png          text,
        aceite_hash         text,
        aceite_em           timestamptz,
        responsavel_id      %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        responsavel_nome    text,
        tarefa_id           text,
        arquivo_path        text,
        arquivo_nome        text,
        arquivo_mime        text,
        obs                 text,
        historico           jsonb NOT NULL DEFAULT '[]'::jsonb,
        criado_por          %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        criado_em           timestamptz NOT NULL DEFAULT now(),
        atualizado_em       timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario, t_equip);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS multas_tenant_idx ON public.multas (tenant_id, status);
CREATE INDEX IF NOT EXISTS multas_colab_idx ON public.multas (tenant_id, colaborador_id);
COMMIT;
