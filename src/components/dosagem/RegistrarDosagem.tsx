import { useState } from 'react';
import { ClipboardCheck, Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { tabela } from '@/lib/dosagem/db';
import { useAuth } from '@/contexts/AuthContext';
import { referencia } from '@/lib/dosagem/referencias';
import type { DoseRegistrada } from '@/lib/dosagem/tipos';

export const textoDaDose = (d: DoseRegistrada) => {
  const refs = [...new Set(d.referencias)].map((id) => referencia(id)).filter(Boolean)
    .map((r) => `${r!.autores}, ${r!.ano} (PubMed ${r!.pmid})`);
  return [
    ...d.linhas,
    d.equipamento ? `Aparelho: ${d.equipamento}` : '',
    refs.length ? `Referências: ${refs.join('; ')}` : '',
    'Parâmetros de referência em validação clínica; dose definida e aplicada pelo profissional.',
  ].filter(Boolean).join('\n');
};

export function RegistrarDosagem({ paciente, dose, segurancaPronta, motivoBloqueio }: {
  paciente: { id: string; nome: string } | null;
  dose: DoseRegistrada | null;
  segurancaPronta: boolean;
  motivoBloqueio?: string;
}) {
  const { user } = useAuth();
  const [salvando, setSalvando] = useState(false);
  const [registrado, setRegistrado] = useState(false);

  const copiar = async () => {
    if (!dose) return;
    try { await navigator.clipboard.writeText(`${dose.titulo}\n${textoDaDose(dose)}`); toast.success('Resumo copiado.'); }
    catch { toast.error('Não consegui copiar.'); }
  };

  const registrar = async () => {
    if (!dose || !paciente || !user) return;
    setSalvando(true);
    try {
      const { error } = await tabela('notas_prontuario').insert({
        paciente_id: paciente.id,
        terapeuta_id: user.id,
        tipo: 'dosagem_fisio',
        titulo: dose.titulo,
        descricao: textoDaDose(dose),
        dados_extras: { modalidade: dose.modalidade, condicao: dose.condicao, parametros: dose.parametros, equipamento: dose.equipamento ?? null, referencias: dose.referencias, em_validacao_clinica: true },
      });
      if (error) throw error;
      setRegistrado(true);
      toast.success(`Dose registrada no prontuário de ${paciente.nome}.`);
    } catch (e) {
      toast.error((e as { message?: string })?.message || 'Não foi possível registrar.');
    } finally {
      setSalvando(false);
    }
  };

  const bloqueio = !dose ? 'Preencha os parâmetros.'
    : !paciente ? 'Escolha um paciente no topo para registrar.'
    : !segurancaPronta ? (motivoBloqueio || 'Confirme a segurança do paciente.')
    : '';

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        <Button onClick={registrar} disabled={!!bloqueio || salvando} className="gap-1.5 flex-1 min-w-[200px]">
          {salvando ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardCheck className="h-4 w-4" />}
          {registrado ? 'Registrar de novo' : 'Registrar no prontuário'}
        </Button>
        <Button variant="outline" onClick={copiar} disabled={!dose} className="gap-1.5"><Copy className="h-4 w-4" /> Copiar</Button>
      </div>
      {bloqueio && <p className="text-[11px] text-muted-foreground">{bloqueio}</p>}
      {registrado && !bloqueio && <p className="text-[11px] text-emerald-700 dark:text-emerald-400">Registrado. Aparece na linha do tempo do prontuário como “Dosagem de recurso”.</p>}
    </div>
  );
}
