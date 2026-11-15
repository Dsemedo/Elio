# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP** — Estágio 1).  
**v0.5.0** — Design System **v1.1 (MVP-scoped)**: Floating Bar + Command Center.

Spec: [`docs/elio-design-system.md`](./docs/elio-design-system.md)

## Requisitos

- **Windows 10/11 (x64)**  
- **Node.js 22.12+**  
- Microfone (voz)  
- Internet só na 1ª vez da voz (~80 MB Whisper)  
- (Opcional) [Ollama](https://ollama.com) com um modelo

## Como rodar (Windows)

Pasta: `C:\Users\Douglas\Elio`

```powershell
git restore package-lock.json
git fetch
git checkout cursor/design-system-fase1-e0f1
git pull
npm install
npm run ensure:electron
npm run dev
```

### O que Douglas deve ver

1. **Floating Bar** grafite translúcida (~420×58, radius 18): logo compacto + campo + mic + expand + menu  
2. Digitar e **Enter** envia sem abrir o painel → estado **Pensando…** neutro (não roxo)  
3. Segurar mic → **Ouvindo…** / **Transcrevendo…** (accent teal)  
4. Expandir → **Command Center** (Geist Sans, sidebar: Início, Conversas, Atividades, Agentes, Memória, Configurações)  
5. Atividades / Agentes / Memória = **em breve** (honestos)  
6. Selo **v0.5.0**

Se sumir: bandeja → **Mostrar Elio**.

### Gaps vs DS completo

| No MVP (Fase 1) | Depois |
|-----------------|--------|
| Tokens, Geist, Lucide, barra, estados reais | Workspace full |
| Chat / voz / histórico | Atividades / Agentes / Memória reais |
| Stubs “em breve” | EXECUTING / approval (quando o Core tiver) |
| Hide por foco + bandeja | Atalho global (OD-20) |

## Segurança

`contextIsolation`, sem `nodeIntegration`, sandbox, Zod IPC. Sem rewrite do núcleo nesta fase.

## Licença

UNLICENSED — uso privado por enquanto.
