# Status do APK `0.0.1-beta-stable`

**Status atual: APK debug construído com sucesso; beta estável ainda não declarado.**

O repositório contém uma casca Capacitor e workflow remoto. O workflow
`36007077005` concluiu com sucesso e produziu o APK debug abaixo:

- artefato: `glucora-apk-0.0.1-beta-stable-debug/app-debug.apk`
- tamanho: 4.168.093 bytes
- SHA-256: `51e10302de8fcd1ba1528ce7e13e29dcc18b37ec23e48122dfa90ae24020886f`
- execução: https://github.com/matalvesdev/glucora/actions/runs/36007077005

Este é um APK debug, sem assinatura de release e sem smoke test em dispositivo.

O próximo gate para criar o APK é escolher e registrar a casca Android, gerar
um build assinado de teste, executar smoke/E2E contra sandbox sintético e
publicar o checksum. Isso não autoriza beta clínico nem dados reais.

Na máquina atual não há Java, Gradle ou Android SDK/ADB detectáveis. O build
remoto funciona; o status permanece `DEBUG_BUILT_UNVERIFIED` até assinatura,
smoke/E2E em dispositivo ou emulador e checksum de release.
