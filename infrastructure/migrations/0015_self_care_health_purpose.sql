-- ADR-042: the sole initial health-data purpose is versioned, specific and immutable.
-- No health record is created by this migration.
INSERT INTO consent.purpose_versions
  (id, purpose_key, version, status, title, notice_text, legal_basis_ref,
   retention_policy_ref, owner_ref, effective_from)
VALUES
  ('pur_selfcarehealth0001', 'self_care_health_data', 1, 'published',
   'Organização dos seus dados para autocuidado',
   'Com seu consentimento específico, a Glucora poderá exibir, organizar e permitir que você consulte seus próprios dados de saúde para autocuidado. Esta finalidade não autoriza diagnóstico, prescrição, compartilhamento por padrão, publicidade comportamental, venda de dados ou treinamento de modelos. Você pode revogar o consentimento a qualquer momento.',
   'LGPD art. 11, I — consentimento específico e destacado',
   'ADR-042: conta ativa e consentimento vigente; após revogação ou exclusão, sistemas ativos em até 30 dias e backups em até 90 dias, salvo bloqueio jurídico documentado',
   'Mateus Alves Bassane', now())
ON CONFLICT (id) DO NOTHING;
