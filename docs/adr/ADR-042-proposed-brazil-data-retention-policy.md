# ADR-042: política inicial brasileira de finalidades, bases legais e retenção

Status: ACCEPTED

## Contexto

Dados de saúde são dados pessoais sensíveis. A LGPD exige hipótese legal específica para seu tratamento e, em regra, eliminação ao término da finalidade; a conservação é excepcional. A Lei nº 13.787/2018 prevê prazo mínimo de 20 anos para prontuários de pacientes, mas a Glucora não deve se apresentar nem operar como prontuário sem uma decisão clínica e regulatória posterior.

## Proposta

| Categoria                                          | Finalidade                                                                                                                                          | Base legal                                                                                                                                                                     | Retenção                                                                                                                                                                                                                                                                       |
| -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Dados de saúde inseridos pelo titular              | Exibir, organizar e permitir ao titular consultar seus próprios dados para autocuidado, sem diagnóstico, prescrição ou compartilhamento por padrão. | Consentimento específico e destacado do titular para essa finalidade, LGPD art. 11, I.                                                                                         | Enquanto a conta estiver ativa e o consentimento para essa finalidade estiver vigente. Após revogação ou pedido de exclusão, eliminar dos sistemas ativos em até 30 dias e dos backups no próximo ciclo de expiração, limitado a 90 dias, salvo bloqueio jurídico documentado. |
| Solicitações de privacidade, exportação e exclusão | Receber, autenticar proporcionalmente, executar e comprovar o atendimento dos direitos do titular.                                                  | Cumprimento de obrigação legal ou regulatória, LGPD art. 11, II, a, e exercício regular de direitos, art. 11, II, d, somente para os dados sensíveis estritamente necessários. | Registros mínimos de pedido, decisão, evidência e auditoria por 5 anos após o encerramento; exportações geradas ficam disponíveis por até 7 dias e são eliminadas depois.                                                                                                      |
| Suporte                                            | Resolver solicitação técnica ou de conta do titular. O canal não aceita dados de saúde, texto livre ou anexos.                                      | Execução de contrato ou de procedimentos preliminares a pedido do titular, LGPD art. 7, V.                                                                                     | Solicitação estruturada e auditoria mínima por 2 anos após o encerramento; eliminar antes se não houver necessidade operacional ou jurídica documentada.                                                                                                                       |

## Controles

- Nenhuma finalidade secundária, publicidade comportamental, venda de dados ou treinamento de modelos com dados do titular é autorizada por esta decisão.
- Toda nova finalidade, compartilhamento, integração, pesquisa ou alteração de prazo exige revisão proporcional de privacidade e atualização versionada da finalidade.
- O produto deve manter o tratamento de saúde bloqueado até que a finalidade versionada, o consentimento e a execução de retenção sejam implementados e testados.
- A operação deve manter um inventário com categoria, finalidade, base legal, prazo, controlador, operadores e evidência de eliminação.

## Evidências normativas

- [LGPD — Lei nº 13.709/2018, arts. 11 e 16](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709compilado.htm)
- [Lei nº 13.787/2018, art. 6º](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13787.htm)

## Consequências

Esta proposta não declara a Glucora como prontuário, não autoriza atendimento clínico, nem substitui revisão jurídica ou regulatória aplicável ao modelo operacional definitivo.
