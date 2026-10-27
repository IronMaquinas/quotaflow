-- 051_comercial_bid.sql — etapa 15a: 📈 Comercial (mini-CRM) + BID
-- Idempotente (pode rodar 2×). Rodar no SQL Editor do Supabase, depois da 050.
--   tenants (+)       → inscricao_estadual, opcao_fiscal (cabeçalho "Identificação" do BID)
--   perfil comercial  → quem vende: vê a seção 📈 Comercial (gestor e admin também veem)
--   bid_modelos       → modelo do BID: seções de texto, colunas do item, condições comerciais.
--                       tenant_id NULL = BIBLIOTECA do QuotaFlow; a empresa importa uma cópia e adapta (versão nova = aviso).
--   bids              → BID-AAAA-NNNN: cliente, responsável, fase do funil, itens agrupados por trecho, condições, validade.
--   bid_versoes       → v1, v2… congeladas (o que mudou em cada uma + hash)
--   bid_atividades    → linha do tempo do CRM: ligação, e-mail, reunião, nota, tarefa com data, eventos automáticos
BEGIN;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS inscricao_estadual text;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS opcao_fiscal text;

DO $$
DECLARE t_tenant text; t_usuario text; r record;
BEGIN
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_tenant  FROM pg_attribute a WHERE a.attrelid = 'public.tenants'::regclass  AND a.attname = 'id';
  SELECT format_type(a.atttypid, a.atttypmod) INTO t_usuario FROM pg_attribute a WHERE a.attrelid = 'public.usuarios'::regclass AND a.attname = 'id';

  IF to_regclass('public.bid_modelos') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.bid_modelos (
        id             bigserial PRIMARY KEY,
        tenant_id      %1$s REFERENCES public.tenants(id) ON DELETE CASCADE,   -- NULL = biblioteca
        nome           text NOT NULL,
        descricao      text,
        titulo_documento text,
        secoes         jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ titulo, texto, posicao: antes|depois }]
        colunas        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ chave, rotulo, tipo: texto|numero|sim_nao|data, unidade }]
        condicoes      jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ chave, rotulo, tipo: texto|moeda|numero, unidade, padrao, grupo: comercial|pagamento }]
        rotulo_grupo   text NOT NULL DEFAULT 'Trecho',
        validade_dias  integer NOT NULL DEFAULT 10,
        origem_id      bigint REFERENCES public.bid_modelos(id) ON DELETE SET NULL,
        origem_versao  integer,
        versao         integer NOT NULL DEFAULT 1,
        ativo          boolean NOT NULL DEFAULT true,
        criado_em      timestamptz NOT NULL DEFAULT now(),
        atualizado_em  timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant);
  END IF;

  IF to_regclass('public.bids') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.bids (
        id                 bigserial PRIMARY KEY,
        tenant_id          %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        numero             text NOT NULL,
        titulo             text,
        referencia         text,                         -- referência do cliente (ex.: "PC 551")
        cliente_id         bigint REFERENCES public.clientes(id) ON DELETE SET NULL,
        cliente_nome       text NOT NULL,
        contato_nome       text,
        contato_email      text,
        contato_telefone   text,
        modelo_id          bigint REFERENCES public.bid_modelos(id) ON DELETE SET NULL,
        modelo_nome        text,
        conteudo           jsonb NOT NULL DEFAULT '{}'::jsonb,   -- cópia do modelo (seções, colunas, condições) — editável no BID
        grupos             jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{ id, titulo, valor, itens: [{ id, valores: {}, valor }] }]
        condicoes          jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { chave: valor, na: [chaves] }
        valor_total_manual numeric,
        valor_total        numeric,
        validade_dias      integer NOT NULL DEFAULT 10,
        valido_ate         date,
        previsao_fechamento date,
        assinante          jsonb NOT NULL DEFAULT '{}'::jsonb,   -- { nome, cargo, registro, telefones }
        responsavel_id     %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        responsavel_nome   text,
        fase               text NOT NULL DEFAULT 'elaboracao' CHECK (fase IN ('elaboracao','enviado','negociacao','proposta_final','aceito','perdido')),
        fase_desde         timestamptz NOT NULL DEFAULT now(),
        enviado_em         timestamptz,
        ganho_em           timestamptz,
        perdido_em         timestamptz,
        motivo_perda       text,
        perda_obs          text,
        versao_atual       integer NOT NULL DEFAULT 0,
        alterado_desde_versao boolean NOT NULL DEFAULT true,
        criado_por_nome    text,
        criado_em          timestamptz NOT NULL DEFAULT now(),
        atualizado_em      timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario);
  END IF;

  IF to_regclass('public.bid_versoes') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.bid_versoes (
        id              bigserial PRIMARY KEY,
        tenant_id       %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        bid_id          bigint NOT NULL REFERENCES public.bids(id) ON DELETE CASCADE,
        versao          integer NOT NULL,
        snapshot        jsonb NOT NULL,
        valor_total     numeric,
        mudancas        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- ["Item … valor R$ x → R$ y", …]
        nota            text,
        hash            text NOT NULL,
        criado_por_nome text,
        criado_em       timestamptz NOT NULL DEFAULT now(),
        UNIQUE (bid_id, versao)
      )$f$, t_tenant);
  END IF;

  IF to_regclass('public.bid_atividades') IS NULL THEN
    EXECUTE format($f$
      CREATE TABLE public.bid_atividades (
        id              bigserial PRIMARY KEY,
        tenant_id       %1$s NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
        bid_id          bigint REFERENCES public.bids(id) ON DELETE CASCADE,
        cliente_id      bigint REFERENCES public.clientes(id) ON DELETE SET NULL,
        tipo            text NOT NULL CHECK (tipo IN ('ligacao','email','reuniao','nota','tarefa','evento')),
        texto           text NOT NULL,
        prevista_para   timestamptz,
        concluida_em    timestamptz,
        usuario_id      %2$s REFERENCES public.usuarios(id) ON DELETE SET NULL,
        usuario_nome    text,
        criado_em       timestamptz NOT NULL DEFAULT now()
      )$f$, t_tenant, t_usuario);
  END IF;

  -- perfil Comercial no catálogo de perfis
  IF to_regclass('public.perfis') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.perfis WHERE codigo = 'comercial') THEN
    BEGIN
      EXECUTE $q$INSERT INTO public.perfis (codigo, nome, descricao, ordem) VALUES ('comercial', 'Comercial', 'Vendas: funil, BIDs e clientes (seção 📈 Comercial)', 7)$q$;
    EXCEPTION WHEN undefined_column THEN
      EXECUTE $q$INSERT INTO public.perfis (codigo, nome) VALUES ('comercial', 'Comercial')$q$;
    END;
  END IF;
  -- CHECK de usuarios.perfil / usuario_perfis.perfil_codigo (se existir) passa a aceitar 'comercial'
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.usuarios'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%perfil%' AND pg_get_constraintdef(oid) NOT ILIKE '%comercial%'
  LOOP
    EXECUTE format('ALTER TABLE public.usuarios DROP CONSTRAINT %I', r.conname);
    EXECUTE format($q$ALTER TABLE public.usuarios ADD CONSTRAINT %I CHECK (perfil IN ('admin','gestor','comprador','operacao','qualidade','financeiro','comercial','colaborador','locatario','tecnico','fornecedor')) NOT VALID$q$, r.conname);
  END LOOP;
  IF to_regclass('public.usuario_perfis') IS NOT NULL THEN
    FOR r IN SELECT conname FROM pg_constraint
             WHERE conrelid = 'public.usuario_perfis'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%perfil_codigo%' AND pg_get_constraintdef(oid) NOT ILIKE '%comercial%'
    LOOP
      EXECUTE format('ALTER TABLE public.usuario_perfis DROP CONSTRAINT %I', r.conname);
      EXECUTE format($q$ALTER TABLE public.usuario_perfis ADD CONSTRAINT %I CHECK (perfil_codigo IN ('admin','gestor','comprador','operacao','qualidade','financeiro','comercial','colaborador','locatario','tecnico','fornecedor')) NOT VALID$q$, r.conname);
    END LOOP;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS bids_numero_unico ON public.bids (tenant_id, numero);
