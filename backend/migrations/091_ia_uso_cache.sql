-- 091_ia_uso_cache.sql — etapa 18zo: 💸 a IA NUNCA cobra duas vezes pela mesma leitura
-- Idempotente. ia_uso.chave = impressão digital (SHA-256) da imagem enviada; ia_uso.resposta = o resultado lido.
--   Mesma CNH de novo → devolve o resultado guardado, sem chamar a IA (custo zero). Falhas da mesma imagem também são
--   contadas pela chave (limite de tentativas). ia_uso.detalhe = motivo técnico da falha (só para o suporte).
ALTER TABLE public.ia_uso ADD COLUMN IF NOT EXISTS chave text;
ALTER TABLE public.ia_uso ADD COLUMN IF NOT EXISTS resposta jsonb;
ALTER TABLE public.ia_uso ADD COLUMN IF NOT EXISTS detalhe text;
CREATE INDEX IF NOT EXISTS ia_uso_chave_idx ON public.ia_uso (tenant_id, recurso, chave);
