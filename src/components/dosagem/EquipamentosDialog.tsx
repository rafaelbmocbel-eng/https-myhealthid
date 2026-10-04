import { useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useRemoverEquipamento, useSalvarEquipamento } from '@/hooks/useEquipamentosFisio';
import { MODALIDADES_APARELHO, type EquipamentoFisio, type ModalidadeAparelho } from '@/lib/dosagem/tipos';
import { CampoNumero, mesesDesde, numStr, parseNum } from './comuns';

interface Form {
  id?: string;
  tipo: ModalidadeAparelho;
  nome: string;
  fabricante: string;
  modelo: string;
  calibracao: string;
  observacoes: string;
  // laser
  nm: string; modoLaser: 'continuo' | 'pulsado'; potMedia: string; potMedida: string; potPico: string; areaFeixe: string;
  // ultrassom
  freq: '1' | '3'; era: string; bnr: string; potMax: string;
  // ondas de choque
  tipoOnda: 'focal' | 'radial'; areaFocal: string; hzMax: string; barMax: string; efdMax: string;
}

const vazio = (tipo: ModalidadeAparelho): Form => ({
  tipo, nome: '', fabricante: '', modelo: '', calibracao: '', observacoes: '',
  nm: '', modoLaser: 'continuo', potMedia: '', potMedida: '', potPico: '', areaFeixe: '',
  freq: '1', era: '', bnr: '', potMax: '',
  tipoOnda: 'focal', areaFocal: '', hzMax: '', barMax: '', efdMax: '',
});

const doEquipamento = (e: EquipamentoFisio): Form => ({
  ...vazio(e.tipo),
  id: e.id, nome: e.nome, fabricante: e.fabricante ?? '', modelo: e.modelo ?? '', calibracao: e.ultima_calibracao?.slice(0, 10) ?? '', observacoes: e.observacoes ?? '',
  nm: numStr(e.specs.comprimento_onda_nm), modoLaser: e.specs.modo ?? 'continuo', potMedia: numStr(e.specs.potencia_media_mw), potMedida: numStr(e.specs.potencia_medida_mw),
  potPico: numStr(e.specs.potencia_pico_mw), areaFeixe: numStr(e.specs.area_feixe_cm2),
  freq: e.specs.frequencia_mhz === 3 ? '3' : '1', era: numStr(e.specs.era_cm2), bnr: numStr(e.specs.bnr), potMax: numStr(e.specs.potencia_max_w),
  tipoOnda: e.specs.tipo ?? 'focal', areaFocal: numStr(e.specs.area_focal_mm2), hzMax: numStr(e.specs.frequencia_max_hz), barMax: numStr(e.specs.pressao_max_bar), efdMax: numStr(e.specs.efd_max_mj_mm2),
});

const semNulos = <T extends Record<string, unknown>>(o: T): T =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== null && v !== undefined)) as T;

function specsDoForm(f: Form): EquipamentoFisio['specs'] {
  if (f.tipo === 'laser') {
    return semNulos({
      comprimento_onda_nm: parseNum(f.nm), modo: f.modoLaser, potencia_media_mw: parseNum(f.potMedia),
      potencia_medida_mw: parseNum(f.potMedida), potencia_pico_mw: parseNum(f.potPico), area_feixe_cm2: parseNum(f.areaFeixe),
    });
  }
  if (f.tipo === 'ultrassom') {
    return semNulos({ frequencia_mhz: f.freq === '3' ? 3 : 1, era_cm2: parseNum(f.era), bnr: parseNum(f.bnr), potencia_max_w: parseNum(f.potMax) }) as EquipamentoFisio['specs'];
  }
  return semNulos({
    tipo: f.tipoOnda, area_focal_mm2: parseNum(f.areaFocal), frequencia_max_hz: parseNum(f.hzMax),
    pressao_max_bar: parseNum(f.barMax), efd_max_mj_mm2: parseNum(f.efdMax),
  });
}

