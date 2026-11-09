import { Download, Loader2, Save } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

interface Props {
  /** Só vale o paciente que foi achado na lista do profissional; vazio quando não há (ou ainda não carregou). */
  pacienteId: string;
  pacienteNome: string | null;
  /** A lista de pacientes ainda está carregando: não dá para confirmar quem recebe o exame. */
  carregandoPacientes?: boolean;
  /** Há pelo menos uma etapa gravada (e, portanto, algo para salvar). */
  temResultado: boolean;
  /** As etapas vieram da demonstração (sinal simulado): não vão para o prontuário. */
  demonstracao: boolean;
  observacoes: string;
  onObservacoes: (texto: string) => void;
  visivelAoCliente: boolean;
  onVisivelAoCliente: (valor: boolean) => void;
  salvando: boolean;
  salvo: boolean;
  onSalvar: () => void;
  onBaixarCsv: () => void;
}

export default function SalvarExame(p: Props) {
  const semPaciente = p.pacienteId === '';
  const carregando = semPaciente && p.carregandoPacientes === true;
  const demo = p.temResultado && p.demonstracao;
  let ajuda: string;
  if (semPaciente || demo) {
    const motivos: string[] = [];
    if (carregando) motivos.push('Carregando pacientes…');
    else if (semPaciente) motivos.push('Escolha um paciente no alto da página para salvar no prontuário.');
    if (demo) motivos.push('Este resultado veio da demonstração (sinal simulado) e não pode ser salvo no prontuário: conecte o módulo e grave as etapas.');
    motivos.push('Você ainda pode baixar o CSV do sinal.');
    ajuda = motivos.join(' ');
  } else if (!p.temResultado) {
    ajuda = 'Grave pelo menos uma etapa para poder salvar.';
  } else if (p.salvo) {
    ajuda = `Salvo no prontuário${p.pacienteNome ? ` de ${p.pacienteNome}` : ''}.`;
  } else {
    ajuda = 'O exame guarda o resumo, o envelope do sinal e os parâmetros da análise. O sinal bruto não é salvo.';
  }
  const bloqueado = semPaciente || !p.temResultado || demo || p.salvando || p.salvo;

  return (
    <Card className="space-y-4 p-3 sm:p-4" aria-label="Salvar o exame">
      <h2 className="text-base font-semibold">Salvar no prontuário</h2>

      <div className="space-y-1.5">
        <Label htmlFor="emg-observacoes" className="text-sm font-medium">
          Observações
        </Label>
        <Textarea
          id="emg-observacoes"
          value={p.observacoes}
          onChange={(e) => p.onObservacoes(e.target.value)}
          rows={3}
          maxLength={2000}
          disabled={p.salvando}
          placeholder="Posição, dor, tipo de tarefa, o que mais for útil…"
        />
      </div>

      <div className="flex items-start justify-between gap-3 rounded-xl border border-border/60 p-3">
        <div className="min-w-0">
          <Label htmlFor="emg-visivel" className="text-sm font-medium">
            Mostrar ao cliente
          </Label>
          <p className="text-xs text-muted-foreground">Desligado: só você vê este exame. Ligado: o cliente também pode ver.</p>
        </div>
        <Switch id="emg-visivel" checked={p.visivelAoCliente} onCheckedChange={p.onVisivelAoCliente} disabled={p.salvando} />
      </div>

      <div className="space-y-2">
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" className="h-11 flex-1 gap-1.5" disabled={bloqueado} aria-describedby="emg-salvar-ajuda" onClick={p.onSalvar}>
            {p.salvando ? <Loader2 className="icon-sm animate-spin" /> : <Save className="icon-sm" />}
            {p.salvo ? 'Salvo no prontuário' : 'Salvar no prontuário'}
          </Button>
          <Button type="button" variant="outline" className="h-11 flex-1 gap-1.5" disabled={!p.temResultado} onClick={p.onBaixarCsv}>
            <Download className="icon-sm" /> Baixar CSV do sinal
          </Button>
        </div>
        <p id="emg-salvar-ajuda" className="text-xs text-muted-foreground" data-testid="ajuda-salvar">
          {ajuda}
          {p.salvo && !semPaciente && (
            <>
              {' '}
              <Link to={`/pacientes/${p.pacienteId}`} className="font-medium text-primary underline underline-offset-2">
                Abrir o prontuário
              </Link>
            </>
          )}
        </p>
      </div>
    </Card>
  );
}
