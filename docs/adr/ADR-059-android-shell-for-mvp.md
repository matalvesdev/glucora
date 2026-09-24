# ADR-059: casca Android do MVP

Status: ACCEPTED

## Decisão

O MVP Android será empacotado com Capacitor sobre o bundle web existente,
mantendo a API Fastify e os contratos compartilhados. O primeiro artefato será
um APK de teste distribuído diretamente, sem publicação em loja, sem push,
deep links sensíveis ou armazenamento local de dados de saúde.

O APK só pode apontar para sandbox sintético até que os gates de produção e
privacidade estejam concluídos. A versão `0.0.1-beta-stable` só poderá ser
declarada após build reprodutível, assinatura, smoke/E2E em dispositivo ou
emulador e checksum publicado.

Aceita por Mateus Alves Bassane em 2026-09-24, evidência `00001`.
