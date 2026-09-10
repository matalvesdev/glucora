# ADR-036: interface condicionada de privacidade e suporte

Status: ACCEPTED

## Contexto e proposta

G1/G3/G7/H5 já possuem rotas condicionadas, enquanto a interface ainda declarava todos os controles indisponíveis. Propõe-se verificar `/v1/me` antes de renderizar formulários. Uma conta autenticada pode enviar pedido de acesso, exportação ou exclusão e suporte por categoria controlada, além de consultar os próprios pedidos já registrados. Sem sessão, nenhum formulário é exibido.

Respostas são validadas com os schemas compartilhados. O browser envia apenas tipo/categoria e chave de idempotência; titular, estado, ids e auditoria permanecem no servidor. Não existe campo livre, upload ou dado de saúde nesta superfície.

## Consequências

A UI passa a refletir a disponibilidade real das APIs sem simular login. Histórico detalhado, consentimentos reais, autenticação de produção e operação de suporte continuam dependentes dos gates aplicáveis.
