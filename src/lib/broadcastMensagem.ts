import { LIMITE_MENSAGEM, primeiroNomeCapitalizado, renderizarModelo, validarModelo, type Motivo } from "@/lib/mensagemModelos";

// Como o nome vem do cadastro (maiúsculas, composto, com sobrenome): a prévia mostra que só o primeiro nome entra.
export const NOMES_EXEMPLO = ["Marina Souza", "JOÃO PEDRO LIMA", "ana-clara lima"] as const;

export const NOME_DE_CONFIRMACAO = primeiroNomeCapitalizado(NOMES_EXEMPLO[0]);

export interface PreviaDaMensagem {
  nome: string;
  texto: string | null;
}

// A prévia usa a mesma renderizarModelo do envio: o que aparece aqui é o que o servidor monta (sem a IA).
export function previasDaMensagem(texto: string, quantos: number): PreviaDaMensagem[] {
  return NOMES_EXEMPLO.slice(0, quantos).map((cadastro) => ({
    nome: primeiroNomeCapitalizado(cadastro),
    texto: renderizarModelo("broadcast", texto, { nome: cadastro }).texto,
  }));
}

export function fraseDeConfirmacao(texto: string): string {
  return renderizarModelo("broadcast", texto, { nome: NOMES_EXEMPLO[0] }).texto ?? "";
}

export function contarCaracteresDaMensagem(texto: string): number {
  return Array.from(texto.trim()).length;
}

// 'vazio' fica de fora: o botão já pede "Preencha a mensagem" e não precisa de aviso vermelho em campo ainda em branco.
const AVISO_DO_ERRO: Partial<Record<Motivo, string>> = {
  chave_desconhecida: "Só a variável {nome} funciona. Variáveis como {horario} e {data} não existem aqui e a campanha não sai com elas.",
  chave_solta: "Há uma chave { ou } sem par. Use só {nome}, com as duas chaves.",
  modelo_longo: `A mensagem passa de ${LIMITE_MENSAGEM} caracteres. Encurte o texto.`,
};

// O primeiro nome aceito tem até 30 letras. {nome} troca 6 letras de "{nome}" por até 30, e o teto vale para o texto já trocado.
const NOME_MAIS_LONGO = "A".repeat(30);

const AVISO_NOME_LONGO =
  `Com o nome de quem tem nome comprido no lugar de {nome}, a mensagem passa de ${LIMITE_MENSAGEM} caracteres e essa pessoa não receberia nada. Encurte o texto.`;

export function avisosDaMensagem(texto: string): string[] {
  const avisos = validarModelo("broadcast", texto).erros.flatMap((erro) => AVISO_DO_ERRO[erro] ?? []);
  if (avisos.length > 0) return avisos;
  if (renderizarModelo("broadcast", texto, { nome: NOME_MAIS_LONGO }).motivo === "longo") return [AVISO_NOME_LONGO];
  return avisos;
}
