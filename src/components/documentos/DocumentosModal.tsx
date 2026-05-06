import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FileText, Download, Loader2, Calendar, ClipboardCheck, FileCheck, Receipt, Stethoscope, Sparkles } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import {
  gerarDocumento,
  TIPO_DOCUMENTO_LABEL,
  type TipoDocumento,
  type ClinicaInfo,
  type TerapeutaInfo,
  type PacienteInfo,
} from '@/utils/pdfDocumentos';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  paciente: PacienteInfo & { id: string; data_nascimento?: string | null; sexo?: string | null };
}

const TIPOS: { value: TipoDocumento; label: string; icon: any; desc: string }[] = [
  { value: 'laudo_cinetico', label: 'Laudo Cinético-Funcional', icon: Stethoscope, desc: 'Laudo completo com anamnese, exame, MyID e CIF (auto-preenchido).' },
  { value: 'comparecimento', label: 'Atestado de Comparecimento', icon: Calendar, desc: 'Comprova presença em sessão (data e horário).' },
  { value: 'atestado_fisio', label: 'Atestado Fisioterapêutico', icon: ClipboardCheck, desc: 'Justifica afastamento de atividades por X dias.' },
  { value: 'declaracao_tratamento', label: 'Declaração de Tratamento', icon: FileCheck, desc: 'Confirma acompanhamento (sem dados clínicos).' },
  { value: 'recibo', label: 'Recibo de Pagamento', icon: Receipt, desc: 'Recibo formal para reembolso/IR.' },
];

