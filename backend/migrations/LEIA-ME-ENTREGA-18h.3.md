# Entrega 18h.3 — 📄 dossiê A4 · 📧 e-mail com contatos · contador de ocorrências

**Sem migration.** Base: 18h.2 (commit 2f3bfab).

## Arquivos
- `backend/services/ocorrencias.js` — e-mail com contatos (📞 Ligar / 💬 WhatsApp), cliente (CNPJ, endereço, obra), equipamento, 📍 mapa; marca foto antiga
- `frontend/src/utils/gerarDossieOcorrencia.js` — dossiê em A4 no padrão dos outros documentos
- `frontend/src/components/ocorrencias/RegistrarOcorrencia.jsx` — envia o aviso de foto antiga / da galeria
- `frontend/src/components/ocorrencias/PainelOcorrencias.jsx` — avisa a tela quando a lista muda (contador)
- `frontend/src/components/contratos/TelaContratos.jsx` — contador na aba ⚠️ Ocorrências
- `backend/verificar-entrega.js`, `readme.md`

## Como testar
1. Registre uma ocorrência como cliente com uma foto da galeria → o e-mail traz quem registrou e o contato do contrato com **📞 Ligar / 💬 WhatsApp**, CNPJ, endereço, equipamento e **📍 Ver no mapa**. (O telefone de quem registrou vem do cadastro do usuário; o do contato vem do contrato/cliente.)
2. 📑 Contratos → a aba **⚠️ Ocorrências** mostra o número em aberto (vermelho com ⛔ se houver parado).
3. Abra a ocorrência → **📄 Dossiê**: página A4 com logo; a foto da galeria aparece com "⚠ foto antiga / da galeria".
4. `cd backend && node verificar-entrega.js`
