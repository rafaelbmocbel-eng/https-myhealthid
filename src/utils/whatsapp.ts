export function shareViaWhatsApp(phoneNumber: string, message: string, url?: string) {
  if (!phoneNumber || phoneNumber.trim() === '') {
    console.warn('WhatsApp: telefone não informado');
    return;
  }
  
  const formattedPhone = phoneNumber.replace(/\D/g, '');
  if (formattedPhone.length < 10) {
    console.warn('WhatsApp: telefone inválido', formattedPhone);
    return;
  }
  
  const phone = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

  let fullMessage = message;
  if (url) {
    fullMessage += `\n\n🔗 Link: ${url}`;
  }

  const encodedMessage = encodeURIComponent(fullMessage);
  const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
  
  // Try window.open first (works on published app, may fail in iframe preview)
  const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  
  // If window.open was blocked (returns null), try the link click fallback
  if (!win) {
    const link = document.createElement('a');
    link.href = whatsappUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export function shareAgendaLink(patientName: string, patientPhone: string, agendaUrl: string) {
  const message = `Olá ${patientName}! 👋\n\n📅 Aqui está seu link personalizado para agendar suas sessões de fisioterapia.`;
  shareViaWhatsApp(patientPhone, message, agendaUrl);
}

export function shareAvaliacaoLink(patientName: string, patientPhone: string, avaliacaoUrl: string) {
  const message = `Olá ${patientName}! 👋\n\n📋 Seu terapeuta enviou um questionário de avaliação para você preencher antes da próxima sessão.\n\nLeva cerca de 30-40 minutos e pode ser feito de onde estiver.`;
  shareViaWhatsApp(patientPhone, message, avaliacaoUrl);
}

export function shareRelatorioLink(patientName: string, patientPhone: string, relatorioUrl: string) {
  const message = `Olá ${patientName}! 👋\n\n📊 Seu relatório de avaliação do *Método Identidade* está pronto!\n\nAcesse para ver seu perfil de disfunção e as recomendações terapêuticas.`;
  shareViaWhatsApp(patientPhone, message, relatorioUrl);
}

export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.length === 11) {
    return cleaned.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  }
  if (cleaned.length === 10) {
    return cleaned.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  }
  return phone;
}

export function validateBrazilianPhone(phone: string): boolean {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.length === 10 || cleaned.length === 11;
}
