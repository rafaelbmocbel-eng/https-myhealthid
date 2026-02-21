import { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { usePacientes } from '@/hooks/usePacientes';
import {
  Sparkles, Users, Search, ChevronRight, Loader2,
  CalendarDays, Target, TrendingUp, BarChart3,
  Dumbbell, Clock, FileText, Plus,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export default function StudioPersonalID() {
  const { user, loading: authLoading } = useAuth();
  const { pacientes, isLoading: loadingPacientes } = usePacientes('studio_personal_id');
  const [searchParams] = useSearchParams();
  const [selectedPacienteId, setSelectedPacienteId] = useState<string | null>(searchParams.get('paciente'));
  const [showDashboard, setShowDashboard] = useState(!!searchParams.get('paciente'));
  const [searchPac, setSearchPac] = useState('');

  if (!authLoading && !user) return <Navigate to="/auth" replace />;

  const selectedPaciente = pacientes.find(p => p.id === selectedPacienteId);
  const filteredPac = pacientes.filter(p =>
    `${p.nome} ${p.sobrenome}`.toLowerCase().includes(searchPac.toLowerCase())
  );

  const handleSelectPaciente = (pac: typeof pacientes[0]) => {
    setSelectedPacienteId(pac.id);
    setShowDashboard(true);
  };

  // Dashboard do paciente selecionado
  if (selectedPacienteId && showDashboard && selectedPaciente) {
    return (
      <AppLayout>
        <div className="container py-8 max-w-4xl">
          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <div className="h-14 w-14 rounded-2xl bg-gradient-studio flex items-center justify-center shadow-lg">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-black text-foreground">
                {selectedPaciente.nome} {selectedPaciente.sobrenome}
              </h1>
              <p className="text-muted-foreground text-sm">Studio Personal ID — Painel do Paciente</p>
            </div>
            <Button variant="outline" size="sm" onClick={() => { setSelectedPacienteId(null); setShowDashboard(false); }}>
              <Users className="h-3.5 w-3.5 mr-1" /> Trocar
            </Button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              { label: 'Sessões', value: '0', icon: CalendarDays, color: 'text-studio' },
              { label: 'Objetivos', value: '0', icon: Target, color: 'text-amber-600' },
              { label: 'Progresso', value: '—', icon: TrendingUp, color: 'text-emerald-600' },
              { label: 'Próxima', value: '—', icon: Clock, color: 'text-blue-600' },
            ].map(stat => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="text-center">
                  <CardContent className="pt-5 pb-4">
                    <Icon className={cn('h-6 w-6 mx-auto mb-2', stat.color)} />
                    <div className="text-2xl font-black text-foreground">{stat.value}</div>
                    <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Action Cards */}
          <div className="grid sm:grid-cols-2 gap-4 mb-8">
            <Card className="border-2 border-studio/20 hover:border-studio/40 transition-all cursor-pointer group">
              <CardContent className="pt-6 pb-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-studio flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                  <Plus className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Nova Sessão</h3>
                  <p className="text-xs text-muted-foreground">Registrar treino personalizado</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto group-hover:text-studio transition-colors" />
              </CardContent>
            </Card>

            <Card className="border-2 border-studio/20 hover:border-studio/40 transition-all cursor-pointer group">
              <CardContent className="pt-6 pb-5 flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-gradient-studio flex items-center justify-center shadow-md group-hover:shadow-lg transition-shadow">
                  <BarChart3 className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-foreground">Relatórios</h3>
                  <p className="text-xs text-muted-foreground">Evolução e métricas do paciente</p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground ml-auto group-hover:text-studio transition-colors" />
              </CardContent>
            </Card>
          </div>

          {/* Empty state */}
          <Card>
            <CardContent className="py-16 text-center">
              <div className="h-16 w-16 rounded-2xl bg-gradient-studio mx-auto mb-4 flex items-center justify-center shadow-lg">
                <Dumbbell className="h-8 w-8 text-white" />
              </div>
              <h3 className="font-bold text-lg text-foreground mb-2">Pronto para começar!</h3>
              <p className="text-muted-foreground text-sm max-w-md mx-auto">
                Este é o painel do Studio Personal ID para <strong>{selectedPaciente.nome}</strong>.
                Registre sessões de treino, acompanhe objetivos e gere relatórios personalizados.
              </p>
              <Button className="mt-6 bg-gradient-studio text-white hover:opacity-90 shadow-lg">
                <Plus className="h-4 w-4 mr-2" /> Iniciar Primeira Sessão
              </Button>
            </CardContent>
          </Card>
        </div>
      </AppLayout>
    );
  }

  // Patient selection screen
  return (
    <AppLayout>
      <div className="container py-8 max-w-3xl">
        {/* Module Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="h-12 w-12 rounded-2xl bg-gradient-studio flex items-center justify-center shadow-lg">
            <Sparkles className="h-7 w-7 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">Studio Personal ID</h1>
            <p className="text-muted-foreground text-sm">Treinamento Personalizado Integrado à Saúde</p>
          </div>
        </div>

        {/* Feature highlights */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { icon: Target, label: 'Objetivos', desc: 'Metas individuais' },
            { icon: Dumbbell, label: 'Exercícios', desc: 'Biblioteca completa' },
            { icon: FileText, label: 'Relatórios', desc: 'Evolução detalhada' },
          ].map(feat => {
            const Icon = feat.icon;
            return (
              <Card key={feat.label} className="border-studio/20 hover:border-studio/40 transition-all">
                <CardContent className="pt-4 pb-3 text-center">
                  <div className="h-10 w-10 rounded-xl bg-studio-light mx-auto mb-2 flex items-center justify-center">
                    <Icon className="h-5 w-5 text-studio" />
                  </div>
                  <div className="font-semibold text-sm text-foreground">{feat.label}</div>
                  <div className="text-[10px] text-muted-foreground">{feat.desc}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Patient list */}
        <div className="clinical-card">
          <div className="flex items-center gap-3 mb-4">
            <Users className="h-4 w-4 text-muted-foreground" />
            <h3 className="font-semibold text-sm text-muted-foreground uppercase tracking-wider">
              Pacientes — Studio Personal ID
            </h3>
          </div>
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar paciente..."
              className="pl-9"
              value={searchPac}
              onChange={e => setSearchPac(e.target.value)}
            />
          </div>

          {loadingPacientes ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-studio" />
            </div>
          ) : filteredPac.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Sparkles className="h-10 w-10 mx-auto mb-2 opacity-30" />
              <p className="font-medium">Nenhum paciente com Studio Personal ID ativo</p>
              <p className="text-sm mt-1">
                Cadastre pacientes em <strong>Pacientes</strong> e ative o serviço Studio Personal ID.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {filteredPac.map(p => (
                <div
                  key={p.id}
                  className="flex items-center gap-3 p-3 rounded-xl border hover:border-studio/40 hover:bg-studio-light/30 transition-all cursor-pointer"
                  onClick={() => handleSelectPaciente(p)}
                >
                  <div className="h-10 w-10 rounded-full bg-gradient-studio flex items-center justify-center shrink-0 text-white font-bold text-sm shadow-md">
                    {p.nome[0]}{p.sobrenome?.[0] || ''}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="font-semibold text-sm text-foreground">{p.nome} {p.sobrenome}</span>
                    <p className="text-xs text-muted-foreground">{p.email || p.telefone || 'Sem contato'}</p>
                  </div>
                  <Button
                    size="sm"
                    className="h-8 text-xs bg-gradient-studio text-white gap-1 hover:opacity-90 shadow-md"
                    onClick={() => handleSelectPaciente(p)}
                  >
                    Abrir <ChevronRight className="h-3 w-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
