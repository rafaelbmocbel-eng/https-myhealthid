function juntarComE(itens: string[]): string {
  if (itens.length <= 1) return itens.join('');
  return `${itens.slice(0, -1).join(', ')} e ${itens[itens.length - 1]}`;
}

// Uma fonte que falha não esconde as outras: só avisa o que ficou de fora.
export default function AvisoDeFalhas({ falhas }: { falhas: string[] }) {
  if (falhas.length === 0) return null;
  return (
    <p role="status" className="rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-[12px] text-muted-foreground">
      Não consegui ler {juntarComE(falhas)}. O que aparece aqui pode estar incompleto.
    </p>
  );
}
