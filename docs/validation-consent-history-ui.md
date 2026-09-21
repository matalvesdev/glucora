# Validação da interface de histórico de consentimentos

Escopo: G4, leitura responsiva do próprio histórico.

- A consulta só ocorre após sessão válida.
- Itens mostram finalidade, texto, versão, decisão e data.
- Resposta inválida ou falha usa estado seguro sem renderizar dados.
- Próxima página usa exclusivamente o cursor opaco da API.
- A tela não oferece grant/revoke sem finalidade aprovada.
- Playwright cobre renderização com dados sintéticos e ausência de sessão.

Validação: `pnpm check` e `pnpm test:e2e`.

Limite: finalidades e mutações reais continuam pendentes. ADR-038 está aceita.
