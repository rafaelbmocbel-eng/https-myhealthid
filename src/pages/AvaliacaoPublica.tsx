import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import logoMetodo from '@/assets/logo-metodo-identidade.jpg';
import Bloco1Anamnese from '@/components/identidade/Bloco1Anamnese';
import Bloco2Dor from '@/components/identidade/Bloco2Dor';
import Bloco3Funcionalidade from '@/components/identidade/Bloco3Funcionalidade';
import Bloco4Kinesiophobia from '@/components/identidade/Bloco4Kinesiophobia';
import Bloco5Regulacao from '@/components/identidade/Bloco5Regulacao';
import type { Bloco1Data, Bloco2Data, Bloco3Data, Bloco4Data, Bloco5Data } from '@/types/identidade';

interface LinkInfo {
  id: string;
  paciente_id: string;
  blocos_inclusos: number[];
  data_expiracao: string;
}

const defaultBloco1: Bloco1Data = {
  queixaPrincipal: '', duracao: '', eventoPrecipitante: false, eventoPrecipitanteDescricao: '',
  historicoMedico: [], historicoFamiliar: false, historicoFamiliarDescricao: '',
  metasTerapeuticas: ['', '', ''], profissao: '', horasSedentario: 8, atividadeFisica: 'leve',
  qualidadeSono: 5, tabagismo: false, alcool: 'nenhum', litrosAgua: 2,
  impactoQualidadeVida: 5, interferenciaTrbalho: 5, quantidadeComorbidades: 2, historicoFamiliarPeso: 3,
  scoreF: 0,
};
const defaultBloco2: Bloco2Data = { regioes: [], scoreD: 0 };
const defaultBloco3: Bloco3Data = { trabalho: 5, domesticas: 5, exercicio: 5, independencia: 5, vidaSocial: 5, scoreEFI: 5 };
const defaultBloco4: Bloco4Data = { respostas: Array(11).fill(2), scoreP: 0 };
const defaultBloco5: Bloco5Data = {
  qualidadeSono: 5, horasSono: 7, acordaNaNoite: 3, dorAfetaSono: 3, descansadoAoAcordar: 6,
  scoreR1: 0, energiaAoAcordar: 6, fadigaDia: 4, precisaCochiblar: 2, motivacao: 6, resistenciaFisica: 6,
  scoreR2: 0, nivelStress: 5, humorGeral: 6, concentracao: 6, preocupacaoSaude: 4, sensacaoControle: 6,
  scoreR3: 0, cargaLaboral: 5, relacionamentos: 4, situacaoFinanceira: 4, eventosEstressantes: 3,
  scoreC: 0, scoreR: 0,
};

