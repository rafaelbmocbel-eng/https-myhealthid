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
    .from('avaliacoes_identidade')
    .insert({
      paciente_id: '008dc9c1-10ba-4e31-b845-8991462b9b27',
      terapeuta_id: 'b4635a86-f68e-4152-91e6-ccdb81aa193c',
      dados_avaliacao: { teste: true },
      score_e: 70, score_p: 65, score_c: 60, score_f: 75,
      score_d: 55, score_r: 80, score_efi: 70, score_i: 60, score_n: 65,
      myid_score: 65,
      myid_analysis: {
        componentScores: { D: 5.5, EFI: 7, P: 6.5, I: 6, R: 8, C: 6, AF: 7.5, HID: 8, NUT: 7, ERG: 6.5, N: 6.5 }
      },
      classificacao: 'MODERADO',
      fase_atual: 2,
      fase_concluida: 1,
      dimensoes_preenchidas: ['D','I','EFI','P','R','C','AF','HID','NUT','ERG','N']
    })
    .select();
  
  if (error) {
    console.error('Insert error:', error.message);
    return;
  }
  
  console.log('Inserted identidade:', data);
}

main();
