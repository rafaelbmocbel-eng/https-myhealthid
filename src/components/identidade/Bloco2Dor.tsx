import { useState } from 'react';
import { Bloco2Data, RegiaoDor } from '@/types/identidade';
import { calcularScoreD, getSeverityColorHex } from '@/utils/calculations';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ChevronRight, ChevronLeft, X, MapPin, Info } from 'lucide-react';
import { BodyAvatarSVG, REGIOES_CORPO } from './BodyAvatarSVG';

const TIPOS_DOR = ['Ardor', 'Queimação', 'Dormência', 'Rigidez', 'Peso/Pressão', 'Pontada', 'Dor profunda'];
const FREQUENCIAS = ['Contínua (24h)', 'Intermitente', 'Noturna (afeta sono)', 'Ao movimento específico'];
const FATORES_PIORA = ['Movimento específico', 'Posição prolongada', 'Clima/umidade', 'Stress/emocional', 'Menstruação', 'Atividade ocupacional', 'Fadiga', 'Sono inadequado'];
const FATORES_MELHORA = ['Repouso', 'Movimento', 'Calor/frio', 'Medicação', 'Fisioterapia', 'Alongamento', 'Outro'];


interface Props {
  data: Bloco2Data;
  onChange: (data: Bloco2Data) => void;
  onNext: () => void;
  onBack: () => void;
}

