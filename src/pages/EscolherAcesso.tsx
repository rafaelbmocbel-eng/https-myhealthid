import { Link } from 'react-router-dom';
import { Heart, Stethoscope, ArrowRight } from 'lucide-react';
import LogoIcon from '@/components/LogoIcon';

// Tela neutra de escolha de acesso: separa claramente os dois públicos logo na
// porta ("Sou cliente" x "Sou profissional"), acabando com a confusão de entrar
// na área errada.
export default function EscolherAcesso() {
  return (
    <div className="min-h-[100dvh] flex flex-col items-center justify-center bg-background px-5 py-10">
      <div className="w-full max-w-3xl">
        {/* Marca */}
        <div className="flex items-center justify-center gap-2.5 mb-2">
          <LogoIcon size={44} />
          <span className="text-2xl font-black text-foreground">My Health ID</span>
        </div>
        <h1 className="text-center text-lg sm:text-xl font-bold text-foreground">Como você quer entrar?</h1>
        <p className="text-center text-sm text-muted-foreground mt-1 mb-7">Escolha a sua área de acesso.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Cliente */}
          <Link
            to="/paciente/login"
            className="group rounded-2xl border-2 border-border bg-card p-6 text-left transition-all hover:border-primary hover:shadow-lg active:scale-[0.99] flex flex-col"
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Heart className="h-6 w-6 text-primary" fill="currentColor" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wide text-primary">Portal do cliente</span>
            <h2 className="text-lg font-black text-foreground mt-0.5">Sou cliente / paciente</h2>
            <p className="text-sm text-muted-foreground mt-1 flex-1">
              Acesse seu portal: MyID, seus exercícios, plano de tratamento e evolução.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              Entrar no portal <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>

          {/* Profissional */}
          <Link
            to="/auth"
            className="group rounded-2xl border-2 border-border bg-card p-6 text-left transition-all hover:border-primary hover:shadow-lg active:scale-[0.99] flex flex-col"
          >
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
              <Stethoscope className="h-6 w-6 text-primary" />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wide text-primary">Painel do profissional</span>
            <h2 className="text-lg font-black text-foreground mt-0.5">Sou profissional</h2>
            <p className="text-sm text-muted-foreground mt-1 flex-1">
              Fisioterapeuta ou clínica: agenda, pacientes, avaliações, CRM e documentos.
            </p>
            <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
              Entrar no painel <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Quer conhecer a plataforma para profissionais?{' '}
          <Link to="/profissional" className="font-semibold text-primary hover:underline">Saiba mais →</Link>
        </p>
      </div>
    </div>
  );
}
