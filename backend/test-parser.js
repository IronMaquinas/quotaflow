// test-parser.js
// Teste isolado do NfeXmlParser — XML de exemplo embutido, sem
// precisar de arquivo externo nem banco. Roda com:
//   node test-parser.js
// Apaga depois do teste.

const { parseNfeXml } = require('./services/NfeXmlParser');

// XML de exemplo (NF-e modelo 55, layout 4.00). Estrutura idêntica
// ao que sai da SEFAZ — só os dados são fictícios.
const XML_EXEMPLO = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe" versao="4.00">
  <NFe xmlns="http://www.portalfiscal.inf.br/nfe">
    <infNFe Id="NFe35240912345678000199550010000012341000012345" versao="4.00">
      <ide>
        <cUF>35</cUF>
        <natOp>Venda de mercadoria</natOp>
        <mod>55</mod>
        <serie>1</serie>
        <nNF>1234</nNF>
        <dhEmi>2026-09-24T10:30:00-03:00</dhEmi>
        <tpNF>1</tpNF>
      </ide>
      <emit>
        <CNPJ>12345678000199</CNPJ>
        <xNome>FORNECEDOR TESTE LTDA</xNome>
        <IE>1234567890</IE>
      </emit>
      <dest>
        <CNPJ>98765432000188</CNPJ>
        <xNome>TRANSPORTADORA TESTE XYZ</xNome>
      </dest>
      <det nItem="1">
        <prod>
          <cProd>NSK-6202</cProd>
          <cEAN>7891234567890</cEAN>
          <xProd>Rolamento NSK 6202</xProd>
          <NCM>84821010</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>2.0000</qCom>
          <vUnCom>150.0000</vUnCom>
          <vProd>300.00</vProd>
          <cEANTrib>7891234567890</cEANTrib>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <CST>00</CST>
              <pICMS>18.00</pICMS>
              <vICMS>54.00</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>
      <det nItem="2">
        <prod>
          <cProd>SKF-6203</cProd>
          <xProd>Rolamento SKF 6203</xProd>
          <NCM>84821010</NCM>
          <CFOP>5102</CFOP>
          <uCom>UN</uCom>
          <qCom>1.0000</qCom>
          <vUnCom>120.0000</vUnCom>
          <vProd>120.00</vProd>
        </prod>
        <imposto>
          <ICMS>
            <ICMS00>
              <CST>00</CST>
              <pICMS>18.00</pICMS>
              <vICMS>21.60</vICMS>
            </ICMS00>
          </ICMS>
        </imposto>
      </det>
      <total>
        <ICMSTot>
          <vProd>420.00</vProd>
          <vFrete>15.00</vFrete>
          <vICMS>75.60</vICMS>
          <vNF>435.00</vNF>
        </ICMSTot>
      </total>
      <transp>
        <vol>
          <qVol>1</qVol>
          <pesoL>5.500</pesoL>
          <pesoB>6.200</pesoB>
        </vol>
      </transp>
    </infNFe>
  </NFe>
</nfeProc>`;

try {
  const r = parseNfeXml(XML_EXEMPLO);

  console.log('\n✅ PARSE OK\n');
  console.log('📋 IDENTIFICAÇÃO');
  console.log('   Chave:    ', r.chave_acesso, `(${r.chave_acesso.length} dígitos)`);
  console.log('   Número:   ', r.numero_nf, '/ Série', r.serie, '/ Modelo', r.modelo);
  console.log('   Layout:   ', r.versao_layout);
  console.log('   Emissão:  ', r.data_emissao);
  console.log('   Natureza: ', r.natureza_operacao);

  console.log('\n🏢 PARTES');
  console.log('   Emitente: ', r.nome_emitente, '— CNPJ', r.cnpj_emitente);
  console.log('   Dest.:    ', r.nome_destinatario, '— CNPJ', r.cnpj_destinatario);

  console.log('\n💰 TOTAIS');
  console.log('   Produtos: ', r.valor_produtos);
  console.log('   Frete:    ', r.valor_frete);
  console.log('   ICMS:     ', r.valor_icms);
  console.log('   Total NF: ', r.valor_total);

  console.log('\n📦 TRANSPORTE');
  console.log('   Volumes:  ', r.qtd_volumes);
  console.log('   Peso L.:  ', r.peso_liquido);
  console.log('   Peso B.:  ', r.peso_bruto);

  console.log('\n🔩 ITENS (' + r.itens.length + ')');
  r.itens.forEach(it => {
    console.log(`   [${it.numero}] ${it.descricao}`);
    console.log(`        Cód: ${it.codigo} | NCM: ${it.ncm} | CFOP: ${it.cfop}`);
    console.log(`        Qtd: ${it.quantidade} ${it.unidade} × R$ ${it.valor_unitario} = R$ ${it.valor_total}`);
    console.log(`        ICMS: CST ${it.icms.cst} | Alíq ${it.icms.aliquota}% | R$ ${it.icms.valor}`);
  });

  console.log('\n⚠️  WARNINGS:', r.warnings.length === 0 ? 'nenhum' : '');
  r.warnings.forEach(w => console.log('   -', w));

  console.log('\n📄 XML cru preservado:', r.xml_raw.length, 'caracteres');
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

} catch (err) {
  console.error('\n❌ ERRO NO PARSE:', err.message, '\n');
  process.exit(1);
}