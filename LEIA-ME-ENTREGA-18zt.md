# Entrega 18zt — 📚 biblioteca de modelos ISO 9001

Sem migração (usa as tabelas 092/093).

## Como usar
1. 📁 Documentos → 📘 Gestão → **📚 Modelos ISO 9001**: dá para buscar e usar **👁 Visualizar** e **Importar**.
2. O modelo entra como **rascunho Rev. 00**, já com o nome, o CNPJ e a cidade/UF da empresa. Os trechos entre **[colchetes]** a empresa completa.
3. Para ajustar o texto, use Editar. Para publicar, use 👁 Ver → **✓ Aprovar e publicar** (admin, gestor ou qualidade). Daí em diante, as alterações seguem o fluxo de revisão (18zs).
4. Se o código já estiver em uso, o modelo é importado como `XX-Q`.

## Os 9 modelos (para a sua revisão de auditor)
- POL-01 Política da Qualidade
- MQ-01 Manual da Qualidade
- PQ-01 Controle de informação documentada (7.5)
- PQ-02 Não conformidade e ação corretiva (10.2)
- PQ-03 Controle de saída não conforme (8.7)
- PQ-04 Propriedade do cliente (8.5.3)
- PQ-05 Competência, treinamento e conscientização (7.2/7.3)
- PQ-06 Aquisição e avaliação de fornecedores (8.4)
- PQ-07 Inspeção, manutenção e controle de equipamentos (7.1.3/7.1.5/8.5.1)

Cada procedimento descreve **o fluxo que o QuotaFlow executa** e cita a tela onde o registro nasce.

Os textos estão em `backend/services/modelosGestao/iso9001.js`. Me mande as correções que eu atualizo; não precisa de migração.

## Arquivos
- backend/services/modelosGestao/iso9001.js (novo) · backend/services/documentosGestao.js · backend/routes/pessoas.js
- frontend/src/components/pessoas/DocumentosGestao.jsx
- backend/verificar-entrega.js · readme.md

⚠️ Suba **todos** os arquivos, inclusive `backend/verificar-entrega.js`.
