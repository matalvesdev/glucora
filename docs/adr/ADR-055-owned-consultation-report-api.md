# ADR-055: relatório determinístico de preparação de consulta do titular

Status: **ACCEPTED**

Aceita por Mateus Alves Bassane em 2026-09-23, com evidência `00001`.

## Contexto

A ADR-023 já preserva um snapshot imutável e auditável de um resumo
determinístico, mas esse recurso ainda não pode ser criado pelo titular. A
timeline própria autorizada pela ADR-053 oferece uma projeção reconstruível
dos fatos atuais necessários para compor esse resumo.

## Decisão

O titular autenticado poderá criar e consultar um relatório de preparação de
consulta para um período explícito, desde que sua conta esteja ativa, a
finalidade `self_care_health_data` esteja publicada e o consentimento esteja
vigente. A criação exige chave de idempotência, reconstrói a projeção antes da
composição e grava o snapshot, referências de versão e auditoria na mesma
transação do repositório de relatório.

O conteúdo exposto é somente descritivo: período, data de geração, contagens
por categoria e origem e limitações padronizadas. Não inclui valores de
medição, notas livres, diagnóstico, recomendação, alerta, interpretação,
exportação ou compartilhamento.

## Controles

- ownership e consentimento são avaliados antes de reconstruir ou persistir;
- período inválido, futuro ou superior ao instante de geração é rejeitado;
- respostas e telemetria não incluem fatos, valores ou referências de origem;
- retry com a mesma chave e conteúdo retorna o snapshot original; conteúdo
  incompatível retorna conflito;
- consultas do relatório são restritas ao próprio titular.

## Limites

Esta decisão não aprova perguntas ou notas livres, IA, exportação, download,
compartilhamento, acesso por profissional, retenção operacional adicional ou
beta.
