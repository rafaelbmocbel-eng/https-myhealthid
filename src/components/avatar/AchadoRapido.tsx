import { useEffect, useMemo, useState } from 'react';
import { Check, Sparkles, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { REGIONS } from '@/components/presencial/Body3DAvatar';
import { VISCERAL_REGIONS } from '@/utils/anatomia/regioesViscerais';
import { encontrarSintomasEmTexto } from '@/utils/anatomia/mapeamentoSintomas';
import { detectarCondicaoSistemica, REGIAO_SISTEMICA } from '@/components/avatar/CondicoesSistemicasCard';
import { useSaveEventoAnatomico, type StatusEvento } from '@/hooks/useEventosAnatomicos';
import { cn } from '@/lib/utils';

const SISTEMAS: [string, string][] = [
  ['musculoesqueletico', 'Musculoesquelético'], ['nervoso', 'Nervoso'], ['circulatorio', 'Circulatório / Cardíaco'],
  ['respiratorio', 'Respiratório'], ['digestorio', 'Digestório'], ['endocrino', 'Endócrino / Metabólico'],
  ['urinario', 'Urinário'], ['reprodutor', 'Reprodutor'], ['tegumentar', 'Pele'], ['linfatico', 'Linfático / Sangue'], ['sensorial', 'Sensorial'],
];
const NOME_SISTEMA = Object.fromEntries(SISTEMAS);
const TODAS_REGIOES = [...REGIONS.map((r) => ({ id: r.id, label: r.label, sistemas: ['musculoesqueletico'] })), ...VISCERAL_REGIONS.map((r) => ({ id: r.id, label: r.label, sistemas: r.sistemas }))];
const nomeRegiao = (id: string) => (id === REGIAO_SISTEMICA ? 'Sem local (condição do corpo todo)' : TODAS_REGIOES.find((r) => r.id === id)?.label || id);

type Tipo = 'cirurgia' | 'fratura' | 'dor' | 'condicao';
const NOME_TIPO: Record<Tipo, string> = { cirurgia: 'Cirurgia / procedimento', fratura: 'Fratura / lesão', dor: 'Dor / sintoma', condicao: 'Condição / doença' };

interface Sugestao { regiao: string; sistema: string; termo: string }

const sem = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

// Lê o achado escrito e sugere sistema, local, tipo, status e data.
function analisar(texto: string) {
  const t = sem(texto);
  const sugestoes: Sugestao[] = [];
  const sist = detectarCondicaoSistemica(texto);
  for (const c of encontrarSintomasEmTexto(texto)) {
    if (!sugestoes.some((s) => s.regiao === c.regiao_id)) sugestoes.push({ regiao: c.regiao_id, sistema: c.sistema, termo: c.termo });
  }
  if (sist) {
    const sistemaApp = sist.sistema === 'cardiovascular' ? 'circulatorio' : sist.sistema;
    // Condição do corpo todo (diabetes, hipertensão…) vem primeiro, sem local.
    sugestoes.unshift({ regiao: REGIAO_SISTEMICA, sistema: sistemaApp, termo: sist.label });
  }
  const tipo: Tipo = /cirurg|operad|opero|troca de|protese|implant|artroplast|reconstru|marcapasso|marca-passo|stent|angioplast|safena|revasculariz|transplant|ablac/.test(t) ? 'cirurgia'
    : /fratur|ruptur|lesao|entorse|luxac/.test(t) ? 'fratura'
    : /\bdor\b|\bdoi\b|doendo|incomod|formigament|queimac/.test(t) ? 'dor' : 'condicao';
  const status: StatusEvento = tipo === 'dor' ? 'ativo' : 'cronico';
  const ano = /\b(19[5-9]\d|20[0-4]\d)\b/.exec(texto)?.[1];
  return { sugestoes, tipo, status, ano: ano || null, cid: sist?.cid || null };
}

// Campo único embaixo do avatar: o profissional escreve o achado, o app procura
// sistema, estrutura/local, lado, tipo e data; o profissional confere e salva.
export default function AchadoRapido({ pacienteId }: { pacienteId: string }) {
  const saveMut = useSaveEventoAnatomico();
  const [texto, setTexto] = useState('');
  const [textoAnalisado, setTextoAnalisado] = useState('');
  const [escolhida, setEscolhida] = useState(0);
  const [sistema, setSistema] = useState('');
  const [regiao, setRegiao] = useState('');
  const [tipo, setTipo] = useState<Tipo>('condicao');
  const [status, setStatus] = useState<StatusEvento>('cronico');

  // Analisa pouco depois de parar de digitar.
  useEffect(() => {
    const id = setTimeout(() => setTextoAnalisado(texto.trim()), 450);
    return () => clearTimeout(id);
  }, [texto]);

  const analise = useMemo(() => (textoAnalisado.length >= 3 ? analisar(textoAnalisado) : null), [textoAnalisado]);

  // Nova análise: aplica a 1ª sugestão (o profissional pode trocar).
  useEffect(() => {
    if (!analise) return;
    setEscolhida(0);
    const s = analise.sugestoes[0];
    setSistema(s?.sistema || '');
    setRegiao(s?.regiao || '');
    setTipo(analise.tipo);
    setStatus(analise.status);
  }, [analise]);

  const escolher = (i: number) => {
    const s = analise?.sugestoes[i];
    if (!s) return;
    setEscolhida(i); setSistema(s.sistema); setRegiao(s.regiao);
  };

  const regioesDoSistema = useMemo(() => TODAS_REGIOES.filter((r) => !sistema || r.sistemas.includes(sistema)), [sistema]);

  const salvar = () => {
    if (!texto.trim() || !sistema || !regiao) return;
    saveMut.mutate({
      paciente_id: pacienteId,
      regiao_id: regiao,
      sistema: sistema as any,
      tipo_achado: texto.trim(),
      tipo_diagnostico: 'achado_clinico' as any,
      origem: 'exame_clinico' as any,
      status,
      ...(analise?.ano ? { data_inicio: `${analise.ano}-01-01` } : {}),
      ...(regiao === REGIAO_SISTEMICA && analise?.cid ? { diagnostico_cid: analise.cid } : {}),
      metadata: { natureza: regiao === REGIAO_SISTEMICA ? 'sistemica' : 'condicao', tipo, origem_manual: true, revisado_profissional: true, achado_rapido: true },
    } as any, {
      onSuccess: () => { setTexto(''); setTextoAnalisado(''); },
    });
  };

  const pronto = !!texto.trim() && !!sistema && !!regiao;

  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/[0.03] p-3 space-y-2.5">
      <div className="flex items-center gap-2">
        <span className="h-7 w-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Wand2 className="h-4 w-4" /></span>
        <div>
          <p className="text-sm font-semibold leading-tight">Registrar achado</p>
          <p className="text-[11px] text-muted-foreground">Escreva do seu jeito — o app encontra o sistema e o local, e você confirma.</p>
        </div>
      </div>
      <Textarea
        rows={2}
        value={texto}
        onChange={(e) => setTexto(e.target.value)}
        placeholder="Ex.: cirurgia de troca de válvula aórtica em 2022 · dor no joelho direito ao subir escada · diabetes tipo 2"
        className="text-sm bg-background"
      />

      {analise && (
        <div className="space-y-2.5">
          {analise.sugestoes.length > 0 ? (
            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1"><Sparkles className="h-3 w-3" /> O app identificou — toque para escolher</p>
              <div className="flex flex-wrap gap-1.5">
                {analise.sugestoes.map((s, i) => (
                  <button key={`${s.regiao}-${i}`} type="button" onClick={() => escolher(i)}
                    className={cn('rounded-lg border px-2.5 py-1.5 text-left text-xs transition',
                      escolhida === i && regiao === s.regiao ? 'border-primary bg-primary/10 ring-1 ring-primary/30' : 'border-border bg-background hover:bg-muted')}>
                    <span className="block font-semibold">{nomeRegiao(s.regiao)}</span>
                    <span className="block text-[10px] text-muted-foreground">{NOME_SISTEMA[s.sistema] || s.sistema} · "{s.termo}"</span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-amber-700 dark:text-amber-400">Não reconheci o local. Escolha o sistema e o local abaixo.</p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-[11px]">Sistema</Label>
              <Select value={sistema || undefined} onValueChange={(v) => { setSistema(v); if (!TODAS_REGIOES.some((r) => r.id === regiao && r.sistemas.includes(v)) && regiao !== REGIAO_SISTEMICA) setRegiao(''); }}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent>{SISTEMAS.map(([k, l]) => <SelectItem key={k} value={k} className="text-xs">{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Local / estrutura</Label>
              <Select value={regiao || undefined} onValueChange={setRegiao}>
                <SelectTrigger className="h-9 text-xs"><SelectValue placeholder="Escolha" /></SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value={REGIAO_SISTEMICA} className="text-xs font-semibold">Sem local (condição do corpo todo)</SelectItem>
                  {regioesDoSistema.map((r) => <SelectItem key={r.id} value={r.id} className="text-xs">{r.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as Tipo)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{(Object.keys(NOME_TIPO) as Tipo[]).map((k) => <SelectItem key={k} value={k} className="text-xs">{NOME_TIPO[k]}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-[11px]">Situação{analise.ano ? ` · desde ${analise.ano}` : ''}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as StatusEvento)}>
                <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo" className="text-xs">Ativo agora</SelectItem>
                  <SelectItem value="em_tratamento" className="text-xs">Em tratamento</SelectItem>
                  <SelectItem value="cronico" className="text-xs">Histórico / crônico</SelectItem>
                  <SelectItem value="resolvido" className="text-xs">Resolvido</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button className="w-full gap-1.5" disabled={!pronto || saveMut.isPending} onClick={salvar}>
            <Check className="h-4 w-4" /> Confirmar e marcar no avatar
            {pronto && <span className="font-normal opacity-80 truncate">· {nomeRegiao(regiao)}</span>}
          </Button>
        </div>
      )}
    </div>
  );
}
