-- 044_clientes.sql — etapa 14b.3.1: cadastro de CLIENTES da transportadora (um por CNPJ/CPF)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 043.
--   clientes                     → cliente da empresa (locação e, depois, propostas comerciais — 15a). Um cadastro por
--                                   CNPJ/CPF na empresa: o segundo contrato do mesmo cliente reaproveita o cadastro.
--   locacao_contratos.cliente_id → o contrato aponta para o cliente (o nome continua gravado no contrato, como histórico)
--   Os contratos já criados ganham o cliente aqui (pelo CNPJ/CPF; sem documento, pelo nome).
BEGIN;
DO $$
DECLARE t_tenant text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id';
  IF to_regclass('public.clientes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.clientes (
        id                bigserial PRIMARY KEY,
        tenant_id         %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        nome              text NOT NULL,             -- nome fantasia (ou o nome da pessoa)
        razao_social      text,
        documento         text,                      -- só dígitos: 14 = CNPJ, 11 = CPF
        endereco          text,
        numero            text,
        complemento       text,
        bairro            text,
        cidade            text,
        uf                text,
        cep               text,
        contato_nome      text,
        contato_email     text,
        contato_telefone  text,
        obs               text,
        ativo             boolean NOT NULL DEFAULT true,
        criado_em         timestamptz NOT NULL DEFAULT now(),
        atualizado_em     timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant);
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS clientes_documento_unico ON public.clientes (tenant_id, documento) WHERE documento IS NOT NULL;
CREATE INDEX IF NOT EXISTS clientes_tenant_idx ON public.clientes (tenant_id);
ALTER TABLE public.locacao_contratos ADD COLUMN IF NOT EXISTS cliente_id bigint REFERENCES public.clientes(id) ON DELETE SET NULL;

-- contratos já existentes → cliente (um por documento; sem documento, um por nome)
INSERT INTO public.clientes (tenant_id, nome, documento, contato_nome, contato_email, contato_telefone)
SELECT DISTINCT ON (c.tenant_id, COALESCE(NULLIF(regexp_replace(COALESCE(c.cliente_doc, ''), '\D', '', 'g'), ''), lower(c.cliente)))
       c.tenant_id, c.cliente, NULLIF(regexp_replace(COALESCE(c.cliente_doc, ''), '\D', '', 'g'), ''), c.contato_nome, c.contato_email, c.contato_telefone
FROM public.locacao_contratos c
WHERE c.cliente_id IS NULL
  AND NOT EXISTS (SELECT 1 FROM public.clientes k WHERE k.tenant_id = c.tenant_id
                  AND (k.documento = NULLIF(regexp_replace(COALESCE(c.cliente_doc, ''), '\D', '', 'g'), '') OR (k.documento IS NULL AND lower(k.nome) = lower(c.cliente))))
ORDER BY c.tenant_id, COALESCE(NULLIF(regexp_replace(COALESCE(c.cliente_doc, ''), '\D', '', 'g'), ''), lower(c.cliente)), c.id;
UPDATE public.locacao_contratos c SET cliente_id = k.id
FROM public.clientes k
WHERE c.cliente_id IS NULL AND k.tenant_id = c.tenant_id
  AND (k.documento = NULLIF(regexp_replace(COALESCE(c.cliente_doc, ''), '\D', '', 'g'), '')
       OR (NULLIF(regexp_replace(COALESCE(c.cliente_doc, ''), '\D', '', 'g'), '') IS NULL AND k.documento IS NULL AND lower(k.nome) = lower(c.cliente)));
COMMIT;
