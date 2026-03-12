import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Award, Activity, Watch, BookOpen, Users,
  Search, Filter, TrendingUp, AlertCircle, ChevronRight,
  Share2, Send, Copy, Check
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { sharePortalInvite } from '@/utils/whatsapp';
import { useToast } from '@/hooks/use-toast';

interface PacienteHub {
  id: string;
  nome: string;
  sobrenome: string;
  email?: string | null;
  telefone?: string | null;
  portal_token?: string | null;
  ativo: boolean;
}

export default function ProfessionalHub() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleInvite = async (paciente?: PacienteHub) => {
    const registerUrl = `${window.location.origin}/paciente/cadastro`;
    if (paciente) {
      await sharePortalInvite(paciente.nome, paciente.telefone || '', registerUrl);
      toast({ title: "Convite enviado!", description: `O link foi preparado para ${paciente.nome}.` });
    } else {
      const message = `Olá! 👋 Conheça o novo Portal do Paciente MyID: ${registerUrl}`;
      window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
    }
  };

  const copyPortalLink = (paciente: PacienteHub) => {
    if (!paciente.portal_token) {
      toast({ title: "Token indisponível", description: "Este paciente não possui um token de portal.", variant: "destructive" });
      return;
    }
    const url = `${window.location.origin}/portal/${paciente.portal_token}`;
    navigator.clipboard.writeText(url);
    setCopiedId(paciente.id);
    toast({ title: "Link copiado!", description: `Link do portal de ${paciente.nome} copiado.` });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const copyGeneralLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/paciente/cadastro`);
    toast({ title: "Link copiado!", description: "Link de cadastro copiado." });
  };

  const { data: pacientes = [], isLoading } = useQuery({
    queryKey: ['hub-pacientes', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pacientes')
        .select('id, nome, sobrenome, email, telefone, portal_token, ativo')
        .eq('terapeuta_id', user!.id)
        .eq('ativo', true)
        .order('nome');
      if (error) throw error;
      return (data || []) as PacienteHub[];
    },
    enabled: !!user,
  });

  const filtered = pacientes.filter(p => {
    const term = searchTerm.toLowerCase();
    if (!term) return true;
    return (
      p.nome?.toLowerCase().includes(term) ||
      p.sobrenome?.toLowerCase().includes(term) ||
      p.email?.toLowerCase().includes(term) ||
      p.telefone?.includes(term)
    );
  });

  return (
    <AppLayout>
      <div className="container py-8 max-w-6xl">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-black text-slate-900 flex items-center gap-2">
              <Award className="h-7 w-7 text-indigo-600" /> Central de Engajamento MyID
            </h1>
            <p className="text-muted-foreground text-sm">Monitore o progresso e hábitos dos seus pacientes.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Nome, e-mail ou telefone..."
                className="pl-9 bg-white border-slate-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Button variant="outline" className="bg-white border-slate-200 hidden sm:flex text-[10px] font-black uppercase tracking-widest h-10 px-4" onClick={copyGeneralLink}>
              <Share2 className="h-3.5 w-3.5 mr-2" /> Copiar Link
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white text-[10px] font-black uppercase tracking-widest h-10 px-4" onClick={() => handleInvite()}>
              <Send className="h-3.5 w-3.5 mr-2" /> Convidar Portal
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="border-none shadow-sm bg-indigo-50"><CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0"><Users className="h-5 w-5 text-white" /></div>
            <div><p className="text-[10px] font-black uppercase text-indigo-400">Total Pacientes</p><p className="text-xl font-black text-indigo-900">{pacientes.length}</p></div>
          </CardContent></Card>
          <Card className="border-none shadow-sm bg-emerald-50"><CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0"><Activity className="h-5 w-5 text-white" /></div>
            <div><p className="text-[10px] font-black uppercase text-emerald-400">Atividade (24h)</p><p className="text-xl font-black text-emerald-900">—</p></div>
          </CardContent></Card>
          <Card className="border-none shadow-sm bg-cyan-50"><CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-cyan-600 flex items-center justify-center shrink-0"><Watch className="h-5 w-5 text-white" /></div>
            <div><p className="text-[10px] font-black uppercase text-cyan-400">Devices</p><p className="text-xl font-black text-cyan-900">—</p></div>
          </CardContent></Card>
          <Card className="border-none shadow-sm bg-amber-50"><CardContent className="p-4 flex items-center gap-4">
            <div className="h-10 w-10 rounded-xl bg-amber-600 flex items-center justify-center shrink-0"><TrendingUp className="h-5 w-5 text-white" /></div>
            <div><p className="text-[10px] font-black uppercase text-amber-400">Pontos (30d)</p><p className="text-xl font-black text-amber-900">—</p></div>
          </CardContent></Card>
        </div>

        {/* Patient List */}
        <h3 className="font-black text-slate-800 flex items-center gap-2 uppercase tracking-widest text-[11px] mb-4">
          <TrendingUp className="h-4 w-4 text-indigo-600" /> Ranking e Status
        </h3>

        {isLoading ? (
          <div className="flex justify-center p-12"><Activity className="h-8 w-8 animate-spin text-indigo-600" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 border-2 border-dashed rounded-2xl"><p className="text-muted-foreground">Nenhum paciente encontrado.</p></div>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map(p => (
              <div
                key={p.id}
                className="clinical-card group hover:border-indigo-400 transition-all cursor-pointer !p-4 flex flex-col md:flex-row md:items-center gap-4"
                onClick={() => navigate(`/pacientes/${p.id}`)}
              >
                {/* Avatar + Name */}
                <div className="flex items-center gap-4 min-w-[200px]">
                  <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-black text-lg">
                    {p.nome?.[0]}{p.sobrenome?.[0]}
                  </div>
                  <div>
                    <h4 className="font-black text-slate-900 leading-none">{p.nome} {p.sobrenome}</h4>
                    <p className="text-[10px] font-bold text-slate-400 mt-1">{p.email || p.telefone || '—'}</p>
                  </div>
                </div>

                {/* Status Icons */}
                <div className="flex-1" />
                <div className="flex items-center gap-4 md:w-36 justify-around">
                  <div className="flex flex-col items-center">
                    <BookOpen className={cn("h-4 w-4 mb-1", "text-slate-300")} />
                    <span className="text-[8px] font-bold uppercase text-slate-400">Diário</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <Watch className={cn("h-4 w-4 mb-1", "text-slate-300")} />
                    <span className="text-[8px] font-bold uppercase text-slate-400">Device</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <AlertCircle className={cn("h-4 w-4 mb-1", "text-slate-300")} />
                    <span className="text-[8px] font-bold uppercase text-slate-400">Alerta</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="shrink-0 flex items-center gap-1">
                  <Button
                    variant="ghost" size="icon"
                    className="hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                    title="Copiar link do portal"
                    onClick={(e) => { e.stopPropagation(); copyPortalLink(p); }}
                  >
                    {copiedId === p.id ? <Check className="h-4 w-4 text-emerald-500" /> : <Copy className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost" size="icon"
                    className="hover:bg-indigo-50 text-slate-400 hover:text-indigo-600"
                    title="Enviar convite WhatsApp"
                    onClick={(e) => { e.stopPropagation(); handleInvite(p); }}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="group-hover:bg-indigo-50 text-indigo-600">
                    <ChevronRight className="h-5 w-5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
