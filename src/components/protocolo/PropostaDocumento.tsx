import { cn } from '@/lib/utils';

// Documento da Proposta de Tratamento — MESMO visual da prévia da tela, agora
// como componente único usado tanto na pré-visualização quanto na geração do
// PDF (capturado por html2canvas). Cada bloco de topo tem data-block, que o
// gerador usa pra quebrar páginas SEM cortar cards no meio.

function brl(n: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(n || 0);
}

const FASE_BORDER = ['border-l-rose-500', 'border-l-amber-500', 'border-l-emerald-500'];

export interface PropostaDocumentoData {
  pacienteNome: string;
  profissionalNome?: string;
  clinicaNome?: string;
  clinicaLogoDataUrl?: string; // já em data URL (sem CORS) pra o html2canvas
  queixa?: string;
  classificacao?: string;
  resumoClinico?: string;
  prognostico?: string;
  fases: Array<{ numero: number; titulo: string; semanas?: string; objetivo?: string; focos: string[] }>;
  manut: {
    mensagemPaciente?: string;
    frequenciaReavaliacao?: string;
    rotinaMinima: string[];
    habitosChave: string[];
    sinaisParaRetornar: string[];
  };
  numeroSessoes: number;
  duracao: string;
  frequencia: string;
  valorSessao: number;
  desconto: number;
  formaPagamento: string;
  total: number;
  mensagem: string;
  telefone?: string;
  validadeDias: number;
}

