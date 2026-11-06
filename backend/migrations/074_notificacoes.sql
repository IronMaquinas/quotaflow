-- 074_notificacoes.sql — etapa 18n: 🔔 Central de Notificações (base para tela, Telegram e app)
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 073.
--   notificacoes: uma linha por aviso a uma pessoa/empresa. A tela mostra todas; o celular (premium) só as que passam na regra
--   contra excesso (services/notificacoes.js). destinatario_tipo/id: 'usuario' + id do usuário · 'fornecedor' + id do fornecedor.
--   chave agrupa avisos do mesmo assunto (ex.: 'spot:<interesse>') — mensagens seguidas viram 1 aviso "enviou 3 mensagens".
--   push_status: null (ainda não avaliada) · 'aguardando' · 'registrada' (sairia no celular — canal ainda não ligado) ·
--     'enviada' · 'dispensada' (lida antes, pessoa online, limite do dia…) — push_motivo explica.
CREATE TABLE IF NOT EXISTS public.notificacoes (
  id bigserial PRIMARY KEY,
  tenant_id text,
  destinatario_tipo text NOT NULL CHECK (destinatario_tipo IN ('usuario','fornecedor')),
  destinatario_id text NOT NULL,
  tipo text NOT NULL,
  titulo text NOT NULL,
  texto text,
  link jsonb NOT NULL DEFAULT '{}'::jsonb,
  chave text,
  quantidade int NOT NULL DEFAULT 1,
  lida_em timestamptz,
  push_status text,
  push_motivo text,
  push_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS notificacoes_dest_idx ON public.notificacoes (destinatario_tipo, destinatario_id, id DESC);
CREATE INDEX IF NOT EXISTS notificacoes_chave_idx ON public.notificacoes (destinatario_tipo, destinatario_id, chave) WHERE lida_em IS NULL;
CREATE INDEX IF NOT EXISTS notificacoes_push_idx ON public.notificacoes (push_status) WHERE lida_em IS NULL;
ALTER TABLE public.notificacoes ENABLE ROW LEVEL SECURITY; -- só o backend (service role)

-- preferências de cada pessoa (o que receber e por onde) — usado pelo celular (premium)
CREATE TABLE IF NOT EXISTS public.notificacao_preferencias (
  destinatario_tipo text NOT NULL,
  destinatario_id text NOT NULL,
  preferencias jsonb NOT NULL DEFAULT '{}'::jsonb,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (destinatario_tipo, destinatario_id)
);
ALTER TABLE public.notificacao_preferencias ENABLE ROW LEVEL SECURITY;