CREATE INDEX IF NOT EXISTS bids_tenant_fase_idx ON public.bids (tenant_id, fase);
CREATE INDEX IF NOT EXISTS bids_cliente_idx ON public.bids (tenant_id, cliente_id);
CREATE INDEX IF NOT EXISTS bid_modelos_tenant_idx ON public.bid_modelos (tenant_id);
CREATE INDEX IF NOT EXISTS bid_atividades_bid_idx ON public.bid_atividades (tenant_id, bid_id);
CREATE INDEX IF NOT EXISTS bid_atividades_pendentes_idx ON public.bid_atividades (tenant_id, prevista_para) WHERE concluida_em IS NULL;

-- Biblioteca: "Transporte de equipamentos" (inspirado no BID real de uma cliente — textos genéricos; a empresa adapta)
INSERT INTO public.bid_modelos (tenant_id, nome, descricao, titulo_documento, rotulo_grupo, validade_dias, secoes, colunas, condicoes, versao)
SELECT NULL, 'Transporte de equipamentos',
  'Proposta (BID) de transporte de máquinas e equipamentos: itens agrupados por trecho, medidas da carga, tipo de conjunto, escolta e licença especial.',
  'BID SERVIÇOS DE TRANSPORTES DE EQUIPAMENTOS', 'Trecho', 10,
  $j$[
    {"titulo": "Escopo do serviço", "posicao": "antes", "texto": "Transporte de equipamento, com fornecimento de veículos adequados, mão de obra qualificada e todos os recursos necessários para garantir a integridade, a segurança e a pontualidade da operação."},
    {"titulo": "Serviços inclusos", "posicao": "antes", "texto": "- Planejamento logístico e definição da rota, mesmo que envolva órgãos do governo como o DNIT;\n- Emissão das autorizações necessárias (AET — Autorização Especial de Trânsito, se aplicável);\n- Fornecimento de veículos apropriados ao tipo de carga;\n- Amarração e fixação da carga conforme as normas técnicas do CONTRAN;\n- Seguro de transporte (cobertura para avarias, roubo e acidentes);\n- Acompanhamento e monitoramento do transporte, preferencialmente on-line;\n- Entrega no destino com conferência da integridade do equipamento;\n- Diligenciamento das notas fiscais com assinatura do recebedor, digitalização e envio ao contratante;\n- Profissionais habilitados e contratados via CLT."},
    {"titulo": "Responsabilidades da transportadora", "posicao": "antes", "texto": "- Garantir condições adequadas dos veículos e equipamentos de apoio;\n- Disponibilizar motoristas qualificados em transporte e amarração;\n- Cumprir todas as exigências legais e normas de segurança e garantir a conservação e a correta manutenção dos veículos;\n- Garantir a integridade física dos equipamentos durante todo o transporte;\n- Arcar com custos de multas por descumprimento de normas de trânsito e excesso de peso/dimensão, quando de sua responsabilidade;\n- Manter seguro de responsabilidade civil e seguro de carga abrangendo danos materiais, avarias e acidentes;\n- Apresentar toda a documentação fiscal obrigatória antes da coleta."},
    {"titulo": "Informações complementares — frota disponível", "posicao": "depois", "texto": "- Quantidade e tipos de veículos disponíveis (prancha, extensível, linha de eixo etc.): ________\n- Veículos de içamento (munk, guindaste): ________\n- Idade média da frota: ________\n- Capacidade máxima de carga (peso/medidas): ________\n- Rastreamento em tempo real: ________\n- Equipamentos auxiliares (cintas, correntes, calços, pranchas de madeira etc.): ________"},
    {"titulo": "Informações complementares — documentação", "posicao": "depois", "texto": "- Procedimentos para obtenção de AET: ________\n- Seguro de carga — valor máximo coberto por carga: ________\n- Seguro de responsabilidade civil contra terceiros: ________\n- Cobertura de avarias/danos aos equipamentos transportados: ________\n- Responsável técnico: ________"},
    {"titulo": "Informações complementares — experiência", "posicao": "depois", "texto": "- Tempo de experiência em transporte de equipamentos pesados: ________\n- Principais clientes atendidos: ________"}
  ]$j$::jsonb,
  $j$[
    {"chave": "veiculo", "rotulo": "Veículo", "tipo": "texto"},
    {"chave": "modelo", "rotulo": "Modelo", "tipo": "texto"},
    {"chave": "peso", "rotulo": "Peso operacional", "tipo": "numero", "unidade": "t"},
    {"chave": "altura", "rotulo": "Altura", "tipo": "numero", "unidade": "m"},
    {"chave": "largura", "rotulo": "Largura", "tipo": "numero", "unidade": "m"},
    {"chave": "comprimento", "rotulo": "Comprimento", "tipo": "numero", "unidade": "m"},
    {"chave": "conjunto", "rotulo": "Tipo de conjunto", "tipo": "texto"},
    {"chave": "escolta", "rotulo": "Escolta", "tipo": "sim_nao"},
    {"chave": "licenca", "rotulo": "Licença especial", "tipo": "sim_nao"},
    {"chave": "data_prevista", "rotulo": "Data prevista", "tipo": "data"}
  ]$j$::jsonb,
  $j$[
    {"chave": "tributo", "rotulo": "Tributo incidente", "tipo": "texto", "grupo": "comercial", "padrao": "ICMS (incluso na precificação final) — alíquota de 12%"},
    {"chave": "pedagio", "rotulo": "Pedágio", "tipo": "texto", "grupo": "comercial", "padrao": "Incluso"},
    {"chave": "licencas", "rotulo": "Licenças", "tipo": "texto", "grupo": "comercial", "padrao": "Incluso"},
    {"chave": "seguros", "rotulo": "Seguros", "tipo": "texto", "grupo": "comercial", "padrao": "Incluso (roubo + avaria + RC-V)"},
    {"chave": "escolta", "rotulo": "Escolta", "tipo": "texto", "grupo": "comercial"},
    {"chave": "prazo_aet", "rotulo": "Prazo de liberação da AET", "tipo": "texto", "grupo": "comercial"},
    {"chave": "prazo_entrega", "rotulo": "Prazo de entrega", "tipo": "texto", "grupo": "comercial"},
    {"chave": "franquia", "rotulo": "Franquia de carga/descarga", "tipo": "numero", "unidade": "horas", "grupo": "comercial"},
    {"chave": "diaria", "rotulo": "Diária pós-franquia", "tipo": "moeda", "grupo": "comercial"},
    {"chave": "forma_pagamento", "rotulo": "Forma de pagamento", "tipo": "texto", "grupo": "pagamento", "padrao": "Parcelado 30/48 dias após a emissão e o envio do conhecimento de transporte e do boleto"}
  ]$j$::jsonb,
  1
WHERE NOT EXISTS (SELECT 1 FROM public.bid_modelos WHERE tenant_id IS NULL AND nome = 'Transporte de equipamentos');
COMMIT;
