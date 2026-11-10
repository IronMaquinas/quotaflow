-- 076_tenant_segmentos.sql — etapa 18u: 🏷 segmentos de negócio da empresa (pode ter mais de um)
-- Idempotente. NULL = ['transporte'] (empresas antigas não mudam nada).
--   transporte · locacao · servicos · outro — define os nomes na tela (Frota / Equipamentos/ativos, Minhas viagens / Minhas atividades…)
--   e sugere módulos no Console da Plataforma.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS segmentos text[];
