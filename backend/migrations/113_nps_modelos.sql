-- 113_nps_modelos.sql — etapa N1.1: ⭐ NPS personalizado — modelos de pesquisa por empresa, pontos positivos e negativos, "lida"
--   nps_modelos: perguntas extras (estrelas 1–5, sim/não, escolha, texto) + itens de pontos 👍/👎 (liga/desliga). A pergunta 0–10 é fixa.
--   nps_pesquisas: cópia do modelo no envio (config), respostas extras, pontos positivos/negativos, aberturas. Idempotente.
DO $$
DECLARE tid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tid FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  IF to_regclass('public.nps_modelos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.nps_modelos (
        id             bigserial PRIMARY KEY,
        tenant_id      %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        nome           text NOT NULL,
        descricao      text,
        padrao         boolean NOT NULL DEFAULT false,
        pontos         boolean NOT NULL DEFAULT true,
        itens_pontos   jsonb NOT NULL DEFAULT '[]'::jsonb,
        perguntas      jsonb NOT NULL DEFAULT '[]'::jsonb,
        ativo          boolean NOT NULL DEFAULT true,
        criado_em      timestamptz NOT NULL DEFAULT now(),
        atualizado_em  timestamptz NOT NULL DEFAULT now()
      )$f$, tid);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS nps_modelos_tenant_idx ON public.nps_modelos (tenant_id);
ALTER TABLE public.nps_pesquisas ADD COLUMN IF NOT EXISTS modelo_id bigint;
ALTER TABLE public.nps_pesquisas ADD COLUMN IF NOT EXISTS modelo_nome text;
ALTER TABLE public.nps_pesquisas ADD COLUMN IF NOT EXISTS config jsonb;
ALTER TABLE public.nps_pesquisas ADD COLUMN IF NOT EXISTS respostas jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.nps_pesquisas ADD COLUMN IF NOT EXISTS pontos_positivos jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.nps_pesquisas ADD COLUMN IF NOT EXISTS pontos_negativos jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.nps_pesquisas ADD COLUMN IF NOT EXISTS aberturas integer NOT NULL DEFAULT 0;
ALTER TABLE public.nps_pesquisas ADD COLUMN IF NOT EXISTS ultima_abertura_em timestamptz;
