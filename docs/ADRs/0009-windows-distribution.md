# ADR 0009 — Distribuição Windows: NSIS + GitHub Releases (PJ-37)

## Status

Aceito (2026-11-15)

## Contexto

Precisamos de instalador para usuários não técnicos e auto-update antes de distribuir além do criador (D-008, OD-09). Code signing (OD-08) ainda sem certificado — não pode bloquear o MVP.

## Decisão

1. **Instalador:** electron-builder **NSIS** x64, wizard (`oneClick: false`), pasta escolhível, atalhos desktop/menu, install **per-user** (`perMachine: false`).
2. **Feed de update:** `electron-updater` → **GitHub Releases** (`Dsemedo/Elio`). Check no boot (+ ~8s) e a cada **4h**. Download automático; instalação no **quit** (não forçada).
3. **Assinatura:** `forceCodeSigning: false`. Se `CSC_LINK` / `CSC_KEY_PASSWORD` existirem, o builder assina; senão, build unsigned OK. Enquanto unsigned: `VERIFY_UPDATE_SIGNATURE = false` + no-op em `NsisUpdater.verifyUpdateCodeSignature` (API atual do electron-updater é função, não boolean).
4. **Publish:** `npm run release:win` com `GH_TOKEN` cria **draft** release; Douglas publica no GitHub. `npm run dist:win` nunca publica (`--publish never`).
5. **CI:** smoke `npm run check:builder` (valida YAML/scripts); sem NSIS signed no Linux.

## Consequências

- SmartScreen pode avisar em builds unsigned — aceitável para Douglas/testadores.
- Releases/assets precisam ser baixáveis sem token embutido no app (repo privado: liberar assets do Release ou tornar o release público).
- Quando houver cert OV/EV: assinar no `release:win`, setar `publisherName` + `VERIFY_UPDATE_SIGNATURE = true`.
