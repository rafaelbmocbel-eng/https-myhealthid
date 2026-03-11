import { useState } from "react";
import PatientLayout, { type PatientSection } from "@/components/paciente/PatientLayout";
import SectionDashboard from "@/components/paciente/sections/SectionDashboard";
import SectionAgenda from "@/components/paciente/sections/SectionAgenda";
import SectionQuestionarios from "@/components/paciente/sections/SectionQuestionarios";
import SectionAtividades from "@/components/paciente/sections/SectionAtividades";
import SectionDiario from "@/components/paciente/sections/SectionDiario";
import SectionDispositivo from "@/components/paciente/sections/SectionDispositivo";
import SectionPlanos from "@/components/paciente/sections/SectionPlanos";
import SectionPerfil from "@/components/paciente/sections/SectionPerfil";

export default function CentralID() {
  const [activeSection, setActiveSection] = useState<PatientSection>("dashboard");

  const renderSection = () => {
    switch (activeSection) {
      case "dashboard":
        return <SectionDashboard onNavigate={setActiveSection} />;
      case "agenda":
        return <SectionAgenda />;
      case "questionarios":
        return <SectionQuestionarios />;
      case "atividades":
        return <SectionAtividades />;
      case "diario":
        return <SectionDiario />;
      case "dispositivo":
        return <SectionDispositivo />;
      case "planos":
        return <SectionPlanos />;
      case "perfil":
        return <SectionPerfil onNavigate={setActiveSection} />;
      default:
        return <SectionDashboard onNavigate={setActiveSection} />;
    }
  };

  return (
    <PatientLayout activeSection={activeSection} onSectionChange={setActiveSection}>
      {renderSection()}
    </PatientLayout>
  );
}
