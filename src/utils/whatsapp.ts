// ── WhatsApp Integration Utils ────────────────────────────────────────
// Core sharing function and message templates for patient communication

import { supabase } from '@/integrations/supabase/client';

export async function shareViaWhatsApp(phoneNumber: string, message: string, url?: string, direct: boolean = false): Promise<{ success: boolean, error?: string }> {
  if (!phoneNumber || phoneNumber.trim() === '') {
    console.warn('WhatsApp: telefone não informado');
    return { success: false, error: 'Telefone não informado' };
  }

  const formattedPhone = phoneNumber.replace(/\D/g, '');
  if (formattedPhone.length < 10) {
    console.warn('WhatsApp: telefone inválido', formattedPhone);
    return { success: false, error: 'Telefone inválido' };
  }

  const phone = formattedPhone.startsWith('55') ? formattedPhone : `55${formattedPhone}`;

  let fullMessage = message;
  if (url) {
    fullMessage += `\n\n🔗 Link: ${url}`;
  }

  // Se o envio for direto via API (Z-API) em background
  if (direct) {
    try {
      const { data, error } = await supabase.functions.invoke('send-whatsapp', {
        body: { phone, message: fullMessage }
      });

      if (error) throw error;
      return { success: true };
    } catch (e: any) {
      console.error('Erro ao enviar WhatsApp direto:', e);
      return { success: false, error: e.message || 'Erro ao comunicar com a provedora Z-API' };
    }
  }

  // Fallback tradicional abrindo aba/app web
  const encodedMessage = encodeURIComponent(fullMessage);
  const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;

  const win = window.open(whatsappUrl, '_blank', 'noopener,noreferrer');
  if (!win) {
    const link = document.createElement('a');
    link.href = whatsappUrl;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return { success: true };
}

// ── Existing templates ────────────────────────────────────────────────

export async function shareAgendaLink(patientName: string, patientPhone: string, agendaUrl: string, direct: boolean = false) {
  const message = `Olá ${patientName}! 👋\n\n📅 Aqui está seu link personalizado para agendar suas sessões de fisioterapia.`;
  return shareViaWhatsApp(patientPhone, message, agendaUrl, direct);
}

export async function shareAvaliacaoLink(patientName: string, patientPhone: string, avaliacaoUrl: string, direct: boolean = false) {
  const message = `Olá ${patientName}! 👋\n\n📋 Seu terapeuta enviou um questionário de avaliação para você preencher antes da próxima sessão.\n\nLeva cerca de 30-40 minutos e pode ser feito de onde estiver.`;
  return shareViaWhatsApp(patientPhone, message, avaliacaoUrl, direct);
}

export async function shareRelatorioLink(patientName: string, patientPhone: string, relatorioUrl: string, direct: boolean = false) {
  const message = `Olá ${patientName}! 👋\n\n📊 Seu relatório de avaliação do *Método Identidade* está pronto!\n\nAcesse para ver seu perfil de disfunção e as recomendações terapêuticas.`;
  return shareViaWhatsApp(patientPhone, message, relatorioUrl, direct);
}

export async function shareMyIDResults(patientName: string, patientPhone: string, result: any, direct: boolean = false) {
  const score = result.myidScore?.toFixed(1) || '0.0';
  const status = result.classificacao || 'LEVE';
  const message = `*RESUMO CLÍNICO - MyID Sistêmico*\n\n` +
    `Olá! 👋 Aqui estão os resultados da minha avaliação:\n\n` +
    `👤 *Paciente:* ${patientName}\n` +
    `📊 *MyID Score:* ${score}\n` +
    `🔴 *Status:* ${status}\n\n` +
    `Esta "Impressão Digital" reflete o equilíbrio entre minhas demandas e minha capacidade de suporte atual.`;
  return shareViaWhatsApp(patientPhone, message, undefined, direct);
}

export async function sharePropostaComercial(patientName: string, patientPhone: string, serviceName: string, value: string, direct: boolean = false) {
  const differentials: Record<string, string[]> = {
    'Método Identidade': [
      'Análise da Impressão Digital Sistêmica (MyID)',
      'Identificação de gatilhos autonômicos',
      'Planejamento de conduta bio-individualizada'
    ],
    'COB° ZERO': [
      'Foco em correção postural e escoliose',
      'Protocolo específico para redução de ângulo Cobb',
      'Acompanhamento radiográfico e funcional'
    ],
    'Studio Personal ID': [
      'Treinamento de elite baseado no seu MyID',
      'Foco em performance e prevenção de lesões',
      'Avaliação de bio-individualidade metabólica'
    ]
  };

  const myDiffs = differentials[serviceName] || ['Atendimento personalizado de alta performance'];
  const diffsText = myDiffs.map(d => `✅ ${d}`).join('\n');

  const message = `*PROPOSTA DE VALOR - MyHealthID*\n\n` +
    `Olá ${patientName}! Conforme conversamos, aqui estão os detalhes do plano recomendado:\n\n` +
    `🎯 *Serviço:* ${serviceName}\n` +
    `${diffsText}\n\n` +
    `💰 *Investimento:* ${value}\n\n` +
    `Vamos começar sua jornada de transformação?`;
  return shareViaWhatsApp(patientPhone, message, undefined, direct);
}

// ── NEW: Funnel stage templates ───────────────────────────────────────

export async function shareBoasVindas(patientName: string, patientPhone: string, terapeutaName: string, direct: boolean = false) {
  const message =
    `Olá ${patientName}! 👋\n\n` +
    `Sou *${terapeutaName}* e estou muito feliz em recebê-lo(a) na nossa equipe!\n\n` +
    `🏥 A partir de agora começamos sua jornada de saúde personalizada com o *Método Identidade*.\n\n` +
    `📋 Em breve enviarei seu questionário de avaliação para começarmos a mapear seu perfil.\n\n` +
    `Qualquer dúvida, estou aqui! 😊`;
  return shareViaWhatsApp(patientPhone, message, undefined, direct);
}

export async function sharePosAvaliacao(patientName: string, patientPhone: string, achados: string, direct: boolean = false) {
  const message =
    `Olá ${patientName}! 👋\n\n` +
    `Concluímos sua avaliação e quero compartilhar os principais achados:\n\n` +
    `${achados}\n\n` +
    `📌 Com base nesses resultados, preparei uma *diretriz de tratamento personalizada* para você.\n\n` +
    `Na próxima sessão, vamos discutir o plano terapêutico completo. Até lá! 💪`;
  return shareViaWhatsApp(patientPhone, message, undefined, direct);
}

export async function sharePosDiretriz(patientName: string, patientPhone: string, diretriz: string, direct: boolean = false) {
  const message =
    `Olá ${patientName}! 📋\n\n` +
    `Aqui está o resumo da sua *Diretriz de Tratamento*:\n\n` +
    `${diretriz}\n\n` +
    `Lembre-se: a constância é o segredo! Nos vemos na próxima sessão. 🙌`;
  return shareViaWhatsApp(patientPhone, message, undefined, direct);
}

export async function shareLembreteRetorno(patientName: string, patientPhone: string, dataRetorno: string, direct: boolean = false) {
  const message =
    `Olá ${patientName}! ⏰\n\n` +
    `Lembrete gentil: sua *reavaliação* está prevista para *${dataRetorno}*.\n\n` +
    `É muito importante para medirmos seu progresso e ajustarmos o tratamento conforme necessário.\n\n` +
    `📅 Precisa reagendar? Me avise que encontramos o melhor horário para você!`;
  return shareViaWhatsApp(patientPhone, message, undefined, direct);
}

export async function shareConfirmacaoSessao(
  patientName: string,
  patientPhone: string,
  dataHora: string,
  terapeutaName?: string,
  direct: boolean = false,
) {
  const assinatura = terapeutaName ? `\n\n— ${terapeutaName}` : '';
  const message =
    `Olá ${patientName}! ✅\n\n` +
    `Confirmando sua sessão para *${dataHora}*.\n\n` +
    `Caso precise reagendar, me avise com antecedência. Até lá! 💙${assinatura}`;
  return shareViaWhatsApp(patientPhone, message, undefined, direct);
}

export async function sharePosAlta(patientName: string, patientPhone: string, direct: boolean = false) {
  const message =
    `Olá ${patientName}! 🌟\n\n` +
    `Como está se sentindo após o tratamento? Espero que muito bem!\n\n` +
    `Lembre-se de manter os exercícios do seu programa domiciliar (HEP) para consolidar os ganhos.\n\n` +
    `📋 Recomendo uma reavaliação preventiva em *4 semanas* para garantir a manutenção dos resultados.\n\n` +
    `Estou aqui sempre que precisar! 💙`;
  return shareViaWhatsApp(patientPhone, message, undefined, direct);
}

export async function shareStructuralResults(patientName: string, patientPhone: string, score: number, classification: string, driver: string, direct: boolean = false) {
  const message =
    `*RESULTADOS — Avaliação Estrutural*\n` +
    `*Método Identidade · MyHealth ID*\n\n` +
    `👤 *Paciente:* ${patientName}\n` +
    `📊 *Score Geral:* ${score.toFixed(1)}/10\n` +
    `📋 *Classificação:* ${classification}\n` +
    `${driver ? `⚠️ *Driver Primário:* ${driver}` : ''}\n\n` +
    `Esses resultados mapeiam suas unidades funcionais e identificam as áreas que precisam de mais atenção.\n\n` +
    `Na próxima sessão, vamos discutir o protocolo de tratamento personalizado! 💪`;
  return shareViaWhatsApp(patientPhone, message, undefined, direct);
}

export async function shareAniversario(patientName: string, patientPhone: string, direct: boolean = false) {
  const message =
    `🎂 Feliz Aniversário, ${patientName}!\n\n` +
    `Neste dia especial, desejo muita saúde, bem-estar e conquistas!\n\n` +
    `É uma honra fazer parte da sua jornada de saúde. Continue cuidando de você! 🌟\n\n` +
    `Um grande abraço! 🤗`;
  return shareViaWhatsApp(patientPhone, message, undefined, direct);
}

export async function sharePacoteInfo(patientName: string, patientPhone: string, pacoteName: string, details: string, value: string, direct: boolean = false) {
  const message =
    `Olá ${patientName}! 👋\n\n` +
    `Preparei uma proposta especial para você:\n\n` +
    `📦 *${pacoteName}*\n\n` +
    `${details}\n\n` +
    `💰 *Investimento:* ${value}\n\n` +
    `Este pacote foi pensado especialmente para o seu perfil. Quer saber mais detalhes? 😊`;
  return shareViaWhatsApp(patientPhone, message, undefined, direct);
}

// ── Utility functions ─────────────────────────────────────────────────

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

// ── Message template definitions (for editable templates UI) ──────────
export interface MessageTemplate {
  id: string;
  label: string;
  icon: string;
  category: 'funil' | 'clinico' | 'comercial';
  defaultMessage: string;
  variables: string[];
}

export const MESSAGE_TEMPLATES: MessageTemplate[] = [
  {
    id: 'boas-vindas', label: 'Boas-vindas', icon: '👋', category: 'funil',
    defaultMessage: 'Olá {nome}! Sou {terapeuta} e estou muito feliz em recebê-lo(a)! 🏥 A partir de agora começamos sua jornada de saúde personalizada com o Método Identidade.',
    variables: ['nome', 'terapeuta'],
  },
  {
    id: 'lembrete-questionario', label: 'Lembrete Questionário', icon: '📋', category: 'funil',
    defaultMessage: 'Olá {nome}! Notei que ainda não preencheu o questionário. É bem rápido e super importante para seu tratamento! O link ainda está ativo 😊',
    variables: ['nome'],
  },
  {
    id: 'pos-avaliacao', label: 'Pós-Avaliação', icon: '📊', category: 'clinico',
    defaultMessage: 'Olá {nome}! Concluímos sua avaliação. Preparei uma diretriz personalizada. Na próxima sessão discutimos o plano! 💪',
    variables: ['nome'],
  },
  {
    id: 'pos-diretriz', label: 'Enviar Diretriz', icon: '📋', category: 'clinico',
    defaultMessage: 'Olá {nome}! Aqui está o resumo da sua Diretriz de Tratamento. Lembre-se: constância é o segredo! 🙌',
    variables: ['nome'],
  },
  {
    id: 'lembrete-retorno', label: 'Lembrete de Retorno', icon: '⏰', category: 'clinico',
    defaultMessage: 'Olá {nome}! Sua reavaliação está prevista para {data}. Muito importante para medirmos seu progresso!',
    variables: ['nome', 'data'],
  },
  {
    id: 'pos-alta', label: 'Pós-Alta', icon: '🌟', category: 'clinico',
    defaultMessage: 'Olá {nome}! Como está se sentindo? Mantenha os exercícios do HEP. Recomendo reavaliação em 4 semanas. Estou aqui! 💙',
    variables: ['nome'],
  },
  {
    id: 'aniversario', label: 'Aniversário', icon: '🎂', category: 'funil',
    defaultMessage: '🎂 Feliz Aniversário, {nome}! Desejo muita saúde e bem-estar! É uma honra fazer parte da sua jornada. 🌟',
    variables: ['nome'],
  },
  {
    id: 'proposta', label: 'Proposta Comercial', icon: '💰', category: 'comercial',
    defaultMessage: 'Olá {nome}! Preparei uma proposta: {servico} · Investimento: {valor}. Vamos começar sua transformação?',
    variables: ['nome', 'servico', 'valor'],
  },
  {
    id: 'resultados-estruturais', label: 'Resultados Estruturais', icon: '🔬', category: 'clinico',
    defaultMessage: 'Olá {nome}! Seus resultados: Score {score}/10 · {classificacao}. Na próxima sessão discutimos o protocolo! 💪',
    variables: ['nome', 'score', 'classificacao'],
  },
];

// ── Pre-defined packages ──────────────────────────────────────────────
export interface Pacote {
  id: string;
  nome: string;
  servico: string;
  sessoes: number;
  duracao: string;
  diferenciais: string[];
  valorSugerido: string;
}

export const PACOTES_PREDEFINIDOS: Pacote[] = [
  {
    id: 'id-avaliacao', nome: 'Avaliação Completa', servico: 'Método Identidade',
    sessoes: 1, duracao: '1 sessão', valorSugerido: '350',
    diferenciais: ['Avaliação MyID completa', 'Mapeamento estrutural', 'Diretriz personalizada'],
  },
  {
    id: 'id-8sess', nome: 'Pacote Tratamento', servico: 'Método Identidade',
    sessoes: 8, duracao: '2 meses', valorSugerido: '2.400',
    diferenciais: ['Avaliação + 8 sessões', 'Reavaliação inclusa', 'HEP personalizado', 'Suporte via WhatsApp'],
  },
  {
    id: 'id-12sess', nome: 'Pacote Premium', servico: 'Método Identidade',
    sessoes: 12, duracao: '3 meses', valorSugerido: '3.200',
    diferenciais: ['Avaliação + 12 sessões', '2 reavaliações', 'HEP + vídeos', 'Suporte prioritário'],
  },
  {
    id: 'cob-8sess', nome: 'Pacote COB°', servico: 'COB° ZERO',
    sessoes: 8, duracao: '2 meses', valorSugerido: '2.800',
    diferenciais: ['Avaliação postural completa', '8 sessões corretivas', 'Acompanhamento radiográfico'],
  },
  {
    id: 'studio-mensal', nome: 'Studio Mensal', servico: 'Studio Personal ID',
    sessoes: 12, duracao: '1 mês', valorSugerido: '1.800',
    diferenciais: ['12 sessões/mês (3x sem)', 'Treino baseado no MyID', 'Avaliação de composição corporal'],
  },
  {
    id: 'studio-trimestral', nome: 'Studio Trimestral', servico: 'Studio Personal ID',
    sessoes: 36, duracao: '3 meses', valorSugerido: '4.500',
    diferenciais: ['36 sessões (3x sem)', 'Reavaliações mensais', 'Suporte nutricional básico', '10% desconto'],
  },
];
