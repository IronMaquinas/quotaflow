# Entrega 18zc.5 — ficha do contrato: uma linha de botões e atalhos só quando há algo

**Base:** origin/main 46e9a7a (18zc.4). Sem migration. Suba todos os arquivos, inclusive o `backend/verificar-entrega.js`, e reinicie o backend.

## Testar
1. **CA-2026-0001:**
   - embaixo fica uma linha só: Salvar · Prévia · Emitir │ Encerrar contrato · Fechar;
   - o "Editar" de baixo sumiu; fica o ✎ Editar condições de cima;
   - sem medições nem ocorrências, os atalhos não aparecem.
2. **CL-2026-0002:**
   - embaixo aparece ✎ Editar contrato;
   - os atalhos mostram a contagem: "📏 N medição(ões)", "⚠️ N ocorrência(s)", "🔍 Inspeções · N atrasada(s)";
   - cada atalho leva à tela certa.
3. **Celular:** abra no celular. A linha de botões quebra sem cortar nada.
