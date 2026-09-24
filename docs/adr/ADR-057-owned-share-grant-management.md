# ADR-057: gestão própria de grants de compartilhamento

Status: ACCEPTED

## Contexto e decisão

E6/G5 já possui o modelo de grant da ADR-025, mas ainda não há superfície do
titular para criar ou revogar um grant. Este slice autoriza somente endpoints
autenticados para o titular do relatório de consulta:

- criar um grant para exatamente um `consultation_report`, usando `recipient_ref`
  opaco, `purpose_version_id` publicado e validade explícita;
- consultar o grant pelo identificador próprio;
- revogar o grant com controle de versão otimista.

O servidor deriva `owner_user_id`, valida ownership do relatório, finalidade,
consentimento vigente e limites de validade. O cliente não escolhe titular,
status ou auditoria. Nenhum endpoint de destinatário, download, entrega,
identidade, e-mail, telefone ou acesso a registros canônicos é habilitado por
esta decisão.

## Consequências

Criação e revogação ficam exercitáveis e auditáveis pelo titular, mantendo o
compartilhamento deny-by-default. A entrega e a autenticação do destinatário
continuam gates separados conforme ADR-025.

Aceita por Mateus Alves Bassane em 2026-09-24, evidência `00001`.
