-- 081_patio_cliente.sql — etapa 18z: 📦 propriedade do cliente (equipamento do cliente guardado no pátio)
-- Idempotente. O tipo de tenants.id é lido do banco.
--   Ex.: a máquina chega do porto e fica no pátio enquanto o dono programa a entrega — quase sempre sem cobrança.
--   NÃO é estoque da empresa (não entra no valor do estoque): uma linha por equipamento, controlado pelo nº de série da plaqueta.
--   Entrada: cliente dono, equipamento, nº de série, NF de entrada, local no pátio, quem recebeu, fotos (com tarja).
--   Saída: quando, quem liberou, quem retirou (nome/documento/placa), NF de saída/remessa, AT (se a empresa transportou), fotos.
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a
   WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.patio_bens (
      id bigserial PRIMARY KEY,
      tenant_id %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      numero text NOT NULL,
      cliente_id bigint REFERENCES public.clientes(id) ON DELETE SET NULL,
      cliente_nome text NOT NULL,
      descricao text NOT NULL,
      fabricante text, modelo text, ano text,
      numero_serie text NOT NULL,
      identificacao text,
      nf_entrada_numero text, nf_entrada_chave text, nf_entrada_data date,
      entrada_em date NOT NULL DEFAULT current_date,
      recebido_por text,
      local_patio text,
      fotos_entrada jsonb NOT NULL DEFAULT '[]'::jsonb,
      obs text,
      status text NOT NULL DEFAULT 'no_patio' CHECK (status IN ('no_patio','saiu')),
      saida_em date, liberado_por text, retirado_por text, retirado_documento text, retirado_placa text,
      nf_saida_numero text, saida_at_id bigint, saida_obs text,
      fotos_saida jsonb NOT NULL DEFAULT '[]'::jsonb,
      criado_em timestamptz NOT NULL DEFAULT now(),
      atualizado_em timestamptz NOT NULL DEFAULT now()
    )$f$, tid);
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS patio_bens_numero_uq ON public.patio_bens (tenant_id, numero);
CREATE UNIQUE INDEX IF NOT EXISTS patio_bens_serie_no_patio_uq ON public.patio_bens (tenant_id, upper(numero_serie)) WHERE status = 'no_patio';
CREATE INDEX IF NOT EXISTS patio_bens_idx ON public.patio_bens (tenant_id, status, cliente_nome);
ALTER TABLE public.patio_bens ENABLE ROW LEVEL SECURITY;
