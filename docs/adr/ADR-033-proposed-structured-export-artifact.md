# ADR-033: artefato estruturado de exportação

Status: PROPOSED

## Contexto e proposta

E5/G1 exigem exportação inteligível e estruturada sem dados de terceiros. Propõe-se um gerador JSON provider-neutral para pedidos `export` em revisão. Um plano explícito injeta adapters por seção; cada registro declara titular, tipo, versão e provenance. O gerador rejeita qualquer divergência de titular, seção duplicada ou registro duplicado e produz bytes determinísticos com SHA-256.

O arquivo usa nome derivado do id opaco da solicitação. Storage, criptografia em repouso, expiração, entrega, autenticação adicional e evidência de download permanecem fora deste boundary e exigem decisões aprovadas.

## Consequências

Adapters canônicos futuros podem gerar um artefato verificável sem acoplamento a storage. Este slice não persiste nem entrega o arquivo e não marca o pedido como fulfilled.
