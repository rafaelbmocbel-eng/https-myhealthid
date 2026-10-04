import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ExternalLink, FlaskConical, Settings2, ShieldQuestion, X } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { ACC, estiloAcento } from '@/lib/dosagem/acentos';
import { AVISO_VALIDACAO } from '@/lib/dosagem/protocolos';
import { REFERENCIAS_DOSAGEM, urlPubmed } from '@/lib/dosagem/referencias';
import { MODALIDADES, type Modalidade } from '@/lib/dosagem/tipos';
import { equipamentosDoTipo, useEquipamentosFisio } from '@/hooks/useEquipamentosFisio';
import { usePacienteDosagem, usePacientesLista } from '@/hooks/useProntuarioSeguranca';
import SeletorModalidade from '@/components/dosagem/SeletorModalidade';
import DosagemLaser from '@/components/dosagem/DosagemLaser';
import DosagemUltrassom from '@/components/dosagem/DosagemUltrassom';
import DosagemOndasChoque from '@/components/dosagem/DosagemOndasChoque';
import DosagemTens from '@/components/dosagem/DosagemTens';
import DosagemNmes from '@/components/dosagem/DosagemNmes';
import DosagemRussa from '@/components/dosagem/DosagemRussa';
import DosagemInterferencial from '@/components/dosagem/DosagemInterferencial';
import EquipamentosDialog from '@/components/dosagem/EquipamentosDialog';

