# ADR 0006 — Localização automática para clima (PJ-26)

## Status

Aceito (2026-11-15)

## Contexto

O default fixo **São Paulo** erra para o Douglas (Goiânia). Ele não quer formulário de cidade. Precisamos de localização automática com permissão do SO, cache local e fallback por IP.

## Decisão

| Item | Valor |
|------|--------|
| Gatilho | 1ª mensagem com intent de clima (Floating Bar / Command Center) |
| OS | `navigator.geolocation` no renderer (Chromium → Windows Location API) |
| Permissão Electron | `session.setPermissionRequestHandler` libera `geolocation` (o diálogo do Windows ainda pode aparecer) |
| Cache | `%APPDATA%\elio\elio-location.json` (lat/lon + nome da cidade + source) |
| Reverse geocode | Open-Meteo `/v1/reverse` (barato, sem key) → nome da cidade |
| Fallback | Se permissão negada/falha: `ipwho.is` no main → cache `source: ip` |
| Env override | `ELIO_WEATHER_LAT`+`LON` ou `ELIO_WEATHER_CITY` (prioridade máxima) |
| LLM | Só o **nome da cidade** no enrich; coords ficam no main / Open-Meteo |
| Histórico | Não grava lat/lon nas mensagens do chat |
| Último recurso | São Paulo (`source: fallback`) só se env/cache/IP falharem |

## Privacidade

- Permissão OS: o usuário pode negar no Windows.
- Fallback IP: o IP público é visível ao endpoint `ipwho.is` (como em qualquer site). Documentado no README.
- Nenhum provedor LLM cloud recebe coordenadas precisas — apenas cidade no system prompt de clima.

## Consequências

- Sem formulário de cidade na UI.
- Primeira pergunta de clima pode abrir diálogo de localização do Windows.
- Cache persiste entre sessões; revalidação só se o arquivo for apagado.
