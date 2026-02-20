export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      agendamentos: {
        Row: {
          cor: string | null
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          observacoes: string | null
          paciente_id: string | null
          status: string
          terapeuta_id: string
          tipo_atendimento: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          observacoes?: string | null
          paciente_id?: string | null
          status?: string
          terapeuta_id: string
          tipo_atendimento?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string | null
          status?: string
          terapeuta_id?: string
          tipo_atendimento?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes: {
        Row: {
          created_at: string
          dados_bloco: Json | null
          dor_identidade: number | null
          id: string
          paciente_id: string
          score_c: number | null
          score_d: number | null
          score_e: number | null
          score_efi: number | null
          score_f: number | null
          score_p: number | null
          score_r: number | null
          status: string
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dados_bloco?: Json | null
          dor_identidade?: number | null
          id?: string
          paciente_id: string
          score_c?: number | null
          score_d?: number | null
          score_e?: number | null
          score_efi?: number | null
          score_f?: number | null
          score_p?: number | null
          score_r?: number | null
          status?: string
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dados_bloco?: Json | null
          dor_identidade?: number | null
          id?: string
          paciente_id?: string
          score_c?: number | null
          score_d?: number | null
          score_e?: number | null
          score_efi?: number | null
          score_f?: number | null
          score_p?: number | null
          score_r?: number | null
          status?: string
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_cob_zero: {
        Row: {
          cobb_angle: number | null
          created_at: string
          dados_avaliacao: Json
          data_avaliacao: string
          id: string
          lenke_type: string | null
          paciente_id: string
          paciente_nome: string
          risco_level: string | null
          risco_percentage: number | null
          score_e: number | null
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          cobb_angle?: number | null
          created_at?: string
          dados_avaliacao: Json
          data_avaliacao: string
          id?: string
          lenke_type?: string | null
          paciente_id: string
          paciente_nome: string
          risco_level?: string | null
          risco_percentage?: number | null
          score_e?: number | null
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          cobb_angle?: number | null
          created_at?: string
          dados_avaliacao?: Json
          data_avaliacao?: string
          id?: string
          lenke_type?: string | null
          paciente_id?: string
          paciente_nome?: string
          risco_level?: string | null
          risco_percentage?: number | null
          score_e?: number | null
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_cob_zero_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      avaliacoes_identidade: {
        Row: {
          classificacao: string | null
          created_at: string
          dados_avaliacao: Json
          data_avaliacao: string
          id: string
          id_final: number | null
          paciente_id: string
          paciente_nome: string
          score_c: number | null
          score_d: number | null
          score_e: number | null
          score_efi: number | null
          score_f: number | null
          score_p: number | null
          score_r: number | null
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          classificacao?: string | null
          created_at?: string
          dados_avaliacao: Json
          data_avaliacao: string
          id?: string
          id_final?: number | null
          paciente_id: string
          paciente_nome: string
          score_c?: number | null
          score_d?: number | null
          score_e?: number | null
          score_efi?: number | null
          score_f?: number | null
          score_p?: number | null
          score_r?: number | null
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          classificacao?: string | null
          created_at?: string
          dados_avaliacao?: Json
          data_avaliacao?: string
          id?: string
          id_final?: number | null
          paciente_id?: string
          paciente_nome?: string
          score_c?: number | null
          score_d?: number | null
          score_e?: number | null
          score_efi?: number | null
          score_f?: number | null
          score_p?: number | null
          score_r?: number | null
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_identidade_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      config_agenda: {
        Row: {
          created_at: string
          dias_semana: Json
          duracao_padrao: number
          horario_fim: string
          horario_inicio: string
          id: string
          intervalo_entre_sessoes: number
          slug: string | null
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dias_semana?: Json
          duracao_padrao?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          intervalo_entre_sessoes?: number
          slug?: string | null
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dias_semana?: Json
          duracao_padrao?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          intervalo_entre_sessoes?: number
          slug?: string | null
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      exercicios_biblioteca: {
        Row: {
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          imagem_url: string | null
          instrucoes: Json | null
          modificacoes: Json | null
          nivel_dificuldade: string
          nome: string
          perfis_indicados: Json | null
          precaucoes: Json | null
          regiao_corporal: Json | null
          tempo_duracao: string | null
          tipo: string | null
          video_url: string | null
        }
        Insert: {
          categoria: string
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          instrucoes?: Json | null
          modificacoes?: Json | null
          nivel_dificuldade?: string
          nome: string
          perfis_indicados?: Json | null
          precaucoes?: Json | null
          regiao_corporal?: Json | null
          tempo_duracao?: string | null
          tipo?: string | null
          video_url?: string | null
        }
        Update: {
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          imagem_url?: string | null
          instrucoes?: Json | null
          modificacoes?: Json | null
          nivel_dificuldade?: string
          nome?: string
          perfis_indicados?: Json | null
          precaucoes?: Json | null
          regiao_corporal?: Json | null
          tempo_duracao?: string | null
          tipo?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      links_agenda_paciente: {
        Row: {
          acessos_totais: number | null
          created_at: string | null
          data_criacao: string | null
          data_expiracao: string | null
          data_primeiro_acesso: string | null
          data_ultimo_acesso: string | null
          id: string
          paciente_id: string
          status: string | null
          terapeuta_id: string
          token: string
          updated_at: string | null
        }
        Insert: {
          acessos_totais?: number | null
          created_at?: string | null
          data_criacao?: string | null
          data_expiracao?: string | null
          data_primeiro_acesso?: string | null
          data_ultimo_acesso?: string | null
          id?: string
          paciente_id: string
          status?: string | null
          terapeuta_id: string
          token?: string
          updated_at?: string | null
        }
        Update: {
          acessos_totais?: number | null
          created_at?: string | null
          data_criacao?: string | null
          data_expiracao?: string | null
          data_primeiro_acesso?: string | null
          data_ultimo_acesso?: string | null
          id?: string
          paciente_id?: string
          status?: string | null
          terapeuta_id?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "links_agenda_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      links_avaliacao: {
        Row: {
          acessos_totais: number | null
          blocos_inclusos: Json | null
          created_at: string | null
          data_criacao: string | null
          data_expiracao: string | null
          data_primeiro_acesso: string | null
          data_ultimo_acesso: string | null
          id: string
          paciente_id: string
          status: string | null
          terapeuta_id: string
          token: string
          updated_at: string | null
        }
        Insert: {
          acessos_totais?: number | null
          blocos_inclusos?: Json | null
          created_at?: string | null
          data_criacao?: string | null
          data_expiracao?: string | null
          data_primeiro_acesso?: string | null
          data_ultimo_acesso?: string | null
          id?: string
          paciente_id: string
          status?: string | null
          terapeuta_id: string
          token?: string
          updated_at?: string | null
        }
        Update: {
          acessos_totais?: number | null
          blocos_inclusos?: Json | null
          created_at?: string | null
          data_criacao?: string | null
          data_expiracao?: string | null
          data_primeiro_acesso?: string | null
          data_ultimo_acesso?: string | null
          id?: string
          paciente_id?: string
          status?: string | null
          terapeuta_id?: string
          token?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "links_avaliacao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      paciente_servicos: {
        Row: {
          ativo: boolean
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          paciente_id: string
          servico: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          paciente_id: string
          servico: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          paciente_id?: string
          servico?: string
        }
        Relationships: [
          {
            foreignKeyName: "paciente_servicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pacientes: {
        Row: {
          ativo: boolean
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          genero: string | null
          id: string
          nome: string
          observacoes: string | null
          sexo: string | null
          sobrenome: string
          telefone: string | null
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          genero?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          sexo?: string | null
          sobrenome?: string
          telefone?: string | null
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          genero?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          sexo?: string | null
          sobrenome?: string
          telefone?: string | null
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      prescricoes_exercicios: {
        Row: {
          created_at: string
          exercicio_id: string
          fase_id: string
          frequencia: string | null
          id: string
          observacoes: string | null
          progressao: Json | null
          protocolo_id: string
          repeticoes: number | null
          series: number | null
          tempo_descanso: string | null
        }
        Insert: {
          created_at?: string
          exercicio_id: string
          fase_id: string
          frequencia?: string | null
          id?: string
          observacoes?: string | null
          progressao?: Json | null
          protocolo_id: string
          repeticoes?: number | null
          series?: number | null
          tempo_descanso?: string | null
        }
        Update: {
          created_at?: string
          exercicio_id?: string
          fase_id?: string
          frequencia?: string | null
          id?: string
          observacoes?: string | null
          progressao?: Json | null
          protocolo_id?: string
          repeticoes?: number | null
          series?: number | null
          tempo_descanso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescricoes_exercicios_exercicio_id_fkey"
            columns: ["exercicio_id"]
            isOneToOne: false
            referencedRelation: "exercicios_biblioteca"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricoes_exercicios_fase_id_fkey"
            columns: ["fase_id"]
            isOneToOne: false
            referencedRelation: "protocolo_fases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescricoes_exercicios_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          crefito: string | null
          email: string
          especialidade: string | null
          id: string
          nome: string
          sobrenome: string
          telefone: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          crefito?: string | null
          email?: string
          especialidade?: string | null
          id?: string
          nome?: string
          sobrenome?: string
          telefone?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          crefito?: string | null
          email?: string
          especialidade?: string | null
          id?: string
          nome?: string
          sobrenome?: string
          telefone?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      progresso_exercicios: {
        Row: {
          concluido: boolean | null
          created_at: string
          data_execucao: string | null
          dor_reportada: number | null
          id: string
          nivel_dificuldade_reportado: number | null
          observacoes: string | null
          paciente_id: string
          prescricao_id: string
          repeticoes_realizadas: number | null
          series_realizadas: number | null
        }
        Insert: {
          concluido?: boolean | null
          created_at?: string
          data_execucao?: string | null
          dor_reportada?: number | null
          id?: string
          nivel_dificuldade_reportado?: number | null
          observacoes?: string | null
          paciente_id: string
          prescricao_id: string
          repeticoes_realizadas?: number | null
          series_realizadas?: number | null
        }
        Update: {
          concluido?: boolean | null
          created_at?: string
          data_execucao?: string | null
          dor_reportada?: number | null
          id?: string
          nivel_dificuldade_reportado?: number | null
          observacoes?: string | null
          paciente_id?: string
          prescricao_id?: string
          repeticoes_realizadas?: number | null
          series_realizadas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "progresso_exercicios_prescricao_id_fkey"
            columns: ["prescricao_id"]
            isOneToOne: false
            referencedRelation: "prescricoes_exercicios"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolo_fases: {
        Row: {
          created_at: string
          id: string
          numero_fase: number
          objetivos: Json | null
          protocolo_id: string
          semanas_fim: number | null
          semanas_inicio: number | null
          sessoes_por_semana: number | null
          titulo: string
        }
        Insert: {
          created_at?: string
          id?: string
          numero_fase: number
          objetivos?: Json | null
          protocolo_id: string
          semanas_fim?: number | null
          semanas_inicio?: number | null
          sessoes_por_semana?: number | null
          titulo: string
        }
        Update: {
          created_at?: string
          id?: string
          numero_fase?: number
          objetivos?: Json | null
          protocolo_id?: string
          semanas_fim?: number | null
          semanas_inicio?: number | null
          sessoes_por_semana?: number | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocolo_fases_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolo_progressao: {
        Row: {
          created_at: string | null
          criterios_atingidos: Json | null
          fase_atual: number | null
          id: string
          observacoes: string | null
          paciente_id: string
          protocolo_id: string
          proxima_avaliacao: string | null
          semana_atual: number | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          criterios_atingidos?: Json | null
          fase_atual?: number | null
          id?: string
          observacoes?: string | null
          paciente_id: string
          protocolo_id: string
          proxima_avaliacao?: string | null
          semana_atual?: number | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          criterios_atingidos?: Json | null
          fase_atual?: number | null
          id?: string
          observacoes?: string | null
          paciente_id?: string
          protocolo_id?: string
          proxima_avaliacao?: string | null
          semana_atual?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "protocolo_progressao_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolo_progressao_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolo_templates: {
        Row: {
          classificacao_severidade: string | null
          created_at: string | null
          criterios_progressao: Json | null
          diagnostico_principal: string | null
          duracao_estimada_semanas: number | null
          evidencia_cientifica: string | null
          fases: Json | null
          frequencia_semanal: number | null
          id: string
          nome: string
          regiao_anatomica: string | null
        }
        Insert: {
          classificacao_severidade?: string | null
          created_at?: string | null
          criterios_progressao?: Json | null
          diagnostico_principal?: string | null
          duracao_estimada_semanas?: number | null
          evidencia_cientifica?: string | null
          fases?: Json | null
          frequencia_semanal?: number | null
          id?: string
          nome: string
          regiao_anatomica?: string | null
        }
        Update: {
          classificacao_severidade?: string | null
          created_at?: string | null
          criterios_progressao?: Json | null
          diagnostico_principal?: string | null
          duracao_estimada_semanas?: number | null
          evidencia_cientifica?: string | null
          fases?: Json | null
          frequencia_semanal?: number | null
          id?: string
          nome?: string
          regiao_anatomica?: string | null
        }
        Relationships: []
      }
      protocolo_tratamentos: {
        Row: {
          ativo: boolean
          created_at: string
          fase_numero: number
          id: string
          observacoes: string | null
          parametros_customizados: Json | null
          protocolo_id: string
          tecnica_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          fase_numero?: number
          id?: string
          observacoes?: string | null
          parametros_customizados?: Json | null
          protocolo_id: string
          tecnica_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          fase_numero?: number
          id?: string
          observacoes?: string | null
          parametros_customizados?: Json | null
          protocolo_id?: string
          tecnica_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocolo_tratamentos_protocolo_id_fkey"
            columns: ["protocolo_id"]
            isOneToOne: false
            referencedRelation: "protocolos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "protocolo_tratamentos_tecnica_id_fkey"
            columns: ["tecnica_id"]
            isOneToOne: false
            referencedRelation: "tecnicas_tratamento"
            referencedColumns: ["id"]
          },
        ]
      }
      protocolos: {
        Row: {
          avaliacao_id: string | null
          created_at: string
          data_envio: string | null
          data_fim_prevista: string | null
          data_inicio: string | null
          descricao: string | null
          duracao_total: string | null
          enviado_para_paciente: boolean | null
          frequencia: string | null
          hierarquia_terapeutica: Json | null
          id: string
          objetivo_geral: string | null
          paciente_id: string
          perfil_dominante: Json | null
          scores_avaliacao: Json | null
          status: string
          terapeuta_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          avaliacao_id?: string | null
          created_at?: string
          data_envio?: string | null
          data_fim_prevista?: string | null
          data_inicio?: string | null
          descricao?: string | null
          duracao_total?: string | null
          enviado_para_paciente?: boolean | null
          frequencia?: string | null
          hierarquia_terapeutica?: Json | null
          id?: string
          objetivo_geral?: string | null
          paciente_id: string
          perfil_dominante?: Json | null
          scores_avaliacao?: Json | null
          status?: string
          terapeuta_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          avaliacao_id?: string | null
          created_at?: string
          data_envio?: string | null
          data_fim_prevista?: string | null
          data_inicio?: string | null
          descricao?: string | null
          duracao_total?: string | null
          enviado_para_paciente?: boolean | null
          frequencia?: string | null
          hierarquia_terapeutica?: Json | null
          id?: string
          objetivo_geral?: string | null
          paciente_id?: string
          perfil_dominante?: Json | null
          scores_avaliacao?: Json | null
          status?: string
          terapeuta_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      protocolos_cob_zero: {
        Row: {
          classificacao_lenke: string | null
          cobb_angle: number | null
          created_at: string
          dados_protocolo: Json | null
          id: string
          paciente_id: string
          risco_progressao: number | null
          status: string
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          classificacao_lenke?: string | null
          cobb_angle?: number | null
          created_at?: string
          dados_protocolo?: Json | null
          id?: string
          paciente_id: string
          risco_progressao?: number | null
          status?: string
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          classificacao_lenke?: string | null
          cobb_angle?: number | null
          created_at?: string
          dados_protocolo?: Json | null
          id?: string
          paciente_id?: string
          risco_progressao?: number | null
          status?: string
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocolos_cob_zero_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      respostas_avaliacao_paciente: {
        Row: {
          bloco_numero: number
          created_at: string | null
          dados_respostas: Json | null
          data_preenchimento: string | null
          id: string
          link_id: string
          numero_tentativa: number | null
          paciente_id: string
        }
        Insert: {
          bloco_numero: number
          created_at?: string | null
          dados_respostas?: Json | null
          data_preenchimento?: string | null
          id?: string
          link_id: string
          numero_tentativa?: number | null
          paciente_id: string
        }
        Update: {
          bloco_numero?: number
          created_at?: string | null
          dados_respostas?: Json | null
          data_preenchimento?: string | null
          id?: string
          link_id?: string
          numero_tentativa?: number | null
          paciente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "respostas_avaliacao_paciente_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "links_avaliacao"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "respostas_avaliacao_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      tecnicas_tratamento: {
        Row: {
          categoria: string
          complexidade: string | null
          contraindicacoes: string | null
          created_at: string
          descricao: string | null
          fase_ideal: number | null
          id: string
          indicacoes: string | null
          nivel_evidencia: string | null
          nome: string
          parametros: Json | null
          prerequisitos: string[] | null
        }
        Insert: {
          categoria: string
          complexidade?: string | null
          contraindicacoes?: string | null
          created_at?: string
          descricao?: string | null
          fase_ideal?: number | null
          id?: string
          indicacoes?: string | null
          nivel_evidencia?: string | null
          nome: string
          parametros?: Json | null
          prerequisitos?: string[] | null
        }
        Update: {
          categoria?: string
          complexidade?: string | null
          contraindicacoes?: string | null
          created_at?: string
          descricao?: string | null
          fase_ideal?: number | null
          id?: string
          indicacoes?: string | null
          nivel_evidencia?: string | null
          nome?: string
          parametros?: Json | null
          prerequisitos?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      link_avaliacao_valido: { Args: { p_link_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
