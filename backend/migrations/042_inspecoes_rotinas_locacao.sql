-- 042_inspecoes_rotinas_locacao.sql — etapa 14b.2
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 041.
--   equipamentos (+)        → situacao 'base' | 'locado', locacao_id (locação ativa)
--   equipamento_locacoes    → histórico de locações (cliente, contrato, local/obra, contato, início, fim previsto/real,
--                             inspeção de entrega e de devolução)
--   equipamento_rotinas     → rotina de inspeção por equipamento: modelo, frequência (diária/semanal/quinzenal/mensal),
--                             quem faz (empresa | locatário), início — base do calendário, "em dia/atrasada" e % de cumprimento
--   inspecao_modelos.tipo   → + 'entrega' e 'devolucao' (locação)
--   inspecoes.locacao_id    → a inspeção feita durante uma locação fica ligada a ela
BEGIN;
ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS situacao text NOT NULL DEFAULT 'base';
ALTER TABLE public.equipamentos ADD COLUMN IF NOT EXISTS locacao_id bigint;
ALTER TABLE public.inspecoes ADD COLUMN IF NOT EXISTS locacao_id bigint;
ALTER TABLE public.inspecao_modelos DROP CONSTRAINT IF EXISTS inspecao_modelos_tipo_chk;
ALTER TABLE public.inspecao_modelos ADD CONSTRAINT inspecao_modelos_tipo_chk CHECK (tipo IN ('equipamento','carregamento','transito','descarregamento','entrega','devolucao'));

DO $$
DECLARE t_tenant text; t_equip text;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_equip  FROM pg_attribute a WHERE a.attrelid = 'public.equipamentos'::regclass AND a.attname = 'id';
  IF to_regclass('public.equipamento_locacoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.equipamento_locacoes (
        id                     bigserial PRIMARY KEY,
        tenant_id              %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        equipamento_id         %2$s NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
        cliente                text NOT NULL,
        contrato               text,
        local                  text,
        contato_nome           text,
        contato_email          text,
        contato_telefone       text,
        inicio                 date NOT NULL,
        fim_previsto           date,
        fim_real               date,
        status                 text NOT NULL DEFAULT 'ativa' CHECK (status IN ('ativa','encerrada')),
        entrega_inspecao_id    bigint,
        devolucao_inspecao_id  bigint,
        obs                    text,
        criado_por_nome        text,
        encerrado_por_nome     text,
        criado_em              timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_equip);
  END IF;
  IF to_regclass('public.equipamento_rotinas') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.equipamento_rotinas (
        id               bigserial PRIMARY KEY,
        tenant_id        %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        equipamento_id   %2$s NOT NULL REFERENCES public.equipamentos(id) ON DELETE CASCADE,
        modelo_id        bigint NOT NULL REFERENCES public.inspecao_modelos(id) ON DELETE CASCADE,
        frequencia       text NOT NULL CHECK (frequencia IN ('diaria','semanal','quinzenal','mensal')),
        responsavel      text NOT NULL DEFAULT 'empresa' CHECK (responsavel IN ('empresa','locatario')),
        locacao_id       bigint REFERENCES public.equipamento_locacoes(id) ON DELETE SET NULL,
        inicio           date NOT NULL,
        ativo            boolean NOT NULL DEFAULT true,
        criado_em        timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_equip);
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS equipamento_locacoes_idx ON public.equipamento_locacoes (tenant_id, equipamento_id);
CREATE INDEX IF NOT EXISTS equipamento_rotinas_idx ON public.equipamento_rotinas (tenant_id, equipamento_id);

