-- 039_autuacoes.sql — etapa 12i: autuações da EMPRESA (requisito legal) — INEA, IBAMA, ANTT, CETESB, vigilância sanitária,
-- Receita, MTE, bombeiros, prefeitura… Ficam na tela de ⚠️ Não Conformidades (aba 🏛 Autuações).
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 038.
--
--   autuacoes → órgão, esfera, nº do auto, datas, fato/infração, base legal, local/unidade, valor, PRAZO DE DEFESA,
--               prazo de recurso, vencimento; licença/documento da empresa ligado (documentos), veículo (equipamentos),
--               situação (recebida → defesa_apresentada → em_recurso → final: paga | cancelada), valor pago,
--               quem monitora + tarefa no ✅ Plano, NC de causa raiz ligada (nc_id — 5 porquês e plano de ação da NC),
--               auto e defesa anexos (bucket "documentos": tenant-{id}/autuacao-{id}/…), histórico (jsonb).

BEGIN;
DO $$
DECLARE t_tenant text; t_usuario text; t_equip text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_equip   FROM pg_attribute a WHERE a.attrelid = 'public.equipamentos'::regclass AND a.attname = 'id';
  IF to_regclass('public.autuacoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.autuacoes (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        orgao             text NOT NULL,
        esfera            text NOT NULL CHECK (esfera IN ('ambiental', 'transporte', 'trabalhista', 'sanitaria', 'tributaria', 'seguranca', 'outra')),
        auto_numero       text,
        data_autuacao     date NOT NULL,
        recebida_em       date NOT NULL,
        descricao         text NOT NULL,
        base_legal        text,
        local             text,
        valor             numeric CHECK (valor IS NULL OR valor >= 0),
        prazo_defesa      date,
        prazo_recurso     date,
        vencimento        date,
        documento_id      bigint REFERENCES public.documentos(id) ON DELETE SET NULL,
        documento_nome    text,
        equipamento_id    %3$s REFERENCES public.equipamentos(id) ON DELETE SET NULL,
        veiculo           text,
        status            text NOT NULL DEFAULT 'recebida' CHECK (status IN ('recebida', 'defesa_apresentada', 'em_recurso', 'paga', 'cancelada')),
        finalizada_em     date,
        valor_pago        numeric,
        motivo_cancelamento text,
        nc_id             text,
        nc_numero         text,
        responsavel_id    %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        responsavel_nome  text,
        tarefa_id         text,
        arquivo_path      text,
        arquivo_nome      text,
        arquivo_mime      text,
        defesa_path       text,
        defesa_nome       text,
        defesa_mime       text,
        obs               text,
        historico         jsonb NOT NULL DEFAULT '[]'::jsonb,
        criado_por        %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        criado_em         timestamptz NOT NULL DEFAULT now(),
        atualizado_em     timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario, t_equip);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS autuacoes_tenant_idx ON public.autuacoes (tenant_id, status);
COMMIT;