// Aplicação de dosagem de recursos: laser, ultrassom, ondas de choque, TENS,
// FES/NMES, russa e interferencial. Cada número vem com a fonte (PubMed); o
// paciente é opcional — com ele o app procura contraindicações no prontuário e
// registra a dose aplicada.
export default function Dosagem() {
  const { user } = useAuth();
  const [sp, setSp] = useSearchParams();
  const [aparelhosAberto, setAparelhosAberto] = useState(false);

  const modalidade = (MODALIDADES.find((m) => m.id === sp.get('m'))?.id ?? 'laser') as Modalidade;
  const pacienteId = sp.get('paciente') || '';

  const { data: lista = [] } = usePacientesLista(user?.id);
  const { data: paciente } = usePacienteDosagem(pacienteId || null);
  const { data: equip } = useEquipamentosFisio();

  const mudar = (chave: string, valor: string) => {
    const novo = new URLSearchParams(sp);
    if (valor) novo.set(chave, valor); else novo.delete(chave);
    setSp(novo, { replace: true });
  };

  const comAparelho = {
    paciente,
    equipamentos: equipamentosDoTipo(equip?.itens, modalidade),
    equipamentosDisponiveis: !!equip?.disponivel,
    onGerenciarAparelhos: () => setAparelhosAberto(true),
  };

  return (
    <AppLayout>
      <div style={estiloAcento(modalidade)} className="relative isolate">
        <div aria-hidden className={cn('pointer-events-none absolute inset-x-0 top-0 -z-10 h-72 transition-colors duration-500', ACC.halo)} />
        <div className="container max-w-6xl space-y-5 py-6">
          <PageHeader
            back="/aplicacoes"
            title="Dosagem de recursos"
            subtitle="Eletrotermofototerapia: calcule a dose, compare com a literatura e registre no prontuário."
            icon={<FlaskConical className="icon-md" />}
            actions={equip?.disponivel ? (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAparelhosAberto(true)}>
                <Settings2 className="h-4 w-4" /> Meus aparelhos
              </Button>
            ) : undefined}
          />

          <div className="flex flex-col gap-3 rounded-2xl border border-border/60 bg-card/90 p-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] backdrop-blur sm:flex-row sm:items-center sm:p-3.5">
            <div className="flex shrink-0 items-center gap-2.5 text-sm font-medium">
              <span className={cn('flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold', ACC.suaveForte, ACC.texto)}>
                {paciente ? paciente.nome.charAt(0) : '—'}
              </span>
              <span>Paciente <span className="text-xs font-normal text-muted-foreground">(opcional)</span></span>
            </div>
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <div className="min-w-0 flex-1">
                <PacienteSelect pacientes={lista} value={pacienteId} onValueChange={(v) => mudar('paciente', v)} placeholder="Escolher para triagem e registro…" />
              </div>
              {pacienteId && <Button variant="ghost" size="icon" aria-label="Tirar paciente" onClick={() => mudar('paciente', '')}><X className="h-4 w-4" /></Button>}
            </div>
            {paciente && (
              <p className="shrink-0 text-xs text-muted-foreground">
                {paciente.idade !== null ? `${paciente.idade} anos` : 'idade não informada'}{paciente.sexo ? ` · ${paciente.sexo}` : ''}
              </p>
            )}
          </div>

          <SeletorModalidade valor={modalidade} onChange={(m) => mudar('m', m === 'laser' ? '' : m)} />

          <p className="flex items-center gap-1.5 px-1 text-[11px] text-muted-foreground">
            <ShieldQuestion className="h-3.5 w-3.5 shrink-0" /> Parâmetros em validação clínica: orientam, não substituem o seu raciocínio nem o manual do aparelho.
          </p>

          <div key={modalidade} className="animate-in fade-in slide-in-from-bottom-1 duration-300 motion-reduce:animate-none">
            {modalidade === 'laser' && <DosagemLaser {...comAparelho} />}
            {modalidade === 'ultrassom' && <DosagemUltrassom {...comAparelho} />}
            {modalidade === 'ondas_choque' && <DosagemOndasChoque {...comAparelho} />}
            {modalidade === 'tens' && <DosagemTens paciente={paciente} />}
            {modalidade === 'nmes' && <DosagemNmes paciente={paciente} />}
            {modalidade === 'russa' && <DosagemRussa paciente={paciente} />}
            {modalidade === 'interferencial' && <DosagemInterferencial paciente={paciente} />}
          </div>

          <details className="group rounded-2xl border border-border/60 bg-card p-4">
            <summary className="cursor-pointer text-sm font-semibold">Fontes e como ler as faixas ({REFERENCIAS_DOSAGEM.length} artigos)</summary>
            <div className="mt-3 space-y-3">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {AVISO_VALIDACAO} Só entram números lidos no resumo ou no texto do artigo; quando a pesquisa não encontrou a dose, a tela diz isso. Nas correntes elétricas, a literatura não sustenta “receita por diagnóstico”: o app mostra o que cada revisão concluiu, inclusive os resultados negativos. A lista de contraindicações marcada como “clássica” ainda não tem artigo associado.
              </p>
              <ol className="grid gap-2 sm:grid-cols-2">
                {REFERENCIAS_DOSAGEM.map((r, i) => (
                  <li key={r.id} className="space-y-1 rounded-xl border border-border/50 p-3 text-xs">
                    <p className="leading-relaxed"><span className="mr-1 font-semibold">{i + 1}.</span>{r.autores} ({r.ano}). {r.revista}.</p>
                    <p className="text-muted-foreground">{r.uso}</p>
                    <div className="flex flex-wrap gap-3">
                      <a className="inline-flex items-center gap-1 text-primary underline" href={urlPubmed(r.pmid)} target="_blank" rel="noreferrer">PubMed {r.pmid} <ExternalLink className="h-3 w-3" /></a>
                      {r.doi && <a className="inline-flex items-center gap-1 text-primary underline" href={`https://doi.org/${r.doi}`} target="_blank" rel="noreferrer">doi:{r.doi} <ExternalLink className="h-3 w-3" /></a>}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </details>
        </div>
      </div>

      {aparelhosAberto && equip?.disponivel && <EquipamentosDialog itens={equip.itens} onClose={() => setAparelhosAberto(false)} />}
    </AppLayout>
  );
}
