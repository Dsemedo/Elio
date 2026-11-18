# ADR 0003 — Shell: Floating Bar + Command Center

**Status:** aceito (atualizado 0.18.3)  
**Data:** 2026-11-15 · **Revisto:** 2026-11-18

## Contexto

OD-19 / DS v1.1: Floating Bar no topo, Command Center ao expandir.  
Feedback Douglas (v0.5.0): moldura preta externa, placeholder, auto-hide no blur.  
Feedback Douglas (2026-11-18): a barra **não** deve cobrir um programa em uso — só na área de trabalho; com app em foco, fica em segundo plano (bandeja).

## Decisão

1. Duas `BrowserWindow`: **bar** (frameless, `alwaysOnTop`, **420×58** preenchendo a janela) e **panel** (Command Center).
2. Mesmo renderer; superfície via `?surface=bar|panel`. Fundo da bar = transparente (sem chrome/padding preto).
3. Segurança inalterada: `contextIsolation`, sem `nodeIntegration`, `sandbox`, preload CJS, IPC com canais fixos + Zod.
4. **Foreground (default):**
   - **Área de trabalho** (HWND `Progman` / `WorkerW`) ou **próprio Elio** → Floating Bar visível (`showInactive`, sem roubar foco).
   - **Outro app** em primeiro plano → esconde barra + painel (`hiddenByFocus`); processo segue na **bandeja**.
   - Voltar à área de trabalho restaura a barra automaticamente.
5. Preferência interna `keepBarOverApps` (default off) restaura o legado: barra always-on-top sobre apps; só recolhe o Command Center.
6. Ocultar explícito: IPC/menu; trazer de volta: **bandeja** ou desktop. Atalho global = OD-20.
7. Idle voz-primeiro: mic PTT; stub “palavra de ativação · em breve”; campo de texto sob demanda.
8. Computador: snapshot via Node `os` — sem native addon.

## Limitações (honestas)

- Detecção no Windows é best-effort (polling ~700 ms + PowerShell/user32).
- Sem atalho global até OD-20 (bandeja / voltar ao desktop).
- Fullscreen exclusivo / UAC / Secure Desktop podem falhar a classificação.
- CPU % é amostragem curta.

## Consequências

Douglas vê a barra no desktop limpo; ao abrir Chrome/Edge/etc. o Elio some da frente e volta pela bandeja ou ao clicar na área de trabalho.
