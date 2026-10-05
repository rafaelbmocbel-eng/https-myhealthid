import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Bluetooth, BluetoothOff, CheckCircle2, ChevronDown, Dumbbell, FileText, History, Loader2, Trash2, Search, Target, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import BarraDinamometria from '@/components/dinamometria/BarraDinamometria';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { bluetoothDisponivel, celula, type StatusCelula } from '@/lib/dinamometria/celulaBle';
import { REGIOES } from '@/lib/dinamometria/analise';
import BateriaCelula from '@/components/dinamometria/BateriaCelula';
import { cn, normalizarBusca } from '@/lib/utils';
import { lerDadosAvaliacao, salvarDadosAvaliacao, type LadoDin } from '@/lib/dinamometria/dadosAvaliacao';

interface Pac { id: string; nome: string; sobrenome: string | null; data_nascimento: string | null; sexo: string | null }

function idade(nasc: string | null) {
  if (!nasc) return null;
  const d = new Date(`${nasc.slice(0, 10)}T12:00:00`);
  if (isNaN(d.getTime())) return null;
  const h = new Date();
  let a = h.getFullYear() - d.getFullYear();
  if (h.getMonth() < d.getMonth() || (h.getMonth() === d.getMonth() && h.getDate() < d.getDate())) a--;
  return a;
}

