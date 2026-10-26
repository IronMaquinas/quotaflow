-- 048_dados_empresa.sql — etapa 14d.4: dados cadastrais da empresa (⚙️ Configurações → 🏢 Empresa)
-- Idempotente. Rodar no SQL Editor do Supabase, depois da 047.
-- Razão social, nome fantasia, CNPJ, endereço, telefone e e-mail da empresa — vão no cabeçalho do contrato
-- ({{empresa.endereco_completo}}, {{empresa.telefone}}, {{empresa.email}}).
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS razao_social text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS nome_fantasia text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cnpj text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS endereco text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS numero text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS complemento text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS bairro text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cidade text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cep text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS telefone text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS email text;

-- Modelo-base da biblioteca: a LOCADORA passa a ter a sede no texto (versão sobe → "✨ Versão nova")
UPDATE public.contrato_modelos
SET corpo = replace(corpo, 'LOCADORA: {{empresa.razao_social}}, inscrita no CNPJ sob o nº {{empresa.cnpj}}.', 'LOCADORA: {{empresa.razao_social}}, inscrita no CNPJ sob o nº {{empresa.cnpj}}, com sede em {{empresa.endereco_completo}}.'),
    versao = versao + 1, atualizado_em = now()
WHERE tenant_id IS NULL AND nome = 'Locação de equipamentos — modelo-base' AND corpo LIKE '%inscrita no CNPJ sob o nº {{empresa.cnpj}}.%';
