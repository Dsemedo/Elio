# ADR 0003 — Shell: Floating Bar + Command Center

**Status:** aceito (atualizado 0.5.1)  
**Data:** 2026-11-15

## Contexto

OD-19 / DS v1.1: Floating Bar no topo, Command Center ao expandir. Feedback Douglas (v0.5.0): moldura preta externa, placeholder de texto como identidade, e auto-hide no blur.

## Decisão

1. Duas `BrowserWindow`: **bar** (frameless, `alwaysOnTop`, **420×58** preenchendo a janela) e **panel** (Command Center).
2. Mesmo renderer; superfície via `?surface=bar|panel`. Fundo da bar = transparente (sem chrome/padding preto).
3. Segurança inalterada: `contextIsolation`, sem `nodeIntegration`, `sandbox`, preload CJS, IPC com canais fixos + Zod.
4. **Perda de foco (default):** recolhe só o Command Center; **Floating Bar permanece** (`focusPolicy` → `keep-bar-hide-panel`). Preferência futura `hideBarOnBlur` pode esconder tudo.
5. Ocultar a barra: menu “Ocultar (bandeja)” ou ação explícita. Trazer de volta: **bandeja**. Atalho global = OD-20.
6. Idle voz-primeiro: mic PTT; stub “palavra de ativação · em breve”; campo de texto sob demanda (sem placeholder “Pergunte ao Elio…”).
7. Computador: snapshot via Node `os` — sem native addon.
8. Integrações Slack/Jira: “em breve”.

## Limitações (honestas)

- Detecção de foco no Windows é best-effort (polling + PowerShell) — usada sobretudo para recolher o painel.
- Sem atalho global até OD-20.
- CPU % é amostragem curta.

## Consequências

Douglas vê a barra sempre acessível no desktop; painel pode sumir ao focar outro app; bandeja cobre ocultação explícita.
