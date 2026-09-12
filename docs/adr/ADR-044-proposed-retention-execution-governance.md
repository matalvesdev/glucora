# ADR-044: governança da execução de retenção e exclusão

Status: **PROPOSED**

## Contexto

A ADR-042 fixa os prazos iniciais e a ADR-043 permite a exclusão transacional
dos dados canônicos de saúde. O sistema ainda não tem um ciclo operacional que
descubra itens vencidos, qualifique bloqueio jurídico, acione backups e
subprocessadores, conserve recibos mínimos ou determine quando uma solicitação
pode sair de revisão. Não há operador, fornecedor, armazenamento, fila ou
agendador de produção aprovados.

## Decisão proposta

Antes de ativar captura pública de dados de saúde ou concluir pedidos de
exclusão, estabelecer uma política operacional versionada que:

- calcula prazos a partir da revogação, pedido de exclusão ou encerramento
  aplicável, sem inferir que a ausência de dado elimina uma obrigação;
- exige um bloqueio jurídico documentado, com motivo controlado, titular,
  responsável, início, revisão e expiração, antes de conservar um dado além do
  prazo padrão;
- monta, para cada pedido elegível, targets explícitos `canonical`,
  `projection`, `backup` e `vendor`, e conserva somente recibos sem payload;
- permite marcar o pedido como `fulfilled` apenas se todos os targets forem
  eliminados ou retidos por bloqueio jurídico documentado; `pending` ou
  `failed` mantém a solicitação em revisão;
- produz evidência operacional de prazo, resultado e responsável, preservada
  com o pedido e a auditoria pelo período de cinco anos definido na ADR-042;
- mantém o agendador, storage de backup, fornecedores e mecanismo de execução
  como interfaces provider-neutral até decisões estratégicas específicas.

O responsável inicial pela política e por cada exceção é Mateus Alves Bassane,
com evidência `00001`. Isso não aprova um operador, subprocessador ou fornecedor
de produção.

## Alternativas consideradas

1. Concluir automaticamente depois do adapter canônico. Rejeitada: não cobre
   backups, projeções externas ou fornecedores.
2. Apagar tudo por um job sem registro de exceção. Rejeitada: impede demonstrar
   base de retenção e não preserva evidência mínima.
3. Escolher agora uma fila, agendador ou armazenamento de backup. Rejeitada:
   são decisões estratégicas abertas e exigem ADR própria.

## Riscos e critérios para aceite

- Compliance valida a classificação de bloqueio jurídico, prazos e evidência
  mínima.
- Security valida autorização, segregação e recibos sem payload.
- Operations define o ciclo, o owner executante, o RPO/RTO, a evidência de
  backup e o procedimento de falha/escalonamento.
- A implementação deve ter testes de prazo, falha segura, ownership, retenção
  de auditoria e todos os targets configurados; nenhum pedido pode ser
  declarado concluído por ausência de target.
