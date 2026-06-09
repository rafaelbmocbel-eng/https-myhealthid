// Gerador de XML TISS 4.01.00 (envio de lote de guias)
// Padrão ANS — schema oficial: http://www.ans.gov.br/padroes/tiss/schemas

interface TissPrestador {
  registro_ans?: string | null;
  cnes?: string | null;
  cnpj_prestador?: string | null;
  cpf_prestador?: string | null;
  nome_prestador?: string | null;
  codigo_prestador_operadora?: string | null;
}

interface TissProcedimento {
  sequencia: number;
  data_execucao: string;
  hora_inicial?: string | null;
  hora_final?: string | null;
  codigo_tabela: string;
  codigo_procedimento: string;
  descricao: string;
  quantidade: number;
  via_acesso?: string | null;
  tecnica_utilizada?: string | null;
  reducao_acrescimo?: number | null;
  valor_unitario: number;
  valor_total: number;
}

interface TissGuia {
  tipo_guia: string;
  numero_guia_prestador?: string | null;
  numero_guia_operadora?: string | null;
  senha_autorizacao?: string | null;
  data_autorizacao?: string | null;
  data_validade_senha?: string | null;
  numero_carteira?: string | null;
  nome_beneficiario?: string | null;
  data_atendimento: string;
  tipo_consulta?: string | null;
  indicacao_acidente?: string | null;
  carater_atendimento?: string | null;
  observacoes?: string | null;
  valor_total: number;
  procedimentos: TissProcedimento[];
}

interface TissLote {
  numero_lote: string;
  competencia: string; // YYYY-MM
  data_envio?: string | null;
  registro_ans_operadora?: string | null;
  versao?: string;
  prestador: TissPrestador;
  guias: TissGuia[];
}

const esc = (v: any): string => {
  if (v === null || v === undefined) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
};

const fmtMoney = (v: number) => Number(v || 0).toFixed(2);

function guiaConsultaXml(g: TissGuia, idx: number): string {
  return `
    <ans:guiaConsulta>
      <ans:cabecalhoConsulta>
        <ans:registroANS>${esc(g.numero_guia_operadora || '')}</ans:registroANS>
        <ans:numeroGuiaPrestador>${esc(g.numero_guia_prestador || `G${idx + 1}`)}</ans:numeroGuiaPrestador>
      </ans:cabecalhoConsulta>
      <ans:dadosAutorizacao>
        <ans:numeroGuiaOperadora>${esc(g.numero_guia_operadora || '')}</ans:numeroGuiaOperadora>
        <ans:dataAutorizacao>${esc(g.data_autorizacao || '')}</ans:dataAutorizacao>
        <ans:senhaAutorizacao>${esc(g.senha_autorizacao || '')}</ans:senhaAutorizacao>
        <ans:dataValidadeSenha>${esc(g.data_validade_senha || '')}</ans:dataValidadeSenha>
      </ans:dadosAutorizacao>
      <ans:dadosBeneficiario>
        <ans:numeroCarteira>${esc(g.numero_carteira || '')}</ans:numeroCarteira>
        <ans:nomeBeneficiario>${esc(g.nome_beneficiario || '')}</ans:nomeBeneficiario>
      </ans:dadosBeneficiario>
      <ans:dadosAtendimento>
        <ans:dataAtendimento>${esc(g.data_atendimento)}</ans:dataAtendimento>
        <ans:tipoConsulta>${esc(g.tipo_consulta || '1')}</ans:tipoConsulta>
        <ans:indicacaoAcidente>${esc(g.indicacao_acidente || '9')}</ans:indicacaoAcidente>
        <ans:procedimento>
          ${g.procedimentos[0] ? `
          <ans:codigoTabela>${esc(g.procedimentos[0].codigo_tabela)}</ans:codigoTabela>
          <ans:codigoProcedimento>${esc(g.procedimentos[0].codigo_procedimento)}</ans:codigoProcedimento>
          <ans:descricaoProcedimento>${esc(g.procedimentos[0].descricao)}</ans:descricaoProcedimento>
          <ans:valorProcedimento>${fmtMoney(g.procedimentos[0].valor_total)}</ans:valorProcedimento>` : ''}
        </ans:procedimento>
      </ans:dadosAtendimento>
      <ans:observacao>${esc(g.observacoes || '')}</ans:observacao>
    </ans:guiaConsulta>`;
}