export default function PropostaDocumento(props: PropostaDocumentoData) {
  const {
    pacienteNome, profissionalNome, clinicaNome, clinicaLogoDataUrl,
    queixa, classificacao, resumoClinico, prognostico, fases, manut,
    numeroSessoes, duracao, frequencia, valorSessao, desconto, formaPagamento, total,
    mensagem, telefone, validadeDias,
  } = props;

  const temManut = !!(manut.mensagemPaciente || manut.frequenciaReavaliacao ||
    manut.rotinaMinima.length || manut.habitosChave.length || manut.sinaisParaRetornar.length);

  return (
    <div className="bg-white text-slate-900" style={{ width: '100%' }}>
      {/* Capa */}
      <div data-block className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 text-center">
        {clinicaLogoDataUrl ? (
          // background-image p/ o preview; no PDF a logo é sobreposta nítida (data-logo)
          <div
            data-logo
            className="mx-auto mb-3 bg-white rounded-lg"
            style={{
              width: 168,
              height: 60,
              backgroundImage: `url(${clinicaLogoDataUrl})`,
              backgroundSize: 'contain',
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
            }}
          />
        ) : null}
        <p className="text-[10px] uppercase tracking-[0.3em] text-amber-300 mb-2">
          {clinicaNome ? clinicaNome : 'Proposta de Tratamento'}
        </p>
        {clinicaNome && <p className="text-[9px] uppercase tracking-[0.2em] text-slate-400 mb-2">Proposta de Tratamento</p>}
        <p className="text-2xl font-semibold tracking-tight">{pacienteNome}</p>
        {profissionalNome && <p className="text-xs text-slate-300 mt-3">Preparado por {profissionalNome}</p>}
      </div>

      {/* Diagnóstico */}
      <div data-block className="px-4 pt-3 pb-2 space-y-2">
        {(queixa || classificacao) && (
          <div className="border-l-2 border-amber-500 pl-3">
            <p className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold">Seu quadro</p>
            <p className="text-sm font-semibold text-slate-900">{queixa || '—'}</p>
            {classificacao && <p className="text-xs text-slate-600">{classificacao}</p>}
          </div>
        )}
        {resumoClinico && <p className="text-xs text-slate-700 leading-relaxed">{resumoClinico}</p>}
        {prognostico && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-md p-2">
            <p className="text-[10px] uppercase tracking-wider text-emerald-700 font-semibold">Prognóstico</p>
            <p className="text-xs text-emerald-900">{prognostico}</p>
          </div>
        )}
      </div>

      {/* Fases */}
      <div className="px-4 pb-1.5">
        <p className="text-[11px] uppercase tracking-wider font-bold text-slate-900 mb-1.5">Seu plano em {fases.length} fases</p>
      </div>
      <div className="px-4 pb-2 space-y-1.5">
        {fases.map((f, i) => (
          <div key={i} data-block className={cn('border border-slate-200 rounded-md p-2.5 border-l-4', FASE_BORDER[i] || 'border-l-slate-400')}>
            <div className="flex items-baseline gap-2">
              <span className={cn('text-2xl font-bold leading-none', i === 0 ? 'text-rose-500' : i === 1 ? 'text-amber-500' : 'text-emerald-500')}>
                {f.numero}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-900">{f.titulo}</p>
                {f.semanas && <p className="text-[10px] text-slate-500">Semanas {f.semanas}</p>}
              </div>
            </div>
            {f.objetivo && <p className="text-xs italic text-slate-700 mt-1">"{f.objetivo}"</p>}
            {f.focos.filter(Boolean).length > 0 && (
              <ul className="mt-1.5 space-y-0.5">
                {f.focos.filter(Boolean).map((foco, j) => (
                  <li key={j} className="text-xs text-slate-700 flex gap-1.5">
                    <span className={cn(i === 0 ? 'text-rose-500' : i === 1 ? 'text-amber-500' : 'text-emerald-500')}>•</span>
                    {foco}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>

      {/* Manutenção */}
      {temManut && (
        <div data-block className="px-4 pb-3">
          <p className="text-[11px] uppercase tracking-wider font-bold text-slate-900 mb-1.5">Plano de Manutenção (pós-alta)</p>
          <div className="border-l-4 border-emerald-500 bg-emerald-50 rounded-md p-2.5 space-y-1.5">
            {manut.mensagemPaciente && <p className="text-xs italic text-slate-700">"{manut.mensagemPaciente}"</p>}
            {manut.frequenciaReavaliacao && (
              <p className="text-xs text-slate-700"><strong>Reavaliação:</strong> {manut.frequenciaReavaliacao}</p>
            )}
            {[
              { k: 'rotinaMinima', label: 'Rotina mínima' },
              { k: 'habitosChave', label: 'Hábitos-chave' },
              { k: 'sinaisParaRetornar', label: 'Voltar ao profissional se' },
            ].map(({ k, label }) => {
              const items = (manut[k as keyof typeof manut] as string[]).filter(Boolean);
              if (items.length === 0) return null;
              return (
                <div key={k}>
                  <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-800">{label}</p>
                  <ul className="space-y-0.5">
                    {items.map((it, idx) => (
                      <li key={idx} className="text-xs text-slate-700 flex gap-1.5"><span className="text-emerald-600">•</span>{it}</li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Investimento */}
      <div data-block className="px-4 pb-3">
        <p className="text-[11px] uppercase tracking-wider font-bold text-slate-900 mb-1.5">Seu investimento</p>
        <div className="bg-slate-900 text-white rounded-md p-3.5 text-center">
          <p className="text-[10px] uppercase tracking-wider text-amber-300">{numeroSessoes} sessões · {duracao}</p>
          {desconto > 0 && <p className="text-xs text-slate-400 line-through mt-1">{brl(numeroSessoes * valorSessao)}</p>}
          <p className="text-3xl font-bold mt-1">{brl(total)}</p>
          <p className="text-[11px] text-slate-300 mt-1">{brl(total / Math.max(1, numeroSessoes))} por sessão · {frequencia}</p>
        </div>
        <p className="text-[11px] text-slate-600 mt-2 text-center">{formaPagamento}</p>
      </div>

      {/* CTA */}
      <div data-block className="bg-amber-50 border-t border-amber-200 p-4 text-center">
        <p className="text-xs text-slate-800 leading-relaxed">{mensagem}</p>
        {telefone && (
          <div className="mt-3 inline-block bg-emerald-500 text-white text-xs font-bold px-4 py-2 rounded-full">
            WhatsApp: {telefone}
          </div>
        )}
        <p className="text-[10px] text-slate-500 mt-3">Proposta válida por {validadeDias} dias</p>
        <p className="text-[9px] text-slate-400 mt-2">{clinicaNome ? `${clinicaNome} · ` : ''}por My Health ID</p>
      </div>
    </div>
  );
}
