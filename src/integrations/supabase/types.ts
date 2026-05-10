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
          membro_equipe_id: string | null
          observacoes: string | null
          paciente_id: string | null
          recorrencia_grupo_id: string | null
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
          membro_equipe_id?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          recorrencia_grupo_id?: string | null
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
          membro_equipe_id?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          recorrencia_grupo_id?: string | null
          status?: string
          terapeuta_id?: string
          tipo_atendimento?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "agendamentos_membro_equipe_id_fkey"
            columns: ["membro_equipe_id"]
            isOneToOne: false
            referencedRelation: "equipe_membros"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agendamentos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      assinaturas: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          origem: string
          plano_id: string
          status: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          origem?: string
          plano_id: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          origem?: string
          plano_id?: string
          status?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assinaturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "planos"
            referencedColumns: ["id"]
          },
        ]
      }
      ausencias_terapeuta: {
        Row: {
          cor: string | null
          created_at: string
          data_fim: string
          data_inicio: string
          dia_inteiro: boolean
          hora_fim: string | null
          hora_inicio: string | null
          id: string
          motivo: string | null
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          cor?: string | null
          created_at?: string
          data_fim: string
          data_inicio: string
          dia_inteiro?: boolean
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string | null
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          cor?: string | null
          created_at?: string
          data_fim?: string
          data_inicio?: string
          dia_inteiro?: boolean
          hora_fim?: string | null
          hora_inicio?: string | null
          id?: string
          motivo?: string | null
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
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
          concluido_em: string | null
          created_at: string
          dados_avaliacao: Json
          data_avaliacao: string
          dimensoes_preenchidas: Json
          fase_atual: number
          fase_concluida: number
          id: string
          id_final: number | null
          link_id: string | null
          myid_analysis: Json | null
          myid_score: number | null
          myid_score_parcial: number | null
          paciente_id: string
          paciente_nome: string
          red_flags: Json | null
          score_c: number | null
          score_d: number | null
          score_e: number | null
          score_efi: number | null
          score_f: number | null
          score_i: number | null
          score_n: number | null
          score_p: number | null
          score_r: number | null
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          classificacao?: string | null
          concluido_em?: string | null
          created_at?: string
          dados_avaliacao: Json
          data_avaliacao: string
          dimensoes_preenchidas?: Json
          fase_atual?: number
          fase_concluida?: number
          id?: string
          id_final?: number | null
          link_id?: string | null
          myid_analysis?: Json | null
          myid_score?: number | null
          myid_score_parcial?: number | null
          paciente_id: string
          paciente_nome: string
          red_flags?: Json | null
          score_c?: number | null
          score_d?: number | null
          score_e?: number | null
          score_efi?: number | null
          score_f?: number | null
          score_i?: number | null
          score_n?: number | null
          score_p?: number | null
          score_r?: number | null
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          classificacao?: string | null
          concluido_em?: string | null
          created_at?: string
          dados_avaliacao?: Json
          data_avaliacao?: string
          dimensoes_preenchidas?: Json
          fase_atual?: number
          fase_concluida?: number
          id?: string
          id_final?: number | null
          link_id?: string | null
          myid_analysis?: Json | null
          myid_score?: number | null
          myid_score_parcial?: number | null
          paciente_id?: string
          paciente_nome?: string
          red_flags?: Json | null
          score_c?: number | null
          score_d?: number | null
          score_e?: number | null
          score_efi?: number | null
          score_f?: number | null
          score_i?: number | null
          score_n?: number | null
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
      avaliacoes_voz: {
        Row: {
          classificacao_severidade: string | null
          created_at: string
          id: string
          paciente_id: string | null
          paciente_nome: string | null
          queixa_principal: string | null
          resultado: Json
          servico: string
          terapeuta_id: string
          transcricao: string
          updated_at: string
        }
        Insert: {
          classificacao_severidade?: string | null
          created_at?: string
          id?: string
          paciente_id?: string | null
          paciente_nome?: string | null
          queixa_principal?: string | null
          resultado: Json
          servico: string
          terapeuta_id: string
          transcricao: string
          updated_at?: string
        }
        Update: {
          classificacao_severidade?: string | null
          created_at?: string
          id?: string
          paciente_id?: string | null
          paciente_nome?: string | null
          queixa_principal?: string | null
          resultado?: Json
          servico?: string
          terapeuta_id?: string
          transcricao?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "avaliacoes_voz_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      body_composition: {
        Row: {
          arm_cm: number | null
          bmi: number | null
          body_fat_pct: number | null
          chest_cm: number | null
          created_at: string
          date: string
          height_cm: number | null
          hip_cm: number | null
          id: string
          muscle_mass_kg: number | null
          notes: string | null
          paciente_id: string
          source: string
          terapeuta_id: string
          thigh_cm: number | null
          updated_at: string
          visceral_fat: number | null
          waist_cm: number | null
          weight_kg: number | null
        }
        Insert: {
          arm_cm?: number | null
          bmi?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          created_at?: string
          date?: string
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          paciente_id: string
          source?: string
          terapeuta_id: string
          thigh_cm?: number | null
          updated_at?: string
          visceral_fat?: number | null
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Update: {
          arm_cm?: number | null
          bmi?: number | null
          body_fat_pct?: number | null
          chest_cm?: number | null
          created_at?: string
          date?: string
          height_cm?: number | null
          hip_cm?: number | null
          id?: string
          muscle_mass_kg?: number | null
          notes?: string | null
          paciente_id?: string
          source?: string
          terapeuta_id?: string
          thigh_cm?: number | null
          updated_at?: string
          visceral_fat?: number | null
          waist_cm?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "body_composition_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_mensagens: {
        Row: {
          created_at: string
          id: string
          lida: boolean
          mensagem: string
          metadata: Json | null
          paciente_id: string
          remetente: string
          terapeuta_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem: string
          metadata?: Json | null
          paciente_id: string
          remetente?: string
          terapeuta_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          lida?: boolean
          mensagem?: string
          metadata?: Json | null
          paciente_id?: string
          remetente?: string
          terapeuta_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_mensagens_paciente_id_fkey"
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
          servicos_ativos: Json
          slug: string | null
          terapeuta_id: string
          turnos: Json
          updated_at: string
          vagas_por_horario: number
        }
        Insert: {
          created_at?: string
          dias_semana?: Json
          duracao_padrao?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          intervalo_entre_sessoes?: number
          servicos_ativos?: Json
          slug?: string | null
          terapeuta_id: string
          turnos?: Json
          updated_at?: string
          vagas_por_horario?: number
        }
        Update: {
          created_at?: string
          dias_semana?: Json
          duracao_padrao?: number
          horario_fim?: string
          horario_inicio?: string
          id?: string
          intervalo_entre_sessoes?: number
          servicos_ativos?: Json
          slug?: string | null
          terapeuta_id?: string
          turnos?: Json
          updated_at?: string
          vagas_por_horario?: number
        }
        Relationships: []
      }
      config_clinica: {
        Row: {
          cep: string | null
          cidade: string | null
          cnpj: string | null
          created_at: string
          email_clinica: string | null
          endereco: string | null
          id: string
          logo_url: string | null
          razao_social: string | null
          responsavel: string | null
          telefone: string | null
          terapeuta_id: string
          uf: string | null
          updated_at: string
          zapi_ativo: boolean
          zapi_client_token: string | null
          zapi_instance_id: string | null
          zapi_token: string | null
        }
        Insert: {
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email_clinica?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          razao_social?: string | null
          responsavel?: string | null
          telefone?: string | null
          terapeuta_id: string
          uf?: string | null
          updated_at?: string
          zapi_ativo?: boolean
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Update: {
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          created_at?: string
          email_clinica?: string | null
          endereco?: string | null
          id?: string
          logo_url?: string | null
          razao_social?: string | null
          responsavel?: string | null
          telefone?: string | null
          terapeuta_id?: string
          uf?: string | null
          updated_at?: string
          zapi_ativo?: boolean
          zapi_client_token?: string | null
          zapi_instance_id?: string | null
          zapi_token?: string | null
        }
        Relationships: []
      }
      controle_sessoes: {
        Row: {
          agendamento_id: string | null
          created_at: string
          data_sessao: string
          duracao_minutos: number | null
          forma_pagamento: string | null
          id: string
          numero_sessao: number
          observacoes: string | null
          paciente_id: string
          plano_nome: string | null
          status: string
          terapeuta_id: string
          tipo_atendimento: string | null
          tipo_cliente: string | null
          updated_at: string
          valor_cobrado: number | null
          valor_guia: number | null
        }
        Insert: {
          agendamento_id?: string | null
          created_at?: string
          data_sessao?: string
          duracao_minutos?: number | null
          forma_pagamento?: string | null
          id?: string
          numero_sessao?: number
          observacoes?: string | null
          paciente_id: string
          plano_nome?: string | null
          status?: string
          terapeuta_id: string
          tipo_atendimento?: string | null
          tipo_cliente?: string | null
          updated_at?: string
          valor_cobrado?: number | null
          valor_guia?: number | null
        }
        Update: {
          agendamento_id?: string | null
          created_at?: string
          data_sessao?: string
          duracao_minutos?: number | null
          forma_pagamento?: string | null
          id?: string
          numero_sessao?: number
          observacoes?: string | null
          paciente_id?: string
          plano_nome?: string | null
          status?: string
          terapeuta_id?: string
          tipo_atendimento?: string | null
          tipo_cliente?: string | null
          updated_at?: string
          valor_cobrado?: number | null
          valor_guia?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "controle_sessoes_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "controle_sessoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_logs: {
        Row: {
          created_at: string
          energy: number
          id: string
          mood: number
          notes: string | null
          paciente_id: string
          pain: number
          sleep_hours: number
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          energy?: number
          id?: string
          mood?: number
          notes?: string | null
          paciente_id: string
          pain?: number
          sleep_hours?: number
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          energy?: number
          id?: string
          mood?: number
          notes?: string | null
          paciente_id?: string
          pain?: number
          sleep_hours?: number
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "daily_logs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      documentos_emitidos: {
        Row: {
          conteudo: Json
          created_at: string
          data_emissao: string
          id: string
          paciente_id: string
          terapeuta_id: string
          tipo: string
          titulo: string
          updated_at: string
        }
        Insert: {
          conteudo?: Json
          created_at?: string
          data_emissao?: string
          id?: string
          paciente_id: string
          terapeuta_id: string
          tipo: string
          titulo: string
          updated_at?: string
        }
        Update: {
          conteudo?: Json
          created_at?: string
          data_emissao?: string
          id?: string
          paciente_id?: string
          terapeuta_id?: string
          tipo?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
      }
      equipe_membros: {
        Row: {
          ativo: boolean
          cor: string
          created_at: string
          id: string
          nome: string
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome: string
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cor?: string
          created_at?: string
          id?: string
          nome?: string
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      evento_inscricoes: {
        Row: {
          created_at: string
          email: string | null
          evento_id: string
          id: string
          ja_era_paciente: boolean
          nome: string
          paciente_id: string | null
          pago: boolean
          status: string
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          evento_id: string
          id?: string
          ja_era_paciente?: boolean
          nome: string
          paciente_id?: string | null
          pago?: boolean
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          evento_id?: string
          id?: string
          ja_era_paciente?: boolean
          nome?: string
          paciente_id?: string | null
          pago?: boolean
          status?: string
          telefone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_inscricoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_inscricoes_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_publicos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_inscricoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_perguntas: {
        Row: {
          created_at: string
          evento_id: string
          id: string
          limite_por_opcao: number | null
          obrigatoria: boolean
          opcoes: Json | null
          ordem: number
          pergunta: string
          tipo: string
        }
        Insert: {
          created_at?: string
          evento_id: string
          id?: string
          limite_por_opcao?: number | null
          obrigatoria?: boolean
          opcoes?: Json | null
          ordem?: number
          pergunta: string
          tipo?: string
        }
        Update: {
          created_at?: string
          evento_id?: string
          id?: string
          limite_por_opcao?: number | null
          obrigatoria?: boolean
          opcoes?: Json | null
          ordem?: number
          pergunta?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "evento_perguntas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_perguntas_evento_id_fkey"
            columns: ["evento_id"]
            isOneToOne: false
            referencedRelation: "eventos_publicos"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_respostas: {
        Row: {
          created_at: string
          id: string
          inscricao_id: string
          pergunta_id: string
          resposta: Json | null
        }
        Insert: {
          created_at?: string
          id?: string
          inscricao_id: string
          pergunta_id: string
          resposta?: Json | null
        }
        Update: {
          created_at?: string
          id?: string
          inscricao_id?: string
          pergunta_id?: string
          resposta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "evento_respostas_inscricao_id_fkey"
            columns: ["inscricao_id"]
            isOneToOne: false
            referencedRelation: "evento_inscricoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evento_respostas_pergunta_id_fkey"
            columns: ["pergunta_id"]
            isOneToOne: false
            referencedRelation: "evento_perguntas"
            referencedColumns: ["id"]
          },
        ]
      }
      eventos: {
        Row: {
          ativo: boolean
          cobrar_pagamento: boolean
          created_at: string
          data_evento: string
          descricao: string | null
          descricao_formulario: string | null
          horario_fim: string
          horario_inicio: string
          id: string
          link_pagamento: string | null
          local: string | null
          pix_chave: string | null
          pix_nome: string | null
          pix_tipo: string | null
          terapeuta_id: string
          titulo: string
          updated_at: string
          vagas_max: number | null
          valor: number | null
        }
        Insert: {
          ativo?: boolean
          cobrar_pagamento?: boolean
          created_at?: string
          data_evento: string
          descricao?: string | null
          descricao_formulario?: string | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          link_pagamento?: string | null
          local?: string | null
          pix_chave?: string | null
          pix_nome?: string | null
          pix_tipo?: string | null
          terapeuta_id: string
          titulo: string
          updated_at?: string
          vagas_max?: number | null
          valor?: number | null
        }
        Update: {
          ativo?: boolean
          cobrar_pagamento?: boolean
          created_at?: string
          data_evento?: string
          descricao?: string | null
          descricao_formulario?: string | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          link_pagamento?: string | null
          local?: string | null
          pix_chave?: string | null
          pix_nome?: string | null
          pix_tipo?: string | null
          terapeuta_id?: string
          titulo?: string
          updated_at?: string
          vagas_max?: number | null
          valor?: number | null
        }
        Relationships: []
      }
      evolucao_paciente: {
        Row: {
          avaliacao_anterior_id: string | null
          avaliacao_atual_id: string
          classificacao: string | null
          created_at: string
          data_registro: string
          delta_c: number | null
          delta_d: number | null
          delta_e: number | null
          delta_efi: number | null
          delta_f: number | null
          delta_i: number | null
          delta_id_final: number | null
          delta_n: number | null
          delta_p: number | null
          delta_r: number | null
          dias_desde_anterior: number | null
          id: string
          id_final: number | null
          myid_score: number | null
          numero_avaliacao: number
          observacoes: string | null
          paciente_id: string
          score_c: number | null
          score_d: number | null
          score_e: number | null
          score_efi: number | null
          score_f: number | null
          score_i: number | null
          score_n: number | null
          score_p: number | null
          score_r: number | null
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          avaliacao_anterior_id?: string | null
          avaliacao_atual_id: string
          classificacao?: string | null
          created_at?: string
          data_registro?: string
          delta_c?: number | null
          delta_d?: number | null
          delta_e?: number | null
          delta_efi?: number | null
          delta_f?: number | null
          delta_i?: number | null
          delta_id_final?: number | null
          delta_n?: number | null
          delta_p?: number | null
          delta_r?: number | null
          dias_desde_anterior?: number | null
          id?: string
          id_final?: number | null
          myid_score?: number | null
          numero_avaliacao?: number
          observacoes?: string | null
          paciente_id: string
          score_c?: number | null
          score_d?: number | null
          score_e?: number | null
          score_efi?: number | null
          score_f?: number | null
          score_i?: number | null
          score_n?: number | null
          score_p?: number | null
          score_r?: number | null
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          avaliacao_anterior_id?: string | null
          avaliacao_atual_id?: string
          classificacao?: string | null
          created_at?: string
          data_registro?: string
          delta_c?: number | null
          delta_d?: number | null
          delta_e?: number | null
          delta_efi?: number | null
          delta_f?: number | null
          delta_i?: number | null
          delta_id_final?: number | null
          delta_n?: number | null
          delta_p?: number | null
          delta_r?: number | null
          dias_desde_anterior?: number | null
          id?: string
          id_final?: number | null
          myid_score?: number | null
          numero_avaliacao?: number
          observacoes?: string | null
          paciente_id?: string
          score_c?: number | null
          score_d?: number | null
          score_e?: number | null
          score_efi?: number | null
          score_f?: number | null
          score_i?: number | null
          score_n?: number | null
          score_p?: number | null
          score_r?: number | null
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evolucao_paciente_avaliacao_anterior_id_fkey"
            columns: ["avaliacao_anterior_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes_identidade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_paciente_avaliacao_atual_id_fkey"
            columns: ["avaliacao_atual_id"]
            isOneToOne: false
            referencedRelation: "avaliacoes_identidade"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "evolucao_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
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
      funil_config: {
        Row: {
          ativo: boolean
          created_at: string
          diferenciais: Json
          id: string
          link_cartao: string | null
          mensagem_agendamento: string | null
          mensagem_boas_vindas: string
          mensagem_confirmacao: string | null
          mensagem_diferenciais: string | null
          mensagem_pagamento: string | null
          mensagem_servicos: string | null
          pix_chave: string | null
          pix_nome: string | null
          pix_tipo: string | null
          servicos: Json
          slug: string | null
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          diferenciais?: Json
          id?: string
          link_cartao?: string | null
          mensagem_agendamento?: string | null
          mensagem_boas_vindas?: string
          mensagem_confirmacao?: string | null
          mensagem_diferenciais?: string | null
          mensagem_pagamento?: string | null
          mensagem_servicos?: string | null
          pix_chave?: string | null
          pix_nome?: string | null
          pix_tipo?: string | null
          servicos?: Json
          slug?: string | null
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          diferenciais?: Json
          id?: string
          link_cartao?: string | null
          mensagem_agendamento?: string | null
          mensagem_boas_vindas?: string
          mensagem_confirmacao?: string | null
          mensagem_diferenciais?: string | null
          mensagem_pagamento?: string | null
          mensagem_servicos?: string | null
          pix_chave?: string | null
          pix_nome?: string | null
          pix_tipo?: string | null
          servicos?: Json
          slug?: string | null
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      funil_leads: {
        Row: {
          agendamento_id: string | null
          created_at: string
          dados_conversa: Json | null
          email: string | null
          etapa_atual: string
          forma_pagamento: string | null
          funil_config_id: string | null
          id: string
          nome: string
          servico_escolhido: string | null
          session_token: string
          status: string
          telefone: string | null
          terapeuta_id: string
          token_expira_em: string
          updated_at: string
          valor_servico: number | null
        }
        Insert: {
          agendamento_id?: string | null
          created_at?: string
          dados_conversa?: Json | null
          email?: string | null
          etapa_atual?: string
          forma_pagamento?: string | null
          funil_config_id?: string | null
          id?: string
          nome: string
          servico_escolhido?: string | null
          session_token?: string
          status?: string
          telefone?: string | null
          terapeuta_id: string
          token_expira_em?: string
          updated_at?: string
          valor_servico?: number | null
        }
        Update: {
          agendamento_id?: string | null
          created_at?: string
          dados_conversa?: Json | null
          email?: string | null
          etapa_atual?: string
          forma_pagamento?: string | null
          funil_config_id?: string | null
          id?: string
          nome?: string
          servico_escolhido?: string | null
          session_token?: string
          status?: string
          telefone?: string | null
          terapeuta_id?: string
          token_expira_em?: string
          updated_at?: string
          valor_servico?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "funil_leads_agendamento_id_fkey"
            columns: ["agendamento_id"]
            isOneToOne: false
            referencedRelation: "agendamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funil_leads_funil_config_id_fkey"
            columns: ["funil_config_id"]
            isOneToOne: false
            referencedRelation: "funil_config"
            referencedColumns: ["id"]
          },
        ]
      }
      health_metrics: {
        Row: {
          active_minutes: number | null
          calories_burned: number | null
          created_at: string
          date: string
          distance_km: number | null
          floors_climbed: number | null
          heart_rate_avg: number | null
          heart_rate_max: number | null
          heart_rate_min: number | null
          heart_rate_resting: number | null
          id: string
          paciente_id: string
          source: string
          spo2_avg: number | null
          spo2_min: number | null
          steps: number | null
          stress_level: number | null
          synced_at: string | null
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          active_minutes?: number | null
          calories_burned?: number | null
          created_at?: string
          date?: string
          distance_km?: number | null
          floors_climbed?: number | null
          heart_rate_avg?: number | null
          heart_rate_max?: number | null
          heart_rate_min?: number | null
          heart_rate_resting?: number | null
          id?: string
          paciente_id: string
          source?: string
          spo2_avg?: number | null
          spo2_min?: number | null
          steps?: number | null
          stress_level?: number | null
          synced_at?: string | null
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          active_minutes?: number | null
          calories_burned?: number | null
          created_at?: string
          date?: string
          distance_km?: number | null
          floors_climbed?: number | null
          heart_rate_avg?: number | null
          heart_rate_max?: number | null
          heart_rate_min?: number | null
          heart_rate_resting?: number | null
          id?: string
          paciente_id?: string
          source?: string
          spo2_avg?: number | null
          spo2_min?: number | null
          steps?: number | null
          stress_level?: number | null
          synced_at?: string | null
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "health_metrics_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
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
      meal_logs: {
        Row: {
          calories: number | null
          carbs_g: number | null
          created_at: string
          date: string
          description: string | null
          fat_g: number | null
          id: string
          meal_type: string
          paciente_id: string
          photo_url: string | null
          protein_g: number | null
          terapeuta_id: string
          time_eaten: string | null
          updated_at: string
        }
        Insert: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          date?: string
          description?: string | null
          fat_g?: number | null
          id?: string
          meal_type?: string
          paciente_id: string
          photo_url?: string | null
          protein_g?: number | null
          terapeuta_id: string
          time_eaten?: string | null
          updated_at?: string
        }
        Update: {
          calories?: number | null
          carbs_g?: number | null
          created_at?: string
          date?: string
          description?: string | null
          fat_g?: number | null
          id?: string
          meal_type?: string
          paciente_id?: string
          photo_url?: string | null
          protein_g?: number | null
          terapeuta_id?: string
          time_eaten?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "meal_logs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      mensagens_whatsapp: {
        Row: {
          canal: string
          created_at: string
          id: string
          mensagem: string
          paciente_id: string
          status: string
          template_id: string | null
          terapeuta_id: string
          tipo: string
        }
        Insert: {
          canal?: string
          created_at?: string
          id?: string
          mensagem: string
          paciente_id: string
          status?: string
          template_id?: string | null
          terapeuta_id: string
          tipo?: string
        }
        Update: {
          canal?: string
          created_at?: string
          id?: string
          mensagem?: string
          paciente_id?: string
          status?: string
          template_id?: string | null
          terapeuta_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "mensagens_whatsapp_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      myid_acoes_checklist: {
        Row: {
          action_key: string
          action_label: string
          action_text: string
          avaliacao_id: string | null
          completed: boolean
          completed_at: string | null
          created_at: string
          id: string
          ordem: number
          paciente_id: string
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          action_key: string
          action_label: string
          action_text: string
          avaliacao_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          ordem?: number
          paciente_id: string
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          action_key?: string
          action_label?: string
          action_text?: string
          avaliacao_id?: string | null
          completed?: boolean
          completed_at?: string | null
          created_at?: string
          id?: string
          ordem?: number
          paciente_id?: string
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      myid_avaliacoes: {
        Row: {
          created_at: string
          dimensoes_preenchidas: Json
          fase_atual: number
          fase_concluida: number
          id: string
          myid_score_parcial: number | null
          paciente_id: string | null
          red_flags_detectadas: boolean
          respostas_brutas: Json | null
          resultado_processado: Json | null
          status: string
          terapeuta_id: string
          token_acesso: string
          ultima_atividade_em: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dimensoes_preenchidas?: Json
          fase_atual?: number
          fase_concluida?: number
          id?: string
          myid_score_parcial?: number | null
          paciente_id?: string | null
          red_flags_detectadas?: boolean
          respostas_brutas?: Json | null
          resultado_processado?: Json | null
          status?: string
          terapeuta_id: string
          token_acesso?: string
          ultima_atividade_em?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dimensoes_preenchidas?: Json
          fase_atual?: number
          fase_concluida?: number
          id?: string
          myid_score_parcial?: number | null
          paciente_id?: string | null
          red_flags_detectadas?: boolean
          respostas_brutas?: Json | null
          resultado_processado?: Json | null
          status?: string
          terapeuta_id?: string
          token_acesso?: string
          ultima_atividade_em?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "myid_avaliacoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      notas_prontuario: {
        Row: {
          created_at: string
          dados_extras: Json | null
          descricao: string
          id: string
          paciente_id: string
          referencia_id: string | null
          terapeuta_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          dados_extras?: Json | null
          descricao: string
          id?: string
          paciente_id: string
          referencia_id?: string | null
          terapeuta_id: string
          tipo?: string
          titulo: string
        }
        Update: {
          created_at?: string
          dados_extras?: Json | null
          descricao?: string
          id?: string
          paciente_id?: string
          referencia_id?: string | null
          terapeuta_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "notas_prontuario_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacoes: {
        Row: {
          created_at: string
          descricao: string
          id: string
          lida: boolean
          metadata: Json | null
          rota: string | null
          terapeuta_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao: string
          id?: string
          lida?: boolean
          metadata?: Json | null
          rota?: string | null
          terapeuta_id: string
          tipo?: string
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string
          id?: string
          lida?: boolean
          metadata?: Json | null
          rota?: string | null
          terapeuta_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      paciente_missoes: {
        Row: {
          acao_imediata: string | null
          ativo: boolean
          categoria: string
          created_at: string
          descricao: string | null
          id: string
          ordem: number
          origem: string
          paciente_id: string
          source_key: string | null
          terapeuta_id: string
          titulo: string
          updated_at: string
          xp_recompensa: number
        }
        Insert: {
          acao_imediata?: string | null
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          origem?: string
          paciente_id: string
          source_key?: string | null
          terapeuta_id: string
          titulo: string
          updated_at?: string
          xp_recompensa?: number
        }
        Update: {
          acao_imediata?: string | null
          ativo?: boolean
          categoria?: string
          created_at?: string
          descricao?: string | null
          id?: string
          ordem?: number
          origem?: string
          paciente_id?: string
          source_key?: string | null
          terapeuta_id?: string
          titulo?: string
          updated_at?: string
          xp_recompensa?: number
        }
        Relationships: []
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
          origem: string | null
          plano_saude: string | null
          portal_token: string | null
          responsavel_id: string | null
          sexo: string | null
          sobrenome: string
          telefone: string | null
          terapeuta_id: string
          tipo_pagamento: string
          updated_at: string
          user_id: string | null
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
          origem?: string | null
          plano_saude?: string | null
          portal_token?: string | null
          responsavel_id?: string | null
          sexo?: string | null
          sobrenome?: string
          telefone?: string | null
          terapeuta_id: string
          tipo_pagamento?: string
          updated_at?: string
          user_id?: string | null
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
          origem?: string | null
          plano_saude?: string | null
          portal_token?: string | null
          responsavel_id?: string | null
          sexo?: string | null
          sobrenome?: string
          telefone?: string | null
          terapeuta_id?: string
          tipo_pagamento?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "equipe_membros"
            referencedColumns: ["id"]
          },
        ]
      }
      pacotes_sessoes: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string | null
          id: string
          nome: string
          observacoes: string | null
          paciente_id: string
          sessoes_utilizadas: number
          status: string
          terapeuta_id: string
          total_sessoes: number
          updated_at: string
          valor_total: number | null
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          paciente_id: string
          sessoes_utilizadas?: number
          status?: string
          terapeuta_id: string
          total_sessoes?: number
          updated_at?: string
          valor_total?: number | null
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          paciente_id?: string
          sessoes_utilizadas?: number
          status?: string
          terapeuta_id?: string
          total_sessoes?: number
          updated_at?: string
          valor_total?: number | null
        }
        Relationships: []
      }
      pagamentos_paciente: {
        Row: {
          comprovante_url: string | null
          created_at: string
          descricao: string
          forma_pagamento: string
          id: string
          observacoes: string | null
          paciente_id: string
          status: string
          terapeuta_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          created_at?: string
          descricao: string
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          paciente_id: string
          status?: string
          terapeuta_id: string
          updated_at?: string
          valor: number
        }
        Update: {
          comprovante_url?: string | null
          created_at?: string
          descricao?: string
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string
          status?: string
          terapeuta_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "pagamentos_paciente_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      pesquisas_nps: {
        Row: {
          comentario: string | null
          created_at: string
          id: string
          nota: number
          paciente_id: string
          sessao_id: string | null
          terapeuta_id: string
        }
        Insert: {
          comentario?: string | null
          created_at?: string
          id?: string
          nota: number
          paciente_id: string
          sessao_id?: string | null
          terapeuta_id: string
        }
        Update: {
          comentario?: string | null
          created_at?: string
          id?: string
          nota?: number
          paciente_id?: string
          sessao_id?: string | null
          terapeuta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pesquisas_nps_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pesquisas_nps_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "controle_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      planos: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          id: string
          modulos: Json
          nome: string
          preco_mensal: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          modulos?: Json
          nome: string
          preco_mensal?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          id?: string
          modulos?: Json
          nome?: string
          preco_mensal?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      preferencias_notificacao: {
        Row: {
          alerta_falta: boolean
          created_at: string
          diario_pendente: boolean
          id: string
          lembrete_consulta: boolean
          nps_recebido: boolean
          questionario_pendente: boolean
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          alerta_falta?: boolean
          created_at?: string
          diario_pendente?: boolean
          id?: string
          lembrete_consulta?: boolean
          nps_recebido?: boolean
          questionario_pendente?: boolean
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          alerta_falta?: boolean
          created_at?: string
          diario_pendente?: boolean
          id?: string
          lembrete_consulta?: boolean
          nps_recebido?: boolean
          questionario_pendente?: boolean
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
          origem: string
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
          origem?: string
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
          origem?: string
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
      sleep_logs: {
        Row: {
          awake_minutes: number | null
          bedtime: string | null
          created_at: string
          date: string
          deep_sleep_hours: number | null
          id: string
          light_sleep_hours: number | null
          notes: string | null
          paciente_id: string
          rem_sleep_hours: number | null
          sleep_quality: number | null
          source: string
          terapeuta_id: string
          total_hours: number
          updated_at: string
          wake_time: string | null
        }
        Insert: {
          awake_minutes?: number | null
          bedtime?: string | null
          created_at?: string
          date?: string
          deep_sleep_hours?: number | null
          id?: string
          light_sleep_hours?: number | null
          notes?: string | null
          paciente_id: string
          rem_sleep_hours?: number | null
          sleep_quality?: number | null
          source?: string
          terapeuta_id: string
          total_hours?: number
          updated_at?: string
          wake_time?: string | null
        }
        Update: {
          awake_minutes?: number | null
          bedtime?: string | null
          created_at?: string
          date?: string
          deep_sleep_hours?: number | null
          id?: string
          light_sleep_hours?: number | null
          notes?: string | null
          paciente_id?: string
          rem_sleep_hours?: number | null
          sleep_quality?: number | null
          source?: string
          terapeuta_id?: string
          total_hours?: number
          updated_at?: string
          wake_time?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sleep_logs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_execucao_exercicios: {
        Row: {
          carga_utilizada: number | null
          created_at: string | null
          execucao_id: string
          id: string
          nome_exercicio: string
          observacoes: string | null
          repeticoes_por_serie: Json | null
          series_realizadas: number | null
          treino_exercicio_id: string | null
        }
        Insert: {
          carga_utilizada?: number | null
          created_at?: string | null
          execucao_id: string
          id?: string
          nome_exercicio: string
          observacoes?: string | null
          repeticoes_por_serie?: Json | null
          series_realizadas?: number | null
          treino_exercicio_id?: string | null
        }
        Update: {
          carga_utilizada?: number | null
          created_at?: string | null
          execucao_id?: string
          id?: string
          nome_exercicio?: string
          observacoes?: string | null
          repeticoes_por_serie?: Json | null
          series_realizadas?: number | null
          treino_exercicio_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_execucao_exercicios_execucao_id_fkey"
            columns: ["execucao_id"]
            isOneToOne: false
            referencedRelation: "studio_execucoes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_execucao_exercicios_treino_exercicio_id_fkey"
            columns: ["treino_exercicio_id"]
            isOneToOne: false
            referencedRelation: "studio_treino_exercicios"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_execucoes: {
        Row: {
          completo: boolean | null
          created_at: string | null
          data_execucao: string | null
          duracao_minutos: number | null
          feedback_aluno: string | null
          feedback_educador: string | null
          id: string
          nota_dor: number | null
          paciente_id: string
          terapeuta_id: string
          treino_id: string
        }
        Insert: {
          completo?: boolean | null
          created_at?: string | null
          data_execucao?: string | null
          duracao_minutos?: number | null
          feedback_aluno?: string | null
          feedback_educador?: string | null
          id?: string
          nota_dor?: number | null
          paciente_id: string
          terapeuta_id: string
          treino_id: string
        }
        Update: {
          completo?: boolean | null
          created_at?: string | null
          data_execucao?: string | null
          duracao_minutos?: number | null
          feedback_aluno?: string | null
          feedback_educador?: string | null
          id?: string
          nota_dor?: number | null
          paciente_id?: string
          terapeuta_id?: string
          treino_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_execucoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_execucoes_treino_id_fkey"
            columns: ["treino_id"]
            isOneToOne: false
            referencedRelation: "studio_treinos"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_medidas: {
        Row: {
          braco_direito: number | null
          braco_esquerdo: number | null
          cintura: number | null
          coxa_direita: number | null
          coxa_esquerda: number | null
          created_at: string | null
          data_medida: string | null
          id: string
          imc: number | null
          massa_magra: number | null
          observacoes: string | null
          paciente_id: string
          panturrilha: number | null
          peitoral: number | null
          percentual_gordura: number | null
          peso: number | null
          quadril: number | null
          terapeuta_id: string
        }
        Insert: {
          braco_direito?: number | null
          braco_esquerdo?: number | null
          cintura?: number | null
          coxa_direita?: number | null
          coxa_esquerda?: number | null
          created_at?: string | null
          data_medida?: string | null
          id?: string
          imc?: number | null
          massa_magra?: number | null
          observacoes?: string | null
          paciente_id: string
          panturrilha?: number | null
          peitoral?: number | null
          percentual_gordura?: number | null
          peso?: number | null
          quadril?: number | null
          terapeuta_id: string
        }
        Update: {
          braco_direito?: number | null
          braco_esquerdo?: number | null
          cintura?: number | null
          coxa_direita?: number | null
          coxa_esquerda?: number | null
          created_at?: string | null
          data_medida?: string | null
          id?: string
          imc?: number | null
          massa_magra?: number | null
          observacoes?: string | null
          paciente_id?: string
          panturrilha?: number | null
          peitoral?: number | null
          percentual_gordura?: number | null
          peso?: number | null
          quadril?: number | null
          terapeuta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "studio_medidas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_notas: {
        Row: {
          conteudo: string
          created_at: string | null
          id: string
          paciente_id: string
          terapeuta_id: string
          tipo: string | null
        }
        Insert: {
          conteudo: string
          created_at?: string | null
          id?: string
          paciente_id: string
          terapeuta_id: string
          tipo?: string | null
        }
        Update: {
          conteudo?: string
          created_at?: string | null
          id?: string
          paciente_id?: string
          terapeuta_id?: string
          tipo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_notas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_periodizacoes: {
        Row: {
          ativa: boolean | null
          created_at: string | null
          data_fim: string | null
          data_inicio: string | null
          divisao: string | null
          duracao_semanas: number | null
          id: string
          nome: string
          objetivo: string | null
          paciente_id: string
          terapeuta_id: string
          updated_at: string | null
        }
        Insert: {
          ativa?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          divisao?: string | null
          duracao_semanas?: number | null
          id?: string
          nome: string
          objetivo?: string | null
          paciente_id: string
          terapeuta_id: string
          updated_at?: string | null
        }
        Update: {
          ativa?: boolean | null
          created_at?: string | null
          data_fim?: string | null
          data_inicio?: string | null
          divisao?: string | null
          duracao_semanas?: number | null
          id?: string
          nome?: string
          objetivo?: string | null
          paciente_id?: string
          terapeuta_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_periodizacoes_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_treino_exercicios: {
        Row: {
          cadencia: string | null
          carga_kg: number | null
          created_at: string | null
          descanso_segundos: number | null
          exercicio_id: string | null
          grupo_muscular: string | null
          id: string
          metodo: string | null
          nome_customizado: string | null
          ordem: number | null
          orientacoes: string | null
          repeticoes: number | null
          series: number | null
          treino_id: string
          updated_at: string | null
          video_url: string | null
        }
        Insert: {
          cadencia?: string | null
          carga_kg?: number | null
          created_at?: string | null
          descanso_segundos?: number | null
          exercicio_id?: string | null
          grupo_muscular?: string | null
          id?: string
          metodo?: string | null
          nome_customizado?: string | null
          ordem?: number | null
          orientacoes?: string | null
          repeticoes?: number | null
          series?: number | null
          treino_id: string
          updated_at?: string | null
          video_url?: string | null
        }
        Update: {
          cadencia?: string | null
          carga_kg?: number | null
          created_at?: string | null
          descanso_segundos?: number | null
          exercicio_id?: string | null
          grupo_muscular?: string | null
          id?: string
          metodo?: string | null
          nome_customizado?: string | null
          ordem?: number | null
          orientacoes?: string | null
          repeticoes?: number | null
          series?: number | null
          treino_id?: string
          updated_at?: string | null
          video_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_treino_exercicios_exercicio_id_fkey"
            columns: ["exercicio_id"]
            isOneToOne: false
            referencedRelation: "exercicios_biblioteca"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_treino_exercicios_treino_id_fkey"
            columns: ["treino_id"]
            isOneToOne: false
            referencedRelation: "studio_treinos"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_treinos: {
        Row: {
          ativo: boolean | null
          created_at: string | null
          duracao_estimada: string | null
          frequencia: string | null
          id: string
          intensidade: string | null
          objetivo: string | null
          ordem: number | null
          paciente_id: string
          periodizacao_id: string | null
          publicado: boolean | null
          terapeuta_id: string
          titulo: string
          updated_at: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string | null
          duracao_estimada?: string | null
          frequencia?: string | null
          id?: string
          intensidade?: string | null
          objetivo?: string | null
          ordem?: number | null
          paciente_id: string
          periodizacao_id?: string | null
          publicado?: boolean | null
          terapeuta_id: string
          titulo: string
          updated_at?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string | null
          duracao_estimada?: string | null
          frequencia?: string | null
          id?: string
          intensidade?: string | null
          objetivo?: string | null
          ordem?: number | null
          paciente_id?: string
          periodizacao_id?: string | null
          publicado?: boolean | null
          terapeuta_id?: string
          titulo?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "studio_treinos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "studio_treinos_periodizacao_id_fkey"
            columns: ["periodizacao_id"]
            isOneToOne: false
            referencedRelation: "studio_periodizacoes"
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
      termos_consentimento: {
        Row: {
          aceito: boolean
          created_at: string
          data_aceite: string | null
          id: string
          ip_aceite: string | null
          paciente_id: string
          terapeuta_id: string
          texto_termo: string
          tipo: string
          updated_at: string
          versao: string
        }
        Insert: {
          aceito?: boolean
          created_at?: string
          data_aceite?: string | null
          id?: string
          ip_aceite?: string | null
          paciente_id: string
          terapeuta_id: string
          texto_termo: string
          tipo?: string
          updated_at?: string
          versao?: string
        }
        Update: {
          aceito?: boolean
          created_at?: string
          data_aceite?: string | null
          id?: string
          ip_aceite?: string | null
          paciente_id?: string
          terapeuta_id?: string
          texto_termo?: string
          tipo?: string
          updated_at?: string
          versao?: string
        }
        Relationships: [
          {
            foreignKeyName: "termos_consentimento_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      vendas: {
        Row: {
          cliente_nome: string | null
          created_at: string
          data_venda: string
          descricao: string | null
          forma_pagamento: string
          id: string
          observacoes: string | null
          paciente_id: string | null
          quantidade: number
          servico: string
          status: string
          terapeuta_id: string
          updated_at: string
          valor_total: number
          valor_unitario: number
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Insert: {
          cliente_nome?: string | null
          created_at?: string
          data_venda?: string
          descricao?: string | null
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string | null
          quantidade?: number
          servico: string
          status?: string
          terapeuta_id: string
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Update: {
          cliente_nome?: string | null
          created_at?: string
          data_venda?: string
          descricao?: string | null
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string | null
          quantidade?: number
          servico?: string
          status?: string
          terapeuta_id?: string
          updated_at?: string
          valor_total?: number
          valor_unitario?: number
          vendedor_id?: string | null
          vendedor_nome?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendas_vendedor_id_fkey"
            columns: ["vendedor_id"]
            isOneToOne: false
            referencedRelation: "equipe_membros"
            referencedColumns: ["id"]
          },
        ]
      }
      water_logs: {
        Row: {
          amount_ml: number
          created_at: string
          date: string
          entries: Json
          goal_ml: number
          id: string
          paciente_id: string
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          amount_ml?: number
          created_at?: string
          date?: string
          entries?: Json
          goal_ml?: number
          id?: string
          paciente_id: string
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          amount_ml?: number
          created_at?: string
          date?: string
          entries?: Json
          goal_ml?: number
          id?: string
          paciente_id?: string
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_logs_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      eventos_publicos: {
        Row: {
          ativo: boolean | null
          cobrar_pagamento: boolean | null
          created_at: string | null
          data_evento: string | null
          descricao: string | null
          descricao_formulario: string | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string | null
          local: string | null
          terapeuta_id: string | null
          titulo: string | null
          updated_at: string | null
          vagas_max: number | null
          valor: number | null
        }
        Insert: {
          ativo?: boolean | null
          cobrar_pagamento?: boolean | null
          created_at?: string | null
          data_evento?: string | null
          descricao?: string | null
          descricao_formulario?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string | null
          local?: string | null
          terapeuta_id?: string | null
          titulo?: string | null
          updated_at?: string | null
          vagas_max?: number | null
          valor?: number | null
        }
        Update: {
          ativo?: boolean | null
          cobrar_pagamento?: boolean | null
          created_at?: string | null
          data_evento?: string | null
          descricao?: string | null
          descricao_formulario?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string | null
          local?: string | null
          terapeuta_id?: string | null
          titulo?: string | null
          updated_at?: string | null
          vagas_max?: number | null
          valor?: number | null
        }
        Relationships: []
      }
    }
    Functions: {
      count_evento_inscricoes: {
        Args: { p_evento_id: string }
        Returns: number
      }
      get_active_inscricao_ids: {
        Args: { p_evento_id: string }
        Returns: {
          id: string
        }[]
      }
      get_agenda_disponibilidade: {
        Args: {
          p_data_fim: string
          p_data_inicio: string
          p_terapeuta_id: string
        }
        Returns: {
          data_fim: string
          data_inicio: string
          status: string
        }[]
      }
      get_agenda_link_by_token: {
        Args: { p_token: string }
        Returns: {
          acessos_totais: number
          created_at: string
          data_criacao: string
          data_expiracao: string
          data_primeiro_acesso: string
          data_ultimo_acesso: string
          id: string
          paciente_id: string
          status: string
          terapeuta_id: string
          token: string
          updated_at: string
        }[]
      }
      get_ausencias_by_token: {
        Args: { p_data_fim: string; p_data_inicio: string; p_token: string }
        Returns: {
          data_fim: string
          data_inicio: string
          dia_inteiro: boolean
          hora_fim: string
          hora_inicio: string
          motivo: string
        }[]
      }
      get_config_agenda_by_funil_slug: {
        Args: { p_slug: string }
        Returns: {
          dias_semana: Json
          duracao_padrao: number
          horario_fim: string
          horario_inicio: string
          intervalo_entre_sessoes: number
          terapeuta_id: string
          vagas_por_horario: number
        }[]
      }
      get_config_agenda_by_token: {
        Args: { p_token: string }
        Returns: {
          dias_semana: Json
          duracao_padrao: number
          horario_fim: string
          horario_inicio: string
          intervalo_entre_sessoes: number
          vagas_por_horario: number
        }[]
      }
      get_evento_pagamento: {
        Args: { p_evento_id: string; p_inscricao_id: string }
        Returns: {
          link_pagamento: string
          pix_chave: string
          pix_nome: string
          pix_tipo: string
          valor: number
        }[]
      }
      get_funil_pagamento: {
        Args: { p_funil_config_id: string; p_lead_id: string }
        Returns: {
          link_cartao: string
          pix_chave: string
          pix_nome: string
          pix_tipo: string
        }[]
      }
      get_funil_publico: {
        Args: { p_slug: string }
        Returns: {
          ativo: boolean
          diferenciais: Json
          id: string
          mensagem_agendamento: string
          mensagem_boas_vindas: string
          mensagem_confirmacao: string
          mensagem_diferenciais: string
          mensagem_pagamento: string
          mensagem_servicos: string
          servicos: Json
          slug: string
          terapeuta_id: string
        }[]
      }
      get_myid_concluido_publico: {
        Args: { p_token: string }
        Returns: {
          data_conclusao: string
          id: string
          myid_score: number
          paciente_nome: string
          resultado_processado: Json
        }[]
      }
      get_myid_em_andamento: {
        Args: { p_token: string }
        Returns: {
          dimensoes_preenchidas: Json
          fase_atual: number
          fase_concluida: number
          id: string
          myid_score_parcial: number
          paciente_id: string
          red_flags_detectadas: boolean
          respostas_brutas: Json
          resultado_processado: Json
          status: string
          terapeuta_id: string
        }[]
      }
      get_patient_by_portal_token: {
        Args: { p_token: string }
        Returns: {
          email: string
          id: string
          nome: string
          sobrenome: string
          telefone: string
          user_id: string
        }[]
      }
      get_terapeuta_by_agenda_token: {
        Args: { p_token: string }
        Returns: {
          bio: string
          especialidade: string
          nome: string
          sobrenome: string
          telefone: string
          user_id: string
        }[]
      }
      get_turnos_by_token: { Args: { p_token: string }; Returns: Json }
      has_active_agenda_link: {
        Args: { p_terapeuta_id: string }
        Returns: boolean
      }
      has_active_agenda_link_for_paciente: {
        Args: { p_paciente_id: string; p_terapeuta_id: string }
        Returns: boolean
      }
      has_module_access: {
        Args: { p_module: string; p_user_id: string }
        Returns: boolean
      }
      link_agenda_valido_por_token: {
        Args: { p_token: string }
        Returns: {
          paciente_id: string
          terapeuta_id: string
        }[]
      }
      link_avaliacao_valido: { Args: { p_link_id: string }; Returns: boolean }
      link_patient_user_by_email: { Args: never; Returns: string }
      link_patient_user_by_token: { Args: { p_token: string }; Returns: string }
      salvar_fase_myid: {
        Args: {
          p_dimensoes: Json
          p_fase: number
          p_red_flags?: boolean
          p_respostas: Json
          p_score_parcial: number
          p_token: string
        }
        Returns: string
      }
      track_agenda_link_access: {
        Args: { p_token: string }
        Returns: undefined
      }
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
