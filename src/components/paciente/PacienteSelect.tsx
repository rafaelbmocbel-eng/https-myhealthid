import * as React from "react"
import { Check, ChevronsUpDown, Search } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
    Command,
    CommandEmpty,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from "@/components/ui/command"
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover"

interface Paciente {
    id: string;
    nome: string;
    sobrenome?: string;
}

interface PacienteSelectProps {
    pacientes: Paciente[];
    value: string;
    onValueChange: (value: string) => void;
    placeholder?: string;
    disabled?: boolean;
    allowBlock?: boolean; // For Agenda "Bloqueio de horário"
}

export function PacienteSelect({
    pacientes,
    value,
    onValueChange,
    placeholder = "Selecionar paciente...",
    disabled = false,
    allowBlock = false
}: PacienteSelectProps) {
    const [open, setOpen] = React.useState(false)

    const selectedPatient = React.useMemo(() => {
        if (value === "bloqueio") return { nome: "— Bloqueio de horário —", sobrenome: "" };
        return pacientes.find((p) => p.id === value);
    }, [pacientes, value]);

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={open}
                    className="w-full justify-between font-normal h-12 text-base bg-card border-2 border-primary/20 hover:border-primary/50 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20 shadow-sm transition-colors"
                    disabled={disabled}
                >
                    <span className="truncate flex items-center gap-2">
                        <Search className="h-4 w-4 text-primary shrink-0" />
                        {value
                            ? selectedPatient
                                ? `${selectedPatient.nome} ${selectedPatient.sobrenome || ""}`
                                : placeholder
                            : placeholder}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[--radix-popover-trigger-width] p-0 shadow-2xl border-primary/20" align="start">
                <Command className="rounded-lg border shadow-md">
                    <CommandInput placeholder="Pesquisar paciente..." className="h-12 text-base" />
                    <CommandList className="max-h-[300px]">
                        <CommandEmpty className="py-6 text-center text-sm text-muted-foreground">
                            Nenhum paciente encontrado.
                        </CommandEmpty>
                        <CommandGroup>
                            {allowBlock && (
                                <CommandItem
                                    value="bloqueio — bloqueio de horário —"
                                    onSelect={() => {
                                        onValueChange("bloqueio")
                                        setOpen(false)
                                    }}
                                    className="bg-amber-50/50 text-amber-700 font-bold hover:bg-amber-100 data-[selected=true]:bg-amber-100 cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === "bloqueio" ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    — Bloqueio de horário —
                                </CommandItem>
                            )}
                            {pacientes.map((p) => (
                                <CommandItem
                                    key={p.id}
                                    value={`${p.nome} ${p.sobrenome || ""}`.toLowerCase()}
                                    onSelect={() => {
                                        onValueChange(p.id)
                                        setOpen(false)
                                    }}
                                    className="cursor-pointer"
                                >
                                    <Check
                                        className={cn(
                                            "mr-2 h-4 w-4",
                                            value === p.id ? "opacity-100" : "opacity-0"
                                        )}
                                    />
                                    {p.nome} {p.sobrenome}
                                </CommandItem>
                            ))}
                        </CommandGroup>
                    </CommandList>
                </Command>
            </PopoverContent>
        </Popover>
    )
}