export default function Bloco2Dor({ data, onChange, onNext, onBack }: Props) {
  const [regioes, setRegioes] = useState<RegiaoDor[]>(data.regioes);
  const [modalRegiao, setModalRegiao] = useState<string | null>(null);

  const getRegiaoDor = (id: string): RegiaoDor => {
    return regioes.find(r => r.id === id) || {
      id, nome: REGIOES_CORPO.find(r => r.id === id)?.nome || id,
      intensidade: 5, tipos: [], irradiacao: false, irradiacaoPara: [],
      frequencia: 'Intermitente', fatoresPiora: [], fatoresMelhora: [],
    };
  };

  const updateRegiao = (id: string, updater: (r: RegiaoDor) => RegiaoDor) => {
    const existing = regioes.find(r => r.id === id);
    const base = existing || getRegiaoDor(id);
    const updated = updater(base);

    let newRegioes: RegiaoDor[];
    if (existing) {
      newRegioes = regioes.map(r => r.id === id ? updated : r);
    } else {
      newRegioes = [...regioes, updated];
    }

    setRegioes(newRegioes);
    const scoreD = calcularScoreD({ regioes: newRegioes, scoreD: 0 });
    onChange({ regioes: newRegioes, scoreD });
  };

  const removeRegiao = (id: string) => {
    const newRegioes = regioes.filter(r => r.id !== id);
    setRegioes(newRegioes);
    const scoreD = calcularScoreD({ regioes: newRegioes, scoreD: 0 });
    onChange({ regioes: newRegioes, scoreD });
  };



  const scoreD = calcularScoreD({ regioes, scoreD: 0 });
  const modalRegiaoDor = modalRegiao ? getRegiaoDor(modalRegiao) : null;

  return (
    <div className="space-y-6">
      <div className="clinical-card">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">Bloco 2</Badge>
              <span className="text-xs text-muted-foreground">~12 min</span>
            </div>
            <h2 className="text-xl font-bold">Avaliação da Dor</h2>
            <p className="text-muted-foreground text-sm mt-1">Clique nas regiões do avatar para mapear a dor</p>
          </div>
          <div className="text-right">
            <div className="text-xs text-muted-foreground">Score D</div>
            <div className="text-3xl font-bold text-primary">{scoreD.toFixed(1)}</div>
            <div className="text-xs text-muted-foreground">/10</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Avatar SVG */}
        <div className="clinical-card">
          <h3 className="font-semibold text-sm mb-3">Avatar Corporal Interativo</h3>
          <div className="flex flex-col items-center">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Clique nas regiões para mapear dor
            </div>

            <BodyAvatarSVG
              mode="pain"
              painMap={Object.fromEntries(regioes.map(r => [r.id, r.intensidade]))}
              onRegionClick={(regionId) => setModalRegiao(regionId)}
              className="w-44"
            />

            {/* Legenda */}
            <div className="flex flex-wrap items-center gap-3 mt-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#e8f4f8] border border-gray-300"></div>
                <span>Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#fef3c7] border border-amber-200"></div>
                <span>1-3</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#f97316]"></div>
                <span>4-7</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#ef4444]"></div>
                <span>8-10</span>
              </div>
            </div>
          </div>
        </div>

        {/* Lista de regiões afetadas */}
        <div className="clinical-card">
          <h3 className="font-semibold text-sm mb-4">Regiões Afetadas ({regioes.length})</h3>
          {regioes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mb-2 opacity-30" />
              <p className="text-sm">Nenhuma região marcada</p>
              <p className="text-xs mt-1">Clique no avatar para adicionar</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto pr-1">
              {regioes.map(r => (
                <div key={r.id} className="p-3 rounded-lg border bg-card hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: r.intensidade >= 6 ? '#e74c3c' : '#f39c12' }}
                      />
                      <span className="font-medium text-sm">{r.nome}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold" style={{ color: getSeverityColorHex(r.intensidade) }}>
                        {r.intensidade}/10
                      </span>
                      <button onClick={() => removeRegiao(r.id)} className="text-muted-foreground hover:text-destructive">
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {r.tipos.map(t => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
                    {r.irradiacao && <Badge variant="outline" className="text-xs text-orange-600 border-orange-200">Irradia</Badge>}
                  </div>
                  <button
                    onClick={() => setModalRegiao(r.id)}
                    className="text-xs text-primary mt-2 hover:underline"
                  >
                    Editar detalhes
                  </button>
                </div>
              ))}
            </div>
          )}

          {regioes.length > 0 && (
            <div className="mt-4 p-3 rounded-lg bg-primary/5 border border-primary/20">
              <div className="flex items-center gap-2">
                <Info className="h-4 w-4 text-primary flex-shrink-0" />
                <div className="text-xs">
                  <strong>Score D: {scoreD.toFixed(1)}/10</strong> · {regioes.length} regiões ·
                  Intensidade média: {(regioes.reduce((s, r) => s + r.intensidade, 0) / regioes.length).toFixed(1)}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal de região */}
      <Dialog open={!!modalRegiao} onOpenChange={() => setModalRegiao(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {modalRegiao ? REGIOES_CORPO.find(r => r.id === modalRegiao)?.nome : ''}
            </DialogTitle>
          </DialogHeader>
          {modalRegiao && modalRegiaoDor && (
            <div className="space-y-5">
              {/* Intensidade */}
              <div>
                <div className="flex justify-between items-center mb-2">
                  <Label>Intensidade da dor</Label>
                  <span className="text-2xl font-bold" style={{ color: getSeverityColorHex(modalRegiaoDor.intensidade) }}>
                    {modalRegiaoDor.intensidade}/10
                  </span>
                </div>
                <Slider
                  value={[modalRegiaoDor.intensidade]}
                  min={0} max={10} step={1}
                  onValueChange={([v]) => updateRegiao(modalRegiao, r => ({ ...r, intensidade: v }))}
                />
                <div className="flex justify-between text-xs text-muted-foreground mt-1">
                  <span>😊 Sem dor</span><span>😭 Dor máxima</span>
                </div>
              </div>

              {/* Tipos */}
              <div>
                <Label className="mb-2 block">Tipo(s) de dor</Label>
                <div className="grid grid-cols-2 gap-2">
                  {TIPOS_DOR.map(tipo => (
                    <div key={tipo} className="flex items-center gap-2">
                      <Checkbox
                        id={tipo}
                        checked={modalRegiaoDor.tipos.includes(tipo)}
                        onCheckedChange={c => updateRegiao(modalRegiao, r => ({
                          ...r, tipos: c ? [...r.tipos, tipo] : r.tipos.filter(t => t !== tipo)
                        }))}
                      />
                      <Label htmlFor={tipo} className="text-sm cursor-pointer">{tipo}</Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Frequência */}
              <div>
                <Label>Frequência</Label>
                <Select
                  value={modalRegiaoDor.frequencia}
                  onValueChange={v => updateRegiao(modalRegiao, r => ({ ...r, frequencia: v }))}
                >
                  <SelectTrigger className="mt-1.5">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FREQUENCIAS.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              {/* Irradiação */}
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Checkbox
                    id="irradiacao"
                    checked={modalRegiaoDor.irradiacao}
                    onCheckedChange={c => updateRegiao(modalRegiao, r => ({ ...r, irradiacao: !!c }))}
                  />
                  <Label htmlFor="irradiacao" className="cursor-pointer">Apresenta irradiação?</Label>
                </div>
                {modalRegiaoDor.irradiacao && (
                  <div className="grid grid-cols-2 gap-2 ml-6">
                    {REGIOES_CORPO.filter(r => r.id !== modalRegiao).map(r => (
                      <div key={r.id} className="flex items-center gap-2">
                        <Checkbox
                          id={`irr-${r.id}`}
                          checked={modalRegiaoDor.irradiacaoPara.includes(r.nome)}
                          onCheckedChange={c => updateRegiao(modalRegiao, reg => ({
                            ...reg, irradiacaoPara: c ? [...reg.irradiacaoPara, r.nome] : reg.irradiacaoPara.filter(i => i !== r.nome)
                          }))}
                        />
                        <Label htmlFor={`irr-${r.id}`} className="text-xs cursor-pointer">{r.nome}</Label>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Fatores */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="mb-2 block text-xs font-semibold text-destructive">Fatores de PIORA</Label>
                  <div className="space-y-1.5">
                    {FATORES_PIORA.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <Checkbox
                          id={`piora-${f}`}
                          checked={modalRegiaoDor.fatoresPiora.includes(f)}
                          onCheckedChange={c => updateRegiao(modalRegiao, r => ({
                            ...r, fatoresPiora: c ? [...r.fatoresPiora, f] : r.fatoresPiora.filter(i => i !== f)
                          }))}
                        />
                        <Label htmlFor={`piora-${f}`} className="text-xs cursor-pointer">{f}</Label>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <Label className="mb-2 block text-xs font-semibold text-success">Fatores de MELHORA</Label>
                  <div className="space-y-1.5">
                    {FATORES_MELHORA.map(f => (
                      <div key={f} className="flex items-center gap-2">
                        <Checkbox
                          id={`melhora-${f}`}
                          checked={modalRegiaoDor.fatoresMelhora.includes(f)}
                          onCheckedChange={c => updateRegiao(modalRegiao, r => ({
                            ...r, fatoresMelhora: c ? [...r.fatoresMelhora, f] : r.fatoresMelhora.filter(i => i !== f)
                          }))}
                        />
                        <Label htmlFor={`melhora-${f}`} className="text-xs cursor-pointer">{f}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <Button className="w-full bg-gradient-primary text-white" onClick={() => setModalRegiao(null)}>
                Salvar região
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Navegação */}
      <div className="clinical-card bg-primary/5 border-primary/20">
        <div className="flex items-center justify-between">
          <Button variant="outline" onClick={onBack}>
            <ChevronLeft className="h-4 w-4 mr-1" />Voltar
          </Button>
          <span className="text-sm text-muted-foreground">Score D: <strong className="text-primary">{scoreD.toFixed(1)}/10</strong></span>
          <Button onClick={onNext} className="bg-gradient-primary text-white shadow-primary">
            Próximo: Funcionalidade
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
