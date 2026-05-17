import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';

export interface TemplateContext {
  nome_completo: string;
  nome: string;
  telefone: string;
  proxima_sessao: string;
  ultima_sessao: string;
  terapeuta: string;
}

export const TEMPLATE_VARIAVEIS: { chave: string; descricao: string }[] = [
  { chave: 'nome', descricao: 'Primeiro nome do contato' },
  { chave: 'nome_completo', descricao: 'Nome completo do contato' },
  { chave: 'telefone', descricao: 'Telefone do contato' },
  { chave: 'próxima_sessão', descricao: 'Data/hora da próxima sessão' },
  { chave: 'última_sessão', descricao: 'Data da última sessão concluída' },
  { chave: 'terapeuta', descricao: 'Seu nome' },
];

export async function buildTemplateContext(conversa: {
  paciente_id: string | null;
  nome_contato: string | null;
  telefone: string;
  terapeuta_id: string;
}): Promise<TemplateContext> {
  const nomeCompleto = conversa.nome_contato || '';
  const ctx: TemplateContext = {
    nome_completo: nomeCompleto,
    nome: nomeCompleto.split(' ')[0] || '',
    telefone: conversa.telefone,
    proxima_sessao: '—',
    ultima_sessao: '—',
    terapeuta: '',
  };

  const profilePromise = supabase
    .from('profiles')
    .select('nome, sobrenome')
    .eq('user_id', conversa.terapeuta_id)
    .maybeSingle();

  const proximaPromise = conversa.paciente_id
    ? supabase
        .from('agendamentos')
        .select('data_inicio,status')
        .eq('paciente_id', conversa.paciente_id)
        .eq('terapeuta_id', conversa.terapeuta_id)
        .gte('data_inicio', new Date().toISOString())
        .neq('status', 'cancelado')
        .order('data_inicio', { ascending: true })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null } as any);

  const ultimaPromise = conversa.paciente_id
    ? supabase
        .from('agendamentos')
        .select('data_inicio')
        .eq('paciente_id', conversa.paciente_id)
        .eq('terapeuta_id', conversa.terapeuta_id)
        .eq('status', 'concluido')
        .order('data_inicio', { ascending: false })
        .limit(1)
        .maybeSingle()
    : Promise.resolve({ data: null } as any);

  const [profileRes, proxRes, ultRes] = await Promise.all([profilePromise, proximaPromise, ultimaPromise]);

  if (profileRes.data) {
    ctx.terapeuta = [profileRes.data.nome, profileRes.data.sobrenome].filter(Boolean).join(' ');
  }
  if (proxRes.data?.data_inicio) {
    ctx.proxima_sessao = format(new Date(proxRes.data.data_inicio), "dd/MM 'às' HH:mm", { locale: ptBR });
  }
  if (ultRes.data?.data_inicio) {
    ctx.ultima_sessao = format(new Date(ultRes.data.data_inicio), 'dd/MM/yyyy', { locale: ptBR });
  }

  return ctx;
}

export function aplicarVariaveis(texto: string, ctx: TemplateContext): string {
  const map: Record<string, string> = {
    nome: ctx.nome || 'olá',
    nome_completo: ctx.nome_completo,
    telefone: ctx.telefone,
    'próxima_sessão': ctx.proxima_sessao,
    proxima_sessao: ctx.proxima_sessao,
    'última_sessão': ctx.ultima_sessao,
    ultima_sessao: ctx.ultima_sessao,
    terapeuta: ctx.terapeuta,
  };
  return texto.replace(/\{([^}]+)\}/g, (_, k) => {
    const key = k.trim().toLowerCase();
    return map[key] ?? `{${k}}`;
  });
}
