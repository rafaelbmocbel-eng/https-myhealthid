import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { MyIDWizard } from '@/components/myid/MyIDWizard';
import { MyIDResult } from '@/components/myid/MyIDResult';
import { useToast } from '@/components/ui/use-toast';
import { Loader2 } from 'lucide-react';

export default function MyIDResponder() {
    const { token } = useParams<{ token: string }>();
    const navigate = useNavigate();
    const { toast } = useToast();
    const [loading, setLoading] = useState(true);
    const [evalData, setEvalData] = useState<any>(null);

    useEffect(() => {
        async function loadEvaluation() {
            if (!token) {
                toast({ title: "Erro", description: "Token inválido.", variant: "destructive" });
                return;
            }

            const { data, error } = await supabase
                .from('myid_avaliacoes')
                .select('*')
                .eq('token_acesso', token)
                .maybeSingle();

            if (error || !data) {
                console.error('Evaluation not found or error:', error, token);
                toast({ title: "Erro", description: "Avaliação não encontrada ou já concluída/inválida.", variant: "destructive" });
                setLoading(false);
                return;
            }

            if (data.status === 'concluido') {
                toast({ title: "Aviso", description: "Esta avaliação já foi concluída e não pode ser alterada.", variant: "default" });
                setLoading(false);
                // Exibiríamos o resultado para ele aqui se quiséssemos, mas como é público, melhor não por privacidade, ou sim? 
                // Vamos deixar ele ver o próprio resultado se tiver o token.
                setEvalData(data);
                return;
            }

            setEvalData(data);
            if (data.status === 'pendente') {
                // Marcar como em andamento
                await supabase.from('myid_avaliacoes').update({ status: 'em_andamento' }).eq('id', data.id);
            }
            setLoading(false);
        }

        loadEvaluation();
    }, [token, toast]);

    const handleComplete = async (result: any, rawData: any) => {
        try {
            console.log('Submitting MyID with token:', token);
            const { data: resp, error } = await supabase.functions.invoke('complete-myid', {
                body: { token, result, rawData },
            });

            if (error) {
                console.error('Supabase function error:', error);
                throw error;
            }
            if (resp?.error) {
                console.error('Function response error:', resp.error);
                throw new Error(resp.error);
            }
            console.log('MyID submission success:', resp);

            toast({
                title: "Sucesso!",
                description: "Sua avaliação MyID foi enviada com sucesso.",
            });

            // Update local state to show results
            setEvalData({ ...evalData, status: 'concluido', resultado_processado: result, respostas_brutas: rawData });

        } catch (error: any) {
            toast({
                title: "Erro ao salvar",
                description: error.message,
                variant: "destructive"
            });
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 flex items-center justify-center">
                <div className="flex flex-col items-center gap-2">
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm text-slate-500 font-medium">Carregando questionário...</p>
                </div>
            </div>
        );
    }

    if (!evalData) {
        return (
            <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4 text-center">
                <h1 className="text-2xl font-bold text-slate-900 mb-2">Link Inválido</h1>
                <p className="text-slate-500 mb-6">O link que você acessou não é válido ou já expirou.</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="bg-white border-b sticky top-0 z-10 px-4 py-3 shadow-sm flex items-center justify-center">
                <div className="font-bold text-xl text-primary flex items-center gap-2">
                    <span className="bg-primary text-white w-8 h-8 rounded-full flex items-center justify-center text-sm">ID</span>
                    MyID
                </div>
            </div>

            <main className="pb-12 pt-4">
                {evalData.status === 'concluido' ? (
                    <div className="w-full max-w-4xl mx-auto py-8">
                        <div className="bg-green-50 text-green-800 p-4 rounded-md mb-8 mx-4 text-center border border-green-200">
                            <p className="font-medium">Obrigado! Sua avaliação já foi concluída e enviada ao profissional.</p>
                        </div>
                        {/* If we want to show the result to the patient right away */}
                        {evalData.resultado_processado && (
                            <div className="mt-8 bg-white p-6 rounded-xl border shadow-sm">
                                <MyIDResult result={evalData.resultado_processado} rawData={evalData.respostas_brutas} />
                            </div>
                        )}
                    </div>
                ) : (
                    <MyIDWizard onComplete={handleComplete} initialData={evalData.respostas_brutas || {}} />
                )}
            </main>
        </div>
    );
}
