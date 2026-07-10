import { CheckCheck } from "lucide-react";
import { cn } from "@/lib/utils";

// Valores de exemplo usados na prévia — mostram como a mensagem chega ao
// paciente com as variáveis já substituídas. Cobre tanto as variáveis das
// mensagens automáticas ({nome}, {horario}, {data}) quanto as dos templates
// ({próxima_sessão}, {terapeuta}, etc.).
const SAMPLE: Record<string, string> = {
  nome: "Marina",
  nome_completo: "Marina Souza",
  telefone: "(11) 98888-7777",
  horario: "14h30",
  data: "quinta, 12/07",
  "próxima_sessão": "12/07 às 14:30",
  proxima_sessao: "12/07 às 14:30",
  "última_sessão": "05/07/2026",
  ultima_sessao: "05/07/2026",
  terapeuta: "Dr. Rafael",
};

export function aplicarSample(txt: string) {
  return (txt || "").replace(/\{([^}]+)\}/g, (m, k) => SAMPLE[k.trim().toLowerCase()] ?? m);
}

// Bolha estilo WhatsApp para pré-visualizar a mensagem enquanto se edita.
export function WaBubblePreview({
  text, incoming = false, compact = false, emptyHint,
}: {
  text: string; incoming?: boolean; compact?: boolean; emptyHint?: string;
}) {
  const t = (text || "").trim();
  return (
    <div className={cn("rounded-xl border border-border/30", compact ? "p-2" : "p-3")} style={{ backgroundColor: "var(--wa-prev)" }}>
      <style>{`:root{--wa-prev:#efeae2}.dark{--wa-prev:#0b141a}`}</style>
      {t ? (
        <div className={cn(
          "max-w-[88%] px-3 py-2 shadow-sm text-[13px] leading-relaxed whitespace-pre-wrap break-words text-gray-900 dark:text-gray-100",
          incoming
            ? "bg-white dark:bg-[#202c33] rounded-[14px] rounded-tl-[4px]"
            : "bg-[#dcf8c6] dark:bg-[#005c4b] rounded-[14px] rounded-tr-[4px] ml-auto",
        )}>
          {aplicarSample(t)}
          <div className={cn("flex items-center justify-end gap-1 mt-0.5", incoming ? "text-muted-foreground/60" : "text-[#008069]/60 dark:text-[#25D366]/60")}>
            <span className="text-[10px] tabular-nums">14:32</span>
            {!incoming && <CheckCheck className="h-3 w-3 text-[#53bdeb]" />}
          </div>
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground text-center py-2">{emptyHint || "A prévia aparece aqui conforme você escreve."}</p>
      )}
    </div>
  );
}
