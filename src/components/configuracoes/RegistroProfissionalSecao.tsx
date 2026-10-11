import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Clock, Loader2, Send } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import {
  REGISTRO_MAX_CARACTERES, ROTULO_SITUACAO_VERIFICACAO, mensagemErroAdmin, situacaoVerificacao, validarRegistroProfissional,
} from '@/lib/chancela';
import { buscarMinhaVerificacao, solicitarVerificacao } from '@/lib/chancelaApi';
import { formatarDataBR } from '@/lib/governanca';
import { cn } from '@/lib/utils';

// Verificação do registro no conselho. É separada da "confirmação da profissão" (que só trava a
// escolha da lente): quem verifica é a equipe MyHealthID, o profissional só informa o registro.

export const CHAVE_MINHA_VERIFICACAO = 'minha-verificacao-profissional';

export default function RegistroProfissionalSecao() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;
  const [registro, setRegistro] = useState('');
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: [CHAVE_MINHA_VERIFICACAO, userId],
    enabled: !!userId,
    staleTime: 60_000,
    retry: false,
    queryFn: () => buscarMinhaVerificacao(userId as string),
  });

  const sugestao = data && !data.registro ? data.registroDoPerfil : null;

  useEffect(() => {
    if (data?.registro) setRegistro(data.registro);
    else if (sugestao) setRegistro(sugestao);
  }, [data?.registro, sugestao]);

  // Banco ainda sem as colunas novas (ou sem rede): a seção some em vez de mostrar um erro técnico.
  if (isLoading || isError || !data) return null;

  const situacao = situacaoVerificacao(data);
  const verificado = situacao === 'verificado';
  const validacao = validarRegistroProfissional(registro);
  const mudou = validacao.ok && validacao.valor !== data.registro;

  const enviar = async () => {
    if (!validacao.ok || validacao.valor === undefined || enviando) return;
    setEnviando(true);
    setErro(null);
    try {
      await solicitarVerificacao(validacao.valor);
      toast.success('Registro enviado. A equipe MyHealthID vai conferir e liberar a verificação.');
      await qc.invalidateQueries({ queryKey: [CHAVE_MINHA_VERIFICACAO] });
    } catch (e) {
      setErro(mensagemErroAdmin(e));
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="space-y-2 border-t border-border/40 pt-3" aria-label="Verificação do registro profissional" role="group">
      <div className="flex flex-wrap items-center gap-2">
        <Label htmlFor="registro-profissional" className="text-xs font-medium">
          Registro no conselho (CREFITO, CREF, CRN…)
        </Label>
        <span
          className={cn(
            'ml-auto inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
            verificado && 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400',
            situacao === 'aguardando' && 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400',
            situacao === 'sem_registro' && 'bg-muted/50 text-muted-foreground',
          )}
        >
          {verificado ? <BadgeCheck className="h-2.5 w-2.5" aria-hidden /> : <Clock className="h-2.5 w-2.5" aria-hidden />}
          {ROTULO_SITUACAO_VERIFICACAO[situacao]}
          {verificado && data.verificadoEm ? ` · ${formatarDataBR(data.verificadoEm)}` : ''}
        </span>
      </div>

      <Input
        id="registro-profissional"
        value={registro}
        onChange={(e) => setRegistro(e.target.value)}
        maxLength={REGISTRO_MAX_CARACTERES}
        placeholder="Número do registro e sigla do conselho"
        disabled={verificado || enviando}
        className="h-9 text-sm"
      />

      {verificado ? (
        <p className="text-[11px] text-muted-foreground">
          Registro verificado. Alterá-lo derrubaria a verificação; para trocar, fale com o suporte enviando o comprovante.
        </p>
      ) : (
        <>
          <Button size="sm" className="gap-2 rounded-xl" onClick={() => void enviar()} disabled={!mudou || enviando}>
            {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Enviar para verificação
          </Button>
          {registro.trim() !== '' && !validacao.ok && <p className="text-[11px] text-amber-700 dark:text-amber-300">{validacao.erro}</p>}
        </>
      )}
      {sugestao && !verificado && (
        <p className="text-[11px] text-muted-foreground">
          Sugestão: este é o registro que você já tem no perfil. Confira e envie para a equipe verificar.
        </p>
      )}
      {erro && <p role="alert" className="text-[11px] text-red-700 dark:text-red-300">{erro}</p>}

      <p className="text-[10px] text-muted-foreground">
        A equipe MyHealthID confere o registro no conselho. Só profissionais verificados geram planos por IA para os próprios pacientes
        e podem integrar a equipe científica. Confirmar a profissão (acima) não substitui a verificação do registro.
      </p>
    </div>
  );
}
