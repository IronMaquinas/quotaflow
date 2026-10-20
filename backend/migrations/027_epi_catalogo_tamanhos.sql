-- 027_epi_catalogo_tamanhos.sql — etapa 12d.1b: catálogo de tipos de EPI (lista do admin + do tenant),
-- tamanho no item de EPI e tamanhos do colaborador. Idempotente (pode rodar 2×). Rodar depois da 026.
--
--   epi_tipos        → tenant_id NULL = CATÁLOGO do QuotaFlow (Console da Plataforma; todos os tenants usam).
--                      tenant_id preenchido = tipo próprio da empresa (código p_…). Mesmo código no tenant
--                      substitui o do catálogo. "grade" diz qual tamanho do colaborador usar na entrega.
--   epi_itens.tamanho → tamanho daquele item (42, M, G, 9…)
--   colaboradores.tam_calcado / tam_camisa / tam_calca / tam_luva → tamanhos da pessoa (sugere o item certo na entrega)

BEGIN;

DO $$
DECLARE t_tenant text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant FROM pg_attribute a
   WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id';
  IF to_regclass('public.epi_tipos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.epi_tipos (
        id                 bigserial PRIMARY KEY,
        tenant_id          %1$s REFERENCES public.tenants(id) ON DELETE CASCADE,   -- NULL = catálogo
        codigo             text NOT NULL,
        nome               text NOT NULL,
        grade              text CHECK (grade IS NULL OR grade IN ('calcado', 'camisa', 'calca', 'luva')),
        troca_dias_padrao  integer CHECK (troca_dias_padrao IS NULL OR (troca_dias_padrao BETWEEN 1 AND 3650)),
        ordem              integer NOT NULL DEFAULT 100,
        ativo              boolean NOT NULL DEFAULT true,
        criado_em          timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS epi_tipos_codigo_unico ON public.epi_tipos (COALESCE(tenant_id::text, '-'), codigo);

ALTER TABLE public.epi_itens     ADD COLUMN IF NOT EXISTS tamanho     text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS tam_calcado text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS tam_camisa  text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS tam_calca   text;
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS tam_luva    text;

-- Catálogo inicial (os mesmos códigos usados nos kits da 026). Só insere o que falta.
INSERT INTO public.epi_tipos (tenant_id, codigo, nome, grade, troca_dias_padrao, ordem)
SELECT NULL, v.codigo, v.nome, v.grade, v.troca, v.ordem
FROM (VALUES
  ('capacete',           'Capacete de segurança',            NULL,      730, 10),
  ('oculos',             'Óculos de proteção',               NULL,      180, 20),
  ('protetor_facial',    'Protetor facial',                  NULL,      365, 30),
  ('mascara_solda',      'Máscara de solda',                 NULL,      730, 40),
  ('protetor_auricular', 'Protetor auricular',               NULL,       90, 50),
  ('mascara_pff2',       'Máscara PFF2',                     NULL,        7, 60),
  ('respirador',         'Respirador com filtro químico',    NULL,      365, 70),
  ('luva_vaqueta',       'Luva de vaqueta / raspa',          'luva',     60, 80),
  ('luva_nitrilica',     'Luva nitrílica',                   'luva',     15, 90),
  ('luva_isolante',      'Luva isolante (elétrica)',         'luva',    180, 100),
  ('luva_anticorte',     'Luva anticorte',                   'luva',     60, 110),
  ('botina',             'Botina de segurança',              'calcado', 180, 120),
  ('botina_isolante',    'Botina isolante (sem metal)',      'calcado', 180, 130),
  ('bota_pvc',           'Bota de PVC',                      'calcado', 180, 140),
  ('camisa',             'Camisa (uniforme)',                'camisa',  180, 150),
  ('calca',              'Calça (uniforme)',                 'calca',   180, 160),
  ('uniforme',           'Uniforme / vestimenta',            'camisa',  180, 170),
  ('jaqueta_termica',    'Jaqueta térmica',                  'camisa',  365, 180),
  ('colete_refletivo',   'Colete refletivo',                 'camisa',  365, 190),
  ('avental_pvc',        'Avental de PVC',                   NULL,      180, 200),
  ('cinto_paraquedista', 'Cinto paraquedista + talabarte',   NULL,      730, 210),
  ('protetor_solar',     'Protetor solar',                   NULL,       30, 220),
  ('creme_protetor',     'Creme de proteção (luva química)', NULL,       30, 230),
  ('outro',              'Outro EPI',                        NULL,      NULL, 999)
) AS v(codigo, nome, grade, troca, ordem)
WHERE NOT EXISTS (SELECT 1 FROM public.epi_tipos t WHERE t.tenant_id IS NULL AND t.codigo = v.codigo);

COMMIT;