const resumo = (e: EquipamentoFisio) => {
  const s = e.specs;
  if (e.tipo === 'laser') return [s.comprimento_onda_nm ? `${s.comprimento_onda_nm} nm` : '', (s.potencia_medida_mw ?? s.potencia_media_mw) ? `${s.potencia_medida_mw ? 'medida ' : ''}${s.potencia_medida_mw ?? s.potencia_media_mw} mW` : '', s.area_feixe_cm2 ? `feixe ${s.area_feixe_cm2} cm²` : ''].filter(Boolean).join(' · ');
  if (e.tipo === 'ultrassom') return [s.frequencia_mhz ? `${s.frequencia_mhz} MHz` : '', s.era_cm2 ? `ERA ${s.era_cm2} cm²` : '', s.bnr ? `BNR ${s.bnr}` : ''].filter(Boolean).join(' · ');
  return [s.tipo === 'radial' ? 'radial' : 'focal', s.area_focal_mm2 ? `foco ${s.area_focal_mm2} mm²` : '', s.frequencia_max_hz ? `até ${s.frequencia_max_hz} Hz` : ''].filter(Boolean).join(' · ');
};

export default function EquipamentosDialog({ itens, onClose }: { itens: EquipamentoFisio[]; onClose: () => void }) {
  const salvar = useSalvarEquipamento();
  const remover = useRemoverEquipamento();
  const [form, setForm] = useState<Form | null>(null);
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));

  const gravar = async () => {
    if (!form) return;
    if (!form.nome.trim()) { toast.error('Dê um nome ao aparelho.'); return; }
    try {
      await salvar.mutateAsync({
        id: form.id, tipo: form.tipo, nome: form.nome.trim(), fabricante: form.fabricante.trim() || null, modelo: form.modelo.trim() || null,
        specs: specsDoForm(form), ultima_calibracao: form.calibracao || null, observacoes: form.observacoes.trim() || null,
      });
      toast.success('Aparelho salvo.');
      setForm(null);
    } catch (e) {
      toast.error((e as { message?: string })?.message || 'Não foi possível salvar.');
    }
  };

  const excluir = async (e: EquipamentoFisio) => {
    if (!window.confirm(`Remover “${e.nome}” dos seus aparelhos?`)) return;
    try { await remover.mutateAsync(e.id); toast.success('Aparelho removido.'); }
    catch (err) { toast.error((err as { message?: string })?.message || 'Não foi possível remover.'); }
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>{form ? (form.id ? 'Editar aparelho' : 'Novo aparelho') : 'Meus aparelhos'}</DialogTitle></DialogHeader>

        {!form ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Cadastre os dados reais de cada emissor, ponteira ou transdutor: a calculadora usa a sua potência, a sua área de feixe e a sua ERA, e não valores de catálogo.
            </p>
            {MODALIDADES_APARELHO.map((m) => {
              const lista = itens.filter((i) => i.tipo === m.id);
              return (
                <div key={m.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold">{m.nome}</p>
                    <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setForm(vazio(m.id))}><Plus className="h-3.5 w-3.5" /> Adicionar</Button>
                  </div>
                  {lista.length === 0 ? <p className="text-xs text-muted-foreground">Nenhum aparelho cadastrado.</p> : (
                    <ul className="divide-y divide-border/50 rounded-lg border border-border/50">
                      {lista.map((e) => {
                        const meses = mesesDesde(e.ultima_calibracao);
                        return (
                          <li key={e.id} className="flex items-center gap-2 p-2.5">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium">{e.nome}{e.modelo ? ` · ${e.modelo}` : ''}</p>
                              <p className="truncate text-[11px] text-muted-foreground tabular-nums">{resumo(e) || 'Sem especificações'}{meses !== null ? ` · calibrado há ${Math.max(meses, 0)} m` : ''}</p>
                            </div>
                            <Button size="icon" variant="ghost" className="h-8 w-8" aria-label="Editar" onClick={() => setForm(doEquipamento(e))}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" aria-label="Remover" onClick={() => excluir(e)}><Trash2 className="h-3.5 w-3.5" /></Button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1 col-span-2">
                <Label className="text-xs font-medium">Tipo</Label>
                <Select value={form.tipo} onValueChange={(v) => set('tipo', v as ModalidadeAparelho)} disabled={!!form.id}>
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>{MODALIDADES_APARELHO.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1 col-span-2">
                <Label htmlFor="eq-nome" className="text-xs font-medium">Nome (como você chama)</Label>
                <Input id="eq-nome" value={form.nome} onChange={(e) => set('nome', e.target.value)} placeholder={form.tipo === 'laser' ? 'ex.: Laser consultório — ponteira 808' : 'ex.: Ultrassom sala 2 — 1 MHz'} className="h-10" />
              </div>
              <div className="space-y-1"><Label htmlFor="eq-fab" className="text-xs font-medium">Fabricante</Label><Input id="eq-fab" value={form.fabricante} onChange={(e) => set('fabricante', e.target.value)} className="h-10" /></div>
              <div className="space-y-1"><Label htmlFor="eq-mod" className="text-xs font-medium">Modelo</Label><Input id="eq-mod" value={form.modelo} onChange={(e) => set('modelo', e.target.value)} className="h-10" /></div>
            </div>

            {form.tipo === 'laser' && (
              <div className="grid grid-cols-2 gap-3">
                <CampoNumero id="eq-nm" label="Comprimento de onda" unidade="nm" valor={form.nm} onChange={(v) => set('nm', v)} />
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Modo</Label>
                  <Select value={form.modoLaser} onValueChange={(v) => set('modoLaser', v as 'continuo' | 'pulsado')}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="continuo">Contínuo</SelectItem><SelectItem value="pulsado">Pulsado / superpulsado</SelectItem></SelectContent>
                  </Select>
                </div>
                <CampoNumero id="eq-pm" label="Potência média (rótulo)" unidade="mW" valor={form.potMedia} onChange={(v) => set('potMedia', v)} />
                <CampoNumero id="eq-pmed" label="Potência MEDIDA" unidade="mW" valor={form.potMedida} onChange={(v) => set('potMedida', v)} dica="Com power meter. Se preencher, a calculadora usa esta." />
                <CampoNumero id="eq-pk" label="Potência de pico (opcional)" unidade="mW" valor={form.potPico} onChange={(v) => set('potPico', v)} />
                <CampoNumero id="eq-af" label="Área do feixe na pele" unidade="cm²" valor={form.areaFeixe} onChange={(v) => set('areaFeixe', v)} />
              </div>
            )}
            {form.tipo === 'ultrassom' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Frequência</Label>
                  <Select value={form.freq} onValueChange={(v) => set('freq', v as '1' | '3')}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="1">1 MHz</SelectItem><SelectItem value="3">3 MHz</SelectItem></SelectContent>
                  </Select>
                </div>
                <CampoNumero id="eq-era" label="ERA (do laudo)" unidade="cm²" valor={form.era} onChange={(v) => set('era', v)} />
                <CampoNumero id="eq-bnr" label="BNR (opcional)" valor={form.bnr} onChange={(v) => set('bnr', v)} dica="Não deve passar de 8." />
                <CampoNumero id="eq-pmax" label="Potência máxima" unidade="W" valor={form.potMax} onChange={(v) => set('potMax', v)} />
              </div>
            )}
            {form.tipo === 'ondas_choque' && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs font-medium">Tipo de onda</Label>
                  <Select value={form.tipoOnda} onValueChange={(v) => set('tipoOnda', v as 'focal' | 'radial')}>
                    <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                    <SelectContent><SelectItem value="focal">Focal</SelectItem><SelectItem value="radial">Radial</SelectItem></SelectContent>
                  </Select>
                </div>
                <CampoNumero id="eq-af2" label="Área focal" unidade="mm²" valor={form.areaFocal} onChange={(v) => set('areaFocal', v)} />
                <CampoNumero id="eq-hz" label="Frequência máxima" unidade="Hz" valor={form.hzMax} onChange={(v) => set('hzMax', v)} />
                <CampoNumero id="eq-bar" label="Pressão máxima" unidade="bar" valor={form.barMax} onChange={(v) => set('barMax', v)} />
                <CampoNumero id="eq-efd" label="EFD máxima" unidade="mJ/mm²" valor={form.efdMax} onChange={(v) => set('efdMax', v)} />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="eq-cal" className="text-xs font-medium">Última calibração</Label>
                <Input id="eq-cal" type="date" value={form.calibracao} onChange={(e) => set('calibracao', e.target.value)} className="h-10" />
              </div>
              <div className="space-y-1">
                <Label htmlFor="eq-obs" className="text-xs font-medium">Observações</Label>
                <Input id="eq-obs" value={form.observacoes} onChange={(e) => set('observacoes', e.target.value)} className="h-10" />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" onClick={() => setForm(null)} disabled={salvar.isPending}>Voltar</Button>
              <Button onClick={gravar} disabled={salvar.isPending}>{salvar.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Salvar aparelho</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
