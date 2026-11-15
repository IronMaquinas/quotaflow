# Entrega 18zw — 🚚 motorista agregado + 🪪 CNH pelo link da viagem

## 1. Rode no Supabase
`backend/migrations/095_colaborador_vinculo.sql` (pode rodar mais de uma vez).

## 2. Vínculo no cadastro (👷 Pessoas → Colaborador)
- **Vínculo:** Próprio (CLT) · **🚚 Agregado** · Terceiro.
- Para agregado ou terceiro aparecem a **empresa do agregado**, o **CNPJ/CPF** e o **RNTRC (ANTT)**.
- **Conformidade do agregado:** o selo olha **só os documentos** exigidos (CNH, ASO, MOPP…). EPI, treinamentos e competências de funcionário ficam por conta da empresa dele.
- A lista mostra o selo "🚚 Agregado", e na AT ele aparece como motorista ("🚚 agregado").

## 3. 🪪 CNH pelo 📲 link da viagem
No link que o motorista recebe aparece o card **"🪪 Sua CNH"**, com a situação do cadastro e o botão **📎 Enviar minha CNH** (PDF da CNH digital ou foto).
- A leitura é automática, com as mesmas travas de custo da 18zo.
- **AT com motorista definido:** a CNH precisa ser dele. Com CPF diferente, aparece "esta CNH é de outra pessoa".
- **AT sem motorista:** o sistema procura pelo CPF. Se não achar, **cria o cadastro como agregado** e liga na AT.
- Só completa o que está vazio no cadastro. Atualiza os dados da CNH, a **foto** (recortada no celular) e o **documento CNH** com o arquivo, sem duplicar.
- Gestor e operação recebem o 🔔 "fulano enviou a CNH — confira".

## Arquivos
- backend/migrations/095_colaborador_vinculo.sql (novo) · backend/services/cnhPeloLink.js (novo)
- backend/services/conformidade.js · documentos.js · execucoes.js · dossie.js · backend/routes/pessoas.js · backend/routes/atLink.js
- frontend/src/components/pessoas/TelaPessoas.jsx · frontend/src/components/programacao/EditorAT.jsx · frontend/src/TelaATPublica.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
