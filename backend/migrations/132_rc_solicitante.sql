-- 132_rc_solicitante.sql — etapa Q3: quem pediu a requisição de compra (RC) — o comprador vê o nome e é avisado
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS solicitante_usuario_id text;
ALTER TABLE public.chamados ADD COLUMN IF NOT EXISTS solicitante_nome text;
