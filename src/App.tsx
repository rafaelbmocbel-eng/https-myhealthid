import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import { lazy, Suspense } from "react";
import PatientGuard from "./components/PatientGuard";
import ProtectedPatientRoute from "./components/paciente/ProtectedPatientRoute";
import ScrollToTop from "./components/ScrollToTop";

// ALL pages lazy-loaded for optimal code-splitting
const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const MetodoIdentidade = lazy(() => import("./pages/MetodoIdentidade"));
const NotFound = lazy(() => import("./pages/NotFound"));
const MyIDResponder = lazy(() => import("./pages/MyIDResponder"));
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
const Eventos = lazy(() => import("./pages/Eventos"));
const EventoPublico = lazy(() => import("./pages/EventoPublico"));
const CadastroCliente = lazy(() => import("./pages/CadastroCliente"));
import { AuthProvider } from "./contexts/AuthContext";
import { isAuthLockTimeoutError } from "./lib/authLock";
import { Loader2 } from "lucide-react";

// Patient portal (lazy-loaded)
const PacienteLogin = lazy(() => import("./pages/paciente/PacienteLogin"));
const PortalGate = lazy(() => import("./pages/paciente/PortalGate"));
const PacienteDashboard = lazy(() => import("./pages/paciente/PacienteDashboard"));
const PacienteAgenda = lazy(() => import("./pages/paciente/PacienteAgenda"));
const PacienteQuestionarios = lazy(() => import("./pages/paciente/PacienteQuestionarios"));
const PacientePerfilPage = lazy(() => import("./pages/paciente/PacientePerfil"));
const PacienteDiario = lazy(() => import("./pages/paciente/PacienteDiario"));
const PacienteEvolucao = lazy(() => import("./pages/paciente/PacienteEvolucao"));
const PacienteExercicios = lazy(() => import("./pages/paciente/PacienteExercicios"));
const PacientePagamentos = lazy(() => import("./pages/paciente/PacientePagamentos"));
const PacienteSaude = lazy(() => import("./pages/paciente/PacienteSaude"));
const PacienteEventos = lazy(() => import("./pages/paciente/PacienteEventos"));

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
          <ScrollToTop />
          <AuthProvider>
            <Suspense fallback={<LazyFallback />}>
              <Routes>
                <Route path="/" element={<PatientGuard><Index /></PatientGuard>} />
                <Route path="/metodo-identidade" element={<PatientGuard><MetodoIdentidade /></PatientGuard>} />
                <Route path="/cob-zero" element={<PatientGuard><CobZero /></PatientGuard>} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/studio-personal-id" element={<PatientGuard><StudioPersonalID /></PatientGuard>} />
                <Route path="/agenda" element={<PatientGuard><Agenda /></PatientGuard>} />
                <Route path="/pacientes" element={<PatientGuard><Pacientes /></PatientGuard>} />
                <Route path="/pacientes/:id" element={<PatientGuard><PacientePerfil /></PatientGuard>} />
                <Route path="/protocolos" element={<Navigate to="/pacientes" replace />} />

                <Route path="/avaliacao/:token" element={<AvaliacaoPublica />} />
                <Route path="/agenda/:token" element={<AgendaPublica />} />
                <Route path="/myid/responder/:token" element={<MyIDResponder />} />
                <Route path="/funil/:slug" element={<FunilPublico />} />
                <Route path="/relatorios" element={<Navigate to="/pacientes" replace />} />
                <Route path="/crm" element={<PatientGuard><GestaoVendas /></PatientGuard>} />
                <Route path="/eventos" element={<PatientGuard><Eventos /></PatientGuard>} />
                <Route path="/evento/:eventoId" element={<EventoPublico />} />
                <Route path="/cadastro/:slug" element={<CadastroCliente />} />
                <Route path="/configuracoes" element={<PatientGuard><Configuracoes /></PatientGuard>} />

                {/* Patient Portal */}
                <Route path="/paciente/login" element={<PacienteLogin />} />
                <Route path="/portal/:token" element={<PortalGate />} />
                <Route path="/paciente/dashboard" element={<ProtectedPatientRoute><PacienteDashboard /></ProtectedPatientRoute>} />
                <Route path="/paciente/diario" element={<ProtectedPatientRoute><PacienteDiario /></ProtectedPatientRoute>} />
                <Route path="/paciente/evolucao" element={<ProtectedPatientRoute><PacienteEvolucao /></ProtectedPatientRoute>} />
                <Route path="/paciente/exercicios" element={<ProtectedPatientRoute><PacienteExercicios /></ProtectedPatientRoute>} />
                <Route path="/paciente/agenda" element={<ProtectedPatientRoute><PacienteAgenda /></ProtectedPatientRoute>} />
                <Route path="/paciente/questionarios" element={<ProtectedPatientRoute><PacienteQuestionarios /></ProtectedPatientRoute>} />
                <Route path="/paciente/pagamentos" element={<ProtectedPatientRoute><PacientePagamentos /></ProtectedPatientRoute>} />
                <Route path="/paciente/saude" element={<ProtectedPatientRoute><PacienteSaude /></ProtectedPatientRoute>} />
                <Route path="/paciente/eventos" element={<ProtectedPatientRoute><PacienteEventos /></ProtectedPatientRoute>} />
                <Route path="/paciente/perfil" element={<ProtectedPatientRoute><PacientePerfilPage /></ProtectedPatientRoute>} />

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
