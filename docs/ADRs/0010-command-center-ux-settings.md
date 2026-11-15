# ADR 0010 — Command Center UX + settings de IA na UI

**Data:** 2026-11-15  
**Status:** Aceito  
**Versão:** 0.13.0

## Contexto

O painel já tinha chat e histórico, mas trocar de conversa exigia a aba Histórico; o header do chat tinha muitos badges; OpenRouter só via `OPENROUTER_API_KEY` no terminal.

## Decisão

1. Lista de threads ao lado do chat no Command Center.  
2. Header do chat: título + Nova + status discreto.  
3. Histórico com busca por título, renomear e confirmação ao excluir.  
4. Preferências em `%APPDATA%/elio/elio-settings.json` (host/modelo Ollama, modelo OpenRouter, cidade do clima).  
5. Chave OpenRouter no cofre `safeStorage` (`secrets/openrouter-key.bin`), mesmo padrão do Spotify — env continua com prioridade se definido.  
6. Stubs “em breve” agrupados no rodapé da sidebar.

## Consequências

- Configurar fallback de nuvem sem editar terminal.  
- Sem secrets no JSON de settings nem nas respostas IPC (só booleans de status).  
- STT / Windows Speech / TTS / browser tab ficam fora deste ADR.
