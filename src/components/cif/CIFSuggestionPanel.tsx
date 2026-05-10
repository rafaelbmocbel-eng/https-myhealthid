import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, ChevronUp, ClipboardList, Copy, Download, AlertCircle, CheckCircle2, Info } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateCIFSuggestions, qualifierLabel, CATEGORY_LABELS, type CIFCode, type CIFSuggestionResult } from '@/utils/cifMapping';
import { cn } from '@/lib/utils';

interface CIFSuggestionPanelProps {
  myidResult: any | null;
  voiceAssessment: any | null;
  structuralAssessment: any | null;
}

const SOURCE_LABELS: Record<string, string> = {
  myid: 'MyID',
  voz: 'Voz',
  estrutural: 'Estrutural',
  combinado: 'Combinado',
};

const SOURCE_COLORS: Record<string, string> = {
  myid: 'bg-primary/10 text-primary border-primary/20',
  voz: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 border-violet-200',
  estrutural: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200',
  combinado: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200',
};

const QUALIFIER_COLORS: Record<number, string> = {
  0: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300',
  1: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  2: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  3: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300',
  4: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
};

const CONFIDENCE_ICON: Record<string, typeof CheckCircle2> = {
  alta: CheckCircle2,
  media: Info,
  baixa: AlertCircle,
};

export default function CIFSuggestionPanel({ myidResult, voiceAssessment, structuralAssessment }: CIFSuggestionPanelProps) {
  const { toast } = useToast();
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['b', 's', 'd', 'e']));

  const hasMyID = !!myidResult;
  const hasVoz = !!voiceAssessment;
  const hasEstrutural = !!structuralAssessment;

  // Require at least MyID + (voice OR structural)
  const canGenerate = hasMyID && (hasVoz || hasEstrutural);

  if (!canGenerate) {
    return (
      <Card className="border-dashed border-2 border-muted-foreground/20">
        <CardContent className="p-6 text-center">
          <ClipboardList className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <h3 className="font-semibold text-foreground mb-1">Classificação CIF</h3>
          <p className="text-sm text-muted-foreground mb-3">
            A sugestão automática de códigos CIF será disponibilizada após a conclusão de:
          </p>
          <div className="flex flex-col gap-1.5 max-w-xs mx-auto text-left">
            <div className="flex items-center gap-2 text-sm">
              {hasMyID ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <AlertCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
              <span className={hasMyID ? 'text-foreground' : 'text-muted-foreground'}>Avaliação MyID</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {hasVoz ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <AlertCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
              <span className={hasVoz ? 'text-foreground' : 'text-muted-foreground'}>Avaliação por Voz</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {hasEstrutural ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" /> : <AlertCircle className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
              <span className={hasEstrutural ? 'text-foreground' : 'text-muted-foreground'}>Avaliação Estrutural</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3 italic">
            É necessário o MyID + pelo menos uma avaliação (Voz ou Estrutural).
          </p>
        </CardContent>
      </Card>
    );
  }

  const suggestion = generateCIFSuggestions(myidResult, voiceAssessment, structuralAssessment);
  const grouped = groupByCategory(suggestion.codes);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  };

  const copyAllCodes = () => {
    const text = suggestion.codes
      .map(c => `${c.code}.${c.qualifier} — ${c.description}`)
      .join('\n');
    navigator.clipboard.writeText(text);
    toast({ title: 'Códigos CIF copiados! 📋' });
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            Classificação CIF
          </CardTitle>
          <div className="flex gap-1.5">
            <Button variant="ghost" size="sm" onClick={copyAllCodes} className="h-7 text-xs gap-1">
              <Copy className="h-3 w-3" /> Copiar
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{suggestion.resumo}</p>
        <div className="flex gap-1.5 flex-wrap mt-1">
          {suggestion.fontes.myid && <Badge variant="outline" className="text-[10px]">MyID</Badge>}
          {suggestion.fontes.voz && <Badge variant="outline" className="text-[10px]">Voz</Badge>}
          {suggestion.fontes.estrutural && <Badge variant="outline" className="text-[10px]">Estrutural</Badge>}
        </div>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {Object.entries(grouped).map(([category, codes]) => (
          <Collapsible key={category} open={expandedCategories.has(category)} onOpenChange={() => toggleCategory(category)}>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-2 rounded-lg hover:bg-accent/50 transition-colors">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="text-[10px] font-mono">
                  {category.toUpperCase()}
                </Badge>
                <span className="text-sm font-medium">{CATEGORY_LABELS[category]}</span>
                <span className="text-xs text-muted-foreground">({codes.length})</span>
              </div>
              {expandedCategories.has(category) ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-1 pl-2">
              {codes.map((code, idx) => {
                const ConfIcon = CONFIDENCE_ICON[code.confidence] || Info;
                return (
                  <div key={`${code.code}-${idx}`} className="flex items-start gap-2 p-2 rounded-md border border-border/50 bg-card hover:bg-accent/30 transition-colors">
                    <code className="text-xs font-mono font-bold text-primary whitespace-nowrap mt-0.5">
                      {code.code}.{code.qualifier}
                    </code>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground leading-tight">{code.description}</p>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <Badge variant="outline" className={cn('text-[9px] border', QUALIFIER_COLORS[code.qualifier])}>
                          {qualifierLabel(code.qualifier)}
                        </Badge>
                        <Badge variant="outline" className={cn('text-[9px] border', SOURCE_COLORS[code.source])}>
                          {SOURCE_LABELS[code.source]}
                        </Badge>
                      </div>
                    </div>
                    <ConfIcon className={cn(
                      'icon-sm shrink-0 mt-0.5',
                      code.confidence === 'alta' ? 'text-emerald-500' : code.confidence === 'media' ? 'text-blue-500' : 'text-orange-500'
                    )} />
                  </div>
                );
              })}
            </CollapsibleContent>
          </Collapsible>
        ))}

        {suggestion.codes.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum código CIF aplicável com base nos dados atuais.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function groupByCategory(codes: CIFCode[]): Record<string, CIFCode[]> {
  const grouped: Record<string, CIFCode[]> = {};
  for (const code of codes) {
    if (!grouped[code.category]) grouped[code.category] = [];
    grouped[code.category].push(code);
  }
  return grouped;
}
