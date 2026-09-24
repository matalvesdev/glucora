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
remoto funciona; o status permanece `DEBUG_BUILT_UNVERIFIED` até assinatura,
smoke/E2E em dispositivo ou emulador e checksum de release.
