-- 121_fotos_cartao.sql — etapa E1: 📸 FOTO COM CARTÃO (cartão de registro gravado na foto — ex.: etiqueta de ultrassom de pá eólica)
--   cartao_foto_modelos → o cartão da empresa: título, código/revisão do formulário, campos (texto, número, opções; meia linha ou linha inteira;
--                         destaque = caixa grande como "Pá" e "Defeito nº"), observações. O cabeçalho (logo + nome) vem do cadastro da empresa.
--   fotos_cartao        → cada foto tirada: valores do cartão, referência (parque/aerogerador…), técnico logado, data/hora, GPS, arquivo e hash.
--                         cliente_uid = id gerado no aparelho (fila offline) → reenviar nunca duplica.
-- Idempotente; tipos de id lidos do banco.
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.cartao_foto_modelos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.cartao_foto_modelos (
        id            bigserial PRIMARY KEY,
        tenant_id     %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        nome          text NOT NULL,
        titulo        text NOT NULL,
        codigo        text,
        revisao       text,
        campos        jsonb NOT NULL DEFAULT '[]'::jsonb,
        obs           boolean NOT NULL DEFAULT true,
        ativo         boolean NOT NULL DEFAULT true,
        criado_por    text,
        criado_em     timestamptz NOT NULL DEFAULT now(),
        atualizado_em timestamptz NOT NULL DEFAULT now()
      )$f$, tid);
  END IF;
  IF to_regclass('public.fotos_cartao') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.fotos_cartao (
        id            bigserial PRIMARY KEY,
        tenant_id     %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        cliente_uid   text NOT NULL,
        modelo_id     bigint REFERENCES public.cartao_foto_modelos(id) ON DELETE SET NULL,
        modelo_nome   text,
        modelo        jsonb,
        valores       jsonb NOT NULL DEFAULT '{}'::jsonb,
        obs           text,
        referencia    text,
        tecnico       text,
        usuario_id    text,
        gps           jsonb,
        tirada_em     timestamptz NOT NULL,
        arquivo       text NOT NULL,
        tamanho       integer,
        hash          text,
        criado_em     timestamptz NOT NULL DEFAULT now()
      )$f$, tid);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS cartao_foto_modelos_tenant_idx ON public.cartao_foto_modelos (tenant_id);
CREATE UNIQUE INDEX IF NOT EXISTS fotos_cartao_uid_idx ON public.fotos_cartao (tenant_id, cliente_uid);
CREATE INDEX IF NOT EXISTS fotos_cartao_tenant_idx ON public.fotos_cartao (tenant_id, tirada_em DESC);
NOTIFY pgrst, 'reload schema';
