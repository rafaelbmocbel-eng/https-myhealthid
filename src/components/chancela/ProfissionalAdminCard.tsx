import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, Loader2, ShieldOff, Users } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { SUPER_ADMINS } from '@/hooks/useIsSuperAdmin';
import {
  AREAS_EQUIPE, CHAVE_PROFISSIONAIS_ADMIN, areasDoPerfil, erroRegistroAlterado, mensagemErroAdmin, perfilHabilitaArea, rotuloPerfil,
  type AreaEquipe, type ProfissionalAdmin,
} from '@/lib/chancela';
import { definirEquipeCientifica, verificarProfissional } from '@/lib/chancelaApi';
import { formatarDataBR } from '@/lib/governanca';

// Uma pessoa na administração: registro informado, verificação (só o administrador concede),
// equipe científica e áreas em que ela chancela. O banco confere de novo dentro de cada RPC.

const NOTA_MAX_CARACTERES = 300;

type Modo = 'verificar' | 'remover';

interface ConfirmarProps {
  modo: Modo | null;
  p: ProfissionalAdmin;
  ocupado: boolean;
  onCancelar: () => void;
  onConfirmar: (nota: string) => void;
}

function ConfirmarVerificacaoDialog({ modo, p, ocupado, onCancelar, onConfirmar }: ConfirmarProps) {
  const [nota, setNota] = useState('');
  const verificar = modo === 'verificar';
  const perfil = p.perfil ? rotuloPerfil(p.perfil) : 'perfil não definido';

  return (
    <Dialog open={modo !== null} onOpenChange={(v) => { if (!v && !ocupado) onCancelar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {verificar
              ? <><BadgeCheck className="h-5 w-5 text-emerald-600 shrink-0" /> Verificar {p.nome}?</>
              : <><ShieldOff className="h-5 w-5 text-red-600 shrink-0" /> Remover a verificação de {p.nome}?</>}
          </DialogTitle>
          <DialogDescription>
            {verificar
              ? `Confirme que você conferiu o registro ${p.registro ?? ''} (${perfil}) no conselho profissional. A verificação libera a geração de planos por IA para os pacientes dessa pessoa e permite incluí-la na equipe científica.`
              : 'A pessoa deixa de poder gerar planos por IA para os pacientes dela, sai da equipe científica (e perde as áreas) e só volta a chancelar depois de ser verificada e incluída de novo.'}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1">
          <Label htmlFor={`nota-verificacao-${p.userId}`} className="text-xs">Nota (opcional)</Label>
          <Textarea
            id={`nota-verificacao-${p.userId}`}
            rows={2}
            value={nota}
            maxLength={NOTA_MAX_CARACTERES}
            onChange={(e) => setNota(e.target.value)}
            placeholder={verificar ? 'Ex.: registro conferido no site do conselho.' : 'Ex.: registro vencido.'}
            className="text-sm"
            disabled={ocupado}
          />
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={onCancelar} disabled={ocupado}>Cancelar</Button>
          <Button
            variant={verificar ? 'default' : 'destructive'}
            onClick={() => onConfirmar(nota)}
            disabled={ocupado}
            className="gap-1.5"
          >
            {ocupado && <Loader2 className="h-4 w-4 animate-spin" />}
            {verificar ? 'Verificar' : 'Remover verificação'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function ProfissionalAdminCard({ p }: { p: ProfissionalAdmin }) {
  const qc = useQueryClient();
  const [ocupado, setOcupado] = useState(false);
  const [modo, setModo] = useState<Modo | null>(null);

  const contaAdministradora = !!p.email && SUPER_ADMINS.includes(p.email.toLowerCase());
  const podeEntrarNaEquipe = p.verificado || p.equipeCientifica;
  const semEmail = !p.email;

  const atualizarLista = () => qc.invalidateQueries({ queryKey: CHAVE_PROFISSIONAIS_ADMIN });

  const executar = async (acao: () => Promise<void>, sucesso: string): Promise<boolean> => {
    setOcupado(true);
    try {
      await acao();
      toast.success(sucesso);
      await atualizarLista();
      return true;
    } catch (e) {
      toast.error(mensagemErroAdmin(e));
      if (erroRegistroAlterado(e)) await atualizarLista();
      return false;
    } finally {
      setOcupado(false);
    }
  };

  const confirmarVerificacao = async (nota: string) => {
    if (!modo) return;
    const verificar = modo === 'verificar';
    const ok = await executar(
      () => verificarProfissional({ userId: p.userId, verificado: verificar, nota, registroVisto: p.registro }),
      verificar ? `${p.nome} foi verificado(a).` : `A verificação de ${p.nome} foi removida.`,
    );
    if (ok) setModo(null);
  };

  const alternarEquipe = (ativo: boolean) => {
    if (!p.email) return;
    let areas: AreaEquipe[] = [];
    if (ativo) areas = p.equipeAreas.length > 0 ? p.equipeAreas : areasDoPerfil(p.perfil);
    void executar(
      () => definirEquipeCientifica({ email: p.email as string, ativo, areas }),
      ativo ? `${p.nome} entrou na equipe científica.` : `${p.nome} saiu da equipe científica.`,
    );
  };

  const alternarArea = (area: AreaEquipe, marcada: boolean) => {
    if (!p.email) return;
    const areas = marcada ? [...p.equipeAreas.filter((a) => a !== area), area] : p.equipeAreas.filter((a) => a !== area);
    void executar(
      () => definirEquipeCientifica({ email: p.email as string, ativo: true, areas }),
      'Áreas da equipe atualizadas.',
    );
  };

  const areasSemPerfil = AREAS_EQUIPE.filter((a) => p.equipeAreas.includes(a.id) && !perfilHabilitaArea(a.id, p.perfil));

  return (
    <li className="rounded-xl border border-border/60 bg-card p-3 space-y-2.5">
      <div className="flex flex-wrap items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{p.nome}</p>
          <p className="text-xs text-muted-foreground truncate">
            {[p.email, p.perfil ? rotuloPerfil(p.perfil) : 'Perfil não definido'].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {contaAdministradora && <Badge variant="info" size="md">Administrador</Badge>}
          {p.verificado
            ? <Badge variant="success" size="md">Verificado{p.verificadoEm ? ` em ${formatarDataBR(p.verificadoEm)}` : ''}</Badge>
            : <Badge variant={p.registro ? 'warning' : 'neutral'} size="md">{p.registro ? 'Aguardando verificação' : 'Sem registro'}</Badge>}
          {p.equipeCientifica && <Badge variant="info" size="md">Equipe científica</Badge>}
        </div>
      </div>

      <p className="text-xs">
        <span className="text-muted-foreground">Registro no conselho: </span>
        {p.registro ? <span className="font-semibold">{p.registro}</span> : <span className="text-muted-foreground">ainda não informado</span>}
      </p>

      {contaAdministradora ? (
        <p className="text-xs text-muted-foreground">
          Conta do administrador: o banco a reconhece pelo e-mail, então ela já vale como verificada e como equipe, em qualquer área.
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {p.verificado ? (
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 text-red-700 hover:text-red-700"
                disabled={ocupado}
                onClick={() => setModo('remover')}
              >
                <ShieldOff className="h-4 w-4" aria-hidden /> Remover verificação
              </Button>
            ) : (
              <Button
                size="sm"
                className="gap-1.5"
                disabled={ocupado || !p.registro}
                title={p.registro ? undefined : 'A pessoa precisa informar o registro antes.'}
                onClick={() => setModo('verificar')}
              >
                <BadgeCheck className="h-4 w-4" aria-hidden /> Verificar
              </Button>
            )}
            {!p.verificado && !p.registro && (
              <span className="text-[11px] text-muted-foreground">A pessoa precisa informar o registro em Configurações.</span>
            )}
          </div>

          <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-2">
            <div className="flex items-center gap-2">
              <Switch
                id={`equipe-${p.userId}`}
                checked={p.equipeCientifica}
                disabled={ocupado || !podeEntrarNaEquipe || semEmail}
                onCheckedChange={alternarEquipe}
                aria-label={`Equipe científica: ${p.nome}`}
              />
              <Label htmlFor={`equipe-${p.userId}`} className="text-xs font-semibold flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5 text-primary" aria-hidden /> Equipe científica
              </Label>
              {ocupado && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label="Salvando" />}
            </div>
            {!podeEntrarNaEquipe && (
              <p className="text-[11px] text-muted-foreground">Verifique o profissional antes de incluí-lo na equipe científica.</p>
            )}
            {semEmail && <p className="text-[11px] text-muted-foreground">Sem e-mail no cadastro: não dá para alterar a equipe por aqui.</p>}

            {p.equipeCientifica && (
              <fieldset className="space-y-1.5" disabled={ocupado}>
                <legend className="text-[11px] text-muted-foreground">Áreas em que chancela</legend>
                <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                  {AREAS_EQUIPE.map((a) => (
                    <div key={a.id} className="flex items-center gap-2">
                      <Checkbox
                        id={`area-${a.id}-${p.userId}`}
                        checked={p.equipeAreas.includes(a.id)}
                        onCheckedChange={(v) => alternarArea(a.id, v === true)}
                        disabled={ocupado}
                        aria-label={`${a.rotulo}: ${p.nome}`}
                      />
                      <Label htmlFor={`area-${a.id}-${p.userId}`} className="text-xs font-normal">
                        {a.rotulo} <span className="text-muted-foreground">({a.exige})</span>
                      </Label>
                    </div>
                  ))}
                </div>
                {p.equipeAreas.length === 0 && (
                  <p className="text-[11px] text-amber-700 dark:text-amber-300">
                    Sem nenhuma área marcada, essa pessoa lê a fila mas não chancela nada.
                  </p>
                )}
                {areasSemPerfil.map((a) => (
                  <p key={a.id} className="flex items-start gap-1 text-[11px] text-amber-700 dark:text-amber-300">
                    <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" aria-hidden />
                    <span>{a.rotulo} exige {a.exige}, e o perfil desta pessoa não habilita: o banco recusa as chancelas dela nesta área.</span>
                  </p>
                ))}
              </fieldset>
            )}
          </div>
        </>
      )}

      <ConfirmarVerificacaoDialog
        key={`${p.userId}-${modo ?? 'fechado'}`}
        modo={modo}
        p={p}
        ocupado={ocupado}
        onCancelar={() => setModo(null)}
        onConfirmar={(nota) => void confirmarVerificacao(nota)}
      />
    </li>
  );
}
