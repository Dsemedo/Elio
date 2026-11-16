# ADR 0016 — Atalhos de teclado allowlisted (fatia 2 da automação)

## Status

Aceito (2026-11-15)

## Contexto

A fatia 1 (ADR 0015) digitava texto e pressionava Enter/Tab/Esc no app em foco. Douglas pediu continuar a automação. Atalhos do dia a dia (copiar, colar, salvar…) ainda faltavam; abrir atalhos arbitrários quebraria o princípio de allowlist.

## Decisão

1. Estender a allowlist de `press_key` com: **Ctrl+C / Ctrl+V / Ctrl+X / Ctrl+A / Ctrl+Z / Ctrl+S**.
2. Parsing PT-BR:
   - via verbo: `pressiona ctrl+c`, `aperta control v`, `tecla ctrl+s`
   - frases sozinhas: `copia`, `cola`, `seleciona tudo`, `desfaz`, `salva`, `recorta` (+ variantes)
3. Scripts PowerShell **fixos** (`^c`, `^v`, …) — sem interpolar input do usuário.
4. **Fora desta fatia:** Win+*, Alt+F4, Ctrl+W, Ctrl+Alt+Del, atalhos livres, cliques por coordenada.

## Consequências

- Demo mais útil: selecionar → copiar → colar / salvar / desfazer por voz.
- Risco residual: age no **app em foco** (igual à fatia 1).
- Próximas fatias possíveis: clicar via UI Automation; confirmação falada para ações sensíveis; comandos compostos de open (produto Fatia 1).
