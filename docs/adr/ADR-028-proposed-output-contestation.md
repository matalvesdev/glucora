# ADR-028: contestação de outputs

Status: ACCEPTED

## Contexto e proposta

FR-033, F8 e G6 exigem que o usuário conteste insight/output e que isso afete gerações futuras. Propõe-se registro append-only por usuário, recurso e versão, com reason code controlado. O conteúdo original e justificativas livres não são duplicados. Consultas futuras removem recursos com contestação aberta antes de montar contexto.

Relatórios confirmam ownership diretamente. Outputs de IA futuros precisarão de registro canônico `ai_runs` e ownership antes de a contestação pública ser ativada. Registro e auditoria ocorrem na mesma transação.

## Consequências

Contestação não é interpretada como prova automática de erro nem apagamento. Workflow de revisão/resolução, reason codes finais, SLA e suporte dependem de Product/Clinical/Operations.
