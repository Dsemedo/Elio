# Elio

Assistente pessoal de IA para desktop (**JARVIS MVP** — Estágio 1).  
**v0.5.1** — Floating Bar UX: barra preenche a janela, voz primeiro, sem auto-hide no blur.

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
git checkout cursor/floating-bar-ux-740e
git pull
npm install
npm run ensure:electron
npm run dev
```

### O que Douglas deve ver

1. **Floating Bar** ~420×58 **sem moldura preta** externa — a janela é a própria barra  
2. Idle **voz primeiro**: “Segure o mic” + stub “Palavra de ativação · em breve” (sem “Pergunte ao Elio…”)  
3. Segurar mic → **Ouvindo…** / **Transcrevendo…** (accent teal); clique na área central para digitar  
4. Clicar em outro app: **barra permanece**; Command Center pode recolher. Ocultar barra só pelo menu → “Ocultar (bandeja)” ou bandeja  
5. Expandir → **Command Center** (Geist Sans, stubs “em breve”)  
6. Selo **v0.5.1**

Se ocultar de propósito: bandeja → **Mostrar Elio**.

### Comportamento de foco (mudança vs 0.5.0)

| Antes (0.5.0) | Agora (0.5.1) |
|---------------|---------------|
| Blur / outro app → escondia barra + painel | Blur → **só recolhe o painel**; **barra fica** |
| Voltar pela bandeja | Barra já no desktop; bandeja só se você ocultou |

Preferência futura `hideBarOnBlur` (opcional) pode voltar ao comportamento antigo; default = DS (barra acessível).

### Gaps vs DS completo

| No MVP (Fase 1) | Depois |
|-----------------|--------|
| Tokens, Geist, Lucide, barra, estados reais | Workspace full |
| Chat / voz / histórico | Atividades / Agentes / Memória reais |
| Stubs “em breve” | EXECUTING / approval (quando o Core tiver) |
| Barra always-on-top + bandeja | Atalho global (OD-20) |

## Segurança

`contextIsolation`, sem `nodeIntegration`, sandbox, Zod IPC. Sem rewrite do núcleo nesta fase.

## Licença

UNLICENSED — uso privado por enquanto.
