# Distribuição Windows — Elio

Guia para **instalar** (usuário) e **publicar** (Douglas). Relacionado: [ADR 0009](./ADRs/0009-windows-distribution.md).

## Instalar (usuário não técnico)

1. Baixe `Elio-<versão>-Setup.exe` em [Releases](https://github.com/Dsemedo/Elio/releases).
2. Abra o instalador. Se o Windows SmartScreen avisar (*Windows protegeu o PC*):
   - **Mais informações** → **Executar assim mesmo**  
   - (Some quando o instalador for assinado com certificado de código.)
3. Siga o assistente (pode escolher a pasta). Marque atalho na área de trabalho se quiser.
4. Ao terminar, o Elio abre. Use pelo atalho ou pelo menu Iniciar (**Elio**).

Atualizações: o app verifica sozinho (ao abrir e a cada ~4h). Quando baixar uma versão nova, avisa; **feche e abra** o Elio para instalar. Não força reinício.

## Gerar instalador local (dev / teste)

No Windows (PowerShell), na pasta do repo:

```powershell
git checkout main
git pull
npm install
npm run ensure:electron
npm run dist:win
```

Artefato: `dist\Elio-<versão>-Setup.exe`  
(`dist:win` **não** publica no GitHub.)

Smoke só da config (também no CI Linux):

```powershell
npm run check:builder
```

## Publicar release (Douglas)

1. Suba a `version` em `package.json` (ex.: `0.12.0` → `0.12.1`) e faça merge no `main`.
2. Crie um [Personal Access Token](https://github.com/settings/tokens) com escopo `repo` (repo privado).
3. No PowerShell **da máquina Windows** que vai gerar o `.exe`:

```powershell
$env:GH_TOKEN = "ghp_..."   # não commitar; sessão local só
# Opcional — assinatura (quando tiver certificado .pfx):
# $env:CSC_LINK = "C:\certs\elio-code-sign.pfx"
# $env:CSC_KEY_PASSWORD = "senha-do-pfx"
npm run release:win
```

4. Abra [Releases](https://github.com/Dsemedo/Elio/releases) — haverá um **draft** com o Setup + `latest.yml` (feed do updater).
5. Revise as notas, publique o draft (**Publish release**).
6. Confirme que o asset `Elio-*-Setup.exe` está **baixável sem login** (necessário para auto-update sem token no app). Em repo privado: nas opções do release, permita download público dos assets ou use release público.

Sem `GH_TOKEN`, `release:win` falha no passo de publish — use `dist:win` para só gerar o `.exe` local.

## Code signing (quando tiver certificado)

| Passo | Detalhe |
|-------|---------|
| Tipo | Mínimo **OV** Code Signing; **EV** reduz atrito SmartScreen mais rápido (OD-08). |
| Arquivo | `.pfx` / `.p12` (nunca no git). |
| Env | `CSC_LINK` = caminho do `.pfx` **ou** base64 do arquivo; `CSC_KEY_PASSWORD` = senha. Alternativa: `WIN_CSC_LINK`. |
| Build | Com as env setadas, `npm run release:win` assina sozinho. Sem elas, build unsigned continua OK (`forceCodeSigning: false`). |
| Updater | Depois de assinar: defina `publisherName` no `electron-builder.yml` (CN do certificado) e `VERIFY_UPDATE_SIGNATURE = true` em `src/main/services/updater/constants.ts`. |

## Desligar updater (debug)

```powershell
$env:ELIO_DISABLE_UPDATER = "1"
```

Só tem efeito no app **instalado** (packaged).
