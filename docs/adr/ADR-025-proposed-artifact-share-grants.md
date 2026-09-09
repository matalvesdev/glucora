# ADR-025: grants de compartilhamento de artefatos

Status: PROPOSED

## Contexto e proposta

E6/G5 exige compartilhamento granular e revogável. Propõe-se um grant explícito para exatamente um relatório, um recipient reference opaco, uma finalidade versionada e um intervalo limitado. O grant não concede acesso a registros canônicos, outras versões ou outros artefatos. Revogação é versionada e auditável.

Identidade/delivery do destinatário continua atrás de interface futura; e-mail ou telefone não é persistido no grant. A finalidade de sharing deve ser publicada antes da exposição. Expiração é avaliada em cada acesso, sem depender de job.

## Consequências

O usuário pode encerrar acesso futuro sem apagar o relatório ou presumir obrigações do receptor. Delivery, autenticação do destinatário, prazo máximo, download e termos finais aguardam decisões Product/Compliance/Security.
