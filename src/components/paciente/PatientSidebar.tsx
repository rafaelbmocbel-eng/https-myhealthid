import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
    LayoutDashboard,
    Calendar,
    DollarSign,
    ClipboardList,
    Activity,
    BookOpen,
    Settings,
    LogOut,
    User,
    History,
    Watch
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const navItems = [
    { icon: LayoutDashboard, label: "Meu Dashboard", path: "/paciente/dashboard" },
    { icon: Calendar, label: "Minha Agenda", path: "/paciente/agenda" },
    { icon: ClipboardList, label: "Questionários", path: "/paciente/questionarios" },
    { icon: History, label: "Minhas Avaliações", path: "/paciente/avaliacoes" },
    { icon: DollarSign, label: "Financeiro", path: "/paciente/financeiro" },
    { icon: Activity, label: "Minhas Métricas", path: "/paciente/atividades" },
    { icon: BookOpen, label: "Meus Planos", path: "/paciente/planos" },
    { icon: Watch, label: "Wearables", path: "/paciente/dispositivo" },
];

const PatientSidebar = ({ onClose }: { onClose?: () => void }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { signOut } = useAuth();

    const handleNav = (path: string) => {
        navigate(path);
        if (onClose) onClose();
    };

    return (
        <div className="h-full flex flex-col bg-white border-r">
            <div className="p-6 flex items-center gap-3">
                <div className="h-8 w-8 bg-indigo-600 rounded-lg flex items-center justify-center shadow-lg shadow-indigo-100">
                    <Activity className="h-5 w-5 text-white" />
                </div>
                <span className="text-xl font-black text-slate-900 tracking-tight">Hub Paciente</span>
            </div>

            <nav className="flex-1 px-4 space-y-1">
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    return (
                        <button
                            key={item.path}
                            onClick={() => handleNav(item.path)}
                            className={cn(
                                "w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 group active:scale-95",
                                isActive
                                    ? "bg-indigo-600 text-white shadow-xl shadow-indigo-100"
                                    : "text-slate-500 hover:bg-slate-50 hover:text-indigo-600"
                            )}
                        >
                            <item.icon className={cn(
                                "h-5 w-5",
                                isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600"
                            )} />
                            {item.label}
                            {isActive && (
                                <div className="ml-auto h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                            )}
                        </button>
                    );
                })}
            </nav>

            <div className="p-4 mt-auto border-t space-y-2">
                <button
                    onClick={() => handleNav("/paciente/perfil")}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-slate-500 hover:bg-slate-50 transition-colors"
                >
                    <Settings className="h-5 w-5 text-slate-400" />
                    Configurações
                </button>
                <button
                    onClick={() => signOut()}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-500 hover:bg-red-50 transition-colors"
                >
                    <LogOut className="h-5 w-5" />
                    Sair do Portal
                </button>
            </div>
        </div>
    );
};

export default PatientSidebar;
