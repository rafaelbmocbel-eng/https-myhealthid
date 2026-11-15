import { useState } from 'react';

/** Opções de visão que a tela guarda entre uma foto e outra: grade, "ver só o desenho" e painel de estilo. */
export function useVisaoDaFoto() {
  const [grade, setGrade] = useState(false);
  const [semAlcas, setSemAlcas] = useState(false);
  const [painelEstilo, setPainelEstilo] = useState(false);
  return { grade, setGrade, semAlcas, setSemAlcas, painelEstilo, setPainelEstilo };
}

export type VisaoDaFoto = ReturnType<typeof useVisaoDaFoto>;
