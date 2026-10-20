# yarncolor-studio

Modifica colori Gomitoli: applica alla foto di un gomitolo (immagine **master**) il colore del filato
di un altro gomitolo (immagine **destinazione**) tramite l'endpoint di image edit di OpenAI.

App Next.js pensata per il deploy su Vercel (piano Hobby).

Le decisioni di progetto (parametri API, modelli, interfaccia, deploy) sono raccolte in [`CLAUDE.md`](CLAUDE.md).

## Configurazione

| File | Contenuto |
|---|---|
| `config/default-prompt.txt` | Prompt di default della modalità "Da campione" |
| `config/hex-prompt.txt` | Prompt di default della modalità "Da codice colore" (con `{TARGET_HEX}`) |
| `config/app.config.ts` | Modelli selezionabili, lato lungo dell'output (`outputLongSide`, 1504), qualità, formato JPEG e compressione, limiti di upload |

Variabili d'ambiente (vedi `.env.example`), da impostare su Vercel per **Production** e **Preview**:

- `OPENAI_API_KEY`: chiave OpenAI, usata solo lato server.
- `APP_PASSWORD`: password di accesso all'app. Cambiarla invalida le sessioni aperte.

## Parametri API

`POST /v1/images/edits` con `image: [master, destinazione]`, `quality: high`, `output_format: jpeg`,
`output_compression: 80`, `n: 1` (una chiamata per immagine), senza `input_fidelity`.

La `size` è proporzionale al master: lato lungo 1504 px, lato corto arrotondato al multiplo di 16 più vicino.
Limiti dei modelli: lati multipli di 16, rapporto massimo 3:1, massimo 3840×2160.

## Deploy su Vercel

- Framework Preset: **Next.js** (comandi di build predefiniti).
- Variabili `OPENAI_API_KEY` e `APP_PASSWORD` per Production e Preview.
- Ogni push su un branch crea un deploy di anteprima; il branch `main` va in produzione.
- Piano Hobby: le route di generazione hanno `maxDuration = 300` secondi.

## Funzionamento

Due modalità, selezionabili in alto:

- **Da campione**: master + immagine destinazione (dettaglio del filato). File: `<master>-<destinazione>.jpg`
  (con 3 immagini `-1`, `-2`, `-3`).
- **Da codice colore**: master + codice esadecimale (obbligatorio) e nome colore facoltativo, usato solo per il
  nome del file. Nel prompt `{TARGET_HEX}` viene sostituito lato server. Con 3 immagini si può variare la
  luminosità (OKLCH, default ±5%). File: `<master>_<HEX usato>[_<nome colore>].jpg` (con 3 immagini senza
  variazione `_1`, `_2`, `_3`).

Prompt di default modificabili solo per la generazione in corso, modello (default `gpt-image-2.5-sunburst`),
1 o 3 immagini (una chiamata per immagine, in parallelo). Dettagli completi in [`CLAUDE.md`](CLAUDE.md).

## Sviluppo

```bash
npm install
npm run dev
npm run typecheck
```
