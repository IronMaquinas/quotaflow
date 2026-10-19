-- 026_epi_itens.sql — etapa 12d.1: EPI ligado ao item de consumo do Estoque + kit de EPI nas funções
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 025.
--
--   epi_itens        → marca um item de consumo como EPI: tipo (categoria), CA, validade do CA, troca a cada X dias.
--                      O saldo continua no Estoque (itens_consumo / itens_consumo_enderecos) — sem estoque duplicado.
--                      1 linha por item de consumo. Desmarcar = ativo false (o histórico de entregas da 12d.2 fica).
--   funcoes.epis     → (já existe desde a 024) kit da função: [{ tipo, quantidade, troca_dias }]
--                      "tipo" é a CATEGORIA (protetor_auricular, botina…), não o item: a biblioteca vale para todos
--                      os tenants e cada empresa liga a categoria aos itens dela.
--   Endereço "EPI"   → o backend cria sozinho (tipo armazem) na primeira vez que a aba 🦺 EPI abre.
--
-- Também coloca o kit sugerido nos 8 modelos da biblioteca (só se o kit ainda estiver vazio) e sobe a versão.

BEGIN;

DO $$
DECLARE t_tenant text; t_item text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass       AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_item   FROM pg_attribute a WHERE a.attrelid = 'public.itens_consumo'::regclass AND a.attname = 'id';

  IF to_regclass('public.epi_itens') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.epi_itens (
        id               bigserial PRIMARY KEY,
        tenant_id        %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        item_consumo_id  %2$s NOT NULL REFERENCES public.itens_consumo(id) ON DELETE CASCADE,
        tipo             text NOT NULL,          -- categoria (services/epi.js → TIPOS_EPI)
        ca               text,                   -- certificado de aprovação (MTE)
        ca_validade      date,
        troca_dias       integer CHECK (troca_dias IS NULL OR (troca_dias BETWEEN 1 AND 3650)),
        obs              text,
        ativo            boolean NOT NULL DEFAULT true,
        criado_em        timestamptz NOT NULL DEFAULT now(),
        atualizado_em    timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_item);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS epi_itens_item_unico ON public.epi_itens (tenant_id, item_consumo_id);
CREATE INDEX IF NOT EXISTS epi_itens_tenant_idx ON public.epi_itens (tenant_id, tipo);

-- Kit sugerido nos modelos da biblioteca (o tenant ajusta na cópia dele)
UPDATE public.funcoes f
   SET epis = v.epis::jsonb, versao = f.versao + 1, atualizado_em = now()
  FROM (VALUES
    ('Motorista carreteiro',                   '[{"tipo":"botina","quantidade":1,"troca_dias":180},{"tipo":"colete_refletivo","quantidade":1,"troca_dias":365},{"tipo":"luva_vaqueta","quantidade":1,"troca_dias":60},{"tipo":"protetor_solar","quantidade":1,"troca_dias":30}]'),
    ('Motorista de produtos perigosos (MOPP)', '[{"tipo":"botina","quantidade":1,"troca_dias":180},{"tipo":"colete_refletivo","quantidade":1,"troca_dias":365},{"tipo":"luva_nitrilica","quantidade":2,"troca_dias":30},{"tipo":"oculos","quantidade":1,"troca_dias":180},{"tipo":"respirador","quantidade":1,"troca_dias":365},{"tipo":"capacete","quantidade":1,"troca_dias":730}]'),
    ('Mecânico de veículos pesados',           '[{"tipo":"botina","quantidade":1,"troca_dias":180},{"tipo":"luva_nitrilica","quantidade":4,"troca_dias":15},{"tipo":"luva_vaqueta","quantidade":1,"troca_dias":60},{"tipo":"oculos","quantidade":1,"troca_dias":180},{"tipo":"protetor_auricular","quantidade":1,"troca_dias":90},{"tipo":"uniforme","quantidade":2,"troca_dias":180}]'),
    ('Eletricista automotivo',                 '[{"tipo":"botina_isolante","quantidade":1,"troca_dias":180},{"tipo":"luva_isolante","quantidade":1,"troca_dias":180},{"tipo":"oculos","quantidade":1,"troca_dias":180},{"tipo":"luva_nitrilica","quantidade":2,"troca_dias":15},{"tipo":"uniforme","quantidade":2,"troca_dias":180}]'),
    ('Borracheiro',                            '[{"tipo":"botina","quantidade":1,"troca_dias":180},{"tipo":"protetor_facial","quantidade":1,"troca_dias":365},{"tipo":"oculos","quantidade":1,"troca_dias":180},{"tipo":"luva_vaqueta","quantidade":1,"troca_dias":60},{"tipo":"protetor_auricular","quantidade":1,"troca_dias":90},{"tipo":"uniforme","quantidade":2,"troca_dias":180}]'),
    ('Ajudante / Conferente',                  '[{"tipo":"botina","quantidade":1,"troca_dias":180},{"tipo":"luva_vaqueta","quantidade":1,"troca_dias":60},{"tipo":"colete_refletivo","quantidade":1,"troca_dias":365},{"tipo":"uniforme","quantidade":2,"troca_dias":180}]'),
    ('Lavador de veículos',                    '[{"tipo":"bota_pvc","quantidade":1,"troca_dias":180},{"tipo":"avental_pvc","quantidade":1,"troca_dias":180},{"tipo":"luva_nitrilica","quantidade":2,"troca_dias":15},{"tipo":"oculos","quantidade":1,"troca_dias":180},{"tipo":"protetor_auricular","quantidade":1,"troca_dias":90}]'),
    ('Assistente de tráfego / administrativo', '[]')
  ) AS v(nome, epis)
 WHERE f.tenant_id IS NULL AND f.nome = v.nome AND f.epis = '[]'::jsonb AND v.epis <> '[]';

COMMIT;
