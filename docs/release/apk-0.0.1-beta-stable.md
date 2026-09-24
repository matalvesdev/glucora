# Status do APK `0.0.1-beta-stable`

**Status atual: APK debug construído com sucesso; build release assinado e smoke em emulador preparados no CI, mas ainda aguardam uma execução validada do novo workflow e os secrets de assinatura. Beta estável ainda não declarado.**

O repositório contém uma casca Capacitor e workflow remoto. O workflow
`36015658808` concluiu com sucesso em 3m13s e produziu o APK debug abaixo:

- artefato: `glucora-apk-0.0.1-beta-stable-debug/app-debug.apk`
- o checksum verificado localmente foi `a1c42e553aff5e977376218f08f5c256540c1795d25f392bc4a92906f70a93b3`;
- execução: https://github.com/matalvesdev/glucora/actions/runs/36015658808

Este é um APK debug, sem assinatura de release. A execução citada ocorreu antes
da inclusão do job de smoke em emulador e não prova esse gate.
O workflow `.github/workflows/android-apk.yml` já contém o caminho de release:
quando os quatro GitHub Actions Secrets estiverem presentes, ele decodifica a
keystore no diretório temporário do runner, executa `assembleRelease` com
assinatura injetada por propriedades do Android Gradle Plugin, gera checksum e
publica o artefato `glucora-apk-0.0.1-beta-stable-release-signed`.

O workflow agora seleciona o mesmo APK candidato à promoção e o instala em um
emulador Android API 35. Sem secrets, testa o debug; com todos os secrets,
testa o release assinado. O script aguarda o boot, instala o APK, resolve e
abre a activity principal e confirma que o processo permanece vivo. Logs,
tipo do build e checksum são publicados como evidência por 14 dias.

O próximo gate é obter uma execução remota verde desse smoke e gerar um build
release assinado contra sandbox sintético. Isso não autoriza beta clínico nem
dados reais.

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
uma execução do novo smoke passar, os secrets existirem, o workflow gerar o
artefato release assinado e o checksum de release ser registrado. O smoke do
release assinado será executado automaticamente na mesma execução.
