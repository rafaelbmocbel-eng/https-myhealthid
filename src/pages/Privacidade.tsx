import LegalShell from '@/components/legal/LegalShell';

// Política de Privacidade (base LGPD). Texto-modelo — revise com apoio jurídico
// e preencha os campos marcados como [ ... ] com os dados reais do controlador.
export default function Privacidade() {
  return (
    <LegalShell titulo="Política de Privacidade" atualizadoEm="20 de agosto de 2026">
      <p>
        Esta Política de Privacidade descreve como o <strong>My Health ID</strong> coleta, usa,
        armazena e protege os dados pessoais de seus usuários, em conformidade com a
        Lei nº 13.709/2018 (Lei Geral de Proteção de Dados — LGPD).
      </p>

      <div className="note">
        O My Health ID é uma ferramenta de <strong>apoio</strong> ao cuidado em saúde. Ele não
        substitui o diagnóstico, o tratamento ou o acompanhamento de um profissional de saúde
        habilitado. Em caso de emergência, procure atendimento médico.
      </div>

      <h2>1. Quem é o controlador dos dados</h2>
      <p>
        O controlador dos dados é [RAZÃO SOCIAL / NOME DO RESPONSÁVEL], inscrito no
        CNPJ/CPF sob nº [CNPJ ou CPF], responsável pela plataforma My Health ID
        (<a href="https://www.myhealthid.com.br">www.myhealthid.com.br</a>).
      </p>

      <h2>2. Quais dados coletamos</h2>
      <h3>2.1. Dados de cadastro</h3>
      <ul>
        <li>Nome, e-mail, telefone e data de nascimento;</li>
        <li>Credenciais de acesso (ou identificação via login do Google, quando escolhido);</li>
        <li>Vínculo com o profissional de saúde responsável, quando aplicável.</li>
      </ul>
      <h3>2.2. Dados de saúde (dados pessoais sensíveis)</h3>
      <ul>
        <li>Respostas aos questionários de avaliação (MyID) e histórico clínico informado;</li>
        <li>Achados clínicos, planos e diretrizes de tratamento registrados pelo profissional;</li>
        <li>Evolução, medidas, exercícios e demais informações do acompanhamento.</li>
      </ul>
      <h3>2.3. Dados de uso</h3>
      <ul>
        <li>Informações técnicas do dispositivo e navegador, e registros de acesso (logs);</li>
        <li>Dados necessários ao funcionamento do aplicativo (por exemplo, preferências salvas).</li>
      </ul>

      <h2>3. Para que usamos os dados</h2>
      <ul>
        <li>Permitir o cadastro, o login e o acesso ao portal do cliente;</li>
        <li>Gerar sua avaliação MyID e conteúdos personalizados de apoio;</li>
        <li>Possibilitar o acompanhamento pelo profissional de saúde vinculado a você;</li>
        <li>Garantir a segurança, prevenir fraudes e cumprir obrigações legais;</li>
        <li>Melhorar a plataforma e a experiência de uso.</li>
      </ul>

      <h2>4. Base legal do tratamento</h2>
      <p>
        O tratamento de dados de saúde é realizado com base no seu <strong>consentimento</strong>
        e, quando aplicável, para a <strong>tutela da saúde</strong> em procedimento realizado por
        profissionais de saúde ou por serviços de saúde (art. 11 da LGPD). Os demais dados são
        tratados para execução do serviço, cumprimento de obrigação legal e legítimo interesse,
        sempre respeitando seus direitos.
      </p>

      <h2>5. Com quem compartilhamos</h2>
      <ul>
        <li>
          <strong>Profissional de saúde vinculado a você:</strong> tem acesso aos dados
          necessários para o seu acompanhamento;
        </li>
        <li>
          <strong>Provedores de infraestrutura</strong> (por exemplo, serviços de hospedagem e
          banco de dados) que operam em nome do My Health ID, sob obrigações de segurança e
          confidencialidade;
        </li>
        <li>
          <strong>Autoridades públicas</strong>, quando exigido por lei ou ordem judicial.
        </li>
      </ul>
      <p>Não vendemos seus dados pessoais.</p>

      <h2>6. Segurança</h2>
      <p>
        Adotamos medidas técnicas e organizacionais para proteger seus dados, como controle de
        acesso, criptografia em trânsito e regras de acesso por usuário. Nenhum sistema é 100%
        infalível, mas trabalhamos continuamente para reduzir riscos.
      </p>

      <h2>7. Por quanto tempo guardamos</h2>
      <p>
        Mantemos os dados pelo tempo necessário às finalidades desta Política e ao cumprimento de
        obrigações legais e regulatórias (inclusive as aplicáveis a registros em saúde). Encerrado
        esse período, os dados são eliminados ou anonimizados.
      </p>

      <h2>8. Seus direitos</h2>
      <p>Nos termos do art. 18 da LGPD, você pode, a qualquer momento:</p>
      <ul>
        <li>Confirmar a existência de tratamento e acessar seus dados;</li>
        <li>Corrigir dados incompletos, inexatos ou desatualizados;</li>
        <li>Solicitar anonimização, bloqueio ou eliminação de dados desnecessários;</li>
        <li>Solicitar a portabilidade e a revogação do consentimento;</li>
        <li>Obter informação sobre com quem compartilhamos seus dados.</li>
      </ul>

      <h2>9. Cookies</h2>
      <p>
        Utilizamos armazenamento local e cookies estritamente necessários ao funcionamento e à
        segurança do serviço (por exemplo, para manter você conectado). Você pode gerenciar cookies
        nas configurações do seu navegador.
      </p>

      <h2>10. Contato e Encarregado (DPO)</h2>
      <p>
        Para exercer seus direitos ou tirar dúvidas sobre esta Política, entre em contato pelo
        e-mail <a href="mailto:myhealthid.support@gmail.com">myhealthid.support@gmail.com</a>.
      </p>

      <h2>11. Alterações</h2>
      <p>
        Podemos atualizar esta Política periodicamente. A versão vigente estará sempre disponível
        nesta página, com a data da última atualização indicada acima.
      </p>
    </LegalShell>
  );
}
