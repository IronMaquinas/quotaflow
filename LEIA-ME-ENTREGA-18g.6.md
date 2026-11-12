# Entrega 18g.6 — 📋 Ficha do CT-e à vista + correções na ficha

**Base:** origin/main c02e998 (18g.4). **Esta entrega já inclui a 18g.5** (telefone do "Meu perfil"): se ainda não copiou a 18g.5, copie só esta. Sem migration.

Copie os arquivos e rode `cd backend && node verificar-entrega.js`. Tem que dar "✓ Todos".

## Testar
1. **✅ Plano → cartão da TSK-TR-2026-0002**, sem abrir a tarefa:
   - aparece a barra "2/4 · próximo: CT-e";
   - ao lado, o botão **📋 Ficha do CT-e**, em azul porque o próximo documento é o CT-e;
   - clicar na barra abre os documentos.
2. **Ficha do CT-e**, comparando com o seu print:
   - Valor total da prestação: agora vem o valor do trecho do PV-2026-0001.
   - UF de início/fim: MG / ES, e municípios Belo Horizonte / Vila Velha.
   - CFOP e alíquota sugeridos: 6353 e 7%.
   - Chave da NF-e: aparece a da NF-e nº 1234.
   - **Destinatário e valor da carga** só aparecem se o **XML** da NF-e tiver sido lido. Se continuarem "falta", anexe o XML da NF-e no passo 1.
3. **"Meu perfil":** o telefone salvo aparece.