// Entrada da dinamometria: 1) célula Bluetooth, 2) paciente (nascimento, sexo,
// peso e dados da avaliação), 3) Teste de força ou Treino.
export default function DinamometriaInicio() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const { user } = useAuth();
  const [status, setStatus] = useState<StatusCelula>(celula.status);
  const [conectando, setConectando] = useState(false);
  const [busca, setBusca] = useState('');
  const [pacId, setPacId] = useState<string | null>(sp.get('paciente'));
  const [nasc, setNasc] = useState('');
  const [sexo, setSexo] = useState('');
  const [peso, setPeso] = useState('');
  const [dataAv, setDataAv] = useState(() => new Date().toISOString().slice(0, 10));
  const [dominante, setDominante] = useState<LadoDin>('D');
  const [acometido, setAcometido] = useState<LadoDin | 'N'>('N');
  const [modalidade, setModalidade] = useState('');
  const [sintomas, setSintomas] = useState('');
  const [salvando, setSalvando] = useState(false);

  useEffect(() => celula.onStatus(setStatus), []);

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ['din-inicio-pacientes', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).from('pacientes')
        .select('id, nome, sobrenome, data_nascimento, sexo')
        .eq('terapeuta_id', user!.id).eq('ativo', true).order('nome');
      return (data || []) as Pac[];
    },
  });
  const pac = pacientes.find((p) => p.id === pacId) || null;

  // Peso mais recente (bioimpedância ou última dinamometria) e, da última dinamometria, lado dominante,
  // lado acometido e modalidade, que costumam se repetir de uma avaliação para a outra.
  const { data: anterior } = useQuery({
    queryKey: ['din-inicio-peso', pacId],
    enabled: !!pacId,
    queryFn: async () => {
      const { data } = await (supabase as any).from('exames_presenciais')
        .select('tipo, dados, data_exame').eq('paciente_id', pacId)
        .in('tipo', ['bioimpedancia', 'dinamometria']).order('data_exame', { ascending: false }).limit(10);
      let peso: number | null = null;
      let suj: { dominante?: LadoDin; acometido?: LadoDin | 'N'; modalidade?: string } | null = null;
      for (const e of (data || []) as any[]) {
        const sujeito = e.tipo === 'dinamometria' ? (e.dados?.analise?.sujeito ?? e.dados?.analise?.movimentos?.[0]?.sujeito) : null;
        if (!suj && sujeito) suj = { dominante: sujeito.dominante, acometido: sujeito.acometido, modalidade: sujeito.modalidade };
        const p = e.tipo === 'bioimpedancia' ? e.dados?.peso_kg : sujeito?.peso;
        if (peso == null && p) peso = Number(p);
      }
      return { peso, suj };
    },
  });
  const pesoSalvo = anterior?.peso ?? null;

  useEffect(() => {
    if (!pac) return;
    setNasc(pac.data_nascimento?.slice(0, 10) || '');
    const s = String(pac.sexo || '').toLowerCase();
    setSexo(s.startsWith('f') ? 'F' : s.startsWith('m') ? 'M' : '');
  }, [pac]);
  // Dados já digitados nesta sessão (ao voltar do teste para editar) valem mais que a última avaliação.
  useEffect(() => {
    if (!pacId) return;
    const salvo = lerDadosAvaliacao(pacId);
    setPeso(salvo?.peso ?? (pesoSalvo != null ? String(pesoSalvo) : ''));
    setDominante(salvo?.dominante ?? anterior?.suj?.dominante ?? 'D');
    setAcometido(salvo?.acometido ?? anterior?.suj?.acometido ?? 'N');
    setModalidade(salvo?.modalidade ?? anterior?.suj?.modalidade ?? '');
    setSintomas(salvo?.sintomas ?? '');
    setDataAv(salvo?.data ?? new Date().toISOString().slice(0, 10));
  }, [anterior, pesoSalvo, pacId]);

  const filtrados = useMemo(() => {
    const q = normalizarBusca(busca.trim());
    const lista = q ? pacientes.filter((p) => normalizarBusca(`${p.nome} ${p.sobrenome || ''}`).includes(q)) : pacientes;
    return lista.slice(0, 30);
  }, [busca, pacientes]);

  const conectar = async () => {
    setConectando(true);
    try { await celula.conectar(); toast.success('Célula conectada'); } catch (e: any) {
      if (e?.name !== 'NotFoundError') toast.error(e?.message || 'Não consegui conectar à célula.');
    } finally { setConectando(false); }
  };

  // Grava nascimento/sexo no cadastro (usados nas normas por idade e sexo).
  const seguir = async (modo: 'teste' | 'treino') => {
    if (!pac) return;
    const mudouNasc = (pac.data_nascimento?.slice(0, 10) || '') !== nasc;
    const sexoAtual = String(pac.sexo || '').toLowerCase().startsWith('f') ? 'F' : String(pac.sexo || '').toLowerCase().startsWith('m') ? 'M' : '';
    if (mudouNasc || (sexo && sexo !== sexoAtual)) {
      setSalvando(true);
      const { error } = await (supabase as any).from('pacientes').update({
        ...(mudouNasc ? { data_nascimento: nasc || null } : {}),
        ...(sexo && sexo !== sexoAtual ? { sexo: sexo === 'F' ? 'feminino' : 'masculino' } : {}),
      }).eq('id', pac.id);
      setSalvando(false);
      if (error) { toast.error('Não consegui salvar o cadastro: ' + error.message); return; }
    }
    salvarDadosAvaliacao(pac.id, {
      data: dataAv, idade: nasc ? String(idade(nasc) ?? '') : '', sexo: sexo === 'F' ? 'F' : 'M', peso: peso.replace(',', '.'),
      dominante, acometido, modalidade: modalidade.trim(), sintomas: sintomas.trim(),
    });
    const q = new URLSearchParams();
    if (peso) q.set('peso', peso.replace(',', '.'));
    if (modo === 'teste') { q.set('modo', 'teste'); navigate(`/pacientes/${pac.id}/dinamometria?${q}`); }
    else navigate(`/pacientes/${pac.id}/dinamometria/treino?${q}`);
  };

  // Histórico do paciente: testes de força (com laudo) e treinos salvos.
  const { data: historico, isLoading: carregandoHist } = useQuery({
    queryKey: ['din-inicio-historico', pacId],
    enabled: !!pacId,
    queryFn: async () => {
      const [ex, tr] = await Promise.all([
        (supabase as any).from('exames_presenciais').select('id, data_exame, created_at, dados, resumo')
          .eq('paciente_id', pacId).eq('tipo', 'dinamometria').order('data_exame', { ascending: false }).order('created_at', { ascending: false }),
        (supabase as any).from('notas_prontuario').select('id, created_at, titulo, descricao')
          .eq('paciente_id', pacId).eq('tipo', 'treino_dinamometria').order('created_at', { ascending: false }).limit(20),
      ]);
      const testes = ((ex.data || []) as any[]).map((e) => {
        const a = e.dados?.analise;
        const movs: any[] = Array.isArray(a?.movimentos) ? a.movimentos : a?.regiao ? [a] : [];
        return {
          id: e.id as string,
          data: e.data_exame as string,
          regioes: movs.map((m) => REGIOES[m.regiao]?.l || m.regiao).join(' · ') || 'Dinamometria',
          laudo: (e.dados?.resultado as string) || '',
          resumo: (e.resumo as string) || '',
        };
      });
      const treinos = ((tr.data || []) as any[]).map((n) => ({ id: n.id as string, data: n.created_at as string, titulo: n.titulo as string, descricao: n.descricao as string }));
      return { testes, treinos };
    },
  });
  const [abertoId, setAbertoId] = useState<string | null>(null);
  const qc = useQueryClient();
  const [excluir, setExcluir] = useState<null | { id: string; tipo: 'teste' | 'treino'; titulo: string }>(null);
  const [excluindo, setExcluindo] = useState(false);
  const confirmarExclusao = async () => {
    if (!excluir) return;
    setExcluindo(true);
    try {
      const tabela = excluir.tipo === 'teste' ? 'exames_presenciais' : 'notas_prontuario';
      const { data, error } = await (supabase as any).from(tabela).delete().eq('id', excluir.id).select('id');
      if (error) throw error;
      // RLS não dá erro quando não deixa apagar: confere se apagou mesmo.
      if (!data?.length) throw new Error('Só quem registrou pode excluir este item.');
      toast.success(excluir.tipo === 'teste' ? 'Exame excluído' : 'Treino excluído');
      if (abertoId === excluir.id) setAbertoId(null);
      qc.invalidateQueries({ queryKey: ['din-inicio-historico', pacId] });
      qc.invalidateQueries({ queryKey: ['exames-presenciais'] });
      setExcluir(null);
    } catch (e: any) {
      toast.error(e?.message || 'Não consegui excluir.');
    } finally {
      setExcluindo(false);
    }
  };
  const dataBR = (d: string) => new Date(d.length <= 10 ? `${d}T12:00:00` : d).toLocaleDateString('pt-BR');

  const anos = idade(nasc || null);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto px-4 md:px-6 pb-6 space-y-4">
        <BarraDinamometria titulo="Início" cliente={pac ? `${pac.nome} ${pac.sobrenome || ''}`.trim() : 'Célula, cliente e modo'} voltar="/aplicacoes" />

        {/* 1. Célula */}
        <Card className="p-4 space-y-2">
          <p className="font-semibold flex items-center gap-2"><span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">1</span> Célula de carga</p>
          {!bluetoothDisponivel() ? (
            <p className="text-sm text-muted-foreground flex items-start gap-1.5"><BluetoothOff className="h-4 w-4 mt-0.5 shrink-0" /> Bluetooth indisponível neste navegador. Use o Chrome no Android ou no computador. Sem a célula, dá para seguir e importar o Excel.</p>
          ) : status.conectado ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> {status.nome} conectada<BateriaCelula pct={celula.bateriaPct} volts={celula.bateriaVolts} className="ml-1" /></p>
              <button className="text-xs text-muted-foreground underline" onClick={() => celula.desconectar()}>Desconectar</button>
            </div>
          ) : (
            <Button className="w-full gap-2" onClick={conectar} disabled={conectando}>
              {conectando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bluetooth className="h-4 w-4" />} Parear célula ($FBLOCK)
            </Button>
          )}
          {status.conectado && celula.bateriaPct != null && celula.bateriaPct < 20 && (
            <p className="text-xs text-red-600">Bateria da célula em {celula.bateriaPct}%: carregue antes de testar. Com pouca carga a leitura pode falhar.</p>
          )}
        </Card>

        {/* 2. Paciente */}
        <Card className="p-4 space-y-3">
          <p className="font-semibold flex items-center gap-2"><span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">2</span> Paciente</p>
          {!pac ? (
            <>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-9" placeholder="Buscar paciente pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} />
              </div>
              <div className="max-h-72 overflow-y-auto divide-y rounded-lg border">
                {isLoading ? (
                  <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                ) : filtrados.length === 0 ? (
                  <p className="p-4 text-sm text-muted-foreground">Nenhum paciente encontrado.</p>
                ) : filtrados.map((p) => (
                  <button key={p.id} className="w-full text-left px-3 py-2.5 hover:bg-muted text-sm flex justify-between gap-2" onClick={() => setPacId(p.id)}>
                    <span className="font-medium truncate">{p.nome} {p.sobrenome}</span>
                    {idade(p.data_nascimento) != null && <span className="text-xs text-muted-foreground shrink-0">{idade(p.data_nascimento)} anos</span>}
                  </button>
                ))}
              </div>
              <Button asChild variant="ghost" size="sm" className="gap-1.5 text-muted-foreground">
                <Link to="/aplicacoes"><UserPlus className="h-4 w-4" /> Cadastrar paciente novo</Link>
              </Button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between gap-2">
                <p className="font-medium">{pac.nome} {pac.sobrenome}</p>
                <button className="text-xs text-muted-foreground underline" onClick={() => setPacId(null)}>Trocar</button>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Data de nascimento{anos != null ? ` · ${anos} anos` : ''}</Label>
                  <Input type="date" value={nasc} onChange={(e) => setNasc(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Sexo</Label>
                  <Select value={sexo} onValueChange={setSexo}>
                    <SelectTrigger><SelectValue placeholder="Escolha" /></SelectTrigger>
                    <SelectContent><SelectItem value="F">Feminino</SelectItem><SelectItem value="M">Masculino</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Peso (kg)</Label>
                  <Input inputMode="decimal" value={peso} onChange={(e) => setPeso(e.target.value)} placeholder="Ex.: 68,5" />
                </div>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs">Data da avaliação</Label>
                  <Input type="date" value={dataAv} onChange={(e) => setDataAv(e.target.value)} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lado dominante</Label>
                  <Select value={dominante} onValueChange={(v) => setDominante(v as LadoDin)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="D">Direito</SelectItem><SelectItem value="E">Esquerdo</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Lado acometido</Label>
                  <Select value={acometido} onValueChange={(v) => setAcometido(v as LadoDin | 'N')}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="N">Nenhum</SelectItem><SelectItem value="D">Direito</SelectItem><SelectItem value="E">Esquerdo</SelectItem></SelectContent>
                  </Select>
                </div>
                <div className="space-y-1 col-span-2 md:col-span-3">
                  <Label className="text-xs">Modalidade / atividade</Label>
                  <Input value={modalidade} onChange={(e) => setModalidade(e.target.value)} placeholder="Ex.: futebol, corrida" />
                </div>
                <div className="space-y-1 col-span-2 md:col-span-3">
                  <Label className="text-xs">Dor e sintomas relatados pelo cliente (opcional)</Label>
                  <Textarea rows={2} value={sintomas} onChange={(e) => setSintomas(e.target.value)} placeholder="Ex.: dor na frente do joelho esquerdo ao descer escadas há 2 meses; piora depois da corrida" />
                  <p className="text-[11px] text-muted-foreground">Entra na interpretação: o app cruza o local e o lado da dor com os achados de força, simetria, razão e fadiga.</p>
                </div>
              </div>
              {!nasc && <p className="text-xs text-amber-700 dark:text-amber-400">Sem data de nascimento, a comparação com a norma por idade fica de fora.</p>}
            </>
          )}
        </Card>

        {/* Histórico */}
        {pac && (
          <Card className="p-4 space-y-3">
            <p className="font-semibold flex items-center gap-2"><History className="h-4 w-4 text-primary" /> Histórico de testes</p>
            {carregandoHist ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : !historico?.testes.length && !historico?.treinos.length ? (
              <p className="text-sm text-muted-foreground">Nenhum teste ou treino ainda. O primeiro aparece aqui assim que for salvo.</p>
            ) : (
              <div className="space-y-2">
                {historico?.testes.map((t) => {
                  const aberto = abertoId === t.id;
                  return (
                    <div key={t.id} className="rounded-xl border border-border/60 overflow-hidden">
                      <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40" onClick={() => setAbertoId(aberto ? null : t.id)} aria-expanded={aberto}>
                        <span className="h-9 w-9 shrink-0 rounded-lg bg-primary/10 text-primary flex items-center justify-center"><Dumbbell className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold">Teste de força · {t.regioes}</span>
                          <span className="block text-xs text-muted-foreground">{dataBR(t.data)}</span>
                        </span>
                        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', aberto && 'rotate-180')} />
                      </button>
                      {aberto && (
                        <div className="px-3 pb-3 space-y-2 border-t border-border/50 pt-2.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Laudo</p>
                          {t.laudo ? t.laudo.split('\n\n').map((p, i) => <p key={i} className="text-sm leading-relaxed">{p}</p>) : <p className="text-sm text-muted-foreground">{t.resumo || 'Sem laudo em texto.'}</p>}
                          <div className="flex flex-wrap gap-2 justify-between">
                            <Button asChild size="sm" variant="outline" className="gap-1.5">
                              <Link to={`/pacientes/${pac.id}/dinamometria?exame=${t.id}`}><FileText className="h-3.5 w-3.5" /> Ver resultado completo e PDF</Link>
                            </Button>
                            <Button size="sm" variant="ghost" className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setExcluir({ id: t.id, tipo: 'teste', titulo: `Teste de força · ${t.regioes} (${dataBR(t.data)})` })}>
                              <Trash2 className="h-3.5 w-3.5" /> Excluir exame
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
                {historico?.treinos.map((t) => {
                  const aberto = abertoId === t.id;
                  return (
                    <div key={t.id} className="rounded-xl border border-border/60 overflow-hidden">
                      <button className="w-full flex items-center gap-3 p-3 text-left hover:bg-muted/40" onClick={() => setAbertoId(aberto ? null : t.id)} aria-expanded={aberto}>
                        <span className="h-9 w-9 shrink-0 rounded-lg bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center justify-center"><Target className="h-4 w-4" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm font-semibold truncate">{t.titulo}</span>
                          <span className="block text-xs text-muted-foreground">{dataBR(t.data)}</span>
                        </span>
                        <ChevronDown className={cn('h-4 w-4 text-muted-foreground transition-transform', aberto && 'rotate-180')} />
                      </button>
                      {aberto && (
                        <div className="px-3 pb-3 border-t border-border/50 pt-2.5 space-y-1">
                          {(t.descricao || '').split('\n').map((l, i) => <p key={i} className="text-sm leading-relaxed">{l}</p>)}
                          <div className="flex justify-end pt-1">
                            <Button size="sm" variant="ghost" className="gap-1.5 text-red-600 hover:text-red-700 hover:bg-red-50" onClick={() => setExcluir({ id: t.id, tipo: 'treino', titulo: `${t.titulo} (${dataBR(t.data)})` })}>
                              <Trash2 className="h-3.5 w-3.5" /> Excluir treino
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* 3. Modo */}
        <Card className={cn('p-4 space-y-3', !pac && 'opacity-60')}>
          <p className="font-semibold flex items-center gap-2"><span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">3</span> Como usar</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              disabled={!pac || salvando}
              onClick={() => seguir('teste')}
              className="rounded-xl border-2 border-border p-4 text-left space-y-1 hover:border-primary hover:bg-primary/5 transition-colors disabled:pointer-events-none"
            >
              <p className="font-semibold flex items-center gap-2"><Dumbbell className="h-4 w-4 text-primary" /> Teste de força</p>
              <p className="text-xs text-muted-foreground">Avaliação por articulação: os dois lados, agonista e antagonista, simetria, razão, fadiga e laudo.</p>
            </button>
            <button
              disabled={!pac || salvando}
              onClick={() => seguir('treino')}
              className="rounded-xl border-2 border-border p-4 text-left space-y-1 hover:border-primary hover:bg-primary/5 transition-colors disabled:pointer-events-none"
            >
              <p className="font-semibold flex items-center gap-2"><Target className="h-4 w-4 text-primary" /> Treino</p>
              <p className="text-xs text-muted-foreground">Isometria com alvo (% do último teste ou kg), tempo no alvo e registro da sessão no prontuário.</p>
            </button>
          </div>
          {salvando && <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Salvando cadastro…</p>}
        </Card>
      </div>
      <AlertDialog open={!!excluir} onOpenChange={(v) => { if (!v && !excluindo) setExcluir(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {excluir?.tipo === 'teste' ? 'este exame' : 'este treino'}?</AlertDialogTitle>
            <AlertDialogDescription>
              {excluir?.titulo}. {excluir?.tipo === 'teste' ? 'O laudo, as curvas e os resultados deste teste serão apagados e ele sai da evolução do paciente.' : 'O registro deste treino sai do prontuário.'} Não dá para desfazer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={excluindo}>Cancelar</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" disabled={excluindo} onClick={(e) => { e.preventDefault(); void confirmarExclusao(); }}>
              {excluindo && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
}
