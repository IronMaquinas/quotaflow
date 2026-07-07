# 🚀 GUIA DE DEPLOY — QUOTAFLOW
## Do zero ao ar em produção (passo a passo para iniciantes)

---

## PRÉ-REQUISITOS (instale antes de começar)

- **Node.js** → nodejs.org → baixe a versão LTS → instale normalmente
- **Git** → git-scm.com → baixe e instale com opções padrão
- **VS Code** → code.visualstudio.com → instale

Para verificar se instalou certo, abra o terminal (PowerShell no Windows, Terminal no Mac) e digite:
```
node --version    ← deve aparecer v20.x.x ou maior
git --version     ← deve aparecer git version x.x.x
```

## CONTAS NECESSÁRIAS (todas gratuitas)

- **GitHub** → github.com
- **Railway** → railway.app (faça login com sua conta GitHub)
- **Resend** → resend.com (para envio de e-mails)

---

## PARTE 1 — CONFIGURAR O PROJETO NO SEU COMPUTADOR

### Passo 1.1 — Abrir o terminal na pasta do projeto

No Windows: clique com botão direito na pasta `quotaflow` → "Abrir no Terminal"
No Mac: arraste a pasta para o Terminal

### Passo 1.2 — Instalar dependências do backend

```bash
cd backend
npm install
```
Aguarde terminar (pode demorar 1-2 minutos na primeira vez).

### Passo 1.3 — Criar o arquivo de configuração

Na pasta `backend`, copie o arquivo `.env.example` e renomeie para `.env`:
- No Windows: copie o arquivo e renomeie
- No terminal: `cp .env.example .env`

Abra o `.env` no VS Code e preencha:

```
PORT=3001
JWT_SECRET=coloque_qualquer_frase_longa_aqui_ex_QuotaFlow2026xK9mP2qR7vL
RESEND_API_KEY=re_xxxx   ← você vai buscar isso no Passo 2
EMAIL_FROM=cotacoes@suaempresa.com.br
FRONTEND_URL=http://localhost:5173
EMPRESA_NOME=Nome da Sua Empresa
```

### Passo 1.4 — Instalar dependências do frontend

Em outro terminal (ou nova aba):
```bash
cd frontend
npm install
```

### Passo 1.5 — Testar localmente

Terminal 1 (backend):
```bash
cd backend
npm run dev
```
Deve aparecer: ✅ QuotaFlow backend rodando na porta 3001

Terminal 2 (frontend):
```bash
cd frontend
npm run dev
```
Deve aparecer: Local: http://localhost:5173

Abra http://localhost:5173 no navegador.
Login: admin@empresa.com / admin123

✅ Se funcionou localmente, siga para a Parte 2.

---

## PARTE 2 — CONFIGURAR O RESEND (e-mails)

### Passo 2.1 — Criar conta e obter chave API

1. Acesse resend.com e crie conta
2. No painel, clique em "API Keys" → "Create API Key"
3. Dê um nome (ex: "quotaflow-producao")
4. Copie a chave que começa com `re_...`
5. Cole no seu `.env` na variável `RESEND_API_KEY`

### Passo 2.2 — Verificar seu domínio de e-mail (IMPORTANTE)

Para enviar e-mails com seu domínio (ex: cotacoes@suaempresa.com.br):
1. No Resend, clique em "Domains" → "Add Domain"
2. Digite seu domínio
3. O Resend vai mostrar registros DNS para adicionar no seu provedor
4. Adicione os registros no painel do seu provedor de domínio (Registro.br, GoDaddy, etc.)
5. Aguarde verificação (pode levar até 48h)

**Alternativa para testes rápidos:** use o domínio de teste do Resend.
No `.env`, mude `EMAIL_FROM` para: `onboarding@resend.dev`
Funciona para enviar para qualquer e-mail, sem configurar domínio.

---

## PARTE 3 — SUBIR O CÓDIGO NO GITHUB

### Passo 3.1 — Criar repositório no GitHub

1. Acesse github.com → clique em "New repository"
2. Nome: `quotaflow`
3. Deixe como **Private** (privado)
4. Clique "Create repository"

### Passo 3.2 — Enviar o código

No terminal, dentro da pasta raiz `quotaflow`:

```bash
git init
git add .
git commit -m "QuotaFlow v1.0 — primeiro commit"
git branch -M main
git remote add origin https://github.com/SEU_USUARIO/quotaflow.git
git push -u origin main
```

⚠️ Substitua `SEU_USUARIO` pelo seu usuário do GitHub.

Verifique no GitHub se os arquivos apareceram. O arquivo `.env` NÃO deve aparecer (está no .gitignore).

---

## PARTE 4 — DEPLOY NO RAILWAY

O Railway vai hospedar o **backend**. O frontend vai junto, servido pelo próprio backend.

### Passo 4.1 — Criar projeto no Railway

1. Acesse railway.app → faça login com GitHub
2. Clique "New Project" → "Deploy from GitHub repo"
3. Selecione o repositório `quotaflow`
4. Railway vai detectar o projeto automaticamente

### Passo 4.2 — Configurar o serviço de backend

