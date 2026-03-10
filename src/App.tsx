import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import MyIDResponder from "./pages/MyIDResponder";
import MetodoIdentidade from "./pages/MetodoIdentidade";
import CobZero from "./pages/CobZero";
import StudioPersonalID from "./pages/StudioPersonalID";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import PatientLogin from "./pages/paciente/PatientLogin";
import PatientRegister from "./pages/paciente/PatientRegister";
import PatientDashboard from "./pages/paciente/PatientDashboard";
import PatientAgenda from "./pages/paciente/PatientAgenda";
import PatientQuestionnaires from "./pages/paciente/PatientQuestionnaires";
import PatientActivities from "./pages/paciente/PatientActivities";
import PatientDiary from "./pages/paciente/PatientDiary";
import PatientWearable from "./pages/paciente/PatientWearable";
import PatientPlans from "./pages/paciente/PatientPlans";
import PatientProfileSettings from "./pages/paciente/PatientProfileSettings";
import ProfessionalHub from "./pages/ProfessionalHub";
import Agenda from "./pages/Agenda";
import Pacientes from "./pages/Pacientes";
import PacientePerfil from "./pages/PacientePerfil";
import Protocolos from "./pages/Protocolos"; // kept for direct URL access
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
            <Route path="/paciente/dashboard" element={<PatientDashboard />} />
            <Route path="/paciente/agenda" element={<PatientAgenda />} />
            <Route path="/paciente/questionarios" element={<PatientQuestionnaires />} />
            <Route path="/paciente/atividades" element={<PatientActivities />} />
            <Route path="/paciente/diario" element={<PatientDiary />} />
            <Route path="/paciente/dispositivo" element={<PatientWearable />} />
            <Route path="/paciente/planos" element={<PatientPlans />} />
            <Route path="/paciente/perfil" element={<PatientProfileSettings />} />
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
