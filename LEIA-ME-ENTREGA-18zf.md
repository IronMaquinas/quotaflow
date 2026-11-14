# Entrega 18zf — 📏⏱ cobrança híbrida por equipamento: mensal, diária ou por hora (inclui a 18ze.1)

**Base:** origin/main 19eaaed (18ze). Esta entrega **inclui a 18ze.1** (clique na foto não fecha o visualizador): use este zip no lugar dela. **Sem migration.** Suba todos os arquivos, inclusive o novo `backend/services/cobrancaLocacao.js` e o `backend/verificar-entrega.js`, e reinicie o backend.

## Testar
1. **Configurar a cobrança:** abra um contrato CL e vá em 📄 Contrato (documento) → **Cobrança e valor por equipamento**. Escolha, por exemplo:
   - um equipamento **mensal** (R$/mês);
   - um equipamento por **diária** (R$/dia);
   - um equipamento **por hora** (R$/h, com mínimo de 100 h/mês).

   Salve. A ficha passa a mostrar "R$ …/dia" e "R$ …/hora (mín. 100 h)".
2. **Prévia do documento:** a tabela mostra a coluna **Valor** com a forma de cobrança de cada equipamento.
3. **(Opcional) Franquia:** preencha **Franquia (h/mês)** e **Hora excedente** nas condições. Os equipamentos mensais passam a cobrar as horas acima da franquia.
4. **Medição do ciclo:**
   - a coluna **Base do cálculo** mostra a conta de cada linha;
   - em equipamento por hora (ou com franquia) **sem leitura de horímetro**, a linha fica laranja e a medição não envia;
   - digite as horas no campo da linha: o valor é recalculado e ela pode ser enviada.
5. **📈 Faturamento previsto:** conta a diária (dias × R$/dia) e o mínimo de horas.
