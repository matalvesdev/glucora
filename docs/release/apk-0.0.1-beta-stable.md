# Status do APK `0.0.1-beta-stable`

**Status atual: build configurado, artefato ainda não construído.**

O repositório agora contém uma casca Capacitor e workflow remoto para gerar o
projeto Android. Ainda não há `.apk`, keystore, checksum de release ou
evidência de estabilidade para declarar.

O próximo gate para criar o APK é escolher e registrar a casca Android, gerar
um build assinado de teste, executar smoke/E2E contra sandbox sintético e
publicar o checksum. Isso não autoriza beta clínico nem dados reais.

Na máquina atual não há Java, Gradle ou Android SDK/ADB detectáveis. O build
remoto do GitHub Actions ainda precisa ser executado; o status permanece
`CONFIGURED_NOT_BUILT`.
