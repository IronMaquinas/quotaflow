-- 028_epi_entregas.sql — etapa 12d.2: entrega de EPI ao colaborador (ficha NR-6) com assinatura
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 027.
--
--   epi_entregas       → uma ficha de entrega: nº EPI-AAAA-NNNN, colaborador, função na época, quem entregou,
--                        assinatura do colaborador (PNG em data URL) + hash SHA-256 (integridade), motivo.
--   epi_entrega_itens  → cada EPI entregue: cópia do nome, tipo, CA e tamanho NA DATA da entrega (prova legal),
--                        quantidade, próxima troca, endereço de onde saiu e nº do movimento de estoque (MOV-…).
--                        Devolução: devolvido_em + estado ('bom' volta ao estoque EPI · 'danificado' descarte ·
--                        'substituido' quando um novo do mesmo tipo é entregue).
--   Histórico nunca é apagado (NR-6: a ficha é o registro da empresa).

BEGIN;

DO $$
DECLARE t_tenant text; t_item text; t_usuario text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass       AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_item    FROM pg_attribute a WHERE a.attrelid = 'public.itens_consumo'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass      AND a.attname = 'id';

  IF to_regclass('public.epi_entregas') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.epi_entregas (
        id                 bigserial PRIMARY KEY,
        tenant_id          %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        numero             text NOT NULL,
        colaborador_id     bigint NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
        funcao_nome        text,
        motivo             text NOT NULL DEFAULT 'entrega' CHECK (motivo IN ('entrega', 'admissao', 'troca', 'reposicao', 'perda', 'dano', 'outro')),
        entregue_em        timestamptz NOT NULL DEFAULT now(),
        entregue_por       %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        entregue_por_nome  text,
        assinatura_png     text NOT NULL,
        assinatura_hash    text NOT NULL,
        obs                text,
        criado_em          timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario);
  END IF;

  IF to_regclass('public.epi_entrega_itens') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.epi_entrega_itens (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        entrega_id        bigint NOT NULL REFERENCES public.epi_entregas(id) ON DELETE CASCADE,
        colaborador_id    bigint NOT NULL REFERENCES public.colaboradores(id) ON DELETE RESTRICT,
        epi_item_id       bigint REFERENCES public.epi_itens(id) ON DELETE SET NULL,
        item_consumo_id   %2$s REFERENCES public.itens_consumo(id) ON DELETE SET NULL,
        tipo              text NOT NULL,
        item_nome         text NOT NULL,
        ca                text,
        tamanho           text,
        quantidade        numeric NOT NULL CHECK (quantidade > 0),
        troca_dias        integer,
        proxima_troca     date,
        endereco_saida    text,
        movimento_numero  text,
        devolvido_em      timestamptz,
        devolucao_estado  text CHECK (devolucao_estado IS NULL OR devolucao_estado IN ('bom', 'danificado', 'substituido')),
        devolucao_obs     text,
        criado_em         timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_item);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS epi_entregas_numero_unico ON public.epi_entregas (tenant_id, numero);
CREATE INDEX IF NOT EXISTS epi_entregas_colab_idx ON public.epi_entregas (tenant_id, colaborador_id);
CREATE INDEX IF NOT EXISTS epi_entrega_itens_colab_idx ON public.epi_entrega_itens (tenant_id, colaborador_id);
CREATE INDEX IF NOT EXISTS epi_entrega_itens_entrega_idx ON public.epi_entrega_itens (entrega_id);

COMMIT;
