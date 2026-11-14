-- 088_checklist_medicao_contratual.sql — etapa 18zg: ⏱ modelo de checklist "Leitura para medição contratual" na BIBLIOTECA
--   (combinado com o Marcony, 14/11): o contrato que cobra por hora ou com franquia precisa de leitura de horímetro; um checklist de
--   carregamento/pré-uso não é o lugar dela. Este modelo é curto (foto do painel + horímetro obrigatório), feito pelo cliente
--   (rotina do locatário) ou pela equipe, e cada empresa importa em 🔍 Inspeções → Biblioteca. Idempotente (não duplica pelo nome).
INSERT INTO public.inspecao_modelos (tenant_id, nome, tipo, categoria, frequencia, descricao, vistas, campos, versao)
SELECT NULL, 'Leitura para medição contratual (horímetro)', 'equipamento', 'outro', 'semanal',
  'Leitura rápida para a medição do contrato: horímetro obrigatório e foto do painel mostrando o número. Use em rotina semanal (ou mensal) feita pelo cliente ou pela sua equipe — a medição calcula as horas do ciclo entre a primeira e a última leitura (precisa de pelo menos 2).',
  '[{"codigo": "painel", "nome": "Painel", "imagem": "esquema:painel", "pontos": [
     {"id": "mc_painel", "rotulo": "Foto do painel com o horímetro legível", "x": 50.0, "y": 45.0, "tipo": "ok_nok", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": "Enquadre o número do horímetro — é a prova da leitura na medição"},
     {"id": "mc_operando", "rotulo": "Equipamento operando normalmente", "x": 25.0, "y": 75.0, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": "Se houve parada ou avaria no período, marque NOK e descreva"}
  ]}]'::jsonb,
  '["horimetro"]'::jsonb, 1
WHERE NOT EXISTS (SELECT 1 FROM public.inspecao_modelos WHERE tenant_id IS NULL AND nome = 'Leitura para medição contratual (horímetro)');
