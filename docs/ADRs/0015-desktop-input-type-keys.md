# ADR 0015 — Digitar / teclas no app em foco (fatia 1 da automação)

## Status

Aceito (2026-11-15)

## Contexto

O MVP já abria site/pasta/app (ADR 0005) e fazia chat/voz, mas a ideia central do JARVIS — **agir no PC** — quase não avançou. Douglas pediu automação após estabilizar voz.

Opções para “digite X no app em foco”:

| Opção | Prós | Contras |
|-------|------|---------|
| **A. Clipboard + Ctrl+V** (SendKeys só `^v`) | Unicode PT-BR seguro; texto do usuário **não** entra no SendKeys | Dependente do foco; mexe no clipboard por um instante |
| **B. SendKeys com o texto** | Simples | Escape frágil; risco com `+^%{}`; PT-BR ruim |
| **C. Lib nativa (nut.js / robotjs)** | Controle fino | ABI/Electron, packaging, manutenção |

## Decisão

1. **Digitar:** A — `clipboard.writeText` + PowerShell fixo com `SendKeys('^v')`. Restaura clipboard anterior (best-effort).
2. **Teclas:** allowlist **Enter / Tab / Esc** com scripts PowerShell **fixos** (sem interpolar input).
3. **Parsing PT-BR:** `digite|escreve …`, `pressiona|aperta|tecla enter|tab|esc`.
4. **Limites:** máx. 500 caracteres; rejeita `\0`; só **win32** nesta fatia.
5. **Router:** lane A `desktop_input`, depois Spotify e antes de open.
6. Sem RPA genérico, sem cliques por coordenada, sem atalhos arbitrários (`Ctrl+C`, etc.) nesta fatia.

## Consequências

- Primeiro passo concreto de automação testável (unit tests com driver mock).
- Risco residual: digita no **app/campo em foco** — o usuário precisa clicar no destino antes.
- PowerShell só com `-Command` de script fixo (`shell: false`); não reabre a porta de `exec` arbitrário do ADR 0005 para opens.
- Próximas fatias possíveis: atalhos allowlisted (**feito na ADR 0016**), clicar em UI Automation, confirmação para ações sensíveis.
