# ADR-016: modelo mínimo de eventos de auditoria

Status: **PROPOSED**

## Contexto

Eventos de consentimento, privacidade, compartilhamento, administração e segurança precisam ser reconstruíveis. Logs operacionais têm finalidade e ciclo de vida diferentes, e não devem substituir evidência de auditoria.

## Decisão proposta

Manter uma tabela append-only separada, composta apenas por identificadores opacos, tipo do evento, ator, titular, recurso, ação, resultado, request ID, referência obrigatória à política de retenção e timestamps.

O schema não possui coluna de payload ou metadata livre. Isso impede o caminho mais simples para registrar acidentalmente dados clínicos, tokens, textos livres ou corpos de requisição.

## Limites

Nenhum evento real é emitido nesta etapa. A taxonomia, retenção, controle de acesso, exportação e vínculo transacional com cada fluxo dependem das decisões proprietárias e de Compliance.

## Critérios para aceite

- Compliance aprova taxonomia e retenção por evento;
- Security aprova privilégios, acesso e proteção da trilha;
- cada fluxo registra evidência na mesma unidade transacional quando necessário;
- testes comprovam minimização, ordenação e imutabilidade.
