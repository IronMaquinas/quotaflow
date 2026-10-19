-- 025_funcoes_detalhes.sql — etapa 12d.0.2: CBO, setor, escolaridade, riscos e "responde a" nas funções
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 024.
--
--   cbo           → código CBO (eSocial), ex.: 7825-10
--   setor         → área (Operação/Tráfego, Oficina, Armazém…)
--   escolaridade  → mínima, um código da lista (fundamental_completo, medio_completo…)
--   riscos        → jsonb ["transito","ruido",…] — riscos da função (PGR/NR-1); vão ajudar a sugerir o kit de EPI (12d)
--   responde_a    → cargo do superior imediato (texto)
--
-- Também completa os 8 modelos da biblioteca (só os que ainda não têm setor) e sobe a versão deles:
-- quem já importou vê "✨ Versão nova na biblioteca" e decide se atualiza.

BEGIN;

ALTER TABLE public.funcoes ADD COLUMN IF NOT EXISTS cbo          text;
ALTER TABLE public.funcoes ADD COLUMN IF NOT EXISTS setor        text;
ALTER TABLE public.funcoes ADD COLUMN IF NOT EXISTS escolaridade text;
ALTER TABLE public.funcoes ADD COLUMN IF NOT EXISTS riscos       jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.funcoes ADD COLUMN IF NOT EXISTS responde_a   text;

UPDATE public.funcoes f
   SET cbo = v.cbo, setor = v.setor, escolaridade = v.escolaridade, riscos = v.riscos::jsonb,
       responde_a = v.responde_a, versao = f.versao + 1, atualizado_em = now()
  FROM (VALUES
    ('Motorista carreteiro',                   '7825-10', 'Operação / Tráfego',        'fundamental_completo', 'Supervisor de tráfego',
     '["transito","vibracao","ruido","calor","postura","jornada","levantamento","queda"]'),
    ('Motorista de produtos perigosos (MOPP)', '7825-10', 'Operação / Tráfego',        'fundamental_completo', 'Supervisor de tráfego',
     '["transito","produtos_perigosos","quimico","incendio","vibracao","ruido","postura","jornada","queda"]'),
    ('Mecânico de veículos pesados',           '9144-25', 'Manutenção / Oficina',      'fundamental_completo', 'Encarregado de manutenção',
     '["ruido","quimico","maquinas","prensamento","postura","levantamento","queda"]'),
    ('Eletricista automotivo',                 '9531-15', 'Manutenção / Oficina',      'medio_completo',       'Encarregado de manutenção',
     '["eletricidade","quimico","maquinas","postura"]'),
    ('Borracheiro',                            '9921-15', 'Manutenção / Oficina',      'fundamental_incompleto','Encarregado de manutenção',
     '["explosao_pneu","levantamento","postura","ruido","maquinas","prensamento"]'),
    ('Ajudante / Conferente',                  '7832-25', 'Armazém / Operação',        'fundamental_incompleto','Encarregado de armazém',
     '["levantamento","prensamento","transito","postura","queda"]'),
    ('Lavador de veículos',                    '5199-35', 'Pátio / Lavagem',           'fundamental_incompleto','Encarregado de manutenção',
     '["umidade","quimico","ruido","queda","postura"]'),
    ('Assistente de tráfego / administrativo', NULL,      'Tráfego / Administrativo',  'medio_completo',       'Supervisor de tráfego',
     '["postura","repetitivo"]')
  ) AS v(nome, cbo, setor, escolaridade, responde_a, riscos)
 WHERE f.tenant_id IS NULL AND f.nome = v.nome AND f.setor IS NULL;

COMMIT;
