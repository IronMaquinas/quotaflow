-- 100_leitura_registrada.sql — etapa 18zz.14: 🧾 leitura registrada pela gestão em nome do funcionário (sem login, reunião, treinamento presencial)
-- Idempotente. colaborador_id = de quem é a leitura; registrado_por* = quem registrou; justificativa obrigatória (na rota); evidência = lista de presença.
DO $$
DECLARE cid text; uid text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO cid FROM pg_attribute a WHERE a.attrelid = 'public.colaboradores'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  SELECT format_type(a.atttypid, a.atttypmod) INTO uid FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id' AND NOT a.attisdropped;
  EXECUTE format('ALTER TABLE public.documentos_gestao_leituras ADD COLUMN IF NOT EXISTS colaborador_id %s', cid);
  EXECUTE format('ALTER TABLE public.documentos_gestao_leituras ADD COLUMN IF NOT EXISTS registrado_por_id %s', uid);
END $$;
ALTER TABLE public.documentos_gestao_leituras ADD COLUMN IF NOT EXISTS registrado_por text;
ALTER TABLE public.documentos_gestao_leituras ADD COLUMN IF NOT EXISTS justificativa text;
ALTER TABLE public.documentos_gestao_leituras ADD COLUMN IF NOT EXISTS evidencia_path text;
ALTER TABLE public.documentos_gestao_leituras ADD COLUMN IF NOT EXISTS evidencia_nome text;
ALTER TABLE public.documentos_gestao_leituras ADD COLUMN IF NOT EXISTS evidencia_mime text;
CREATE INDEX IF NOT EXISTS documentos_gestao_leituras_col_idx ON public.documentos_gestao_leituras (documento_id, revisao, colaborador_id);
NOTIFY pgrst, 'reload schema';
