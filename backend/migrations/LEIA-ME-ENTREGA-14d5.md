# Entrega 14d.5 — Perfil da empresa completo · CEP primeiro · CNPJ travado com histórico

Por cima da **14d.4** (ordem: 14d.3 → 14d.4 → 14d.5). **Só os 13 arquivos que mudaram desde a 14d.4.**

## Como aplicar
1. **Supabase → SQL Editor:** rode `backend/migrations/049_perfil_empresa_cnpj.sql` (depois da 047 e da 048).
   - Ela também preenche os dados vazios das contas que já existem com o que a Receita devolveu no cadastro.
2. Copie os arquivos por cima (na **raiz** do projeto).
3. Novos no git:
   `git add backend/migrations/049_perfil_empresa_cnpj.sql backend/services/perfilEmpresa.js frontend/src/components/configuracoes/CompletarPerfil.jsx`
4. `cd backend && node verificar-entrega.js` → **158 arquivos OK**.
5. Reinicie o backend.

## Para testar
- Tela inicial (admin/gestor): cartão **🏢 Complete o perfil da sua empresa** → clique num item → abre a aba certa.
- ⚙️ Configurações → 🏢 Empresa: digite um **CEP** → rua/bairro/cidade se completam e o cursor vai para o Número.
- **🔍 Buscar na Receita** completa só os campos vazios. CNPJ aparece com 🔒.
- **🕓 Histórico de alterações** depois de salvar.
- Console da plataforma → Transportadoras → **🔒 CNPJ…** (motivo obrigatório) → o histórico da empresa mostra a troca.
- Teste do gatilho: `UPDATE tenants SET cnpj = cnpj || '' WHERE id = …` não grava nada (mesmo valor); qualquer troca real por SQL aparece como "direto no banco".

## Árvore
```
backend/
  verificar-entrega.js
  routes/ configuracoes.js · plataforma.js
  services/ perfilEmpresa.js (novo) · receitaCnpj.js · cadastroPublico.js
  migrations/049_perfil_empresa_cnpj.sql (novo)
frontend/src/
  App.jsx
  components/configuracoes/ DadosEmpresa.jsx · CompletarPerfil.jsx (novo) · TelaConfiguracoes.jsx
  plataforma/ConsolePlataforma.jsx
readme.md
```
