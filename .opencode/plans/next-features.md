# Plano: Próximas Features do FEMIC v2

## 1. Legenda de cores + simplificar card

### AppointmentCard.tsx
- Remover `<select>` de status do card (linhas 58-69)
- Remover prop `onStatusChange`
- Manter: hora, nome (shortName), serviço (hover)
- Remover texto "Cancelado"/"Concluído" do card (cores já comunicam)

### WeekView.tsx
- Adicionar legenda de cores abaixo do grid:
  ```
  🟡 Agendado | 🔵 Confirmado | 🟢 Concluído | 🔴 Cancelado
  ```
- Legenda como flex row com dots coloridos + labels

---

## 2. Dashboard: alertas configuráveis + último agendamento

### DashboardPage.tsx
- Tornar limiares configuráveis via state (salvo em localStorage):
  - `criticalThreshold` (default: 3)
  - `lowThreshold` (default: 5)
- Adicionar input/editável para ajustar limiares na seção de alertas
- NOVO: Alertar último agendamento do paciente
  - Para cada paciente ativo, buscar o appointment com maior `appointment_date`
  - Se é futuro → tudo bem
  - Se é passado e há pacote ativo → alerta "Último agendamento foi em X, considere agendar nova sessão"
  - Se pacote esgotado → alerta "Paciente sem sessões, criar novo pacote"

---

## 3. Pacotes: cronologia por paciente

### PatientChartModal.tsx
- Adicionar aba "Pacotes" ao lado de "Anamnese" e "Evoluções"
- Buscar `session_packages` filtrado por `patient_id`
- Mostrar lista cronológica:
  - Data de criação
  - Total de sessões
  - Sessões restantes
  - Status (ativo/esgotado)
- Botão "Novo Pacote" para criar quando acabar
  - Insert em `session_packages` com `patient_id`, `total_sessions`, `remaining_sessions`

### Queries
- Adicionar `fetchPatientPackages(patientId: string)` em services.ts

---

## 4. Captação: telefone formatado + limpar

### CaptacaoPage.tsx
- Função `formatPhone(phone: string)`:
  - Remove tudo que não é dígito
  - Formata: `(XX) XXXXX-XXXX`
  - Se menos de 11 dígitos: `(XX) XXXX-XXXX`
- Aplicar `formatPhone()` no display do telefone (linha 171)
- NOVO: Botão "Limpar pendências" no header
  - Atualiza todas as tasks com `status = "pending"` para `status = "done"` (ou另一个值 que indica processado)
  - Confirmação antes de limpar

---

## 5. Remover Convenios

### Arquivos para modificar:
- `App.tsx`: Remover import de ConveniosPage e rota `/convenios`
- `Layout.tsx`: Remover item `{ icon: Shield, label: "Convênios", path: "/convenios" }` e `pageTitles["/convenios"]`

### Arquivo para deletar:
- `src/pages/ConveniosPage.tsx`

### Manter:
- Tabela `health_insurances` no banco (pode ser usada por `services`)
- `fetchHealthInsurances` em services.ts (mantido para uso interno)

---

## 6. Documentos com IA + cabeçalho/logo/assinatura/carimbo

### Database
- Tabela `patient_documents` já existe no código
- Adicionar colunas:
  - `content TEXT` (corpo do documento)
  - `header_logo_url TEXT` (URL do logo)
  - `signature_url TEXT` (URL da assinatura)
  - `stamp_url TEXT` (URL do carimbo)
  - `doc_type TEXT` (tipo: atestado, relatório, receita, declaração, outro)
  - `patient_name TEXT` (cache do nome)

### DocumentosPacientePage.tsx - Reescrita completa
- Layout: sidebar com tipos de documento + área principal de edição
- Tipos predefinidos:
  - Atestado Médico
  - Relatório de Evolução
  - Receita
  - Declaração
  - Laudo
  - Personalizado
- Para cada tipo:
  - Template pré-definido com campos variáveis
  - Edição livre com textarea rico
  - Preview antes de salvar
- Upload de assets:
  - Logo da empresa (salvo em state ou localStorage)
  - Assinatura (upload de imagem)
  - Carimbo (upload de imagem)
- Geração com IA:
  - Botão "Gerar com IA" que chama API (OpenAI/Claude)
  - Prompt baseado no tipo + dados do paciente
  - Resultado editável antes de salvar
- Salvamento:
  - Salva `rendered_html` (HTML renderizado)
  - Salva `content` (texto puro)
  - Salva URLs dos assets
- Listagem:
  - Busca por paciente/título
  - Filtro por tipo
  - Ações: editar, duplicar, excluir, enviar (link)
- SQL para criar tabela com novas colunas

### Template de exemplo (Atestado):
```
[LOGO]

ATESTADO

Atesto para os devidos fins que o(a) paciente [NOME],
portador(a) do CPF [CPF], necessita de repouso por [DIAS] dias,
período de [DATA_INICIO] a [DATA_FIM].

[LOCAL], [DATA]

_________________________
[NOME_PROFISSIONAL]
[CRM/COREN]

[CARIMBO]
```