1. No painel do Railway, clique no serviço criado
2. Vá em "Settings" → "Source"
3. Em "Root Directory", digite: `backend`
4. Em "Build Command", coloque: `npm install`
5. Em "Start Command", coloque: `npm start`

### Passo 4.3 — Configurar variáveis de ambiente no Railway

1. Clique em "Variables" no seu serviço
2. Adicione cada variável do seu `.env`:

```
PORT              → deixe em branco (Railway define automaticamente)
JWT_SECRET        → sua string secreta longa
RESEND_API_KEY    → re_xxxx (sua chave do Resend)
EMAIL_FROM        → cotacoes@suaempresa.com.br
EMPRESA_NOME      → Nome da Sua Empresa
FRONTEND_URL      → (você vai preencher depois com a URL gerada)
```

### Passo 4.4 — Obter a URL pública

1. No Railway, clique em "Settings" → "Networking" → "Generate Domain"
2. Vai gerar algo como: `quotaflow-backend-production.up.railway.app`
3. Volte em "Variables" e atualize:
   ```
   FRONTEND_URL → https://quotaflow-backend-production.up.railway.app
   ```

### Passo 4.5 — Fazer o build do frontend para produção

O frontend precisa ser "compilado" antes do deploy. No seu computador:

```bash
cd frontend
npm run build
```

Vai criar uma pasta `frontend/dist/` com os arquivos otimizados.

Agora adicione estas linhas ao `backend/server.js` (antes do `app.listen`):

```javascript
const path = require("path");
// Servir o frontend compilado
app.use(express.static(path.join(__dirname, "../frontend/dist")));
// Para o React Router funcionar
app.get("*", (req, res) => {
  if (!req.path.startsWith("/api") && !req.path.startsWith("/health")) {
    res.sendFile(path.join(__dirname, "../frontend/dist/index.html"));
  }
});
```

Faça o commit e push:
```bash
git add .
git commit -m "adicionar serve do frontend"
git push
```

O Railway vai detectar o push e fazer o deploy automaticamente.

### Passo 4.6 — Verificar se está rodando

Acesse: `https://SUA-URL.up.railway.app/health`

Deve aparecer: `{"status":"ok","timestamp":"..."}`

Depois acesse a URL raiz e o sistema deve abrir.

---

## PARTE 5 — PRIMEIRO ACESSO EM PRODUÇÃO

### Passo 5.1 — Login inicial

Acesse sua URL pública e faça login:
- E-mail: `admin@empresa.com`
- Senha: `admin123`

### Passo 5.2 — TROQUE A SENHA IMEDIATAMENTE

1. Vá em "Usuários" (menu admin)
2. Edite o usuário Admin
3. Defina uma senha forte (mínimo 12 caracteres)

### Passo 5.3 — Cadastrar usuários reais

1. Vá em "Usuários" → "+ Novo usuário"
2. Cadastre sua cliente como Gestor ou Admin
3. Cadastre os compradores e técnicos

### Passo 5.4 — Configurar dados iniciais

1. Cadastre os equipamentos em "⚙ Equipamentos"
2. Cadastre os fornecedores em "🏭 Fornecedores" (com CNPJ para validação)
3. Ajuste as categorias em "Gerenciar Categorias"

---

## PARTE 6 — COMPARTILHAR COM SUA CLIENTE

Envie para ela:
```
🔗 Link do sistema: https://SUA-URL.up.railway.app

Credenciais de acesso:
E-mail: email.da.cliente@empresa.com
Senha: (a que você cadastrou)
```

---

## MANUTENÇÃO E ATUALIZAÇÕES

### Fazer uma atualização no código:
```bash
# Após editar os arquivos
git add .
git commit -m "descrição do que mudou"
git push
```
O Railway vai detectar e fazer o deploy automaticamente em ~2 minutos.

### Ver logs do servidor (se der erro):
No Railway → seu serviço → "Logs"

### Backup do banco de dados:
O banco fica em `backend/quotaflow.db`. No Railway, você pode baixá-lo
pela aba "Files" do serviço. Faça backup semanal enquanto não tiver
volume de dados grande.

---

## CUSTOS

| Serviço  | Plano gratuito       | Quando pagar        |
|----------|---------------------|---------------------|
| Railway  | 500h/mês grátis     | ~R$25/mês se usar mais |
| Resend   | 3.000 e-mails/mês   | ~R$50/mês acima disso |
| GitHub   | Repositórios ilimitados grátis | — |

Para a fase de testes com sua cliente, **tudo é gratuito**.

---

## PROBLEMAS COMUNS

**"Cannot find module"** → rode `npm install` na pasta que deu erro

**"Port already in use"** → feche outros terminais ou reinicie o computador

**E-mail não chega** → verifique se `RESEND_API_KEY` está correto no Railway

**Login não funciona em produção** → verifique se `JWT_SECRET` está nas variáveis do Railway

**Página em branco** → abra o DevTools (F12) → aba Console → me mostre o erro

---

## CONTATO E SUPORTE

Se travar em algum passo, volte aqui no Claude e descreva:
1. Em qual passo travou
2. Qual mensagem de erro apareceu
3. Print do terminal ou do navegador

Vou te ajudar a resolver. 💪
