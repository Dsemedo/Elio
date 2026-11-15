# ADR 0003 — Shell: barrinha overlay + painel

**Status:** aceito (Fatia A)  
**Data:** 2026-11-15

## Contexto

OD-19 define a direção de produto: barrinha flutuante no topo (~20% da largura), some com outro app em foco, painel completo ao clicar. OD-20 (atalho global) ainda está aberto.

## Decisão

1. Duas `BrowserWindow`: **bar** (frameless, `alwaysOnTop`, ~20% largura, centralizada) e **panel** (janela completa com nav).
2. Mesmo renderer; superfície via `?surface=bar|panel`.
3. Segurança inalterada: `contextIsolation`, sem `nodeIntegration`, `sandbox`, preload CJS, IPC com canais fixos + Zod.
4. Esconder ao perder foco: best-effort (blur + debounce; no Windows, polling do HWND via PowerShell/user32).
5. Trazer de volta: **ícone na bandeja** (“Mostrar Elio”). Atalho global fica para OD-20.
6. Computador: snapshot via Node `os` (memória/CPU aproximada) — sem native addon e sem ranking de processos.
7. Integrações Slack/Jira: cards “em breve” (sem OAuth neste pedaço).

## Limitações (honestas)

- Detecção de foco no Windows não é perfeita (polling ~700 ms; PowerShell pode falhar; fullscreen exclusivo / UAC).
- Fora do Windows, só blur/focus das janelas do Elio.
- Sem atalho global até OD-20.
- CPU % é amostragem curta, não perfilamento profundo.
- Apps/pastas via Ollama continuam fora de escopo.

## Consequências

Douglas vê a barrinha + painel com Conversar (chat/voz), Histórico, Integrações (stubs) e Computador (básico). Bandeja cobre o “como volto” até o atalho.