export default function AvaliacaoPublica() {
  const { token } = useParams<{ token: string }>();
  const [linkInfo, setLinkInfo] = useState<LinkInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [blocoAtual, setBlocoAtual] = useState(1);
  const [blocosConcluidos, setBlocosConcluidos] = useState<Set<number>>(new Set());
  const [concluido, setConcluido] = useState(false);
  const [salvando, setSalvando] = useState(false);

  const [bloco1, setBloco1] = useState<Bloco1Data>(defaultBloco1);
  const [bloco2, setBloco2] = useState<Bloco2Data>(defaultBloco2);
  const [bloco3, setBloco3] = useState<Bloco3Data>(defaultBloco3);
  const [bloco4, setBloco4] = useState<Bloco4Data>(defaultBloco4);
  const [bloco5, setBloco5] = useState<Bloco5Data>(defaultBloco5);

  useEffect(() => {
    if (!token) { setErro('Link inválido.'); setLoading(false); return; }
    (async () => {
      try {
        // Usa edge function segura — não expõe token nem dados sensíveis via SELECT público
        const { data, error } = await supabase.functions.invoke('validar-token-avaliacao', {
          body: { token },
        });
        if (error || !data || data.error) {
          setErro(data?.error || 'Link não encontrado.');
          setLoading(false);
          return;
        }
        setLinkInfo(data as LinkInfo);
      } catch {
        setErro('Erro ao validar o link. Tente novamente.');
      }
      setLoading(false);
    })();
  }, [token]);

  const salvarBloco = async (blocoNum: number, dados: any) => {
    if (!linkInfo) return;
    setSalvando(true);
    try {
      // Verifica se já existe resposta para este bloco neste link
      const { data: existente } = await supabase
        .from('respostas_avaliacao_paciente')
        .select('id, numero_tentativa')
        .eq('link_id', linkInfo.id)
        .eq('bloco_numero', blocoNum)
        .order('numero_tentativa', { ascending: false })
        .limit(1)
        .maybeSingle();

      await supabase.from('respostas_avaliacao_paciente').insert({
        link_id: linkInfo.id,
        paciente_id: linkInfo.paciente_id,
        bloco_numero: blocoNum,
        dados_respostas: dados,
        numero_tentativa: existente ? (existente.numero_tentativa + 1) : 1,
      });
    } catch (e) {
      console.error('Erro ao salvar bloco:', e);
    } finally {
      setSalvando(false);
    }
  };

  const avancarBloco = async (blocoNum: number, dados: any) => {
    await salvarBloco(blocoNum, dados);
    setBlocosConcluidos(prev => new Set([...prev, blocoNum]));
    if (blocoNum < 5) setBlocoAtual(blocoNum + 1);
    else setConcluido(true);
  };

  const voltarBloco = () => setBlocoAtual(prev => Math.max(1, prev - 1));

  const progresso = (blocosConcluidos.size / 5) * 100;

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );

  if (erro) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4 p-6">
      <XCircle className="h-16 w-16 text-destructive" />
      <h2 className="text-xl font-bold text-foreground">Link inválido</h2>
      <p className="text-muted-foreground text-center max-w-sm">{erro}</p>
    </div>
  );

  if (concluido) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-6 p-6">
      <img src={logoMetodo} alt="Logo" className="h-16 w-16 rounded-2xl object-cover shadow-lg" />
      <CheckCircle2 className="h-16 w-16 text-emerald-500" />
      <div className="text-center max-w-sm">
        <h2 className="text-2xl font-bold text-foreground mb-2">Avaliação Concluída!</h2>
        <p className="text-muted-foreground">Suas respostas foram salvas com sucesso. Seu terapeuta já pode visualizá-las.</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b bg-card px-4 py-4 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto flex items-center gap-4">
          <img src={logoMetodo} alt="Logo" className="h-10 w-10 rounded-xl object-cover shrink-0" />
          <div className="flex-1">
            <h1 className="font-bold text-sm text-foreground">Avaliação Método Identidade</h1>
            <div className="flex items-center gap-3 mt-1">
              <Progress value={progresso} className="h-1.5 flex-1" />
              <span className="text-xs text-muted-foreground whitespace-nowrap">{blocosConcluidos.size}/5 blocos</span>
            </div>
          </div>
          {salvando && <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
          <AlertCircle className="h-3.5 w-3.5" />
          Preencha com honestidade. Suas respostas são confidenciais.
        </div>

        {blocoAtual === 1 && (
          <Bloco1Anamnese
            data={bloco1}
            onChange={setBloco1}
            onNext={() => avancarBloco(1, bloco1)}
          />
        )}
        {blocoAtual === 2 && (
          <Bloco2Dor
            data={bloco2}
            onChange={setBloco2}
            onNext={() => avancarBloco(2, bloco2)}
            onBack={voltarBloco}
          />
        )}
        {blocoAtual === 3 && (
          <Bloco3Funcionalidade
            data={bloco3}
            onChange={setBloco3}
            onNext={() => avancarBloco(3, bloco3)}
            onBack={voltarBloco}
          />
        )}
        {blocoAtual === 4 && (
          <Bloco4Kinesiophobia
            data={bloco4}
            onChange={setBloco4}
            onNext={() => avancarBloco(4, bloco4)}
            onBack={voltarBloco}
          />
        )}
        {blocoAtual === 5 && (
          <Bloco5Regulacao
            data={bloco5}
            onChange={setBloco5}
            onNext={() => avancarBloco(5, bloco5)}
            onBack={voltarBloco}
          />
        )}
      </div>
    </div>
  );
}
