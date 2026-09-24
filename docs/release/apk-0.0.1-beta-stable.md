# Status do APK `0.0.1-beta-stable`

**Status atual: APK debug construído com sucesso; beta estável ainda não declarado.**

O repositório contém uma casca Capacitor e workflow remoto. O workflow
`36007567364` concluiu com sucesso em 2m46s e produziu o APK debug abaixo:

- artefato: `glucora-apk-0.0.1-beta-stable-debug/app-debug.apk`
- o checksum verificado localmente foi `cb3bd85c42a0e1527678432c721112f44eaf7942bb43711f76b94bdfa49b9164`;
- execução: https://github.com/matalvesdev/glucora/actions/runs/36007567364

Este é um APK debug, sem assinatura de release e sem smoke test em dispositivo.

O próximo gate é gerar um build assinado de teste e executar smoke/E2E contra
sandbox sintético. Isso não autoriza beta clínico nem dados reais.

Para o build assinado, o workflow deverá receber a keystore e as senhas por
GitHub Actions Secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEYSTORE_PASSWORD` e `ANDROID_KEY_PASSWORD`). A chave privada não deve
ser criada no runner, commitada ou armazenada em artefatos.

Na máquina atual não há Java, Gradle ou Android SDK/ADB detectáveis. O build
remoto funciona; o status permanece `DEBUG_BUILT_UNVERIFIED` até assinatura,
smoke/E2E em dispositivo ou emulador e checksum de release.
