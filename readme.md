# Etapa 11a — "Criar conta", planos, teste grátis e aprovação

## O que muda

**Tela de login:** novo link **"Criar conta — 15 dias grátis"**. Na aba Fornecedor, o link vira "Cadastrar minha empresa".

**Transportadora** (`POST /api/auth/signup`):
- **CNPJ:** obrigatório. É conferido na Receita no navegador e de novo no servidor. CNPJ inexistente ou não ATIVO bloqueia o cadastro, assim como a Receita fora do ar. CNPJ que já é cliente recebe a mensagem "peça ao gestor".
- **Acesso:** o responsável entra como **gestor** e também como **admin**. O admin é necessário porque a tela de Usuários exige esse perfil, e sem ele o dono não conseguiria cadastrar a equipe. O cadastro agora grava `usuario_perfis`.
- **Teste:** **15 dias grátis**. Uma faixa no topo mostra "faltam X dias". Quando o teste acaba, aparece só um aviso; nada é bloqueado.
- **Aprovação:** a empresa nasce **em análise**. O sistema inteiro já fica liberado, menos a **publicação no Canal Spot**, que só abre depois da sua aprovação.

**Fornecedor** (`POST /api/auth/signup-fornecedor`):
- **Cadastro:** CNPJ obrigatório, conferido na Receita, mais nome fantasia, telefone, WhatsApp, atuação (opcional) e login.
- **Situação inicial:** nasce como **`candidato`** (em análise). Não aparece para nenhuma transportadora e não vê o Canal Spot. Já entra no portal, com o aviso "Cadastro em análise".
- **CNPJ já cadastrado:** se o CNPJ já é de um global ou de outro candidato, o cadastro é recusado ("entre com o login da empresa").

**Alertas automáticos:** cada cadastro novo é marcado se tiver CNAE fora do esperado, empresa aberta há menos de 6 meses ou e-mail gratuito. Os alertas não bloqueiam nada; ficam gravados em `alertas_cadastro`.

**Aviso para você:** se a variável **`ADMIN_EMAIL`** estiver configurada no Render, você recebe um e-mail a cada cadastro novo. O e-mail traz os dados da Receita, os alertas e o comando SQL para aprovar.

**Tabela `planos`:**
- Cliente: teste, bronze, prata e ouro. Fornecedor: gratuito e pro.
- Nome, preço e recursos ficam no banco. Por enquanto nenhum plano bloqueia nada.

Os clientes e fornecedores que já existem continuam como estão: aprovados e sem teste.

## Aprovar até a tela de admin existir (11b)

No SQL Editor do Supabase:

```sql
-- Transportadoras aguardando
SELECT id, nome, cnpj, email_admin, regiao, alertas_cadastro, dados_cnpj->>'cnae_descricao' AS atividade
  FROM tenants WHERE aprovacao_status = 'pendente';

-- Aprovar / recusar transportadora
UPDATE tenants SET aprovacao_status = 'aprovado', aprovado_em = now() WHERE id = 0;
UPDATE tenants SET aprovacao_status = 'recusado', aprovacao_obs = 'motivo' WHERE id = 0;

-- Fornecedores aguardando
SELECT id, nome_fantasia, cnpj, email, cidade, estado, alertas_cadastro, dados_cnpj->>'cnae_descricao' AS atividade
  FROM fornecedores WHERE tipo = 'candidato';

-- Antes de aprovar um fornecedor: algum tenant já tem esse CNPJ como local?
-- (se tiver, até a 11b esse tenant vai ver o fornecedor duas vezes)
SELECT id, tenant_id, nome_fantasia FROM fornecedores WHERE cnpj = '00000000000000' AND tipo = 'local';

-- Aprovar fornecedor (vira verificado: aparece para todos e vê o Canal Spot)
UPDATE fornecedores SET tipo = 'global' WHERE id = 0 AND tipo = 'candidato';
```

## Arquivos

- **Banco:** `016_cadastro_planos.sql`
- **Backend:**
  - `routes/auth.js`
  - `routes/spot.js`
  - `routes/fornecedor.js`
  - `services/convitesFornecedor.js` (passa a usar a consulta à Receita centralizada)
  - `services/receitaCnpj.js` (**novo**)
  - `services/cadastroPublico.js` (**novo**)
  - `verificar-entrega.js` (41 arquivos)
- **Frontend:**
  - `App.jsx` (só 2 linhas: a faixa de aviso)
  - `TelaLogin.jsx`
  - `TelaSignup.jsx`
  - `components/shared/AvisoPlanoTenant.jsx` (**novo**)
  - `components/spot/TelaCanalSpot.jsx`
  - `components/portal/TelaFornecedor.jsx`

## Como aplicar

1. No Supabase, rode `016_cadastro_planos.sql`.
   - Se aparecer o aviso "Removendo CHECK antigo em tenants", é esperado: um CHECK antigo travava o plano em 'starter'.
   - A conferência no fim lista: 6 planos, os tenants aprovados e os fornecedores por tipo.
2. Na pasta `backend`, rode `node verificar-entrega.js --antes`. O esperado é **9/9**.
   - Se `App.jsx`, `TelaLogin.jsx` ou `TelaSignup.jsx` aparecerem como diferentes, me mande esses arquivos antes de copiar.
3. Copie os arquivos, inclusive o `verificar-entrega.js`.
4. Rode `node verificar-entrega.js` de novo. O esperado é **41/41**. Se aparecer o aviso de arquivo novo fora do git, rode `git add`.
5. Opcional: no Render, crie a variável `ADMIN_EMAIL` com o seu e-mail.
6. Faça o commit e o push.