function guiaSpSadtXml(g: TissGuia, idx: number): string {
  const procs = g.procedimentos.map((p) => `
        <ans:procedimentoExecutado>
          <ans:sequencialItem>${p.sequencia}</ans:sequencialItem>
          <ans:dataExecucao>${esc(p.data_execucao)}</ans:dataExecucao>
          ${p.hora_inicial ? `<ans:horaInicial>${esc(p.hora_inicial)}</ans:horaInicial>` : ''}
          ${p.hora_final ? `<ans:horaFinal>${esc(p.hora_final)}</ans:horaFinal>` : ''}
          <ans:procedimento>
            <ans:codigoTabela>${esc(p.codigo_tabela)}</ans:codigoTabela>
            <ans:codigoProcedimento>${esc(p.codigo_procedimento)}</ans:codigoProcedimento>
            <ans:descricaoProcedimento>${esc(p.descricao)}</ans:descricaoProcedimento>
          </ans:procedimento>
          <ans:quantidadeExecutada>${p.quantidade}</ans:quantidadeExecutada>
          ${p.via_acesso ? `<ans:viaAcesso>${esc(p.via_acesso)}</ans:viaAcesso>` : ''}
          ${p.tecnica_utilizada ? `<ans:tecnicaUtilizada>${esc(p.tecnica_utilizada)}</ans:tecnicaUtilizada>` : ''}
          <ans:reducaoAcrescimo>${(p.reducao_acrescimo ?? 1).toFixed(2)}</ans:reducaoAcrescimo>
          <ans:valorUnitario>${fmtMoney(p.valor_unitario)}</ans:valorUnitario>
          <ans:valorTotal>${fmtMoney(p.valor_total)}</ans:valorTotal>
        </ans:procedimentoExecutado>`).join('');

  return `
    <ans:guiaSP-SADT>
      <ans:cabecalhoGuia>
        <ans:registroANS>${esc(g.numero_guia_operadora || '')}</ans:registroANS>
        <ans:numeroGuiaPrestador>${esc(g.numero_guia_prestador || `G${idx + 1}`)}</ans:numeroGuiaPrestador>
      </ans:cabecalhoGuia>
      <ans:dadosAutorizacao>
        <ans:numeroGuiaOperadora>${esc(g.numero_guia_operadora || '')}</ans:numeroGuiaOperadora>
        <ans:dataAutorizacao>${esc(g.data_autorizacao || '')}</ans:dataAutorizacao>
        <ans:senhaAutorizacao>${esc(g.senha_autorizacao || '')}</ans:senhaAutorizacao>
        <ans:dataValidadeSenha>${esc(g.data_validade_senha || '')}</ans:dataValidadeSenha>
      </ans:dadosAutorizacao>
      <ans:dadosBeneficiario>
        <ans:numeroCarteira>${esc(g.numero_carteira || '')}</ans:numeroCarteira>
        <ans:nomeBeneficiario>${esc(g.nome_beneficiario || '')}</ans:nomeBeneficiario>
      </ans:dadosBeneficiario>
      <ans:dadosSolicitacao>
        <ans:dataSolicitacao>${esc(g.data_atendimento)}</ans:dataSolicitacao>
        <ans:caraterAtendimento>${esc(g.carater_atendimento || '1')}</ans:caraterAtendimento>
        <ans:indicacaoClinica>${esc(g.observacoes || '')}</ans:indicacaoClinica>
      </ans:dadosSolicitacao>
      <ans:procedimentosExecutados>${procs}
      </ans:procedimentosExecutados>
      <ans:valorTotal>
        <ans:valorProcedimentos>${fmtMoney(g.valor_total)}</ans:valorProcedimentos>
        <ans:valorTotalGeral>${fmtMoney(g.valor_total)}</ans:valorTotalGeral>
      </ans:valorTotal>
    </ans:guiaSP-SADT>`;
}

export function buildTissLoteXml(lote: TissLote): string {
  const versao = lote.versao || '4.01.00';
  const guiasXml = lote.guias.map((g, i) =>
    g.tipo_guia === 'sp_sadt' ? guiaSpSadtXml(g, i) : guiaConsultaXml(g, i)
  ).join('');

  const total = lote.guias.reduce((s, g) => s + Number(g.valor_total || 0), 0);
  const qtd = lote.guias.length;

  return `<?xml version="1.0" encoding="ISO-8859-1"?>
<ans:mensagemTISS xmlns:ans="http://www.ans.gov.br/padroes/tiss/schemas"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
  xsi:schemaLocation="http://www.ans.gov.br/padroes/tiss/schemas tissV${versao.replace(/\./g, '_')}.xsd">
  <ans:cabecalho>
    <ans:identificacaoTransacao>
      <ans:tipoTransacao>ENVIO_LOTE_GUIAS</ans:tipoTransacao>
      <ans:sequencialTransacao>${esc(lote.numero_lote)}</ans:sequencialTransacao>
      <ans:dataRegistroTransacao>${esc(lote.data_envio || new Date().toISOString().slice(0, 10))}</ans:dataRegistroTransacao>
      <ans:horaRegistroTransacao>${new Date().toTimeString().slice(0, 8)}</ans:horaRegistroTransacao>
    </ans:identificacaoTransacao>
    <ans:origem>
      <ans:identificacaoPrestador>
        ${lote.prestador.cnpj_prestador ? `<ans:CNPJ>${esc(lote.prestador.cnpj_prestador)}</ans:CNPJ>` : ''}
        ${lote.prestador.cpf_prestador ? `<ans:CPF>${esc(lote.prestador.cpf_prestador)}</ans:CPF>` : ''}
        ${lote.prestador.codigo_prestador_operadora ? `<ans:codigoPrestadorNaOperadora>${esc(lote.prestador.codigo_prestador_operadora)}</ans:codigoPrestadorNaOperadora>` : ''}
      </ans:identificacaoPrestador>
    </ans:origem>
    <ans:destino>
      <ans:registroANS>${esc(lote.registro_ans_operadora || '')}</ans:registroANS>
    </ans:destino>
    <ans:Padrao>${esc(versao)}</ans:Padrao>
  </ans:cabecalho>
  <ans:prestadorParaOperadora>
    <ans:loteGuias>
      <ans:numeroLote>${esc(lote.numero_lote)}</ans:numeroLote>
      <ans:guiasTISS>${guiasXml}
      </ans:guiasTISS>
    </ans:loteGuias>
  </ans:prestadorParaOperadora>
  <ans:epilogo>
    <ans:totalGuias>${qtd}</ans:totalGuias>
    <ans:valorTotalLote>${fmtMoney(total)}</ans:valorTotalLote>
  </ans:epilogo>
</ans:mensagemTISS>`;
}

export function downloadXml(filename: string, content: string) {
  const blob = new Blob([content], { type: 'application/xml;charset=ISO-8859-1' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
