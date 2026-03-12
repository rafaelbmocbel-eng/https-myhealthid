import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Index from "./pages/Index";
import MyIDResponder from "./pages/MyIDResponder";
import MetodoIdentidade from "./pages/MetodoIdentidade";
import CobZero from "./pages/CobZero";
import StudioPersonalID from "./pages/StudioPersonalID";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import PatientLogin from "./pages/paciente/PatientLogin";
import PatientRegister from "./pages/paciente/PatientRegister";
import PatientPortalAccess from "./pages/paciente/PatientPortalAccess";
import CentralID from "./pages/paciente/CentralID";
import ProfessionalHub from "./pages/ProfessionalHub";
import Agenda from "./pages/Agenda";
import Pacientes from "./pages/Pacientes";
import PacientePerfil from "./pages/PacientePerfil";
import Protocolos from "./pages/Protocolos";
import AvaliacaoPublica from "./pages/AvaliacaoPublica";
import AgendaPublica from "./pages/AgendaPublica";
import Relatorios from "./pages/Relatorios";
import GestaoVendas from "./pages/GestaoVendas";
import Configuracoes from "./pages/Configuracoes";
import FunilChat from "./pages/FunilChat";
import { AuthProvider } from "./contexts/AuthContext";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/metodo-identidade" element={<MetodoIdentidade />} />
            <Route path="/cob-zero" element={<CobZero />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/paciente/login" element={<PatientLogin />} />
            <Route path="/paciente/cadastro" element={<PatientRegister />} />

            {/* Central ID — single patient portal page */}
            <Route path="/paciente/dashboard" element={<CentralID />} />
            {/* Legacy patient routes redirect to Central ID */}
            <Route path="/paciente/agenda" element={<Navigate to="/paciente/dashboard" replace />} />
            <Route path="/paciente/questionarios" element={<Navigate to="/paciente/dashboard" replace />} />
            <Route path="/paciente/atividades" element={<Navigate to="/paciente/dashboard" replace />} />
            <Route path="/paciente/diario" element={<Navigate to="/paciente/dashboard" replace />} />
            <Route path="/paciente/dispositivo" element={<Navigate to="/paciente/dashboard" replace />} />
            <Route path="/paciente/planos" element={<Navigate to="/paciente/dashboard" replace />} />
            <Route path="/paciente/perfil" element={<Navigate to="/paciente/dashboard" replace />} />

            <Route path="/studio-personal-id" element={<StudioPersonalID />} />
            <Route path="/hub-paciente" element={<ProfessionalHub />} />
            <Route path="/agenda" element={<Agenda />} />
            <Route path="/pacientes" element={<Pacientes />} />
            <Route path="/pacientes/:id" element={<PacientePerfil />} />
            <Route path="/protocolos" element={<Protocolos />} />

            <Route path="/avaliacao/:token" element={<AvaliacaoPublica />} />
            <Route path="/agenda/:token" element={<AgendaPublica />} />
            <Route path="/myid/responder/:token" element={<MyIDResponder />} />
            <Route path="/funil/:slug" element={<FunilChat />} />
            <Route path="/relatorios" element={<Relatorios />} />
            <Route path="/crm" element={<GestaoVendas />} />
            <Route path="/configuracoes" element={<Configuracoes />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
