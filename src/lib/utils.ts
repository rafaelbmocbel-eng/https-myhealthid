import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normaliza texto para BUSCA e ORDENAÇÃO: minúsculas, sem acento e sem espaços
 * nas pontas. Assim "joao" acha "João" e "avila" acha "Ávila". Não altera o
 * nome salvo/exibido — é só a chave de comparação.
 */
export function normalizarBusca(texto: string | null | undefined): string {
  return (texto ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}
