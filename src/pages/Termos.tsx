import LegalShell from '@/components/legal/LegalShell';

// Termos de Uso. Texto-modelo — revise com apoio jurídico e preencha os campos
// marcados como [ ... ] com os dados reais do responsável.
export default function Termos() {
  return (
    <LegalShell titulo="Termos de Uso" atualizadoEm="20 de agosto de 2026">
      <p>
        Estes Termos de Uso regem o acesso e a utilização da plataforma <strong>My Health ID</strong>
        (<a href="https://www.myhealthid.com.br">www.myhealthid.com.br</a>) e do aplicativo. Ao criar
        uma conta ou utilizar o serviço, você concorda com estes Termos.
      </p>

      <h2>1. O que é o My Health ID</h2>
      <p>
        O My Health ID é uma plataforma de avaliação e acompanhamento em saúde que gera uma
        identidade clínica (MyID) e conteúdos personalizados de apoio, e conecta o usuário ao
        profissional de saúde responsável.
      </p>

      <div className="note">
        <strong>Importante:</strong> o My Health ID é uma ferramenta de <strong>apoio</strong> e não
        substitui consulta, diagnóstico, tratamento ou acompanhamento por profissional de saúde
        habilitado. As orientações e planos gerados não constituem prescrição médica. Em caso de
        emergência, procure atendimento imediato.
      </div>

      <h2>2. Cadastro e conta</h2>
      <ul>
        <li>Você deve fornecer informações verdadeiras e mantê-las atualizadas;</li>
        <li>Você é responsável por manter a confidencialidade das suas credenciais de acesso;</li>
        <li>
          Para usuários menores de idade, o cadastro e o uso devem ser realizados por um
          responsável legal;
        </li>
        <li>Notifique-nos imediatamente em caso de uso não autorizado da sua conta.</li>
      </ul>

      <h2>3. Uso permitido</h2>
      <p>Você concorda em <strong>não</strong>:</p>
      <ul>
        <li>Usar o serviço para fins ilícitos ou que violem direitos de terceiros;</li>
        <li>Tentar acessar áreas, dados ou contas sem autorização;</li>
        <li>Interferir na segurança ou no funcionamento da plataforma;</li>
        <li>Reproduzir, copiar ou explorar comercialmente o serviço sem autorização.</li>
      </ul>

      <h2>4. Planos e pagamentos</h2>
      <p>
        O My Health ID pode oferecer recursos gratuitos e recursos pagos (premium). As condições,
        preços e formas de pagamento aplicáveis serão informados no momento da contratação. Recursos
        pagos podem ser alterados mediante aviso prévio.
      </p>

      <h2>5. Conteúdo e responsabilidade clínica</h2>
      <p>
        Os conteúdos de saúde exibidos (dicas, questionários, planos e diretrizes) têm caráter
        informativo e de apoio. As decisões clínicas cabem ao profissional de saúde responsável e ao
        próprio usuário. O My Health ID não se responsabiliza por condutas adotadas sem orientação
        profissional adequada.
      </p>

      <h2>6. Propriedade intelectual</h2>
      <p>
        A marca, o software, o design e os conteúdos do My Health ID são protegidos por lei. O uso do
        serviço não transfere a você quaisquer direitos de propriedade intelectual, salvo o direito
        limitado de utilizar a plataforma conforme estes Termos.
      </p>

      <h2>7. Privacidade</h2>
      <p>
        O tratamento de dados pessoais é regido pela nossa{' '}
        <a href="/privacidade">Política de Privacidade</a>, que integra estes Termos.
      </p>

      <h2>8. Limitação de responsabilidade</h2>
      <p>
        O serviço é fornecido "no estado em que se encontra". Na máxima medida permitida em lei, o
        My Health ID não se responsabiliza por danos indiretos ou por indisponibilidades temporárias
        decorrentes de fatores fora do seu controle razoável.
      </p>

      <h2>9. Encerramento</h2>
      <p>
        Você pode encerrar sua conta a qualquer momento. Podemos suspender ou encerrar o acesso em
        caso de violação destes Termos, resguardadas as obrigações legais de guarda de informações.
      </p>

      <h2>10. Lei aplicável e foro</h2>
      <p>
        Estes Termos são regidos pelas leis do Brasil. Fica eleito o foro da comarca de
        [CIDADE/UF], salvo disposição legal em contrário aplicável ao consumidor.
      </p>

      <h2>11. Contato</h2>
      <p>
        Dúvidas sobre estes Termos podem ser enviadas para{' '}
        <a href="mailto:myhealthid.support@gmail.com">myhealthid.support@gmail.com</a>.
      </p>
    </LegalShell>
  );
}
