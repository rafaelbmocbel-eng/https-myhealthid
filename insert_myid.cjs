const { createClient } = require('./node_modules/@supabase/supabase-js');

const supabase = createClient(
  'https://mgdzlzpzjpnswpqdtylz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1nZHpsenB6anBuc3dwcWR0eWx6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE0NjM5MzIsImV4cCI6MjA4NzAzOTkzMn0.zAu_ZC8ne3X-Dj6cXEchbJdfKBRfnFTx2pqo5Cef_7c'
);

async function main() {
  const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
    email: 'testepaciente2027@example.com',
    password: 'PortalTeste#9876!Secure'
  });
  
  if (authError) {
    console.error('Login error:', authError.message);
    return;
  }
  
  console.log('Logged in as:', authData.user.id);
  
  const { data, error } = await supabase
    .from('myid_avaliacoes')
    .insert({
      paciente_id: '008dc9c1-10ba-4e31-b845-8991462b9b27',
      pontuacao_global: 65,
      pontuacao_dimensoes: { saude: 70, sono: 55, alimentacao: 60, atividade: 75, mente: 65, emocoes: 60, relacoes: 70, proposito: 80, ambiente: 65, financas: 70, criatividade: 60 },
      dimensoes_preenchidas: { saude: true, sono: true, alimentacao: true, atividade: true, mente: true, emocoes: true, relacoes: true, proposito: true, ambiente: true, financas: true, criatividade: true },
      perfil_gerado: 'Perfil de teste para visualização do portal.',
      resumo_executivo: JSON.stringify({ maiorOportunidade: 'Sono', pontoAtencao: 'Alimentação' })
    })
    .select();
  
  if (error) {
    console.error('Insert error:', error.message);
    return;
  }
  
  console.log('Inserted MyID:', data);
}

main();
