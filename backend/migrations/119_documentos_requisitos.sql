-- 119_documentos_requisitos.sql — etapa A1.4: 🧭 matriz documentos × requisitos — quais itens da norma cada documento de gestão atende.
--   Vazio = o sistema sugere pelo campo "Norma / referência" (ex.: "ISO 9001:2015 — 7.2 e 7.3"). Idempotente.
ALTER TABLE public.documentos_gestao ADD COLUMN IF NOT EXISTS requisitos jsonb NOT NULL DEFAULT '[]'::jsonb;
