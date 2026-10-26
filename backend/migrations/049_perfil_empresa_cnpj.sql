-- 049_perfil_empresa_cnpj.sql — etapa 14d.5: perfil da empresa completo + CNPJ travado com rastreabilidade
-- Idempotente. Rodar no SQL Editor do Supabase, depois da 048.
--
-- 1) tenant_alteracoes: histórico de TODA alteração nos dados cadastrais da empresa (campo, antes, depois, quem, origem, motivo).
-- 2) Gatilho no banco: qualquer troca de tenants.cnpj (pelo sistema, pelo Console ou direto no SQL) grava uma linha no histórico.
--    O Console da plataforma preenche cnpj_alterado_por / cnpj_alteracao_motivo / cnpj_alterado_em no mesmo UPDATE; sem isso fica "alterado direto no banco".
-- 3) Contas antigas: preenche os dados cadastrais vazios com o que a Receita devolveu no cadastro (tenants.dados_cnpj).

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cnpj_alterado_por text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cnpj_alteracao_motivo text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS cnpj_alterado_em timestamptz;

DO $$
DECLARE tipo text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO tipo FROM pg_attribute a
   WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format($f$
    CREATE TABLE IF NOT EXISTS public.tenant_alteracoes (
      id bigserial PRIMARY KEY,
      tenant_id %s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
      campo text NOT NULL,
      antes text,
      depois text,
      origem text NOT NULL DEFAULT 'empresa',   -- empresa | plataforma | banco
      usuario_id text,
      usuario_nome text,
      motivo text,
      criado_em timestamptz NOT NULL DEFAULT now()
    )$f$, tipo);
END $$;
CREATE INDEX IF NOT EXISTS tenant_alteracoes_tenant_idx ON public.tenant_alteracoes (tenant_id, criado_em DESC);

CREATE OR REPLACE FUNCTION public.qf_log_cnpj_tenant() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE pela_plataforma boolean := NEW.cnpj_alterado_em IS DISTINCT FROM OLD.cnpj_alterado_em;
BEGIN
  IF NEW.cnpj IS DISTINCT FROM OLD.cnpj THEN
    INSERT INTO public.tenant_alteracoes (tenant_id, campo, antes, depois, origem, usuario_nome, motivo)
    VALUES (NEW.id, 'cnpj', OLD.cnpj, NEW.cnpj,
            CASE WHEN pela_plataforma THEN 'plataforma' ELSE 'banco' END,
            CASE WHEN pela_plataforma THEN NEW.cnpj_alterado_por END,
            CASE WHEN pela_plataforma THEN NEW.cnpj_alteracao_motivo ELSE 'alterado direto no banco' END);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS tenants_cnpj_log ON public.tenants;
CREATE TRIGGER tenants_cnpj_log AFTER UPDATE OF cnpj ON public.tenants FOR EACH ROW EXECUTE FUNCTION public.qf_log_cnpj_tenant();

-- Contas antigas: dados da Receita guardados no cadastro → campos vazios (não sobrescreve o que a empresa já preencheu)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'tenants' AND column_name = 'dados_cnpj') THEN
    EXECUTE $u$
      UPDATE public.tenants t SET
        razao_social  = COALESCE(NULLIF(t.razao_social, ''),  r.j->>'razao_social'),
        nome_fantasia = COALESCE(NULLIF(t.nome_fantasia, ''), NULLIF(r.j->>'nome_fantasia', ''), t.nome),
        endereco      = COALESCE(NULLIF(t.endereco, ''),      r.j->>'endereco'),
        numero        = COALESCE(NULLIF(t.numero, ''),        r.j->>'numero'),
        complemento   = COALESCE(NULLIF(t.complemento, ''),   r.j->>'complemento'),
        bairro        = COALESCE(NULLIF(t.bairro, ''),        r.j->>'bairro'),
        cidade        = COALESCE(NULLIF(t.cidade, ''),        r.j->>'cidade'),
        cep           = COALESCE(NULLIF(t.cep, ''),           r.j->>'cep'),
        email         = COALESCE(NULLIF(t.email, ''),         r.j->>'email')
      FROM (SELECT id, (to_jsonb(dados_cnpj) #>> '{}')::jsonb AS j FROM public.tenants WHERE dados_cnpj IS NOT NULL) r
      WHERE r.id = t.id AND jsonb_typeof(r.j) = 'object'
    $u$;
  END IF;
END $$;
