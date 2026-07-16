-- Reúne os campos antigos de avaliação no campo exibido como "Avaliação complementar".
-- O marcador torna a migração idempotente e preserva qualquer sumário já escrito.
with legacy_assessments as (
  select
    id,
    concat_ws(E'\n',
      case when nullif(trim(limitations), '') is not null then 'Limitações funcionais: ' || trim(limitations) end,
      case when nullif(trim(goals), '') is not null then 'Objetivos: ' || trim(goals) end,
      case when nullif(trim(previous_treatments), '') is not null then 'Tratamentos anteriores: ' || trim(previous_treatments) end,
      case when nullif(trim(occupation_routine), '') is not null then 'Rotina ocupacional: ' || trim(occupation_routine) end,
      case when nullif(trim(physical_activity_context), '') is not null then 'Contexto de atividade física: ' || trim(physical_activity_context) end,
      case when nullif(trim(psychosocial_factors), '') is not null then 'Fatores psicossociais: ' || trim(psychosocial_factors) end,
      case when nullif(trim(fear_avoidance), '') is not null then 'Medo-evitação: ' || trim(fear_avoidance) end,
      case when nullif(trim(red_flags), '') is not null then 'Bandeiras vermelhas: ' || trim(red_flags) end,
      case when nullif(trim(obs), '') is not null then 'Observações: ' || trim(obs) end
    ) as details
  from public.clinical_anamneses
), updates as (
  select
    clinical_anamneses.id,
    concat_ws(E'\n\n',
      nullif(trim(clinical_anamneses.clinical_summary), ''),
      'Avaliação complementar (dados anteriores):' || E'\n' || legacy_assessments.details
    ) as complementary_assessment
  from public.clinical_anamneses
  join legacy_assessments using (id)
  where legacy_assessments.details <> ''
    and coalesce(clinical_anamneses.clinical_summary, '') not like '%Avaliação complementar (dados anteriores):%'
)
update public.clinical_anamneses
set clinical_summary = updates.complementary_assessment
from updates
where clinical_anamneses.id = updates.id;
