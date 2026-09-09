# Validação — solicitações de privacidade

- Máquina de estados rejeita fulfillment direto sem revisão e impede reabertura de estado terminal.
- Estado usa versionamento; eventos são append-only e carregam apenas reason codes.
- Tipos suportados cobrem acesso, exportação e exclusão com escopo integral do próprio usuário.
- Prazos, verificação e conclusão não são inferidos sem política aprovada.