export default function DocumentosModal({ open, onOpenChange, paciente }: Props) {
  const { user } = useAuth();
  const [tipo, setTipo] = useState<TipoDocumento | null>(null);
  const [gerando, setGerando] = useState(false);
  const [clinica, setClinica] = useState<ClinicaInfo | null>(null);
  const [terapeuta, setTerapeuta] = useState<TerapeutaInfo | null>(null);

  // Form fields (todos os tipos)
  const [data, setData] = useState(new Date().toISOString().split('T')[0]);
  const [horaEntrada, setHoraEntrada] = useState('09:00');
  const [horaSaida, setHoraSaida] = useState('10:00');
  const [diasAfastamento, setDiasAfastamento] = useState(1);
  const [cid, setCid] = useState('');
  const [motivo, setMotivo] = useState('');
  const [desde, setDesde] = useState(new Date().toISOString().split('T')[0]);
  const [finalidade, setFinalidade] = useState('');
  const [observacoes, setObservacoes] = useState('');
  const [valor, setValor] = useState(0);
  const [referente, setReferente] = useState('sessões de fisioterapia');
  const [formaPagamento, setFormaPagamento] = useState('PIX');
  const [numeroSessoes, setNumeroSessoes] = useState<number | undefined>();

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const [clinicaRes, profileRes] = await Promise.all([
        (supabase as any).from('config_clinica').select('*').eq('terapeuta_id', user.id).maybeSingle(),
        supabase.from('profiles').select('nome, sobrenome, especialidade, crefito').eq('user_id', user.id).maybeSingle(),
      ]);
      setClinica(clinicaRes.data || null);
      const p = profileRes.data as any;
      setTerapeuta({
        nome: p?.nome || user.email?.split('@')[0] || 'Terapeuta',
        sobrenome: p?.sobrenome,
        registro: p?.crefito,
        especialidade: p?.especialidade,
      });
    })();
  }, [open, user]);

  const handleGerar = async () => {
    if (!tipo || !terapeuta || !user) return;
    setGerando(true);
    try {
      let dados: any = {};
      switch (tipo) {
        case 'comparecimento':
          dados = { data, horaEntrada, horaSaida };
          break;
        case 'atestado_fisio':
          dados = { diasAfastamento, dataInicio: data, cid: cid || undefined, motivo: motivo || undefined };
          break;
        case 'declaracao_tratamento':
          dados = { desde, finalidade: finalidade || undefined, observacoes: observacoes || undefined };
          break;
        case 'recibo':
          dados = { valor, referente, formaPagamento, numeroSessoes };
          break;
      }

      const doc = await gerarDocumento(tipo, { clinica, terapeuta, paciente }, dados);
      const filename = `${TIPO_DOCUMENTO_LABEL[tipo].replace(/\s/g, '_')}_${paciente.nome}_${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);

      // Salvar histórico
      await (supabase as any).from('documentos_emitidos').insert({
        terapeuta_id: user.id,
        paciente_id: paciente.id,
        tipo,
        titulo: TIPO_DOCUMENTO_LABEL[tipo],
        conteudo: dados,
      });

      toast({ title: '📄 Documento gerado!', description: `${TIPO_DOCUMENTO_LABEL[tipo]} baixado com sucesso.` });
      onOpenChange(false);
      setTipo(null);
    } catch (err: any) {
      console.error('Erro ao gerar documento:', err);
      toast({ title: 'Erro ao gerar', description: err.message, variant: 'destructive' });
    } finally {
      setGerando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            Gerar Documento Clínico
          </DialogTitle>
          <DialogDescription>
            Para <strong>{paciente.nome} {paciente.sobrenome}</strong>
          </DialogDescription>
        </DialogHeader>

        {!tipo ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 py-4">
            {TIPOS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTipo(t.value)}
                className="text-left p-4 rounded-xl border border-border hover:border-primary hover:bg-primary/5 transition-all active:scale-[0.98]"
              >
                <div className="flex items-center gap-2 mb-1">
                  <t.icon className="h-4 w-4 text-primary shrink-0" />
                  <span className="font-semibold text-sm">{t.label}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t.desc}</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/20">
              <FileText className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">{TIPO_DOCUMENTO_LABEL[tipo]}</span>
              <Button variant="ghost" size="sm" className="ml-auto h-7 text-xs" onClick={() => setTipo(null)}>
                Trocar
              </Button>
            </div>

            {tipo === 'comparecimento' && (
              <div className="grid grid-cols-3 gap-3">
                <div className="col-span-3">
                  <Label htmlFor="data">Data da sessão</Label>
                  <Input id="data" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="hentrada">Entrada</Label>
                  <Input id="hentrada" type="time" value={horaEntrada} onChange={(e) => setHoraEntrada(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="hsaida">Saída</Label>
                  <Input id="hsaida" type="time" value={horaSaida} onChange={(e) => setHoraSaida(e.target.value)} />
                </div>
              </div>
            )}

            {tipo === 'atestado_fisio' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="dias">Dias de afastamento</Label>
                  <Input id="dias" type="number" min={1} value={diasAfastamento} onChange={(e) => setDiasAfastamento(Number(e.target.value))} />
                </div>
                <div>
                  <Label htmlFor="dini">A partir de</Label>
                  <Input id="dini" type="date" value={data} onChange={(e) => setData(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="cid">CID (opcional)</Label>
                  <Input id="cid" placeholder="Ex: M54.5" value={cid} onChange={(e) => setCid(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="motivo">Motivo clínico (opcional)</Label>
                  <Textarea id="motivo" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
                </div>
              </div>
            )}

            {tipo === 'declaracao_tratamento' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="desde">Em tratamento desde</Label>
                  <Input id="desde" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="fin">Finalidade (opcional)</Label>
                  <Input id="fin" placeholder="Ex: empresa, escola, seguro" value={finalidade} onChange={(e) => setFinalidade(e.target.value)} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="obs">Observações (opcional)</Label>
                  <Textarea id="obs" rows={2} value={observacoes} onChange={(e) => setObservacoes(e.target.value)} />
                </div>
              </div>
            )}

            {tipo === 'recibo' && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="valor">Valor (R$)</Label>
                  <Input id="valor" type="number" step="0.01" value={valor} onChange={(e) => setValor(Number(e.target.value))} />
                </div>
                <div>
                  <Label htmlFor="forma">Forma de pagamento</Label>
                  <Select value={formaPagamento} onValueChange={setFormaPagamento}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="PIX">PIX</SelectItem>
                      <SelectItem value="dinheiro">Dinheiro</SelectItem>
                      <SelectItem value="cartão de crédito">Cartão de crédito</SelectItem>
                      <SelectItem value="cartão de débito">Cartão de débito</SelectItem>
                      <SelectItem value="transferência bancária">Transferência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="nses">Nº de sessões (opcional)</Label>
                  <Input id="nses" type="number" min={1} value={numeroSessoes ?? ''} onChange={(e) => setNumeroSessoes(e.target.value ? Number(e.target.value) : undefined)} />
                </div>
                <div className="col-span-2">
                  <Label htmlFor="ref">Referente a</Label>
                  <Input id="ref" value={referente} onChange={(e) => setReferente(e.target.value)} />
                </div>
              </div>
            )}

            <Button
              className="w-full bg-gradient-to-r from-primary to-accent text-primary-foreground"
              onClick={handleGerar}
              disabled={gerando}
            >
              {gerando ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Download className="h-4 w-4 mr-2" />}
              Gerar PDF e Baixar
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
