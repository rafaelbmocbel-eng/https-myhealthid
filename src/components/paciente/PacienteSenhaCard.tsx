import { useState } from 'react';
import { Eye, EyeOff, KeyRound, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Quem entrou só pelo Google não tem senha; aqui cria uma (ou troca a atual)
// para poder entrar também com e-mail e senha.
export default function PacienteSenhaCard() {
  const { user } = useAuth();
  const [aberto, setAberto] = useState(false);
  const [senha, setSenha] = useState('');
  const [confirma, setConfirma] = useState('');
  const [mostrar, setMostrar] = useState(false);
  const [salvando, setSalvando] = useState(false);

  if (!user) return null;
  const temSenha = (user.identities || []).some((i) => i.provider === 'email') || user.app_metadata?.senha_definida === true;
  const titulo = temSenha ? 'Alterar minha senha' : 'Criar minha senha';

  const salvar = async () => {
    if (senha.length < 8) { toast.error('A senha precisa ter pelo menos 8 caracteres.'); return; }
    if (senha !== confirma) { toast.error('As duas senhas não são iguais.'); return; }
    setSalvando(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: senha });
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('reauthentication') || msg.includes('recent')) {
          toast.error('Por segurança, saia e entre de novo no portal e tente outra vez.');
        } else if (msg.includes('same')) {
          toast.error('A nova senha precisa ser diferente da atual.');
        } else if (msg.includes('weak') || msg.includes('pwned') || msg.includes('password should')) {
          toast.error('Senha muito fraca. Combine letras, números e símbolos e evite senhas comuns.');
        } else {
          toast.error(error.message);
        }
        return;
      }
      toast.success(temSenha ? 'Senha alterada!' : `Senha criada! Agora você também entra com ${user.email} e essa senha.`);
      setSenha(''); setConfirma(''); setAberto(false);
    } finally {
      setSalvando(false);
    }
  };

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
            <KeyRound className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">Senha de acesso</p>
            <p className="text-xs text-muted-foreground">
              {temSenha
                ? 'Você entra com seu e-mail e senha.'
                : 'Você entra pelo Google. Crie uma senha para entrar também com e-mail e senha.'}
            </p>
          </div>
          {!aberto && (
            <Button size="sm" variant="outline" onClick={() => setAberto(true)}>{titulo}</Button>
          )}
        </div>
        {aberto && (
          <div className="space-y-2.5">
            <div className="space-y-1">
              <Label htmlFor="nova-senha" className="text-xs">Nova senha</Label>
              <div className="relative">
                <Input
                  id="nova-senha"
                  type={mostrar ? 'text' : 'password'}
                  autoComplete="new-password"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setMostrar((v) => !v)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground"
                  aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                >
                  {mostrar ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground">Mínimo 8 caracteres. Combine letras, números e símbolos.</p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="confirma-senha" className="text-xs">Repita a senha</Label>
              <Input
                id="confirma-senha"
                type={mostrar ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirma}
                onChange={(e) => setConfirma(e.target.value)}
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button size="sm" variant="ghost" onClick={() => { setAberto(false); setSenha(''); setConfirma(''); }} disabled={salvando}>
                Cancelar
              </Button>
              <Button size="sm" onClick={salvar} disabled={salvando || !senha || !confirma} className="gap-1.5">
                {salvando && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Salvar senha
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
