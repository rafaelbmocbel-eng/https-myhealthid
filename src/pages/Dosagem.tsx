import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Activity, ExternalLink, FlaskConical, Settings2, UserRound, Waves, X, Zap } from 'lucide-react';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Button } from '@/components/ui/button';
import { PacienteSelect } from '@/components/paciente/PacienteSelect';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { AVISO_VALIDACAO } from '@/lib/dosagem/protocolos';
import { REFERENCIAS_DOSAGEM, urlPubmed } from '@/lib/dosagem/referencias';
import { MODALIDADES, type Modalidade } from '@/lib/dosagem/tipos';
import { equipamentosDoTipo, useEquipamentosFisio } from '@/hooks/useEquipamentosFisio';
import { usePacienteDosagem, usePacientesLista } from '@/hooks/useProntuarioSeguranca';
import DosagemLaser from '@/components/dosagem/DosagemLaser';
import DosagemUltrassom from '@/components/dosagem/DosagemUltrassom';
import DosagemOndasChoque from '@/components/dosagem/DosagemOndasChoque';
import EquipamentosDialog from '@/components/dosagem/EquipamentosDialog';

const ICONES: Record<Modalidade, typeof Zap> = { laser: Zap, ultrassom: Waves, ondas_choque: Activity };

// Aplicação de dosagem de eletrotermofototerapia: laser, ultrassom e ondas de
// choque. Cada número vem com a fonte (PubMed); o paciente é opcional — com ele
// o app procura contraindicações no prontuário e registra a dose aplicada.
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

  const props = {
    paciente,
    equipamentos: equipamentosDoTipo(equip?.itens, modalidade),
    equipamentosDisponiveis: !!equip?.disponivel,
    onGerenciarAparelhos: () => setAparelhosAberto(true),
  };

  return (
    <AppLayout>
      <div className="container max-w-6xl py-6 space-y-5">
        <PageHeader
          back="/aplicacoes"
          title="Dosagem de recursos"
          subtitle="Eletrotermofototerapia — laser, ultrassom e ondas de choque: calcule a dose, compare com a literatura e registre no prontuário."
          icon={<FlaskConical className="icon-md" />}
          actions={equip?.disponivel ? (
            <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setAparelhosAberto(true)}>
              <Settings2 className="h-4 w-4" /> Meus aparelhos
            </Button>
          ) : undefined}
        />

        <div className="rounded-2xl border border-border/60 bg-card p-3 sm:p-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex items-center gap-2 text-sm font-medium shrink-0"><UserRound className="h-4 w-4 text-muted-foreground" /> Paciente <span className="text-xs font-normal text-muted-foreground">(opcional)</span></div>
          <div className="flex-1 min-w-0 flex items-center gap-2">
            <div className="flex-1 min-w-0">
              <PacienteSelect pacientes={lista} value={pacienteId} onValueChange={(v) => mudar('paciente', v)} placeholder="Escolher para triagem e registro…" />
            </div>
            {pacienteId && (
              <Button variant="ghost" size="icon" aria-label="Tirar paciente" onClick={() => mudar('paciente', '')}><X className="h-4 w-4" /></Button>
            )}
          </div>
          {paciente && (
            <p className="text-xs text-muted-foreground shrink-0">
              {paciente.idade !== null ? `${paciente.idade} anos` : 'idade não informada'}{paciente.sexo ? ` · ${paciente.sexo}` : ''}
            </p>
          )}
        </div>

        <div role="tablist" aria-label="Modalidade" className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted/60 p-1.5">
          {MODALIDADES.map((m) => {
            const Icone = ICONES[m.id];
            const ativo = m.id === modalidade;
            return (
              <button key={m.id} role="tab" aria-selected={ativo} type="button" onClick={() => mudar('m', m.id === 'laser' ? '' : m.id)}
                className={cn('flex items-center justify-center gap-2 rounded-xl px-2 py-2.5 text-sm font-semibold transition-all',
                  ativo ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                <Icone className="h-4 w-4 shrink-0" /> <span className="truncate">{m.curto}</span>
              </button>
            );
          })}
        </div>

        {modalidade === 'laser' && <DosagemLaser key="laser" {...props} />}
        {modalidade === 'ultrassom' && <DosagemUltrassom key="us" {...props} />}
        {modalidade === 'ondas_choque' && <DosagemOndasChoque key="eswt" {...props} />}

        <details className="rounded-2xl border border-border/60 bg-card p-4">
          <summary className="cursor-pointer text-sm font-semibold">Fontes e como ler as faixas ({REFERENCIAS_DOSAGEM.length} artigos)</summary>
          <div className="mt-3 space-y-3">
            <p className="text-xs leading-relaxed text-muted-foreground">
              {AVISO_VALIDACAO} Só entram números lidos no resumo ou no texto do artigo; quando a pesquisa não encontrou a dose, a tela diz “sem dose confirmada”. A lista de contraindicações marcada como “clássica” ainda não tem artigo associado.
            </p>
            <ol className="space-y-2">
              {REFERENCIAS_DOSAGEM.map((r, i) => (
                <li key={r.id} className="rounded-xl border border-border/50 p-3 text-xs space-y-1">
                  <p className="leading-relaxed"><span className="font-semibold mr-1">{i + 1}.</span>{r.autores} ({r.ano}). {r.revista}.</p>
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

      {aparelhosAberto && equip?.disponivel && <EquipamentosDialog itens={equip.itens} onClose={() => setAparelhosAberto(false)} />}
    </AppLayout>
  );
}
