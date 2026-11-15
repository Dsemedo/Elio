# ADR 0001 — Versão do Electron (Sprint 0)

## Status

Aceito (com ajuste de pin no npm)

## Contexto

OD-01 aprovou Electron **45.3.3** com fallback **44.11.3**. O Sprint 0 precisa de um pin instalável no npm para subir o shell desktop com `contextIsolation` e preload mínimo.

## Decisão

- Pin instalado: **`electron@45.3.2`** (tag `latest` / `45-x-y` no npm no momento do scaffold).
- Motivo do desvio: **`45.3.3` ainda não estava publicada** no registry npm.
- Fallback documentado permanece **44.11.3** se o major 45 falhar em build/runtime no Windows.

## Consequências

- Compatível com `electron-vite` 6.x e `electron-builder` 26.x.
- Ao publicar `45.3.3`, basta bumpar o pin e revalidar smoke Windows.
- STT Whisper continua fora deste ADR (subprocess `whisper-cli` — OD-02); sem binding nativo no Sprint 0.
- Stub de SQLite/drizzle adiado se bloquear “app abre”; não faz parte do aceite mínimo deste PR.
