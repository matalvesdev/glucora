# ADR-015: política de autorização baseada em consentimento

Status: **ACCEPTED**

## Contexto

Autenticação não concede acesso a dados ou capacidades. O Source of Truth exige que cada operação relevante avalie identidade, titularidade, estado da conta, finalidade e consentimento no servidor, com negação por padrão.

## Decisão proposta

Usar uma política de domínio determinística para capacidades do consumidor. A autorização exige simultaneamente ator autenticado, conta ativa correspondente, titularidade, versão de finalidade publicada e vigente e último evento de consentimento igual a `granted` para a mesma versão.

Qualquer dado ausente, inconsistente, futuro ou revogado resulta em negação. O repositório calcula o estado atual usando a ordem temporal dos eventos, para que uma revogação posterior afete novas operações.

## Limites

Esta política ainda não declara capacidades ou finalidades reais. Papéis profissionais, organizações, suporte, compartilhamento e hipóteses legais sem consentimento exigem políticas e decisões próprias.

## Critérios para aceite

- Compliance aprova o mapeamento de cada capacidade para finalidade e base legal;
- Security revisa a matriz e os limites de confiança;
- testes cobrem ausência, inconsistência, titularidade, rascunho, vigência, concessão e revogação.
