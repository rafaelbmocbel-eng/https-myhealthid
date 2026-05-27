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
  
  const resultado = {
    MyID_score: 1.25,
    clinical_priority: 'Numerator (Reduce Demand)',
    color: '✅',
    component_scores: {
      D_pain: 3, EFI_functionality: 4.5, P_psychological: 4, I_inertia: 2,
      R_regulation: 5, C_context: 4.5, AF_activity: 3.5, HID_hydration: 4,
      NUT_nutrition: 4, ERG_ergonomics: 3, N_noise: 2
    },
    focus_areas: ['Melhorar sono (8+ horas)', 'Aumentar hidratação', 'Melhorar nutrição'],
    recommendation: 'Seu corpo está em excelente estado de recuperação',
    red_flags: false,
    red_flags_details: { fever: false, incontinence: false, neuropathy: false, night_pain: false, progressive: false, weight_loss: false },
    healing_history: { healing_speed: 'Não Avaliado', physio_history: 'moderate', prognosis: 'Primeira lesão, tempo imprevisível' },
    pain_pattern: 'Rigidez Matinal (Inflamatório)',
    status: 'EXCELLENT',
    timestamp: new Date().toISOString()
  };
  
  const { data, error } = await supabase
    .from('myid_avaliacoes')
    .insert({
      paciente_id: '008dc9c1-10ba-4e31-b845-8991462b9b27',
      terapeuta_id: 'b4635a86-f68e-4152-91e6-ccdb81aa193c',
      status: 'concluido',
      resultado_processado: resultado,
      dimensoes_preenchidas: ['D','I','EFI','P','R','C','AF','HID','NUT','ERG','N'],
      fase_atual: 1,
      fase_concluida: 1
    })
    .select();
  
  if (error) {
    console.error('Insert error:', error.message, error.details, error.hint);
    return;
  }
  
  console.log('Inserted MyID:', data);
}

main();
