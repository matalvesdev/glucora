# Validação do artefato estruturado de exportação

Escopo: E5/G1, gerador interno com fixtures sintéticas.

- Somente pedido de exportação em revisão é aceito.
- Seções são explícitas e únicas; registros preservam tipo, versão e provenance.
- Registro cujo titular diverge do pedido interrompe toda a geração.
- JSON possui ordem determinística e checksum SHA-256.
- Nome do arquivo usa somente o id opaco da solicitação.

Validação: `pnpm check`.

Limite: persistência, criptografia, expiração, entrega, reautenticação e adapters reais continuam pendentes. ADR-033 permanece PROPOSED.
