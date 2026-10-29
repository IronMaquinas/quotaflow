-- 055_execucoes_at.sql — etapa 16a: 🚛 Programação — EXECUÇÕES (genérico) + AT por trecho (tipo transporte)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 054.
--   bid_modelos (+) / pedidos_venda (+) tipo_execucao → o que o aceite gera: transporte (AT — esta etapa) · locacao (contrato
--                     de locação que já existe — depois) · servico (Autorização de Serviço — futuro) · venda (separação/entrega — futuro).
--   execucoes        → uma linha por execução. Transporte = AT-AAAA-NNNN, UMA POR TRECHO do pedido: itens do trecho (sem valores),
--                     coleta/entrega (local, data e hora), motorista (bloqueia com 🔴 no selo — o gestor libera com justificativa),
--                     conjunto = cavalo + até 2 implementos (bloqueia se algum está bloqueado por inspeção), anexos NF-e/CT-e/MDF-e,
--                     status programada → em_execucao → concluida | cancelada (atualiza sozinho os itens do pedido).
BEGIN;
ALTER TABLE public.bid_modelos   ADD COLUMN IF NOT EXISTS tipo_execucao text NOT NULL DEFAULT 'transporte';
ALTER TABLE public.pedidos_venda ADD COLUMN IF NOT EXISTS tipo_execucao text NOT NULL DEFAULT 'transporte';
DO $$
DECLARE t_tenant text; t_colab text; t_equip text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass       AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_colab  FROM pg_attribute a WHERE a.attrelid = 'public.colaboradores'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_equip  FROM pg_attribute a WHERE a.attrelid = 'public.equipamentos'::regclass  AND a.attname = 'id';
  IF to_regclass('public.execucoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.execucoes (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        numero            text NOT NULL,
        tipo              text NOT NULL DEFAULT 'transporte' CHECK (tipo IN ('transporte','locacao','servico','venda')),
        pv_id             bigint NOT NULL REFERENCES public.pedidos_venda(id) ON DELETE CASCADE,
        pv_numero         text,
        grupo_id          text,
        grupo_titulo      text,
        itens             jsonb NOT NULL DEFAULT '[]'::jsonb,   -- itens do trecho, SEM valores: [{ id, valores, quantidade }]
        colunas           jsonb NOT NULL DEFAULT '[]'::jsonb,   -- colunas do modelo (para mostrar os itens)
        cliente_id        bigint,
        cliente_nome      text,
        status            text NOT NULL DEFAULT 'programada' CHECK (status IN ('programada','em_execucao','concluida','cancelada')),
        origem            text,
        destino           text,
        inicio_previsto   timestamptz,
        fim_previsto      timestamptz,
        motorista_id      %2$s REFERENCES public.colaboradores(id) ON DELETE SET NULL,
        motorista_nome    text,
        motorista_selo    jsonb,                                -- retrato do selo no momento da programação
        liberacao         jsonb,                                -- { por, em, justificativa } — motorista 🔴 liberado pelo gestor
        cavalo_id         %3$s REFERENCES public.equipamentos(id) ON DELETE SET NULL,
        conjunto          jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ id, tag, nome, papel: cavalo|implemento }]
        observacoes       text,
        anexos            jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ id, tipo: nfe|cte|mdfe|outro, nome, path, mime, tamanho, em, por }]
        iniciada_em       timestamptz,
        concluida_em      timestamptz,
        cancelada_em      timestamptz,
        cancelada_motivo  text,
        criado_por_nome   text,
        criado_em         timestamptz NOT NULL DEFAULT now(),
        atualizado_em     timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_colab, t_equip);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS execucoes_numero_unico ON public.execucoes (tenant_id, numero);
CREATE INDEX IF NOT EXISTS execucoes_pv_idx ON public.execucoes (tenant_id, pv_id);
CREATE INDEX IF NOT EXISTS execucoes_agenda_idx ON public.execucoes (tenant_id, inicio_previsto) WHERE status IN ('programada','em_execucao');
COMMIT;
