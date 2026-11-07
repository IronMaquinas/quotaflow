-- 075_spot_anexo_email_atraso.sql — etapa 18q: 📎 anexo na conversa do Spot + ✉️ e-mail se ficar 4 h sem ler
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 074.
--   spot_mensagens.anexo: { nome, mime, path, tamanho } — foto (JPG/PNG) ou PDF, até 10 MB, no bucket "documentos"
--   notificacoes.email_em / email_status: a conversa passou 4 h sem ler → e-mail (uma vez por assunto até ler).
--     email_status: 'enviado' · 'sem_email' (cadastro sem e-mail) · 'admin' (perfil admin não recebe e-mail de rotina) · 'falhou'
--     É também a base do 📊 indicador de atenção do comprador (meta: 0% das respostas passando de 4 h sem ler).
ALTER TABLE public.spot_mensagens ADD COLUMN IF NOT EXISTS anexo jsonb;
ALTER TABLE public.spot_mensagens ALTER COLUMN texto DROP NOT NULL;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS email_em timestamptz;
ALTER TABLE public.notificacoes ADD COLUMN IF NOT EXISTS email_status text;
CREATE INDEX IF NOT EXISTS notificacoes_email_idx ON public.notificacoes (tipo, criado_em) WHERE lida_em IS NULL AND email_em IS NULL;
