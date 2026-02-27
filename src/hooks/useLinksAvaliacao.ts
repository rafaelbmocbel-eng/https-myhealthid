import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { getAvaliacaoUrl } from '@/utils/linkUrls';

export interface LinkAvaliacao {
  id: string;
  paciente_id: string;
  terapeuta_id: string;
  token: string;
  blocos_inclusos: number[];
  data_criacao: string;
  data_expiracao: string;
  acessos_totais: number;
  data_primeiro_acesso?: string;
  data_ultimo_acesso?: string;
  status: string;
}

export function useLinksAvaliacao() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [gerando, setGerando] = useState(false);

  const { data: links = [], isLoading } = useQuery({
    queryKey: ['links_avaliacao', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('links_avaliacao')
        .select('*')
        .eq('terapeuta_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as LinkAvaliacao[];
    },
    enabled: !!user,
  });

  const gerarLink = async (pacienteId: string): Promise<LinkAvaliacao | null> => {
    if (!user) return null;
    setGerando(true);
    try {
      // Cancela links ativos anteriores para este paciente
      await supabase
        .from('links_avaliacao')
        .update({ status: 'cancelado' })
        .eq('paciente_id', pacienteId)
        .eq('terapeuta_id', user.id)
        .eq('status', 'ativo');

      const dataExpiracao = new Date();
      dataExpiracao.setDate(dataExpiracao.getDate() + 30);

      const { data, error } = await supabase
        .from('links_avaliacao')
        .insert({
          paciente_id: pacienteId,
          terapeuta_id: user.id,
          blocos_inclusos: [1, 2, 3, 4, 5, 6],
          status: 'ativo',
          data_expiracao: dataExpiracao.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      qc.invalidateQueries({ queryKey: ['links_avaliacao'] });
      toast({ title: 'Link gerado! ✅', description: 'Válido por 30 dias.' });
      return data as LinkAvaliacao;
    } catch (e: any) {
      toast({ title: 'Erro ao gerar link', description: e.message, variant: 'destructive' });
      return null;
    } finally {
      setGerando(false);
    }
  };

  const cancelarLink = async (id: string) => {
    await supabase.from('links_avaliacao').update({ status: 'cancelado' }).eq('id', id);
    qc.invalidateQueries({ queryKey: ['links_avaliacao'] });
    toast({ title: 'Link cancelado' });
  };

  const getLinkUrl = (token: string) => getAvaliacaoUrl(token);

  const copiarLink = async (token: string) => {
    const url = getLinkUrl(token);
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(url);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = url;
        textArea.style.position = "absolute";
        textArea.style.left = "-999999px";
        document.body.prepend(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      toast({ title: 'Link copiado! 📋', description: 'Pronto para enviar.' });
    } catch (error) {
      toast({ title: 'Erro ao copiar', description: 'Tente novamente.', variant: 'destructive' });
    }
  };

  return { links, isLoading, gerando, gerarLink, cancelarLink, copiarLink, getLinkUrl };
}
