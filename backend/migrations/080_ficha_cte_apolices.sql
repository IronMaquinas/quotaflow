-- 080_ficha_cte_apolices.sql — etapa 18g.3: 📋 ficha do CT-e + 🛡 apólices de seguro em ⚙️
-- Idempotente. O tipo de tenants.id é lido do banco.
--   tenants.fiscal_cte: dados fixos da transportadora para o CT-e — IE, UF, RNTRC, CFOP (dentro/fora do estado), CST e
--     alíquota do ICMS, produto predominante padrão, tomador padrão.
--   tenant_apolices: seguradora, CNPJ, nº da apólice, ramo (RCTR-C, RC-DC, RC-V…), vigência e quem é o responsável pelo seguro.
--     A ficha do CT-e usa a apólice vigente na data do transporte; a averbação vem da tarefa fiscal.
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS fiscal_cte jsonb NOT NULL DEFAULT '{}'::jsonb;
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a
   WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.tenant_apolices (
      id bigserial PRIMARY KEY,
      tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      seguradora text NOT NULL,
      seguradora_cnpj text,
      numero text NOT NULL,
      ramo text NOT NULL DEFAULT 'RCTR-C',
      responsavel text NOT NULL DEFAULT 'emitente' CHECK (responsavel IN ('emitente','remetente','expedidor','recebedor','destinatario','tomador')),
      vigencia_inicio date,
      vigencia_fim date,
      obs text,
      ativo boolean NOT NULL DEFAULT true,
      criado_em timestamptz NOT NULL DEFAULT now()
    )$f$, tid);
END $$;
CREATE INDEX IF NOT EXISTS tenant_apolices_idx ON public.tenant_apolices (tenant_id, ativo);
ALTER TABLE public.tenant_apolices ENABLE ROW LEVEL SECURITY;
