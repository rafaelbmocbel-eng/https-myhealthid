import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Dicas locais baseadas em achados clínicos (fallback quando sem notificação)
const DICAS_LOCAIS = [
  { driver: 'sono',       texto: 'Durma e acorde sempre no mesmo horário — mesmo no fim de semana. Consistência no ciclo do sono reduz dor crônica em até 30%.' },
  { driver: 'hidratacao', texto: 'Beba 1 copo d\'água agora. Hidratação adequada lubrifica articulações e reduz a percepção de dor.' },
  { driver: 'movimento',  texto: 'Levante e faça 2 minutos de caminhada agora. Movimento suave é o melhor anti-inflamatório natural.' },
  { driver: 'postura',    texto: 'Verifique sua postura: pés no chão, costas apoiadas, tela na altura dos olhos. Seu pescoço agradece.' },
  { driver: 'respiracao', texto: 'Respire: inspire pelo nariz por 4 seg, segure 2 seg, expire pela boca por 6 seg. Repita 5 vezes — reduz tensão muscular.' },
  { driver: 'nutricao',   texto: 'Anti-inflamatórios naturais: cúrcuma, gengibre e ômega-3 (peixe, linhaça). Adicione um deles hoje à sua alimentação.' },
  { driver: 'estresse',   texto: 'O estresse aumenta a percepção de dor. Identifique uma coisa que você pode simplificar hoje.' },
];

function getDicaLocal(pacienteId: string): string {
  // Usa dia do ano + id para variar a dica diariamente de forma consistente
  const dia = new Date().getDay();
  const hash = pacienteId.charCodeAt(0) || 0;
  return DICAS_LOCAIS[(dia + hash) % DICAS_LOCAIS.length].texto;
}

export default function PacienteDicaInteligente() {
  const { user } = useAuth();

  const { data: pac } = useQuery({
    queryKey: ['paciente-id-dica', user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('pacientes')
        .select('id')
        .eq('user_id', user!.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
    staleTime: 300_000,
  });

  // Tenta buscar dica enviada pelo profissional primeiro
  const { data: dica } = useQuery({
    queryKey: ['paciente-dica-inteligente', pac?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from('notificacao_envios')
        .select('id, mensagem, driver, enviado_em')
        .eq('paciente_id', pac!.id)
        .order('enviado_em', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!pac?.id,
    staleTime: 60_000,
  });

  // Fallback: dica local gerada sem precisar de notificação do profissional
  const mensagem = dica?.mensagem ?? (pac?.id ? getDicaLocal(pac.id) : null);
  const tempo = dica?.enviado_em
    ? formatDistanceToNow(new Date(dica.enviado_em), { addSuffix: true, locale: ptBR })
    : 'personalizada para você';

  if (!mensagem) return null;

  return (
    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-primary/0 p-4 shadow-xs">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 shrink-0">
          <Sparkles className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wider font-semibold text-primary mb-1">
            Dica para você
          </p>
          <p className="text-sm leading-relaxed">{mensagem}</p>
          <p className="text-[10px] text-muted-foreground mt-1.5">{tempo}</p>
        </div>
      </div>
    </div>
  );
}
