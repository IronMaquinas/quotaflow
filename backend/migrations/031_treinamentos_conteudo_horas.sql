-- 031_treinamentos_conteudo_horas.sql — etapa 12e.2a: conteúdo + prova dos treinamentos, horas creditadas, nascimento
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 030.
--
--   treinamentos.secoes      → conteúdo em seções [{ titulo, texto, video_url, material_url }]
--                              (vídeo = link YouTube/Vimeo não listado; material = link de PDF/apostila)
--   treinamentos.prova       → { nota_minima, tentativas_max, perguntas: [{ enunciado, alternativas: [..], correta }] } ou NULL
--   treinamento_participacoes.horas → horas CREDITADAS ao colaborador (NULL = usa a carga da turma, se presente e concluída)
--   colaboradores.data_nascimento   → 2º fator do link da prova (12e.2b) e aniversariantes do mês

BEGIN;
ALTER TABLE public.treinamentos ADD COLUMN IF NOT EXISTS secoes jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.treinamentos ADD COLUMN IF NOT EXISTS prova jsonb;
ALTER TABLE public.treinamento_participacoes ADD COLUMN IF NOT EXISTS horas numeric CHECK (horas IS NULL OR horas >= 0);
ALTER TABLE public.colaboradores ADD COLUMN IF NOT EXISTS data_nascimento date;
CREATE INDEX IF NOT EXISTS treinamentos_biblioteca_idx ON public.treinamentos (codigo) WHERE tenant_id IS NULL;

-- Semente da biblioteca: 1 treinamento de exemplo (sem vídeo — o vídeo é seu, cole o link no Console)
INSERT INTO public.treinamentos (tenant_id, codigo, nome, norma, carga_horaria, validade_meses, tipo, conteudo, secoes, prova, versao)
SELECT NULL, 'nr6_uso_epi', 'NR-6 — Uso, guarda e conservação de EPI', 'NR-6', 1, 12, 'regulatorio',
  'O que é EPI e o CA; obrigações do empregador e do empregado; uso correto, guarda, higienização e troca; comunicação de dano.',
  '[{"titulo":"O que é EPI e o Certificado de Aprovação (CA)","texto":"EPI é todo dispositivo de uso individual destinado a proteger a saúde e a integridade física do trabalhador. Só pode ser usado EPI com CA válido, emitido pelo Ministério do Trabalho.","video_url":null,"material_url":null},
    {"titulo":"Obrigações do empregador e do empregado","texto":"Empregador: fornecer gratuitamente o EPI adequado ao risco, orientar e treinar, exigir o uso, substituir quando danificado e registrar a entrega. Empregado: usar apenas para a finalidade, guardar e conservar, comunicar qualquer alteração que o torne impróprio.","video_url":null,"material_url":null},
    {"titulo":"Uso, guarda e troca","texto":"Confira o EPI antes de usar. Guarde em local limpo e seco. Higienize conforme o fabricante. Danificado, vencido ou sem ajuste: devolva e peça a troca — a troca fica registrada na sua ficha de EPI.","video_url":null,"material_url":null}]'::jsonb,
  '{"nota_minima":70,"tentativas_max":3,"perguntas":[
    {"enunciado":"Quem paga pelo EPI do trabalhador?","alternativas":["O trabalhador","O empregador, gratuitamente","Metade cada um"],"correta":1},
    {"enunciado":"O que comprova que o EPI foi aprovado para uso?","alternativas":["A nota fiscal","O Certificado de Aprovação (CA)","A etiqueta de preço"],"correta":1},
    {"enunciado":"O EPI está danificado. O que fazer?","alternativas":["Continuar usando até o fim do turno","Consertar em casa","Comunicar e pedir a troca"],"correta":2},
    {"enunciado":"A recusa injustificada ao uso do EPI fornecido é:","alternativas":["Permitida","Ato faltoso","Indiferente"],"correta":1},
    {"enunciado":"Onde guardar o EPI?","alternativas":["Em local limpo e seco","No chão do caminhão","Em qualquer lugar"],"correta":0}]}'::jsonb,
  1
WHERE NOT EXISTS (SELECT 1 FROM public.treinamentos WHERE tenant_id IS NULL AND codigo = 'nr6_uso_epi');

COMMIT;
