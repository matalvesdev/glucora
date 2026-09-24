# Status do APK `0.0.1-beta-stable`

**Status atual: APK debug construído com sucesso; build release assinado preparado no CI, mas ainda bloqueado pela ausência dos secrets de assinatura. Beta estável ainda não declarado.**

O repositório contém uma casca Capacitor e workflow remoto. O workflow
`36007567364` concluiu com sucesso em 2m46s e produziu o APK debug abaixo:

- artefato: `glucora-apk-0.0.1-beta-stable-debug/app-debug.apk`
- o checksum verificado localmente foi `cb3bd85c42a0e1527678432c721112f44eaf7942bb43711f76b94bdfa49b9164`;
- execução: https://github.com/matalvesdev/glucora/actions/runs/36007567364

Este é um APK debug, sem assinatura de release e sem smoke test em dispositivo.
O workflow `.github/workflows/android-apk.yml` já contém o caminho de release:
quando os quatro GitHub Actions Secrets estiverem presentes, ele decodifica a
keystore no diretório temporário do runner, executa `assembleRelease` com
assinatura injetada por propriedades do Android Gradle Plugin, gera checksum e
publica o artefato `glucora-apk-0.0.1-beta-stable-release-signed`.

O próximo gate é gerar um build assinado de teste e executar smoke/E2E contra
sandbox sintético. Isso não autoriza beta clínico nem dados reais.

Para o build assinado, o workflow deve receber a keystore e as senhas por
GitHub Actions Secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEY_ALIAS`,
`ANDROID_KEYSTORE_PASSWORD` e `ANDROID_KEY_PASSWORD`). A chave privada não deve
ser criada no runner, commitada ou armazenada em artefatos. Enquanto qualquer
um desses secrets estiver ausente, o workflow publica apenas o APK debug e
registra que a assinatura de release foi pulada.

Procedimento do responsável, em uma máquina segura com Java:

```powershell
keytool -genkeypair -v -keystore glucora-release.keystore -alias glucora -keyalg RSA -keysize 4096 -validity 10000
$b64 = [Convert]::ToBase64String([IO.File]::ReadAllBytes('.\glucora-release.keystore'))
$b64 | gh secret set ANDROID_KEYSTORE_BASE64
'glucora' | gh secret set ANDROID_KEY_ALIAS
'<senha-da-keystore>' | gh secret set ANDROID_KEYSTORE_PASSWORD
'<senha-da-chave>' | gh secret set ANDROID_KEY_PASSWORD
```

O arquivo `.keystore` deve permanecer fora do repositório e ser guardado com
backup seguro. A rotação da chave exige uma decisão de release separada.

Na máquina atual não há Java, Gradle ou Android SDK/ADB detectáveis. O build
remoto funciona; o status permanece `DEBUG_BUILT_UNSIGNED_RELEASE_PENDING` até
os secrets existirem, o workflow gerar o artefato release assinado, o checksum
de release ser registrado e smoke/E2E em dispositivo ou emulador passar.
