import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";

// Lazy-loaded pages for better performance
const MyIDResponder = lazy(() => import("./pages/MyIDResponder"));
const MetodoIdentidade = lazy(() => import("./pages/MetodoIdentidade"));
const CobZero = lazy(() => import("./pages/CobZero"));
const StudioPersonalID = lazy(() => import("./pages/StudioPersonalID"));
const Agenda = lazy(() => import("./pages/Agenda"));
const Pacientes = lazy(() => import("./pages/Pacientes"));
const PacientePerfil = lazy(() => import("./pages/PacientePerfil"));
const AvaliacaoPublica = lazy(() => import("./pages/AvaliacaoPublica"));
const AgendaPublica = lazy(() => import("./pages/AgendaPublica"));
const GestaoVendas = lazy(() => import("./pages/GestaoVendas"));
const Configuracoes = lazy(() => import("./pages/Configuracoes"));
const FunilPublico = lazy(() => import("./pages/FunilPublico"));
import { AuthProvider } from "./contexts/AuthContext";
import { isAuthLockTimeoutError } from "./lib/authLock";
import { Loader2 } from "lucide-react";

// Patient portal (lazy-loaded)
const PacienteLogin = lazy(() => import("./pages/paciente/PacienteLogin"));
const PacienteDashboard = lazy(() => import("./pages/paciente/PacienteDashboard"));
const PacienteAgenda = lazy(() => import("./pages/paciente/PacienteAgenda"));
const PacienteQuestionarios = lazy(() => import("./pages/paciente/PacienteQuestionarios"));
const PacientePerfilPage = lazy(() => import("./pages/paciente/PacientePerfil"));
const PacienteDiario = lazy(() => import("./pages/paciente/PacienteDiario"));
const PacienteEvolucao = lazy(() => import("./pages/paciente/PacienteEvolucao"));
const PacienteExercicios = lazy(() => import("./pages/paciente/PacienteExercicios"));
const PacientePagamentos = lazy(() => import("./pages/paciente/PacientePagamentos"));
const PacienteSaude = lazy(() => import("./pages/paciente/PacienteSaude"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (isAuthLockTimeoutError(error)) return failureCount < 5;
        return failureCount < 2;
      },
      retryDelay: (attemptIndex, error) => {
        if (isAuthLockTimeoutError(error)) {
          return Math.min(500 * 2 ** (attemptIndex - 1), 5000);
        }
        return Math.min(1000 * attemptIndex, 3000);
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: (failureCount, error) => isAuthLockTimeoutError(error) && failureCount < 2,
      retryDelay: (attemptIndex) => Math.min(500 * 2 ** (attemptIndex - 1), 3000),
    },
  },
});

const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-6 w-6 animate-spin text-primary" />
  </div>
);

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem disableTransitionOnChange>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/metodo-identidade" element={<MetodoIdentidade />} />
                <Route path="/cob-zero" element={<CobZero />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/studio-personal-id" element={<StudioPersonalID />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/pacientes" element={<Pacientes />} />
                <Route path="/pacientes/:id" element={<PacientePerfil />} />
                <Route path="/protocolos" element={<Navigate to="/pacientes" replace />} />

                <Route path="/avaliacao/:token" element={<AvaliacaoPublica />} />
                <Route path="/agenda/:token" element={<AgendaPublica />} />
                <Route path="/myid/responder/:token" element={<MyIDResponder />} />
                <Route path="/funil/:slug" element={<FunilPublico />} />
                <Route path="/relatorios" element={<Navigate to="/pacientes" replace />} />
                <Route path="/crm" element={<GestaoVendas />} />
                <Route path="/configuracoes" element={<Configuracoes />} />

                {/* Patient Portal */}
                <Route path="/paciente/login" element={<PacienteLogin />} />
                <Route path="/paciente/dashboard" element={<PacienteDashboard />} />
                <Route path="/paciente/diario" element={<PacienteDiario />} />
                <Route path="/paciente/evolucao" element={<PacienteEvolucao />} />
                <Route path="/paciente/exercicios" element={<PacienteExercicios />} />
                <Route path="/paciente/agenda" element={<PacienteAgenda />} />
                <Route path="/paciente/questionarios" element={<PacienteQuestionarios />} />
                <Route path="/paciente/pagamentos" element={<PacientePagamentos />} />
                <Route path="/paciente/saude" element={<PacienteSaude />} />
                <Route path="/paciente/perfil" element={<PacientePerfilPage />} />

                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
