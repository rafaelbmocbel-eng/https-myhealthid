import { useState } from 'react';
import ChatWindow from './ChatWindow';
import { Button } from '@/components/ui/button';
import { MessageSquare, ExternalLink } from 'lucide-react';
import { useChatMensagens } from '@/hooks/useChatMensagens';
import { useAuth } from '@/contexts/AuthContext';
import { Badge } from '@/components/ui/badge';

interface Props {
  pacienteId: string;
  pacienteNome: string;
  pacienteTelefone?: string | null;
}

/**
 * Tab de chat no perfil do paciente (lado profissional).
 * Includes quick-action templates for common automated messages.
 */
export default function ChatPacienteTab({ pacienteId, pacienteNome, pacienteTelefone }: Props) {
  const { user } = useAuth();
  const { mensagens, enviarMensagem } = useChatMensagens(pacienteId);
  const [showTemplates, setShowTemplates] = useState(false);

  const templates = [
    { label: '📅 Lembrete de sessão', tipo: 'lembrete_sessao', msg: `Olá ${pacienteNome}! 😊 Lembrete: você tem sessão agendada em breve. Confirme sua presença!` },
    { label: '✅ Pós-atendimento', tipo: 'pos_atendimento', msg: `Olá ${pacienteNome}! Obrigado pela sessão de hoje. Lembre-se de seguir as orientações e preencher o diário. Qualquer dúvida, estou aqui! 💪` },
    { label: '🔄 Reengajamento', tipo: 'reengajamento', msg: `Olá ${pacienteNome}! Sentimos sua falta! 😊 Que tal agendarmos uma nova sessão? Sua continuidade é importante para o progresso do tratamento.` },
    { label: '🎂 Aniversário', tipo: 'aniversario', msg: `Parabéns, ${pacienteNome}! 🎂🎉 Desejamos muita saúde e felicidade! Continue cuidando de você.` },
  ];

  const handleTemplate = (template: typeof templates[0]) => {
    if (!user) return;
    enviarMensagem.mutate({
      paciente_id: pacienteId,
      terapeuta_id: user.id,
      mensagem: template.msg,
      remetente: 'terapeuta',
      tipo: template.tipo,
    });
    setShowTemplates(false);
  };

  const whatsappLink = pacienteTelefone
    ? `https://wa.me/55${pacienteTelefone.replace(/\D/g, '')}`
    : null;

  if (!user) return null;

  return (
    <div className="flex flex-col h-[500px] md:h-[600px]">
      {/* Header with actions */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Chat com {pacienteNome}</span>
          {mensagens.filter(m => !m.lida && m.remetente === 'paciente').length > 0 && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
              {mensagens.filter(m => !m.lida && m.remetente === 'paciente').length}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTemplates(!showTemplates)}
            className="text-xs"
          >
            Templates
          </Button>
          {whatsappLink && (
            <Button variant="ghost" size="icon" asChild className="h-8 w-8">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="h-3.5 w-3.5 text-green-600" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* Templates dropdown */}
      {showTemplates && (
        <div className="px-3 py-2 border-b border-border bg-muted/30 flex flex-wrap gap-1.5">
          {templates.map(t => (
            <Button
              key={t.tipo}
              variant="outline"
              size="sm"
              className="text-xs h-7"
              onClick={() => handleTemplate(t)}
            >
              {t.label}
            </Button>
          ))}
        </div>
      )}

      <ChatWindow
        pacienteId={pacienteId}
        terapeutaId={user.id}
        remetente="terapeuta"
        className="flex-1 min-h-0"
      />
    </div>
  );
}
