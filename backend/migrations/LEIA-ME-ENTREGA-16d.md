# Entrega 16d — rastreabilidade (BID · item · PV), nº de série e agenda mês/ano

Copie por cima. **Sem SQL** (tudo nos campos que já existem). Reinicie o backend. `cd backend && node verificar-entrega.js` → 199 ✓.

## O que testar
1. **BID** (📈 Comercial): a tabela de itens ganhou a coluna **#** e **Nº de série**. Salve: os itens recebem número (1, 2, 3…). Tire um item e inclua outro: o novo pega o próximo número, sem reaproveitar. ⧉ Duplicar cria um item novo, sem número e sem série. O PDF e o link do cliente mostram o #.
2. **Pedido**: os itens aparecem como "#1 · …" (o pedido antigo é numerado na ordem).
3. **Programação → modal**: "📦 Item 1 · …" com o campo **Nº de série** (preenchido do BID, editável). Programe: a série vai para o card, a ficha, o PDF da AT e o link do motorista.
4. **Referência**: a ficha, o PDF e o link do motorista mostram "🔗 BID-… · item N · PV-…".
5. **🚛 ATs → busca**: digite "BID-2026-0001 item 2", "série SN…", uma placa ou o motorista.
6. **🗓 Agenda da frota**: botões **Semana / Mês / Ano**. No ano, clique num mês para abrir o calendário.
