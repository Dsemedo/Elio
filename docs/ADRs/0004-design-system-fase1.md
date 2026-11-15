# ADR 0004 — Design System Fase 1 (v1.1 MVP-scoped)

**Status:** aceito  
**Data:** 2026-11-15

## Contexto

Douglas rejeitou o visual do shell Fatia A e aprovou o Design System. A **v1.1** restringe o MVP: Geist Sans, accent teal, thinking neutro, sem fingir agent/approval.

## Decisão

1. Tokens CSS conforme `docs/elio-design-system.md` v1.1.
2. Floating Bar 420×58: densidade input+voz; logo compacto; menu overflow.
3. Estados reais: idle / listening / transcribing / thinking (neutro) / error / offline.
4. Info roxo (`#A995ED`) só em badges de IA.
5. Command Center sidebar com stubs “em breve” (Atividades, Agentes, Memória).
6. Geist Sans (woff2 local); Lucide; motion 150–250 ms ease-out; focus ring; `prefers-reduced-motion`.
7. Não reescrever Electron nem AI core.

## Consequências

Fases 2–4 preenchem Workspace / ações no PC / TTS visual sem simular agora.
