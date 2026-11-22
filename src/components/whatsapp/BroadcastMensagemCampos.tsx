import { Textarea } from "@/components/ui/textarea";
import { WaBubblePreview } from "@/components/whatsapp/WaBubblePreview";
import { avisosDaMensagem, contarCaracteresDaMensagem, previasDaMensagem } from "@/lib/broadcastMensagem";
import { LIMITE_MENSAGEM } from "@/lib/mensagemModelos";

// Campo da mensagem da campanha: contador e avisos cada um na própria linha, para o texto longo ou o erro não
// estourarem a largura de um celular.
export function CampoMensagemBroadcast({ id, texto, onChange, placeholder, rows = 4 }: {
  id: string; texto: string; onChange: (v: string) => void; placeholder: string; rows?: number;
}) {
  const avisos = avisosDaMensagem(texto);
  const idsDosAvisos = avisos.map((_, i) => `${id}-aviso-${i}`);
  return (
    <div className="space-y-1.5 min-w-0">
      <Textarea id={id} rows={rows} placeholder={placeholder} value={texto}
        aria-invalid={avisos.length > 0} aria-describedby={[`${id}-contador`, ...idsDosAvisos].join(" ")}
        onChange={(e) => onChange(e.target.value)} className="resize-none text-sm break-words" />
      <p id={`${id}-contador`} className="text-xs text-foreground/70 tabular-nums">
        {contarCaracteresDaMensagem(texto)}/{LIMITE_MENSAGEM} caracteres
      </p>
      {avisos.map((aviso, i) => (
        <p key={aviso} id={idsDosAvisos[i]} role="alert" className="text-xs text-destructive dark:text-red-400 break-words">{aviso}</p>
      ))}
    </div>
  );
}

// Mesma renderizarModelo do envio, com nomes de exemplo: mostra o texto que sai quando a IA está desligada.
export function PreviasDaMensagem({ texto, quantos, dicaVazia }: { texto: string; quantos: number; dicaVazia: string }) {
  const vazia = texto.trim() === "";
  return (
    <div className="space-y-2 min-w-0">
      <p className="text-micro !text-foreground/70 font-medium">Prévia com nomes de exemplo</p>
      {previasDaMensagem(texto, quantos).map((previa) => (
        <div key={previa.nome} className="space-y-1 min-w-0" data-testid="previa-broadcast">
          <p className="text-xs text-foreground/70 break-words">Para {previa.nome}</p>
          <WaBubblePreview text={previa.texto ?? ""} compact
            emptyHint={vazia ? dicaVazia : "Corrija o aviso do texto para ver o exemplo."} />
        </div>
      ))}
    </div>
  );
}
