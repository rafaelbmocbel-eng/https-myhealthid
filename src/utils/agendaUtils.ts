/**
 * Utilitários para a Agenda
 */

/**
 * Gera uma cor HSL consistente baseada em uma string (como o ID do paciente)
 * Retorna um esquema de cores (bg, border, text) suave e legível.
 */
export function getPatientColor(id: string) {
    if (!id) return {
        bg: 'bg-primary/10',
        border: 'border-primary/30',
        text: 'text-primary-foreground'
    };

    // Algoritmo simples de hash para o ID
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
        hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }

    // Usar o hash para selecionar um matiz (hue) no círculo cromático
    const h = Math.abs(hash % 360);

    // Retornar estilos Tailwind inline ou classes CSS dinâmicas
    // Como estamos usando Tailwind no projeto, vamos retornar um objeto de estilo inline para maior flexibilidade
    return {
        backgroundColor: `hsl(${h}, 70%, 95%)`,
        borderColor: `hsl(${h}, 60%, 80%)`,
        color: `hsl(${h}, 80%, 25%)`,
        borderLeftColor: `hsl(${h}, 70%, 50%)`
    };
}
