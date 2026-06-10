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
          clinica_id: string | null
          confirmacao_enviada_em: string | null
          confirmado_pelo_paciente_em: string | null
          cor: string | null
          created_at: string
          data_fim: string
          data_inicio: string
          id: string
          lembrete_2h_enviado_em: string | null
          membro_equipe_id: string | null
          no_show_processado_em: string | null
          observacoes: string | null
          paciente_id: string | null
          pos_sessao_enviado_em: string | null
          recorrencia_grupo_id: string | null
          status: string
          terapeuta_id: string
          tipo_atendimento: string | null
          titulo: string | null
          updated_at: string
        }
        Insert: {
          clinica_id?: string | null
          confirmacao_enviada_em?: string | null
          confirmado_pelo_paciente_em?: string | null
          cor?: string | null
          created_at?: string
          data_fim: string
          data_inicio: string
          id?: string
          lembrete_2h_enviado_em?: string | null
          membro_equipe_id?: string | null
          no_show_processado_em?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          pos_sessao_enviado_em?: string | null
          recorrencia_grupo_id?: string | null
          status?: string
          terapeuta_id: string
          tipo_atendimento?: string | null
          titulo?: string | null
          updated_at?: string
        }
        Update: {
          clinica_id?: string | null
          confirmacao_enviada_em?: string | null
          confirmado_pelo_paciente_em?: string | null
          cor?: string | null
          created_at?: string
          data_fim?: string
          data_inicio?: string
          id?: string
          lembrete_2h_enviado_em?: string | null
          membro_equipe_id?: string | null
          no_show_processado_em?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          pos_sessao_enviado_em?: string | null
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
      agente_broadcasts: {
        Row: {
          ab_variantes: Json
          agendado_para: string | null
          concluido_em: string | null
          created_at: string
          enviados: number
          erros: number
          filtro: Json
          hsm_template_id: string | null
          id: string
          iniciado_em: string | null
          intencao: string
          paciente_ids: string[]
          resultado_variantes: Json
          status: string
          terapeuta_id: string
          titulo: string
          total: number
          updated_at: string
        }
        Insert: {
          ab_variantes?: Json
          agendado_para?: string | null
          concluido_em?: string | null
          created_at?: string
          enviados?: number
          erros?: number
          filtro?: Json
          hsm_template_id?: string | null
          id?: string
          iniciado_em?: string | null
          intencao: string
          paciente_ids?: string[]
          resultado_variantes?: Json
          status?: string
          terapeuta_id: string
          titulo: string
          total?: number
          updated_at?: string
        }
        Update: {
          ab_variantes?: Json
          agendado_para?: string | null
          concluido_em?: string | null
          created_at?: string
          enviados?: number
          erros?: number
          filtro?: Json
          hsm_template_id?: string | null
          id?: string
          iniciado_em?: string | null
          intencao?: string
          paciente_ids?: string[]
          resultado_variantes?: Json
          status?: string
          terapeuta_id?: string
          titulo?: string
          total?: number
          updated_at?: string
        }
        Relationships: []
      }
      agente_disparos: {
        Row: {
          conteudo: string
          conversa_id: string | null
          created_at: string
          erro: string | null
          gatilho: string
          id: string
          paciente_id: string | null
          ref_id: string | null
          respondido_em: string | null
          status: string
          terapeuta_id: string
        }
        Insert: {
          conteudo: string
          conversa_id?: string | null
          created_at?: string
          erro?: string | null
          gatilho: string
          id?: string
          paciente_id?: string | null
          ref_id?: string | null
          respondido_em?: string | null
          status?: string
          terapeuta_id: string
        }
        Update: {
          conteudo?: string
          conversa_id?: string | null
          created_at?: string
          erro?: string | null
          gatilho?: string
          id?: string
          paciente_id?: string | null
          ref_id?: string | null
          respondido_em?: string | null
          status?: string
          terapeuta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agente_disparos_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agente_disparos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      antropometria: {
        Row: {
          altura_cm: number | null
          braco_cm: number | null
          cintura_cm: number | null
          coxa_cm: number | null
          created_at: string
          data_medicao: string
          gordura_pct: number | null
          id: string
          imc: number | null
          massa_magra_kg: number | null
          observacao: string | null
          paciente_id: string
          panturrilha_cm: number | null
          pescoco_cm: number | null
          peso_kg: number | null
          quadril_cm: number | null
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          altura_cm?: number | null
          braco_cm?: number | null
          cintura_cm?: number | null
          coxa_cm?: number | null
          created_at?: string
          data_medicao?: string
          gordura_pct?: number | null
          id?: string
          imc?: number | null
          massa_magra_kg?: number | null
          observacao?: string | null
          paciente_id: string
          panturrilha_cm?: number | null
          pescoco_cm?: number | null
          peso_kg?: number | null
          quadril_cm?: number | null
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          altura_cm?: number | null
          braco_cm?: number | null
          cintura_cm?: number | null
          coxa_cm?: number | null
          created_at?: string
          data_medicao?: string
          gordura_pct?: number | null
          id?: string
          imc?: number | null
          massa_magra_kg?: number | null
          observacao?: string | null
          paciente_id?: string
          panturrilha_cm?: number | null
          pescoco_cm?: number | null
          peso_kg?: number | null
          quadril_cm?: number | null
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
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
      atestados_medicos: {
        Row: {
          cid_codigo: string | null
          cid_descricao: string | null
          created_at: string
          data_inicio: string
          dias_afastamento: number
          id: string
          motivo: string | null
          paciente_id: string
          terapeuta_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          cid_codigo?: string | null
          cid_descricao?: string | null
          created_at?: string
          data_inicio?: string
          dias_afastamento?: number
          id?: string
          motivo?: string | null
          paciente_id: string
          terapeuta_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          cid_codigo?: string | null
          cid_descricao?: string | null
          created_at?: string
          data_inicio?: string
          dias_afastamento?: number
          id?: string
          motivo?: string | null
          paciente_id?: string
          terapeuta_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
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
          perfil_profissional: Database["public"]["Enums"]["perfil_profissional"]
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
          perfil_profissional?: Database["public"]["Enums"]["perfil_profissional"]
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
          perfil_profissional?: Database["public"]["Enums"]["perfil_profissional"]
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
      cid10_catalogo: {
        Row: {
          categoria: string | null
          codigo: string
          created_at: string
          descricao: string
        }
        Insert: {
          categoria?: string | null
          codigo: string
          created_at?: string
          descricao: string
        }
        Update: {
          categoria?: string | null
          codigo?: string
          created_at?: string
          descricao?: string
        }
        Relationships: []
      }
      clinica_convites: {
        Row: {
          clinica_id: string
          created_at: string
          email: string
          expira_em: string
          id: string
          papel: Database["public"]["Enums"]["clinica_papel"]
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          clinica_id: string
          created_at?: string
          email: string
          expira_em?: string
          id?: string
          papel?: Database["public"]["Enums"]["clinica_papel"]
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          clinica_id?: string
          created_at?: string
          email?: string
          expira_em?: string
          id?: string
          papel?: Database["public"]["Enums"]["clinica_papel"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinica_convites_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      clinica_membros: {
        Row: {
          aceito_em: string | null
          clinica_id: string
          comissao_percentual: number | null
          convidado_em: string
          created_at: string
          id: string
          papel: Database["public"]["Enums"]["clinica_papel"]
          perfil_profissional:
            | Database["public"]["Enums"]["perfil_profissional"]
            | null
          status: Database["public"]["Enums"]["clinica_membro_status"]
          updated_at: string
          user_id: string
        }
        Insert: {
          aceito_em?: string | null
          clinica_id: string
          comissao_percentual?: number | null
          convidado_em?: string
          created_at?: string
          id?: string
          papel?: Database["public"]["Enums"]["clinica_papel"]
          perfil_profissional?:
            | Database["public"]["Enums"]["perfil_profissional"]
            | null
          status?: Database["public"]["Enums"]["clinica_membro_status"]
          updated_at?: string
          user_id: string
        }
        Update: {
          aceito_em?: string | null
          clinica_id?: string
          comissao_percentual?: number | null
          convidado_em?: string
          created_at?: string
          id?: string
          papel?: Database["public"]["Enums"]["clinica_papel"]
          perfil_profissional?:
            | Database["public"]["Enums"]["perfil_profissional"]
            | null
          status?: Database["public"]["Enums"]["clinica_membro_status"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinica_membros_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      clinica_pacientes_lixeira: {
        Row: {
          apagado_em: string
          apagado_por: string
          clinica_id: string | null
          expira_em: string
          id: string
          motivo: string | null
          paciente_id: string
        }
        Insert: {
          apagado_em?: string
          apagado_por: string
          clinica_id?: string | null
          expira_em?: string
          id?: string
          motivo?: string | null
          paciente_id: string
        }
        Update: {
          apagado_em?: string
          apagado_por?: string
          clinica_id?: string | null
          expira_em?: string
          id?: string
          motivo?: string | null
          paciente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinica_pacientes_lixeira_clinica_id_fkey"
            columns: ["clinica_id"]
            isOneToOne: false
            referencedRelation: "clinicas"
            referencedColumns: ["id"]
          },
        ]
      }
      clinicas: {
        Row: {
          ativa: boolean
          created_at: string
          dono_user_id: string
          id: string
          limite_profissionais: number
          nome: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          dono_user_id: string
          id?: string
          limite_profissionais?: number
          nome: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          dono_user_id?: string
          id?: string
          limite_profissionais?: number
          nome?: string
          updated_at?: string
        }
        Relationships: []
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
          horario_funcionamento: string | null
          id: string
          logo_url: string | null
          razao_social: string | null
          registro_responsavel: string | null
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
          horario_funcionamento?: string | null
          id?: string
          logo_url?: string | null
          razao_social?: string | null
          registro_responsavel?: string | null
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
          horario_funcionamento?: string | null
          id?: string
          logo_url?: string | null
          razao_social?: string | null
          registro_responsavel?: string | null
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
          convenio_id: string | null
          created_at: string
          data_recebimento: string | null
          data_sessao: string
          duracao_minutos: number | null
          forma_pagamento: string | null
          forma_recebimento: string | null
          id: string
          numero_sessao: number
          observacao_pagamento: string | null
          observacoes: string | null
          paciente_id: string
          plano_nome: string | null
          profissional_user_id: string | null
          status: string
          status_pagamento: string
          terapeuta_id: string
          tipo_atendimento: string | null
          tipo_cliente: string | null
          updated_at: string
          valor_cobrado: number | null
          valor_guia: number | null
        }
        Insert: {
          agendamento_id?: string | null
          convenio_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          data_sessao?: string
          duracao_minutos?: number | null
          forma_pagamento?: string | null
          forma_recebimento?: string | null
          id?: string
          numero_sessao?: number
          observacao_pagamento?: string | null
          observacoes?: string | null
          paciente_id: string
          plano_nome?: string | null
          profissional_user_id?: string | null
          status?: string
          status_pagamento?: string
          terapeuta_id: string
          tipo_atendimento?: string | null
          tipo_cliente?: string | null
          updated_at?: string
          valor_cobrado?: number | null
          valor_guia?: number | null
        }
        Update: {
          agendamento_id?: string | null
          convenio_id?: string | null
          created_at?: string
          data_recebimento?: string | null
          data_sessao?: string
          duracao_minutos?: number | null
          forma_pagamento?: string | null
          forma_recebimento?: string | null
          id?: string
          numero_sessao?: number
          observacao_pagamento?: string | null
          observacoes?: string | null
          paciente_id?: string
          plano_nome?: string | null
          profissional_user_id?: string | null
          status?: string
          status_pagamento?: string
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
            foreignKeyName: "controle_sessoes_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
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
      convenios: {
        Row: {
          ativo: boolean
          codigo_tuss: string | null
          created_at: string
          id: string
          nome: string
          observacoes: string | null
          prazo_repasse_dias: number | null
          terapeuta_id: string
          updated_at: string
          valor_padrao: number | null
        }
        Insert: {
          ativo?: boolean
          codigo_tuss?: string | null
          created_at?: string
          id?: string
          nome: string
          observacoes?: string | null
          prazo_repasse_dias?: number | null
          terapeuta_id: string
          updated_at?: string
          valor_padrao?: number | null
        }
        Update: {
          ativo?: boolean
          codigo_tuss?: string | null
          created_at?: string
          id?: string
          nome?: string
          observacoes?: string | null
          prazo_repasse_dias?: number | null
          terapeuta_id?: string
          updated_at?: string
          valor_padrao?: number | null
        }
        Relationships: []
      }
      crm_cadencia_execucoes: {
        Row: {
          agendado_para: string
          cadencia_id: string
          conversa_id: string
          created_at: string
          enviado_em: string | null
          erro: string | null
          id: string
          passo_id: string
          status: string
          terapeuta_id: string
        }
        Insert: {
          agendado_para: string
          cadencia_id: string
          conversa_id: string
          created_at?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          passo_id: string
          status?: string
          terapeuta_id: string
        }
        Update: {
          agendado_para?: string
          cadencia_id?: string
          conversa_id?: string
          created_at?: string
          enviado_em?: string | null
          erro?: string | null
          id?: string
          passo_id?: string
          status?: string
          terapeuta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_cadencia_execucoes_cadencia_id_fkey"
            columns: ["cadencia_id"]
            isOneToOne: false
            referencedRelation: "crm_cadencias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_cadencia_execucoes_passo_id_fkey"
            columns: ["passo_id"]
            isOneToOne: false
            referencedRelation: "crm_cadencia_passos"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cadencia_passos: {
        Row: {
          ativo: boolean
          cadencia_id: string
          created_at: string
          delay_horas: number
          id: string
          mensagem: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          cadencia_id: string
          created_at?: string
          delay_horas?: number
          id?: string
          mensagem: string
          ordem: number
        }
        Update: {
          ativo?: boolean
          cadencia_id?: string
          created_at?: string
          delay_horas?: number
          id?: string
          mensagem?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_cadencia_passos_cadencia_id_fkey"
            columns: ["cadencia_id"]
            isOneToOne: false
            referencedRelation: "crm_cadencias"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_cadencias: {
        Row: {
          ativo: boolean
          created_at: string
          descricao: string | null
          estagio_gatilho: string
          id: string
          nome: string
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          estagio_gatilho: string
          id?: string
          nome: string
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          estagio_gatilho?: string
          id?: string
          nome?: string
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
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
      despesas: {
        Row: {
          categoria: string
          comprovante_url: string | null
          created_at: string
          data_despesa: string
          descricao: string
          forma_pagamento: string | null
          id: string
          observacao: string | null
          recorrente: boolean
          terapeuta_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          categoria?: string
          comprovante_url?: string | null
          created_at?: string
          data_despesa?: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          recorrente?: boolean
          terapeuta_id: string
          updated_at?: string
          valor: number
        }
        Update: {
          categoria?: string
          comprovante_url?: string | null
          created_at?: string
          data_despesa?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          observacao?: string | null
          recorrente?: boolean
          terapeuta_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: []
      }
      diagnosticos_paciente: {
        Row: {
          ativo: boolean
          cid_codigo: string
          cid_descricao: string
          created_at: string
          data_diagnostico: string | null
          id: string
          observacao: string | null
          paciente_id: string
          terapeuta_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          cid_codigo: string
          cid_descricao: string
          created_at?: string
          data_diagnostico?: string | null
          id?: string
          observacao?: string | null
          paciente_id: string
          terapeuta_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          cid_codigo?: string
          cid_descricao?: string
          created_at?: string
          data_diagnostico?: string | null
          id?: string
          observacao?: string | null
          paciente_id?: string
          terapeuta_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
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
      escalas_psicologia: {
        Row: {
          classificacao: string | null
          created_at: string
          data_aplicacao: string
          id: string
          observacoes: string | null
          paciente_id: string
          pontuacao_total: number
          respostas: Json
          severidade: string | null
          terapeuta_id: string
          tipo_escala: string
          updated_at: string
        }
        Insert: {
          classificacao?: string | null
          created_at?: string
          data_aplicacao?: string
          id?: string
          observacoes?: string | null
          paciente_id: string
          pontuacao_total?: number
          respostas?: Json
          severidade?: string | null
          terapeuta_id: string
          tipo_escala: string
          updated_at?: string
        }
        Update: {
          classificacao?: string | null
          created_at?: string
          data_aplicacao?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string
          pontuacao_total?: number
          respostas?: Json
          severidade?: string | null
          terapeuta_id?: string
          tipo_escala?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "escalas_psicologia_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      evento_inscricoes: {
        Row: {
          created_at: string
          email: string | null
          evento_id: string
          id: string
          ja_era_paciente: boolean
          nome: string
          origem_utm: Json | null
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
          origem_utm?: Json | null
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
          origem_utm?: Json | null
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
          categoria: string
          cobrar_pagamento: boolean
          created_at: string
          data_evento: string
          descricao: string | null
          descricao_formulario: string | null
          horario_fim: string
          horario_inicio: string
          id: string
          lembrete_1h_enviado: boolean
          lembrete_24h_enviado: boolean
          link_pagamento: string | null
          link_video: string | null
          local: string | null
          pix_chave: string | null
          pix_nome: string | null
          pix_tipo: string | null
          publico_alvo: string
          recorrencia_grupo_id: string | null
          terapeuta_id: string
          titulo: string
          updated_at: string
          vagas_max: number | null
          valor: number | null
        }
        Insert: {
          ativo?: boolean
          categoria?: string
          cobrar_pagamento?: boolean
          created_at?: string
          data_evento: string
          descricao?: string | null
          descricao_formulario?: string | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          lembrete_1h_enviado?: boolean
          lembrete_24h_enviado?: boolean
          link_pagamento?: string | null
          link_video?: string | null
          local?: string | null
          pix_chave?: string | null
          pix_nome?: string | null
          pix_tipo?: string | null
          publico_alvo?: string
          recorrencia_grupo_id?: string | null
          terapeuta_id: string
          titulo: string
          updated_at?: string
          vagas_max?: number | null
          valor?: number | null
        }
        Update: {
          ativo?: boolean
          categoria?: string
          cobrar_pagamento?: boolean
          created_at?: string
          data_evento?: string
          descricao?: string | null
          descricao_formulario?: string | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          lembrete_1h_enviado?: boolean
          lembrete_24h_enviado?: boolean
          link_pagamento?: string | null
          link_video?: string | null
          local?: string | null
          pix_chave?: string | null
          pix_nome?: string | null
          pix_tipo?: string | null
          publico_alvo?: string
          recorrencia_grupo_id?: string | null
          terapeuta_id?: string
          titulo?: string
          updated_at?: string
          vagas_max?: number | null
          valor?: number | null
        }
        Relationships: []
      }
      eventos_clinicos_anatomicos: {
        Row: {
          created_at: string
          data_inicio: string
          data_resolucao: string | null
          diagnostico_cid: string | null
          estrutura: string | null
          evento_origem_id: string | null
          id: string
          metadata: Json
          notas_clinicas: string | null
          origem: Database["public"]["Enums"]["origem_achado_anatomico"]
          paciente_id: string
          regiao_id: string
          severidade: number
          sistema: Database["public"]["Enums"]["sistema_corporal"]
          status: Database["public"]["Enums"]["status_evento_anatomico"]
          terapeuta_id: string
          tipo_achado: string
          updated_at: string
          visivel_paciente: boolean
        }
        Insert: {
          created_at?: string
          data_inicio?: string
          data_resolucao?: string | null
          diagnostico_cid?: string | null
          estrutura?: string | null
          evento_origem_id?: string | null
          id?: string
          metadata?: Json
          notas_clinicas?: string | null
          origem?: Database["public"]["Enums"]["origem_achado_anatomico"]
          paciente_id: string
          regiao_id: string
          severidade?: number
          sistema?: Database["public"]["Enums"]["sistema_corporal"]
          status?: Database["public"]["Enums"]["status_evento_anatomico"]
          terapeuta_id: string
          tipo_achado: string
          updated_at?: string
          visivel_paciente?: boolean
        }
        Update: {
          created_at?: string
          data_inicio?: string
          data_resolucao?: string | null
          diagnostico_cid?: string | null
          estrutura?: string | null
          evento_origem_id?: string | null
          id?: string
          metadata?: Json
          notas_clinicas?: string | null
          origem?: Database["public"]["Enums"]["origem_achado_anatomico"]
          paciente_id?: string
          regiao_id?: string
          severidade?: number
          sistema?: Database["public"]["Enums"]["sistema_corporal"]
          status?: Database["public"]["Enums"]["status_evento_anatomico"]
          terapeuta_id?: string
          tipo_achado?: string
          updated_at?: string
          visivel_paciente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "eventos_clinicos_anatomicos_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence_ingestion_log: {
        Row: {
          articles_fetched: number | null
          articles_inserted: number | null
          articles_skipped: number | null
          error_details: Json | null
          errors_count: number | null
          finished_at: string | null
          id: string
          query: string | null
          source: string
          started_at: string
          status: string
        }
        Insert: {
          articles_fetched?: number | null
          articles_inserted?: number | null
          articles_skipped?: number | null
          error_details?: Json | null
          errors_count?: number | null
          finished_at?: string | null
          id?: string
          query?: string | null
          source: string
          started_at?: string
          status?: string
        }
        Update: {
          articles_fetched?: number | null
          articles_inserted?: number | null
          articles_skipped?: number | null
          error_details?: Json | null
          errors_count?: number | null
          finished_at?: string | null
          id?: string
          query?: string | null
          source?: string
          started_at?: string
          status?: string
        }
        Relationships: []
      }
      evidence_library: {
        Row: {
          abstract: string | null
          authors: string[] | null
          citation_count: number | null
          created_at: string
          doi: string | null
          embedding: string | null
          embedding_model: string | null
          evidence_level: string | null
          external_id: string
          health_areas: string[]
          id: string
          journal: string | null
          language: string | null
          mesh_terms: string[] | null
          pmid: string | null
          source: string
          study_type: string | null
          title: string
          updated_at: string
          url: string | null
          year: number | null
        }
        Insert: {
          abstract?: string | null
          authors?: string[] | null
          citation_count?: number | null
          created_at?: string
          doi?: string | null
          embedding?: string | null
          embedding_model?: string | null
          evidence_level?: string | null
          external_id: string
          health_areas?: string[]
          id?: string
          journal?: string | null
          language?: string | null
          mesh_terms?: string[] | null
          pmid?: string | null
          source?: string
          study_type?: string | null
          title: string
          updated_at?: string
          url?: string | null
          year?: number | null
        }
        Update: {
          abstract?: string | null
          authors?: string[] | null
          citation_count?: number | null
          created_at?: string
          doi?: string | null
          embedding?: string | null
          embedding_model?: string | null
          evidence_level?: string | null
          external_id?: string
          health_areas?: string[]
          id?: string
          journal?: string | null
          language?: string | null
          mesh_terms?: string[] | null
          pmid?: string | null
          source?: string
          study_type?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          year?: number | null
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
      exames_importados: {
        Row: {
          arquivo_url: string | null
          created_at: string
          dados_extraidos: Json | null
          data_exame: string | null
          erro: string | null
          id: string
          paciente_id: string
          status: string
          terapeuta_id: string
          tipo: string | null
          updated_at: string
        }
        Insert: {
          arquivo_url?: string | null
          created_at?: string
          dados_extraidos?: Json | null
          data_exame?: string | null
          erro?: string | null
          id?: string
          paciente_id: string
          status?: string
          terapeuta_id: string
          tipo?: string | null
          updated_at?: string
        }
        Update: {
          arquivo_url?: string | null
          created_at?: string
          dados_extraidos?: Json | null
          data_exame?: string | null
          erro?: string | null
          id?: string
          paciente_id?: string
          status?: string
          terapeuta_id?: string
          tipo?: string | null
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
          origem_utm: Json | null
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
          origem_utm?: Json | null
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
          origem_utm?: Json | null
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
      links_rastreaveis: {
        Row: {
          ativo: boolean
          cliques: number
          created_at: string
          id: string
          label: string
          terapeuta_id: string
          updated_at: string
          url_destino: string
          url_final: string
          utms: Json
        }
        Insert: {
          ativo?: boolean
          cliques?: number
          created_at?: string
          id?: string
          label: string
          terapeuta_id: string
          updated_at?: string
          url_destino: string
          url_final: string
          utms?: Json
        }
        Update: {
          ativo?: boolean
          cliques?: number
          created_at?: string
          id?: string
          label?: string
          terapeuta_id?: string
          updated_at?: string
          url_destino?: string
          url_final?: string
          utms?: Json
        }
        Relationships: []
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
      medicamentos_catalogo: {
        Row: {
          apresentacao: string | null
          classe: string | null
          created_at: string
          id: string
          nome: string
          posologia_sugerida: string | null
          principio_ativo: string | null
        }
        Insert: {
          apresentacao?: string | null
          classe?: string | null
          created_at?: string
          id?: string
          nome: string
          posologia_sugerida?: string | null
          principio_ativo?: string | null
        }
        Update: {
          apresentacao?: string | null
          classe?: string | null
          created_at?: string
          id?: string
          nome?: string
          posologia_sugerida?: string | null
          principio_ativo?: string | null
        }
        Relationships: []
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
      notificacao_envios: {
        Row: {
          canal: Database["public"]["Enums"]["notif_canal"]
          driver: Database["public"]["Enums"]["myid_dimensao"]
          enviado_em: string
          erro: string | null
          id: string
          lida_em: string | null
          mensagem: string
          paciente_id: string
          regra_id: string | null
          status: string
          terapeuta_id: string
        }
        Insert: {
          canal: Database["public"]["Enums"]["notif_canal"]
          driver: Database["public"]["Enums"]["myid_dimensao"]
          enviado_em?: string
          erro?: string | null
          id?: string
          lida_em?: string | null
          mensagem: string
          paciente_id: string
          regra_id?: string | null
          status?: string
          terapeuta_id: string
        }
        Update: {
          canal?: Database["public"]["Enums"]["notif_canal"]
          driver?: Database["public"]["Enums"]["myid_dimensao"]
          enviado_em?: string
          erro?: string | null
          id?: string
          lida_em?: string | null
          mensagem?: string
          paciente_id?: string
          regra_id?: string | null
          status?: string
          terapeuta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notificacao_envios_regra_id_fkey"
            columns: ["regra_id"]
            isOneToOne: false
            referencedRelation: "notificacao_regras"
            referencedColumns: ["id"]
          },
        ]
      }
      notificacao_inteligente_config: {
        Row: {
          ativa: boolean
          created_at: string
          enviar_para_paciente: boolean
          enviar_para_terapeuta: boolean
          janela_minutos: number
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          enviar_para_paciente?: boolean
          enviar_para_terapeuta?: boolean
          janela_minutos?: number
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          ativa?: boolean
          created_at?: string
          enviar_para_paciente?: boolean
          enviar_para_terapeuta?: boolean
          janela_minutos?: number
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      notificacao_regras: {
        Row: {
          ativo: boolean
          canal: Database["public"]["Enums"]["notif_canal"]
          created_at: string
          dias_semana: number[]
          driver: Database["public"]["Enums"]["myid_dimensao"]
          horario_envio: string
          id: string
          intervalo_repeticao_horas: number | null
          template_mensagem: string
          terapeuta_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          canal?: Database["public"]["Enums"]["notif_canal"]
          created_at?: string
          dias_semana?: number[]
          driver: Database["public"]["Enums"]["myid_dimensao"]
          horario_envio?: string
          id?: string
          intervalo_repeticao_horas?: number | null
          template_mensagem: string
          terapeuta_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          canal?: Database["public"]["Enums"]["notif_canal"]
          created_at?: string
          dias_semana?: number[]
          driver?: Database["public"]["Enums"]["myid_dimensao"]
          horario_envio?: string
          id?: string
          intervalo_repeticao_horas?: number | null
          template_mensagem?: string
          terapeuta_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: []
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
          alergias: string | null
          ativo: boolean
          avatar_url: string | null
          bairro: string | null
          cadastro_status: string
          cep: string | null
          cidade: string | null
          clinica_id: string | null
          condicoes_preexistentes: string | null
          contato_emergencia_nome: string | null
          contato_emergencia_parentesco: string | null
          contato_emergencia_telefone: string | null
          convenio_id: string | null
          cpf: string | null
          created_at: string
          data_nascimento: string | null
          email: string | null
          endereco: string | null
          endereco_complemento: string | null
          endereco_numero: string | null
          genero: string | null
          id: string
          lgpd_aceite_em: string | null
          lgpd_versao: string | null
          medicamentos_uso: string | null
          nivel_atual: Database["public"]["Enums"]["nivel_paciente"]
          nome: string
          observacoes: string | null
          origem: string | null
          origem_utm: Json | null
          plano_saude: string | null
          portal_token: string | null
          queixa_principal: string | null
          responsavel_id: string | null
          sexo: string | null
          sobrenome: string
          telefone: string | null
          terapeuta_id: string
          tipo_conta: string
          tipo_pagamento: string
          uf: string | null
          updated_at: string
          user_id: string | null
          xp_total: number
        }
        Insert: {
          alergias?: string | null
          ativo?: boolean
          avatar_url?: string | null
          bairro?: string | null
          cadastro_status?: string
          cep?: string | null
          cidade?: string | null
          clinica_id?: string | null
          condicoes_preexistentes?: string | null
          contato_emergencia_nome?: string | null
          contato_emergencia_parentesco?: string | null
          contato_emergencia_telefone?: string | null
          convenio_id?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          endereco_complemento?: string | null
          endereco_numero?: string | null
          genero?: string | null
          id?: string
          lgpd_aceite_em?: string | null
          lgpd_versao?: string | null
          medicamentos_uso?: string | null
          nivel_atual?: Database["public"]["Enums"]["nivel_paciente"]
          nome: string
          observacoes?: string | null
          origem?: string | null
          origem_utm?: Json | null
          plano_saude?: string | null
          portal_token?: string | null
          queixa_principal?: string | null
          responsavel_id?: string | null
          sexo?: string | null
          sobrenome?: string
          telefone?: string | null
          terapeuta_id: string
          tipo_conta?: string
          tipo_pagamento?: string
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          xp_total?: number
        }
        Update: {
          alergias?: string | null
          ativo?: boolean
          avatar_url?: string | null
          bairro?: string | null
          cadastro_status?: string
          cep?: string | null
          cidade?: string | null
          clinica_id?: string | null
          condicoes_preexistentes?: string | null
          contato_emergencia_nome?: string | null
          contato_emergencia_parentesco?: string | null
          contato_emergencia_telefone?: string | null
          convenio_id?: string | null
          cpf?: string | null
          created_at?: string
          data_nascimento?: string | null
          email?: string | null
          endereco?: string | null
          endereco_complemento?: string | null
          endereco_numero?: string | null
          genero?: string | null
          id?: string
          lgpd_aceite_em?: string | null
          lgpd_versao?: string | null
          medicamentos_uso?: string | null
          nivel_atual?: Database["public"]["Enums"]["nivel_paciente"]
          nome?: string
          observacoes?: string | null
          origem?: string | null
          origem_utm?: Json | null
          plano_saude?: string | null
          portal_token?: string | null
          queixa_principal?: string | null
          responsavel_id?: string | null
          sexo?: string | null
          sobrenome?: string
          telefone?: string | null
          terapeuta_id?: string
          tipo_conta?: string
          tipo_pagamento?: string
          uf?: string | null
          updated_at?: string
          user_id?: string | null
          xp_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "pacientes_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
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
      pagamentos_paciente_auditoria: {
        Row: {
          acao: string
          ator_user_id: string | null
          campos_alterados: string[] | null
          created_at: string
          dados_antigos: Json | null
          dados_novos: Json | null
          id: string
          origem: string
          paciente_id: string | null
          pagamento_id: string
          terapeuta_id: string | null
        }
        Insert: {
          acao: string
          ator_user_id?: string | null
          campos_alterados?: string[] | null
          created_at?: string
          dados_antigos?: Json | null
          dados_novos?: Json | null
          id?: string
          origem: string
          paciente_id?: string | null
          pagamento_id: string
          terapeuta_id?: string | null
        }
        Update: {
          acao?: string
          ator_user_id?: string | null
          campos_alterados?: string[] | null
          created_at?: string
          dados_antigos?: Json | null
          dados_novos?: Json | null
          id?: string
          origem?: string
          paciente_id?: string | null
          pagamento_id?: string
          terapeuta_id?: string | null
        }
        Relationships: []
      }
      perfis_profissionais: {
        Row: {
          blocos_ativos: Json
          created_at: string
          descricao: string | null
          id: Database["public"]["Enums"]["perfil_profissional"]
          nome_exibicao: string
          prompt_sistema: string
          schema_saida: Json
          template_evolucao: string | null
          updated_at: string
        }
        Insert: {
          blocos_ativos?: Json
          created_at?: string
          descricao?: string | null
          id: Database["public"]["Enums"]["perfil_profissional"]
          nome_exibicao: string
          prompt_sistema: string
          schema_saida?: Json
          template_evolucao?: string | null
          updated_at?: string
        }
        Update: {
          blocos_ativos?: Json
          created_at?: string
          descricao?: string | null
          id?: Database["public"]["Enums"]["perfil_profissional"]
          nome_exibicao?: string
          prompt_sistema?: string
          schema_saida?: Json
          template_evolucao?: string | null
          updated_at?: string
        }
        Relationships: []
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
          destaque: boolean
          id: string
          limite_ia_mensal: number
          modulos: Json
          nome: string
          ordem: number
          preco_mensal: number
          stripe_price_id: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          limite_ia_mensal?: number
          modulos?: Json
          nome: string
          ordem?: number
          preco_mensal?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          descricao?: string | null
          destaque?: boolean
          id?: string
          limite_ia_mensal?: number
          modulos?: Json
          nome?: string
          ordem?: number
          preco_mensal?: number
          stripe_price_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      planos_alimentares: {
        Row: {
          ativo: boolean
          calorias_alvo: number | null
          created_at: string
          id: string
          macros_alvo: Json | null
          objetivo: string | null
          observacoes: string | null
          paciente_id: string
          plano: Json
          terapeuta_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          calorias_alvo?: number | null
          created_at?: string
          id?: string
          macros_alvo?: Json | null
          objetivo?: string | null
          observacoes?: string | null
          paciente_id: string
          plano: Json
          terapeuta_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          calorias_alvo?: number | null
          created_at?: string
          id?: string
          macros_alvo?: Json | null
          objetivo?: string | null
          observacoes?: string | null
          paciente_id?: string
          plano?: Json
          terapeuta_id?: string
          titulo?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "planos_alimentares_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      planos_treino: {
        Row: {
          ativo: boolean
          created_at: string
          duracao_semanas: number | null
          estrutura: Json
          frequencia_semanal: number | null
          id: string
          nivel: string | null
          objetivo: string | null
          paciente_id: string
          restricoes: string | null
          terapeuta_id: string
          titulo: string
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          duracao_semanas?: number | null
          estrutura?: Json
          frequencia_semanal?: number | null
          id?: string
          nivel?: string | null
          objetivo?: string | null
          paciente_id: string
          restricoes?: string | null
          terapeuta_id: string
          titulo: string
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          duracao_semanas?: number | null
          estrutura?: Json
          frequencia_semanal?: number | null
          id?: string
          nivel?: string | null
          objetivo?: string | null
          paciente_id?: string
          restricoes?: string | null
          terapeuta_id?: string
          titulo?: string
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
      prescricoes_paciente: {
        Row: {
          created_at: string
          data_emissao: string
          id: string
          itens: Json
          orientacoes: string | null
          paciente_id: string
          terapeuta_id: string
          tipo: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_emissao?: string
          id?: string
          itens?: Json
          orientacoes?: string | null
          paciente_id: string
          terapeuta_id: string
          tipo?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_emissao?: string
          id?: string
          itens?: Json
          orientacoes?: string | null
          paciente_id?: string
          terapeuta_id?: string
          tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          crefito: string | null
          email: string
          especialidade: string | null
          especialidade_medica: string | null
          id: string
          nome: string
          perfil_profissional: Database["public"]["Enums"]["perfil_profissional"]
          perfil_profissional_confirmado: boolean
          perfil_profissional_confirmado_em: string | null
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
          especialidade_medica?: string | null
          id?: string
          nome?: string
          perfil_profissional?: Database["public"]["Enums"]["perfil_profissional"]
          perfil_profissional_confirmado?: boolean
          perfil_profissional_confirmado_em?: string | null
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
          especialidade_medica?: string | null
          id?: string
          nome?: string
          perfil_profissional?: Database["public"]["Enums"]["perfil_profissional"]
          perfil_profissional_confirmado?: boolean
          perfil_profissional_confirmado_em?: string | null
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
      recompensas_catalogo: {
        Row: {
          ativa: boolean
          created_at: string
          descricao: string | null
          estoque: number | null
          id: string
          nivel_minimo: Database["public"]["Enums"]["nivel_paciente"]
          ordem: number
          terapeuta_id: string
          titulo: string
          updated_at: string
          xp_custo: number
        }
        Insert: {
          ativa?: boolean
          created_at?: string
          descricao?: string | null
          estoque?: number | null
          id?: string
          nivel_minimo?: Database["public"]["Enums"]["nivel_paciente"]
          ordem?: number
          terapeuta_id: string
          titulo: string
          updated_at?: string
          xp_custo: number
        }
        Update: {
          ativa?: boolean
          created_at?: string
          descricao?: string | null
          estoque?: number | null
          id?: string
          nivel_minimo?: Database["public"]["Enums"]["nivel_paciente"]
          ordem?: number
          terapeuta_id?: string
          titulo?: string
          updated_at?: string
          xp_custo?: number
        }
        Relationships: []
      }
      recompensas_resgates: {
        Row: {
          created_at: string
          entregue_em: string | null
          id: string
          observacao: string | null
          paciente_id: string
          recompensa_id: string
          resgatado_em: string
          status: Database["public"]["Enums"]["recompensa_status"]
          terapeuta_id: string
          updated_at: string
          xp_gasto: number
        }
        Insert: {
          created_at?: string
          entregue_em?: string | null
          id?: string
          observacao?: string | null
          paciente_id: string
          recompensa_id: string
          resgatado_em?: string
          status?: Database["public"]["Enums"]["recompensa_status"]
          terapeuta_id: string
          updated_at?: string
          xp_gasto: number
        }
        Update: {
          created_at?: string
          entregue_em?: string | null
          id?: string
          observacao?: string | null
          paciente_id?: string
          recompensa_id?: string
          resgatado_em?: string
          status?: Database["public"]["Enums"]["recompensa_status"]
          terapeuta_id?: string
          updated_at?: string
          xp_gasto?: number
        }
        Relationships: [
          {
            foreignKeyName: "recompensas_resgates_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "recompensas_resgates_recompensa_id_fkey"
            columns: ["recompensa_id"]
            isOneToOne: false
            referencedRelation: "recompensas_catalogo"
            referencedColumns: ["id"]
          },
        ]
      }
      recordatorios_24h: {
        Row: {
          created_at: string
          data_referencia: string
          id: string
          observacoes: string | null
          paciente_id: string
          refeicoes: Json
          terapeuta_id: string
          totais: Json | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_referencia?: string
          id?: string
          observacoes?: string | null
          paciente_id: string
          refeicoes?: Json
          terapeuta_id: string
          totais?: Json | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_referencia?: string
          id?: string
          observacoes?: string | null
          paciente_id?: string
          refeicoes?: Json
          terapeuta_id?: string
          totais?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "recordatorios_24h_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      repasse_config: {
        Row: {
          ativo: boolean
          convenio_id: string | null
          created_at: string
          id: string
          membro_equipe_id: string
          percentual: number
          terapeuta_id: string
          updated_at: string
          valor_fixo: number | null
        }
        Insert: {
          ativo?: boolean
          convenio_id?: string | null
          created_at?: string
          id?: string
          membro_equipe_id: string
          percentual?: number
          terapeuta_id: string
          updated_at?: string
          valor_fixo?: number | null
        }
        Update: {
          ativo?: boolean
          convenio_id?: string | null
          created_at?: string
          id?: string
          membro_equipe_id?: string
          percentual?: number
          terapeuta_id?: string
          updated_at?: string
          valor_fixo?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "repasse_config_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "repasse_config_membro_fk"
            columns: ["membro_equipe_id"]
            isOneToOne: false
            referencedRelation: "equipe_membros"
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
      sinais_vitais: {
        Row: {
          altura_cm: number | null
          created_at: string
          fc: number | null
          glicemia: number | null
          id: string
          medido_em: string
          observacoes: string | null
          pa_diastolica: number | null
          pa_sistolica: number | null
          paciente_id: string
          peso_kg: number | null
          spo2: number | null
          temperatura: number | null
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          altura_cm?: number | null
          created_at?: string
          fc?: number | null
          glicemia?: number | null
          id?: string
          medido_em?: string
          observacoes?: string | null
          pa_diastolica?: number | null
          pa_sistolica?: number | null
          paciente_id: string
          peso_kg?: number | null
          spo2?: number | null
          temperatura?: number | null
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          altura_cm?: number | null
          created_at?: string
          fc?: number | null
          glicemia?: number | null
          id?: string
          medido_em?: string
          observacoes?: string | null
          pa_diastolica?: number | null
          pa_sistolica?: number | null
          paciente_id?: string
          peso_kg?: number | null
          spo2?: number | null
          temperatura?: number | null
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
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
      testes_funcionais_paciente: {
        Row: {
          classificacao: string | null
          created_at: string
          data_teste: string
          id: string
          observacao: string | null
          paciente_id: string
          resultado: number | null
          terapeuta_id: string
          tipo_teste: string
          unidade: string | null
          updated_at: string
        }
        Insert: {
          classificacao?: string | null
          created_at?: string
          data_teste?: string
          id?: string
          observacao?: string | null
          paciente_id: string
          resultado?: number | null
          terapeuta_id: string
          tipo_teste: string
          unidade?: string | null
          updated_at?: string
        }
        Update: {
          classificacao?: string | null
          created_at?: string
          data_teste?: string
          id?: string
          observacao?: string | null
          paciente_id?: string
          resultado?: number | null
          terapeuta_id?: string
          tipo_teste?: string
          unidade?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      tiss_config: {
        Row: {
          cnes: string | null
          cnpj_prestador: string | null
          codigo_prestador_operadora: string | null
          contato: Json | null
          cpf_prestador: string | null
          created_at: string
          endereco: Json | null
          id: string
          nome_prestador: string | null
          registro_ans: string | null
          terapeuta_id: string
          tipo_prestador: string | null
          updated_at: string
          versao_tiss: string
        }
        Insert: {
          cnes?: string | null
          cnpj_prestador?: string | null
          codigo_prestador_operadora?: string | null
          contato?: Json | null
          cpf_prestador?: string | null
          created_at?: string
          endereco?: Json | null
          id?: string
          nome_prestador?: string | null
          registro_ans?: string | null
          terapeuta_id: string
          tipo_prestador?: string | null
          updated_at?: string
          versao_tiss?: string
        }
        Update: {
          cnes?: string | null
          cnpj_prestador?: string | null
          codigo_prestador_operadora?: string | null
          contato?: Json | null
          cpf_prestador?: string | null
          created_at?: string
          endereco?: Json | null
          id?: string
          nome_prestador?: string | null
          registro_ans?: string | null
          terapeuta_id?: string
          tipo_prestador?: string | null
          updated_at?: string
          versao_tiss?: string
        }
        Relationships: []
      }
      tiss_guia_procedimentos: {
        Row: {
          codigo_procedimento: string
          codigo_tabela: string
          created_at: string
          data_execucao: string
          descricao: string
          guia_id: string
          hora_final: string | null
          hora_inicial: string | null
          id: string
          quantidade: number
          reducao_acrescimo: number | null
          sequencia: number
          tecnica_utilizada: string | null
          valor_total: number
          valor_unitario: number
          via_acesso: string | null
        }
        Insert: {
          codigo_procedimento: string
          codigo_tabela?: string
          created_at?: string
          data_execucao?: string
          descricao: string
          guia_id: string
          hora_final?: string | null
          hora_inicial?: string | null
          id?: string
          quantidade?: number
          reducao_acrescimo?: number | null
          sequencia?: number
          tecnica_utilizada?: string | null
          valor_total?: number
          valor_unitario?: number
          via_acesso?: string | null
        }
        Update: {
          codigo_procedimento?: string
          codigo_tabela?: string
          created_at?: string
          data_execucao?: string
          descricao?: string
          guia_id?: string
          hora_final?: string | null
          hora_inicial?: string | null
          id?: string
          quantidade?: number
          reducao_acrescimo?: number | null
          sequencia?: number
          tecnica_utilizada?: string | null
          valor_total?: number
          valor_unitario?: number
          via_acesso?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiss_guia_procedimentos_guia_id_fkey"
            columns: ["guia_id"]
            isOneToOne: false
            referencedRelation: "tiss_guias"
            referencedColumns: ["id"]
          },
        ]
      }
      tiss_guias: {
        Row: {
          carater_atendimento: string | null
          convenio_id: string | null
          created_at: string
          data_atendimento: string
          data_autorizacao: string | null
          data_validade_senha: string | null
          id: string
          indicacao_acidente: string | null
          lote_id: string | null
          nome_beneficiario: string | null
          numero_carteira: string | null
          numero_guia_operadora: string | null
          numero_guia_prestador: string | null
          observacoes: string | null
          paciente_id: string | null
          senha_autorizacao: string | null
          sessao_id: string | null
          status: string
          terapeuta_id: string
          tipo_consulta: string | null
          tipo_guia: string
          updated_at: string
          valor_total: number | null
          xml_gerado: string | null
        }
        Insert: {
          carater_atendimento?: string | null
          convenio_id?: string | null
          created_at?: string
          data_atendimento?: string
          data_autorizacao?: string | null
          data_validade_senha?: string | null
          id?: string
          indicacao_acidente?: string | null
          lote_id?: string | null
          nome_beneficiario?: string | null
          numero_carteira?: string | null
          numero_guia_operadora?: string | null
          numero_guia_prestador?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          senha_autorizacao?: string | null
          sessao_id?: string | null
          status?: string
          terapeuta_id: string
          tipo_consulta?: string | null
          tipo_guia?: string
          updated_at?: string
          valor_total?: number | null
          xml_gerado?: string | null
        }
        Update: {
          carater_atendimento?: string | null
          convenio_id?: string | null
          created_at?: string
          data_atendimento?: string
          data_autorizacao?: string | null
          data_validade_senha?: string | null
          id?: string
          indicacao_acidente?: string | null
          lote_id?: string | null
          nome_beneficiario?: string | null
          numero_carteira?: string | null
          numero_guia_operadora?: string | null
          numero_guia_prestador?: string | null
          observacoes?: string | null
          paciente_id?: string | null
          senha_autorizacao?: string | null
          sessao_id?: string | null
          status?: string
          terapeuta_id?: string
          tipo_consulta?: string | null
          tipo_guia?: string
          updated_at?: string
          valor_total?: number | null
          xml_gerado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiss_guias_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guias_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tiss_guias_sessao_id_fkey"
            columns: ["sessao_id"]
            isOneToOne: false
            referencedRelation: "controle_sessoes"
            referencedColumns: ["id"]
          },
        ]
      }
      tiss_lotes: {
        Row: {
          competencia: string
          convenio_id: string | null
          created_at: string
          data_envio: string | null
          id: string
          numero_lote: string
          observacoes: string | null
          qtd_guias: number
          status: string
          terapeuta_id: string
          updated_at: string
          valor_total: number
          xml_gerado: string | null
        }
        Insert: {
          competencia: string
          convenio_id?: string | null
          created_at?: string
          data_envio?: string | null
          id?: string
          numero_lote: string
          observacoes?: string | null
          qtd_guias?: number
          status?: string
          terapeuta_id: string
          updated_at?: string
          valor_total?: number
          xml_gerado?: string | null
        }
        Update: {
          competencia?: string
          convenio_id?: string | null
          created_at?: string
          data_envio?: string | null
          id?: string
          numero_lote?: string
          observacoes?: string | null
          qtd_guias?: number
          status?: string
          terapeuta_id?: string
          updated_at?: string
          valor_total?: number
          xml_gerado?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tiss_lotes_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
        ]
      }
      tiss_tuss_codigos: {
        Row: {
          ativo: boolean
          codigo: string
          convenio_id: string | null
          created_at: string
          descricao: string
          id: string
          terapeuta_id: string
          updated_at: string
          valor: number
        }
        Insert: {
          ativo?: boolean
          codigo: string
          convenio_id?: string | null
          created_at?: string
          descricao: string
          id?: string
          terapeuta_id: string
          updated_at?: string
          valor?: number
        }
        Update: {
          ativo?: boolean
          codigo?: string
          convenio_id?: string | null
          created_at?: string
          descricao?: string
          id?: string
          terapeuta_id?: string
          updated_at?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "tiss_tuss_codigos_convenio_id_fkey"
            columns: ["convenio_id"]
            isOneToOne: false
            referencedRelation: "convenios"
            referencedColumns: ["id"]
          },
        ]
      }
      tracking_config: {
        Row: {
          ativos: boolean
          created_at: string
          ga4_id: string | null
          meta_pixel_id: string | null
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          ativos?: boolean
          created_at?: string
          ga4_id?: string | null
          meta_pixel_id?: string | null
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          ativos?: boolean
          created_at?: string
          ga4_id?: string | null
          meta_pixel_id?: string | null
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      uso_ia_mensal: {
        Row: {
          ano_mes: string
          created_at: string
          id: string
          quantidade: number
          tipo: string
          updated_at: string
          user_id: string
        }
        Insert: {
          ano_mes: string
          created_at?: string
          id?: string
          quantidade?: number
          tipo?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          ano_mes?: string
          created_at?: string
          id?: string
          quantidade?: number
          tipo?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
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
      wearable_alertas: {
        Row: {
          created_at: string
          descricao: string | null
          detectado_em: string
          id: string
          lido: boolean
          metrica_atual: number | null
          metrica_referencia: number | null
          paciente_id: string
          severidade: string
          terapeuta_id: string
          tipo: string
          titulo: string
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          detectado_em?: string
          id?: string
          lido?: boolean
          metrica_atual?: number | null
          metrica_referencia?: number | null
          paciente_id: string
          severidade?: string
          terapeuta_id: string
          tipo: string
          titulo: string
        }
        Update: {
          created_at?: string
          descricao?: string | null
          detectado_em?: string
          id?: string
          lido?: boolean
          metrica_atual?: number | null
          metrica_referencia?: number | null
          paciente_id?: string
          severidade?: string
          terapeuta_id?: string
          tipo?: string
          titulo?: string
        }
        Relationships: []
      }
      wearable_sync_log: {
        Row: {
          calories: number | null
          created_at: string
          fonte: string
          heart_rate: number | null
          id: string
          paciente_id: string
          raw_data: Json | null
          sincronizado_em: string
          sleep_hours: number | null
          steps: number | null
          terapeuta_id: string
        }
        Insert: {
          calories?: number | null
          created_at?: string
          fonte?: string
          heart_rate?: number | null
          id?: string
          paciente_id: string
          raw_data?: Json | null
          sincronizado_em?: string
          sleep_hours?: number | null
          steps?: number | null
          terapeuta_id: string
        }
        Update: {
          calories?: number | null
          created_at?: string
          fonte?: string
          heart_rate?: number | null
          id?: string
          paciente_id?: string
          raw_data?: Json | null
          sincronizado_em?: string
          sleep_hours?: number | null
          steps?: number | null
          terapeuta_id?: string
        }
        Relationships: []
      }
      wellness_assinaturas: {
        Row: {
          created_at: string
          data_fim: string | null
          data_inicio: string
          id: string
          paciente_id: string
          provider: string | null
          provider_subscription_id: string | null
          proxima_cobranca: string | null
          status: string
          ultima_sessao_mensal_em: string | null
          updated_at: string
          valor_mensal: number
        }
        Insert: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          paciente_id: string
          provider?: string | null
          provider_subscription_id?: string | null
          proxima_cobranca?: string | null
          status?: string
          ultima_sessao_mensal_em?: string | null
          updated_at?: string
          valor_mensal?: number
        }
        Update: {
          created_at?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          paciente_id?: string
          provider?: string | null
          provider_subscription_id?: string | null
          proxima_cobranca?: string | null
          status?: string
          ultima_sessao_mensal_em?: string | null
          updated_at?: string
          valor_mensal?: number
        }
        Relationships: [
          {
            foreignKeyName: "wellness_assinaturas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_automacoes: {
        Row: {
          auto_confirmacao_24h: boolean
          bot_ativo: boolean
          created_at: string
          delay_resposta_segundos: number
          detectar_intencao: boolean
          dias_semana: Json
          gatilhos_ativos: Json
          horario_fim: string
          horario_inicio: string
          id: string
          max_turnos_bot: number
          mensagem_confirmacao: string
          mensagem_fora_horario: string
          mensagem_lembrete_2h: string | null
          mensagem_no_show: string | null
          mensagem_pos_sessao: string | null
          mensagem_saudacao: string
          no_show_perdoar_primeira: boolean
          no_show_so_com_pacote: boolean
          palavras_escalonamento: string[]
          pausar_bot_apos_humano: boolean
          prompt_extra: string | null
          sla_ativo: boolean
          sla_minutos: number
          terapeuta_id: string
          tom_voz: string
          updated_at: string
          usar_contexto_clinico: boolean
        }
        Insert: {
          auto_confirmacao_24h?: boolean
          bot_ativo?: boolean
          created_at?: string
          delay_resposta_segundos?: number
          detectar_intencao?: boolean
          dias_semana?: Json
          gatilhos_ativos?: Json
          horario_fim?: string
          horario_inicio?: string
          id?: string
          max_turnos_bot?: number
          mensagem_confirmacao?: string
          mensagem_fora_horario?: string
          mensagem_lembrete_2h?: string | null
          mensagem_no_show?: string | null
          mensagem_pos_sessao?: string | null
          mensagem_saudacao?: string
          no_show_perdoar_primeira?: boolean
          no_show_so_com_pacote?: boolean
          palavras_escalonamento?: string[]
          pausar_bot_apos_humano?: boolean
          prompt_extra?: string | null
          sla_ativo?: boolean
          sla_minutos?: number
          terapeuta_id: string
          tom_voz?: string
          updated_at?: string
          usar_contexto_clinico?: boolean
        }
        Update: {
          auto_confirmacao_24h?: boolean
          bot_ativo?: boolean
          created_at?: string
          delay_resposta_segundos?: number
          detectar_intencao?: boolean
          dias_semana?: Json
          gatilhos_ativos?: Json
          horario_fim?: string
          horario_inicio?: string
          id?: string
          max_turnos_bot?: number
          mensagem_confirmacao?: string
          mensagem_fora_horario?: string
          mensagem_lembrete_2h?: string | null
          mensagem_no_show?: string | null
          mensagem_pos_sessao?: string | null
          mensagem_saudacao?: string
          no_show_perdoar_primeira?: boolean
          no_show_so_com_pacote?: boolean
          palavras_escalonamento?: string[]
          pausar_bot_apos_humano?: boolean
          prompt_extra?: string | null
          sla_ativo?: boolean
          sla_minutos?: number
          terapeuta_id?: string
          tom_voz?: string
          updated_at?: string
          usar_contexto_clinico?: boolean
        }
        Relationships: []
      }
      whatsapp_contatos_bloqueados: {
        Row: {
          created_at: string
          id: string
          motivo: string | null
          nome: string | null
          telefone: string
          terapeuta_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          motivo?: string | null
          nome?: string | null
          telefone: string
          terapeuta_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          motivo?: string | null
          nome?: string | null
          telefone?: string
          terapeuta_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      whatsapp_conversas: {
        Row: {
          arquivada: boolean
          atribuido_a: string | null
          bot_ativo: boolean
          created_at: string
          foto_url: string | null
          id: string
          intencao_atual: string | null
          lead_score: number
          motivo_escalonamento: string | null
          nao_lidas: number
          nome_contato: string | null
          origem_utm: Json | null
          paciente_id: string | null
          pipeline_motivo_perda: string | null
          pipeline_stage: Database["public"]["Enums"]["crm_pipeline_stage"]
          pipeline_updated_at: string
          primeiro_resposta_em: string | null
          requer_atencao: boolean
          sla_responder_ate: string | null
          tags: string[] | null
          telefone: string
          terapeuta_id: string
          turnos_bot: number
          ultima_direcao: string | null
          ultima_mensagem: string | null
          ultima_mensagem_em: string | null
          updated_at: string
        }
        Insert: {
          arquivada?: boolean
          atribuido_a?: string | null
          bot_ativo?: boolean
          created_at?: string
          foto_url?: string | null
          id?: string
          intencao_atual?: string | null
          lead_score?: number
          motivo_escalonamento?: string | null
          nao_lidas?: number
          nome_contato?: string | null
          origem_utm?: Json | null
          paciente_id?: string | null
          pipeline_motivo_perda?: string | null
          pipeline_stage?: Database["public"]["Enums"]["crm_pipeline_stage"]
          pipeline_updated_at?: string
          primeiro_resposta_em?: string | null
          requer_atencao?: boolean
          sla_responder_ate?: string | null
          tags?: string[] | null
          telefone: string
          terapeuta_id: string
          turnos_bot?: number
          ultima_direcao?: string | null
          ultima_mensagem?: string | null
          ultima_mensagem_em?: string | null
          updated_at?: string
        }
        Update: {
          arquivada?: boolean
          atribuido_a?: string | null
          bot_ativo?: boolean
          created_at?: string
          foto_url?: string | null
          id?: string
          intencao_atual?: string | null
          lead_score?: number
          motivo_escalonamento?: string | null
          nao_lidas?: number
          nome_contato?: string | null
          origem_utm?: Json | null
          paciente_id?: string | null
          pipeline_motivo_perda?: string | null
          pipeline_stage?: Database["public"]["Enums"]["crm_pipeline_stage"]
          pipeline_updated_at?: string
          primeiro_resposta_em?: string | null
          requer_atencao?: boolean
          sla_responder_ate?: string | null
          tags?: string[] | null
          telefone?: string
          terapeuta_id?: string
          turnos_bot?: number
          ultima_direcao?: string | null
          ultima_mensagem?: string | null
          ultima_mensagem_em?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversas_paciente_id_fkey"
            columns: ["paciente_id"]
            isOneToOne: false
            referencedRelation: "pacientes"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_filtros_salvos: {
        Row: {
          created_at: string
          filtros: Json
          id: string
          nome: string
          ordem: number
          terapeuta_id: string
        }
        Insert: {
          created_at?: string
          filtros?: Json
          id?: string
          nome: string
          ordem?: number
          terapeuta_id: string
        }
        Update: {
          created_at?: string
          filtros?: Json
          id?: string
          nome?: string
          ordem?: number
          terapeuta_id?: string
        }
        Relationships: []
      }
      whatsapp_hsm_templates: {
        Row: {
          categoria: string
          conteudo: string
          created_at: string
          id: string
          idioma: string
          meta_template_id: string | null
          nome: string
          status: string
          terapeuta_id: string
          updated_at: string
          variaveis: Json
        }
        Insert: {
          categoria?: string
          conteudo: string
          created_at?: string
          id?: string
          idioma?: string
          meta_template_id?: string | null
          nome: string
          status?: string
          terapeuta_id: string
          updated_at?: string
          variaveis?: Json
        }
        Update: {
          categoria?: string
          conteudo?: string
          created_at?: string
          id?: string
          idioma?: string
          meta_template_id?: string | null
          nome?: string
          status?: string
          terapeuta_id?: string
          updated_at?: string
          variaveis?: Json
        }
        Relationships: []
      }
      whatsapp_intencoes: {
        Row: {
          confianca: number
          conversa_id: string
          created_at: string
          id: string
          intencao: string
          mensagem_id: string | null
          metadata: Json | null
          resumo: string | null
          terapeuta_id: string
        }
        Insert: {
          confianca?: number
          conversa_id: string
          created_at?: string
          id?: string
          intencao: string
          mensagem_id?: string | null
          metadata?: Json | null
          resumo?: string | null
          terapeuta_id: string
        }
        Update: {
          confianca?: number
          conversa_id?: string
          created_at?: string
          id?: string
          intencao?: string
          mensagem_id?: string | null
          metadata?: Json | null
          resumo?: string | null
          terapeuta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_intencoes_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_intencoes_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_mensagens_inbox"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_mensagens_inbox: {
        Row: {
          conteudo: string | null
          conversa_id: string
          created_at: string
          direcao: string
          erro: string | null
          id: string
          metadata: Json | null
          midia_url: string | null
          status: string
          terapeuta_id: string
          tipo: string
          transcricao: string | null
          zapi_message_id: string | null
        }
        Insert: {
          conteudo?: string | null
          conversa_id: string
          created_at?: string
          direcao: string
          erro?: string | null
          id?: string
          metadata?: Json | null
          midia_url?: string | null
          status?: string
          terapeuta_id: string
          tipo?: string
          transcricao?: string | null
          zapi_message_id?: string | null
        }
        Update: {
          conteudo?: string | null
          conversa_id?: string
          created_at?: string
          direcao?: string
          erro?: string | null
          id?: string
          metadata?: Json | null
          midia_url?: string | null
          status?: string
          terapeuta_id?: string
          tipo?: string
          transcricao?: string | null
          zapi_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_mensagens_inbox_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_notas: {
        Row: {
          conteudo: string
          conversa_id: string
          created_at: string
          id: string
          terapeuta_id: string
        }
        Insert: {
          conteudo: string
          conversa_id: string
          created_at?: string
          id?: string
          terapeuta_id: string
        }
        Update: {
          conteudo?: string
          conversa_id?: string
          created_at?: string
          id?: string
          terapeuta_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_notas_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_templates: {
        Row: {
          atalho: string
          categoria: string | null
          conteudo: string
          created_at: string
          id: string
          terapeuta_id: string
          titulo: string
          updated_at: string
          uso_count: number
        }
        Insert: {
          atalho: string
          categoria?: string | null
          conteudo: string
          created_at?: string
          id?: string
          terapeuta_id: string
          titulo: string
          updated_at?: string
          uso_count?: number
        }
        Update: {
          atalho?: string
          categoria?: string | null
          conteudo?: string
          created_at?: string
          id?: string
          terapeuta_id?: string
          titulo?: string
          updated_at?: string
          uso_count?: number
        }
        Relationships: []
      }
    }
    Views: {
      eventos_publicos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          cobrar_pagamento: boolean | null
          created_at: string | null
          data_evento: string | null
          descricao: string | null
          descricao_formulario: string | null
          horario_fim: string | null
          horario_inicio: string | null
          id: string | null
          link_video: string | null
          local: string | null
          terapeuta_id: string | null
          titulo: string | null
          updated_at: string | null
          vagas_max: number | null
          valor: number | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          cobrar_pagamento?: boolean | null
          created_at?: string | null
          data_evento?: string | null
          descricao?: string | null
          descricao_formulario?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string | null
          link_video?: string | null
          local?: string | null
          terapeuta_id?: string | null
          titulo?: string | null
          updated_at?: string | null
          vagas_max?: number | null
          valor?: number | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          cobrar_pagamento?: boolean | null
          created_at?: string | null
          data_evento?: string | null
          descricao?: string | null
          descricao_formulario?: string | null
          horario_fim?: string | null
          horario_inicio?: string | null
          id?: string | null
          link_video?: string | null
          local?: string | null
          terapeuta_id?: string | null
          titulo?: string | null
          updated_at?: string | null
          vagas_max?: number | null
          valor?: number | null
        }
        Relationships: []
      }
      wearable_metricas_semanais: {
        Row: {
          dias_com_dados: number | null
          fc_repouso_media_7d: number | null
          paciente_id: string | null
          passos_media_7d: number | null
          passos_media_semana_anterior: number | null
          ultimo_dia_com_dados: string | null
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
    }
    Functions: {
      calcular_nivel_paciente: {
        Args: { p_xp: number }
        Returns: Database["public"]["Enums"]["nivel_paciente"]
      }
      count_evento_inscricoes: {
        Args: { p_evento_id: string }
        Returns: number
      }
      criar_paciente_wellness: {
        Args: {
          p_email: string
          p_nome: string
          p_sobrenome: string
          p_telefone?: string
        }
        Returns: string
      }
      excluir_paciente_completo: {
        Args: { p_paciente_id: string }
        Returns: undefined
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
      get_paciente_completar_publico: {
        Args: { p_token: string }
        Returns: {
          cadastro_status: string
          email: string
          id: string
          nome: string
          sobrenome: string
          telefone: string
          terapeuta_nome: string
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
      get_wellness_status: {
        Args: never
        Returns: {
          acesso_clinico: string
          acesso_clinico_expira_em: string
          assinatura_status: string
          consulta_mensal_disponivel: boolean
          dias_restantes_carencia: number
          is_in_trial: boolean
          is_premium: boolean
          paciente_id: string
          proxima_cobranca: string
          tipo_conta: string
          trial_ate: string
          ultima_sessao_mensal_em: string
        }[]
      }
      has_active_agenda_link: {
        Args: { p_terapeuta_id: string }
        Returns: boolean
      }
      has_active_agenda_link_for_paciente: {
        Args: { p_paciente_id: string; p_terapeuta_id: string }
        Returns: boolean
      }
      has_clinica_role: {
        Args: {
          _clinica_id: string
          _papel?: Database["public"]["Enums"]["clinica_papel"]
          _user_id: string
        }
        Returns: boolean
      }
      has_module_access: {
        Args: { p_module: string; p_user_id: string }
        Returns: boolean
      }
      increment_evidence_citation: {
        Args: { p_ids: string[] }
        Returns: undefined
      }
      incrementar_clique_link: {
        Args: { p_link_id: string }
        Returns: undefined
      }
      incrementar_uso_ia: {
        Args: { p_tipo?: string; p_user_id: string }
        Returns: number
      }
      is_clinica_dono: {
        Args: { _clinica_id: string; _user_id: string }
        Returns: boolean
      }
      is_valid_cpf: { Args: { p_cpf: string }; Returns: boolean }
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
      match_evidence: {
        Args: {
          filter_areas?: string[]
          match_count?: number
          min_year?: number
          query_embedding: string
        }
        Returns: {
          abstract: string
          authors: string[]
          doi: string
          evidence_level: string
          external_id: string
          health_areas: string[]
          id: string
          journal: string
          similarity: number
          study_type: string
          title: string
          url: string
          year: number
        }[]
      }
      meu_plano_atual: {
        Args: never
        Returns: {
          data_fim: string
          limite_ia_mensal: number
          modulos: Json
          plano_id: string
          plano_nome: string
          preco_mensal: number
          status: string
          uso_ia_atual: number
        }[]
      }
      salvar_cadastro_paciente_autenticado: {
        Args: { p_data: Json }
        Returns: Json
      }
      salvar_cadastro_paciente_publico: {
        Args: { p_data: Json; p_token: string }
        Returns: string
      }
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
      seed_notificacao_regras_default: {
        Args: { p_terapeuta_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
      track_agenda_link_access: {
        Args: { p_token: string }
        Returns: undefined
      }
    }
    Enums: {
      clinica_membro_status: "convidado" | "ativo" | "removido"
      clinica_papel: "dono" | "profissional" | "recepcao"
      crm_pipeline_stage:
        | "novo"
        | "qualificado"
        | "agendado"
        | "fechado"
        | "perdido"
      myid_dimensao:
        | "D"
        | "EFI"
        | "P"
        | "I"
        | "R"
        | "C"
        | "AF"
        | "HID"
        | "NUT"
        | "ERG"
        | "N"
        | "MED"
        | "ANY"
      nivel_paciente: "bronze" | "prata" | "ouro" | "platina" | "diamante"
      notif_canal: "in_app" | "whatsapp" | "push"
      origem_achado_anatomico:
        | "subjetivo_myid"
        | "exame_clinico"
        | "exame_imagem"
        | "voz_ia"
        | "autocadastro_paciente"
        | "outro"
      perfil_profissional:
        | "fisioterapeuta"
        | "medico"
        | "psicologo"
        | "nutricionista"
        | "educador_fisico"
        | "terapeuta_ocupacional"
      recompensa_status: "solicitado" | "aprovado" | "entregue" | "cancelado"
      sistema_corporal:
        | "musculoesqueletico"
        | "nervoso"
        | "cardiovascular"
        | "respiratorio"
        | "digestorio"
        | "endocrino"
        | "urinario"
        | "reprodutor"
        | "tegumentar"
        | "linfatico"
        | "sensorial"
      status_evento_anatomico:
        | "ativo"
        | "em_tratamento"
        | "resolvido"
        | "cronico"
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
    Enums: {
      clinica_membro_status: ["convidado", "ativo", "removido"],
      clinica_papel: ["dono", "profissional", "recepcao"],
      crm_pipeline_stage: [
        "novo",
        "qualificado",
        "agendado",
        "fechado",
        "perdido",
      ],
      myid_dimensao: [
        "D",
        "EFI",
        "P",
        "I",
        "R",
        "C",
        "AF",
        "HID",
        "NUT",
        "ERG",
        "N",
        "MED",
        "ANY",
      ],
      nivel_paciente: ["bronze", "prata", "ouro", "platina", "diamante"],
      notif_canal: ["in_app", "whatsapp", "push"],
      origem_achado_anatomico: [
        "subjetivo_myid",
        "exame_clinico",
        "exame_imagem",
        "voz_ia",
        "autocadastro_paciente",
        "outro",
      ],
      perfil_profissional: [
        "fisioterapeuta",
        "medico",
        "psicologo",
        "nutricionista",
        "educador_fisico",
        "terapeuta_ocupacional",
      ],
      recompensa_status: ["solicitado", "aprovado", "entregue", "cancelado"],
      sistema_corporal: [
        "musculoesqueletico",
        "nervoso",
        "cardiovascular",
        "respiratorio",
        "digestorio",
        "endocrino",
        "urinario",
        "reprodutor",
        "tegumentar",
        "linfatico",
        "sensorial",
      ],
      status_evento_anatomico: [
        "ativo",
        "em_tratamento",
        "resolvido",
        "cronico",
      ],
    },
  },
} as const
