# Entrega Q1 — 🧪 Revisão + correções nos fluxos centrais
Base: T1.2 (e17f55d)

DEPLOY: backend (Render) + frontend (Netlify) — 1 deploy de cada. Sem migration.

1. Copie os arquivos do zip por cima; `cd backend && node verificar-entrega.js`.
2. git add -A && commit && push.
3. Teste rápido:
   - RC de 10 un → cotação: o portal do fornecedor mostra 10 e a OC sai com 10.
   - Aprovar uma OC: o e-mail ao fornecedor lista só os itens dela.
   - Recebimento avulso com fornecedor: aparece o fornecedor na movimentação.
   - Pedir retirada maior que o saldo: aviso "Saldo insuficiente".
   - OS → aplicar material com nº de série → 📷 abre a câmera.