-- Biblioteca: entrega e devolução de locação (mesmos pontos — o relatório compara lado a lado)
INSERT INTO public.inspecao_modelos (tenant_id, nome, tipo, categoria, frequencia, descricao, vistas, campos, versao)
SELECT NULL, 'Locação — inspeção de entrega', 'entrega', 'empilhadeira', 'avulsa', 'Na saída para o cliente: estado do equipamento com fotos de cada lado, acessórios e horímetro — base de comparação na devolução.', '[{"codigo": "geral", "nome": "Equipamento", "imagem": "esquema:empilhadeira_lateral", "pontos": [{"id": "lc_lataria", "rotulo": "Lataria e pintura (amassados, riscos)", "x": 50.0, "y": 34.6, "tipo": "ok_nok", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": "Foto de cada lado — serve de comparação na devolução"}, {"id": "lc_garfos", "rotulo": "Garfos / implemento (trincas, desgaste)", "x": 85.0, "y": 76.2, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "lc_pneus", "rotulo": "Pneus / rodas", "x": 27.5, "y": 80.8, "tipo": "ok_nok", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "lc_vaz", "rotulo": "Vazamentos (óleo, hidráulico, combustível)", "x": 63.8, "y": 46.2, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "lc_cabine", "rotulo": "Cabine, assento e cinto", "x": 50.0, "y": 40.4, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "lc_luzes", "rotulo": "Luzes, buzina e alarme de ré", "x": 72.8, "y": 48.1, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "lc_extintor", "rotulo": "Extintor (carga e validade)", "x": 37.5, "y": 67.3, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "lc_acess", "rotulo": "Acessórios entregues (chaves, manual, carregador)", "x": 15.0, "y": 23.1, "tipo": "texto", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": "Liste o que foi entregue"}, {"id": "lc_limpeza", "rotulo": "Limpeza geral", "x": 80.0, "y": 23.1, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}]}, {"codigo": "painel", "nome": "Painel", "imagem": "esquema:painel", "pontos": [{"id": "lc_alertas", "rotulo": "Luzes de alerta apagadas após partida", "x": 50.0, "y": 36.5, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "lc_comb", "rotulo": "Combustível / bateria", "x": 50.0, "y": 67.7, "tipo": "numero", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": "%", "ajuda": "Foto do marcador"}]}]'::jsonb, '["horimetro","local","cliente"]'::jsonb, 1
WHERE NOT EXISTS (SELECT 1 FROM public.inspecao_modelos WHERE tenant_id IS NULL AND nome = 'Locação — inspeção de entrega');
INSERT INTO public.inspecao_modelos (tenant_id, nome, tipo, categoria, frequencia, descricao, vistas, campos, versao)
SELECT NULL, 'Locação — inspeção de devolução', 'devolucao', 'empilhadeira', 'avulsa', 'Na volta do cliente: os mesmos pontos da entrega (o relatório mostra entrega × devolução lado a lado).', '[{"codigo": "geral", "nome": "Equipamento", "imagem": "esquema:empilhadeira_lateral", "pontos": [{"id": "lc_lataria", "rotulo": "Lataria e pintura (amassados, riscos)", "x": 50.0, "y": 34.6, "tipo": "ok_nok", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": "Foto de cada lado — serve de comparação na devolução"}, {"id": "lc_garfos", "rotulo": "Garfos / implemento (trincas, desgaste)", "x": 85.0, "y": 76.2, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "lc_pneus", "rotulo": "Pneus / rodas", "x": 27.5, "y": 80.8, "tipo": "ok_nok", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "lc_vaz", "rotulo": "Vazamentos (óleo, hidráulico, combustível)", "x": 63.8, "y": 46.2, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "lc_cabine", "rotulo": "Cabine, assento e cinto", "x": 50.0, "y": 40.4, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "lc_luzes", "rotulo": "Luzes, buzina e alarme de ré", "x": 72.8, "y": 48.1, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}, {"id": "lc_extintor", "rotulo": "Extintor (carga e validade)", "x": 37.5, "y": 67.3, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "lc_acess", "rotulo": "Acessórios entregues (chaves, manual, carregador)", "x": 15.0, "y": 23.1, "tipo": "texto", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": "Liste o que foi entregue"}, {"id": "lc_limpeza", "rotulo": "Limpeza geral", "x": 80.0, "y": 23.1, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": false, "unidade": null, "ajuda": null}]}, {"codigo": "painel", "nome": "Painel", "imagem": "esquema:painel", "pontos": [{"id": "lc_alertas", "rotulo": "Luzes de alerta apagadas após partida", "x": 50.0, "y": 36.5, "tipo": "ok_nok", "foto": "se_nok", "foto_obrigatoria": true, "critico": true, "unidade": null, "ajuda": null}, {"id": "lc_comb", "rotulo": "Combustível / bateria", "x": 50.0, "y": 67.7, "tipo": "numero", "foto": "sempre", "foto_obrigatoria": true, "critico": false, "unidade": "%", "ajuda": "Foto do marcador"}]}]'::jsonb, '["horimetro","local","cliente"]'::jsonb, 1
WHERE NOT EXISTS (SELECT 1 FROM public.inspecao_modelos WHERE tenant_id IS NULL AND nome = 'Locação — inspeção de devolução');

COMMIT;
