import { ReactNode, useEffect } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface ProtectedRouteProps {
    children: ReactNode;
    requiredRole?: "admin" | "professional" | "patient";
}

export const ProtectedRoute = ({ children, requiredRole }: ProtectedRouteProps) => {
    const { user, profile, loading } = useAuth();
    const location = useLocation();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-slate-50">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
        );
    }

    if (!user) {
        // Redireciona para o login correspondente
        const isPatientPath = location.pathname.startsWith("/paciente");
        return <Navigate to={isPatientPath ? "/paciente/login" : "/auth"} state={{ from: location }} replace />;
    }

    // Se uma role for necessária, verifica se o perfil condiz
    if (requiredRole && profile?.role !== requiredRole) {
        // Se o perfil ainda não existe (mas o user sim), evitamos o redirect loop
        if (!profile) {
            return (
                <div className="flex flex-col items-center justify-center h-screen bg-slate-50 p-6 text-center">
                    <Loader2 className="h-8 w-8 animate-spin text-indigo-600 mb-4" />
                    <p className="text-slate-600 font-bold uppercase text-xs tracking-widest">Sincronizando Identidade...</p>
                    <p className="text-slate-400 text-[10px] mt-2 max-w-xs">Se este processo demorar mais de 10 segundos, tente atualizar a página ou verificar sua conexão.</p>
                </div>
            );
        }

        // Redirecionamento cruzado: se um paciente tenta ver algo profissional, vai pro dashboard dele
        if (profile.role === "patient") {
            return <Navigate to="/paciente/dashboard" replace />;
        }

        // Se um profissional tenta ver algo de paciente, PERMITIMOS para facilitar testes
        if (profile.role === "professional" && requiredRole === "patient") {
            return <>{children}</>;
        }

        // Caso padrão: vai pro root (hub do profissional)
        return <Navigate to="/" replace />;
    }

    return <>{children}</>;

    return <>{children}</>;
};
