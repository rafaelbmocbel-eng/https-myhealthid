import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Bluetooth, BluetoothOff, CheckCircle2, Dumbbell, Loader2, Search, Target, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import AppLayout from '@/components/AppLayout';
import { PageHeader } from '@/components/ui/page-header';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { bluetoothDisponivel, celula, type StatusCelula } from '@/lib/dinamometria/celulaBle';
import { cn } from '@/lib/utils';

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
// peso), 3) Teste de força ou Treino.
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

  // Peso mais recente: bioimpedância ou última dinamometria.
  const { data: pesoSalvo } = useQuery({
    queryKey: ['din-inicio-peso', pacId],
    enabled: !!pacId,
    queryFn: async () => {
      const { data } = await (supabase as any).from('exames_presenciais')
        .select('tipo, dados, data_exame').eq('paciente_id', pacId)
        .in('tipo', ['bioimpedancia', 'dinamometria']).order('data_exame', { ascending: false }).limit(10);
      for (const e of (data || []) as any[]) {
        const p = e.tipo === 'bioimpedancia' ? e.dados?.peso_kg : (e.dados?.analise?.sujeito?.peso ?? e.dados?.analise?.movimentos?.[0]?.sujeito?.peso);
        if (p) return Number(p);
      }
      return null;
    },
  });

  useEffect(() => {
    if (!pac) return;
    setNasc(pac.data_nascimento?.slice(0, 10) || '');
    const s = String(pac.sexo || '').toLowerCase();
    setSexo(s.startsWith('f') ? 'F' : s.startsWith('m') ? 'M' : '');
  }, [pac]);
  useEffect(() => { if (pesoSalvo != null) setPeso(String(pesoSalvo)); else setPeso(''); }, [pesoSalvo, pacId]);

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    const lista = q ? pacientes.filter((p) => `${p.nome} ${p.sobrenome || ''}`.toLowerCase().includes(q)) : pacientes;
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
    const q = new URLSearchParams();
    if (peso) q.set('peso', peso.replace(',', '.'));
    if (modo === 'teste') { q.set('modo', 'teste'); navigate(`/pacientes/${pac.id}/dinamometria?${q}`); }
    else navigate(`/pacientes/${pac.id}/dinamometria/treino?${q}`);
  };

  const anos = idade(nasc || null);

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto p-4 md:p-6 space-y-4">
        <PageHeader title="Dinamometria" subtitle="Célula de carga, paciente e modo" eyebrow="Aplicações" icon={<Dumbbell className="icon-md" />} back="/aplicacoes" />

        {/* 1. Célula */}
        <Card className="p-4 space-y-2">
          <p className="font-semibold flex items-center gap-2"><span className="h-6 w-6 rounded-full bg-primary text-primary-foreground text-xs flex items-center justify-center">1</span> Célula de carga</p>
          {!bluetoothDisponivel() ? (
            <p className="text-sm text-muted-foreground flex items-start gap-1.5"><BluetoothOff className="h-4 w-4 mt-0.5 shrink-0" /> Bluetooth indisponível neste navegador. Use o Chrome no Android ou no computador. Sem a célula, dá para seguir e importar o Excel.</p>
          ) : status.conectado ? (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1.5"><CheckCircle2 className="h-4 w-4" /> {status.nome} conectada{celula.bateria != null && <span className="text-xs text-muted-foreground font-normal">· bateria {celula.bateria}/3</span>}</p>
              <button className="text-xs text-muted-foreground underline" onClick={() => celula.desconectar()}>Desconectar</button>
            </div>
          ) : (
            <Button className="w-full gap-2" onClick={conectar} disabled={conectando}>
              {conectando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Bluetooth className="h-4 w-4" />} Parear célula ($FBLOCK)
            </Button>
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
              {!nasc && <p className="text-xs text-amber-700 dark:text-amber-400">Sem data de nascimento, a comparação com a norma por idade fica de fora.</p>}
            </>
          )}
        </Card>

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
    </AppLayout>
  );
}
