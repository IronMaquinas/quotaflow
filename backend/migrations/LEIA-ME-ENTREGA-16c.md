# Entrega 16c — Mesa em cards, rascunho, kit e 📲 link do motorista

Inclui a 16b.3, que ainda não estava no GitHub.

## Como aplicar
1. Copie os arquivos por cima.
2. No Supabase, rode **`backend/migrations/056_at_rascunho_link_motorista.sql`** (pode rodar 2×).
3. Reinicie o backend. `cd backend && node verificar-entrega.js` → **199 ✓**.
4. Para o link do motorista funcionar no celular, o `FRONTEND_URL` do backend precisa ser o endereço público do app (em localhost o link só abre no seu computador).

## O que testar
1. **🚛 Programação → 🧩 Mesa**: cada item é um card. Clique em "＋ Programar".
2. **Modal**: rota e data já preenchidas. Escolha motorista, cavalo e implementos (cada campo tem nome).
   - O **kit do motorista** aparece sozinho: CNH do motorista e CRLV de cada equipamento, puxados do cadastro (👷 Pessoas → Documentos / documentos do equipamento). Clique para ver o arquivo.
   - CNH/CRLV **vencido na data da viagem** trava: como gestor/admin, aparece a justificativa; como operação, salve como rascunho e peça ao gestor.
   - Não cadastrado: fica vermelho, mas só avisa.
   - Mesmo cavalo ou motorista em outra AT no mesmo horário: "⚠ Conflito — Equipamento: CV-01 já está na AT-…" e o campo fica destacado; trocar o equipamento faz o aviso sumir.
3. **💾 Salvar rascunho** → o card fica "rascunho"; reabra de outro computador e continue. **Cancelar** sai sem gravar.
4. Em uma programação nova, clique em **＋ NF-e** e escolha o arquivo: o rascunho é salvo sozinho para guardar o arquivo.
5. Nos cards e na ficha, **todo chip faz algo**: verde abre no visualizador (PDF, imagem ou XML); ＋ anexa.
6. Ficha da AT → **📲 Link do motorista**: Copiar / WhatsApp / "ver como o motorista". No celular: rota com botão do Google Maps, documentos para abrir e salvar, conjunto e carga, sem valores. Quando o motorista abre, aparece ✓✓.
