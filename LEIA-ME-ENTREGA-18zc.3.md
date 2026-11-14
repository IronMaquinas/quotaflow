# Entrega 18zc.3 — contrato não é emitido sem ninguém para aceitar

**Base:** origin/main 84f433e. Sem migration. Suba todos os arquivos, inclusive o `backend/verificar-entrega.js`, e reinicie o backend.

## Antes de testar
Volte o CA-2026-0001 para "em elaboração" (no Supabase):
```sql
UPDATE public.locacao_contratos
   SET emitido_texto = NULL, emitido_tabela = NULL, emitido_em = NULL, emitido_por_nome = NULL,
       emitido_hash = NULL, emitido_versao = 0,
       aceite_nome = NULL, aceite_usuario_id = NULL, aceite_em = NULL, aceite_png = NULL, aceite_hash = NULL
 WHERE numero = 'CA-2026-0001';
```

## Testar
1. **Nova ordem:** abra o CA-2026-0001. **👤 Acessos do locatário** agora aparece antes de **📄 Contrato (documento)**.
2. **Emitir sem acesso:** use **📄 Emitir**. Abre o modal "Quem vai aceitar este contrato?".
3. **Criar o acesso pelo modal:**
   - escolha **👤 Criar o acesso do cliente** e crie o acesso para marcony@betaeyes.com;
   - use **📄 Emitir** de novo. A mensagem diz que o e-mail de aceite saiu;
   - confira a caixa de entrada.
4. **Assinar:** entre com esse acesso e assine. O contrato passa para ✅ Em andamento.
5. **(Opcional) Aceite em papel:** num contrato sem acesso, escolha **✍ O cliente vai assinar no papel**. O contrato é emitido sem e-mail.
