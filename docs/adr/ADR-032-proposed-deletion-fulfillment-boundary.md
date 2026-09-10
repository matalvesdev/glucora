# ADR-032: boundary de fulfillment de exclusão

Status: ACCEPTED

## Contexto e proposta

G8 exige que uma solicitação de exclusão percorra sistemas e subprocessadores e preserve evidência. Propõe-se um orquestrador provider-neutral para pedidos `deletion` em revisão. Um plano explícito injeta targets classificados como canonical, projection, vendor ou backup; cada adapter devolve resultado controlado, reason code, timestamp e referência de evidência.

Falhas e recibos inválidos são convertidos em códigos seguros sem propagar mensagens do fornecedor. O orquestrador não decide se retenção é legítima, não altera o estado da solicitação e não seleciona vendors. A política aprovada monta o plano e interpreta os recibos antes de marcar fulfillment.

## Consequências

Adapters futuros têm um contrato testável e rastreável. Os hooks reais, política de retenção, lifecycle de backup, subprocessadores e autorização de execução continuam dependentes de Compliance, Security e Operations.
