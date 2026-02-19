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

const REGIOES_CORPO = [
  { id: 'cabeca', nome: 'Cabeça', cx: 150, cy: 45, r: 30 },
  { id: 'pescoco', nome: 'Pescoço', cx: 150, cy: 90, r: 14 },
  { id: 'ombroDireito', nome: 'Ombro Direito', cx: 100, cy: 120, r: 20 },
  { id: 'ombroEsquerdo', nome: 'Ombro Esquerdo', cx: 200, cy: 120, r: 20 },
  { id: 'colunaToracica', nome: 'Coluna Torácica', cx: 150, cy: 165, r: 22 },
  { id: 'colunaLombar', nome: 'Coluna Lombar', cx: 150, cy: 225, r: 22 },
  { id: 'sacroPelvica', nome: 'Sacro-Pélvica', cx: 150, cy: 270, r: 22 },
  { id: 'coxaDireita', nome: 'Coxa Direita', cx: 120, cy: 340, r: 22 },
  { id: 'coxaEsquerda', nome: 'Coxa Esquerda', cx: 180, cy: 340, r: 22 },
  { id: 'pernaDireita', nome: 'Perna/Pé Direito', cx: 115, cy: 430, r: 20 },
  { id: 'pernaEsquerda', nome: 'Perna/Pé Esquerdo', cx: 185, cy: 430, r: 20 },
];

const TIPOS_DOR = ['Ardor', 'Queimação', 'Dormência', 'Rigidez', 'Peso/Pressão', 'Pontada', 'Dor profunda'];
const FREQUENCIAS = ['Contínua (24h)', 'Intermitente', 'Noturna (afeta sono)', 'Ao movimento específico'];
const FATORES_PIORA = ['Movimento específico', 'Posição prolongada', 'Clima/umidade', 'Stress/emocional', 'Menstruação', 'Outro'];
const FATORES_MELHORA = ['Repouso', 'Movimento', 'Calor/frio', 'Medicação', 'Fisioterapia', 'Outro'];

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

  const getRegiaoCor = (id: string) => {
    const r = regioes.find(r => r.id === id);
    if (!r) return '#e8f4f8';
    if (r.intensidade >= 6) return '#e74c3c';
    if (r.intensidade >= 1) return '#f39c12';
    return '#e8f4f8';
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
          <h3 className="font-semibold text-sm mb-4">Avatar Corporal Interativo</h3>
          <div className="flex flex-col items-center">
            <div className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              Clique nas regiões para adicionar/editar dor
            </div>
            <svg viewBox="0 0 300 490" className="w-48 h-auto" style={{ maxHeight: 420 }}>
              {/* Corpo base */}
              <ellipse cx="150" cy="45" rx="28" ry="28" fill="#f0f0f0" stroke="#ddd" strokeWidth="1.5" />
              <rect x="120" y="85" width="60" height="10" rx="5" fill="#f0f0f0" stroke="#ddd" strokeWidth="1" />
              <ellipse cx="150" cy="175" rx="55" ry="90" fill="#f0f0f0" stroke="#ddd" strokeWidth="1.5" />
              <ellipse cx="150" cy="285" rx="50" ry="50" fill="#f0f0f0" stroke="#ddd" strokeWidth="1.5" />
              <ellipse cx="118" cy="370" rx="22" ry="60" fill="#f0f0f0" stroke="#ddd" strokeWidth="1.5" />
              <ellipse cx="182" cy="370" rx="22" ry="60" fill="#f0f0f0" stroke="#ddd" strokeWidth="1.5" />

              {/* Regiões clicáveis */}
              {REGIOES_CORPO.map(regiao => (
                <circle
                  key={regiao.id}
                  cx={regiao.cx} cy={regiao.cy} r={regiao.r}
                  fill={getRegiaoCor(regiao.id)}
                  stroke={regioes.find(r => r.id === regiao.id) ? '#666' : '#ccc'}
                  strokeWidth={regioes.find(r => r.id === regiao.id) ? 2 : 1}
                  className="body-region cursor-pointer transition-all hover:opacity-80"
                  onClick={() => setModalRegiao(regiao.id)}
                  opacity={0.85}
                />
              ))}

              {/* Labels */}
              {REGIOES_CORPO.map(regiao => (
                <text
                  key={`label-${regiao.id}`}
                  x={regiao.cx} y={regiao.cy + 1}
                  textAnchor="middle" dominantBaseline="middle"
                  fontSize="6" fill="#333" fontWeight="500"
                  className="pointer-events-none select-none"
                  style={{ fontSize: '6px' }}
                >
                  {regioes.find(r => r.id === regiao.id) ? regioes.find(r => r.id === regiao.id)?.intensidade : ''}
                </text>
              ))}
            </svg>

            {/* Legenda */}
            <div className="flex items-center gap-4 mt-3 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#e8f4f8] border border-gray-300"></div>
                <span>Normal</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#f39c12]"></div>
                <span>1-5</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-[#e74c3c]"></div>
                <span>6-10</span>
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
