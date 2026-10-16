# yarncolor-studio

Modifica colori Gomitoli: applica alla foto di un gomitolo (immagine **master**) il colore del filato
di un altro gomitolo (immagine **destinazione**) tramite l'endpoint di image edit di OpenAI.

App Next.js pensata per il deploy su Vercel (piano Hobby).

## Configurazione

| File | Contenuto |
|---|---|
| `config/default-prompt.txt` | Prompt di default, caricato nel campo di testo dell'app |
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

1. Carica l'immagine master e l'immagine destinazione (JPG, PNG o WebP, massimo 4 MB in totale).
   L'app mostra la dimensione con cui verrà generata l'immagine.
2. Il prompt di default è precompilato e modificabile; le modifiche valgono solo per la generazione in corso.
3. Scegli il modello (default `gpt-image-2.5-sunburst`) e 1 o 3 immagini: ogni immagine è una chiamata separata
   che parte sempre da master e destinazione.
4. Ogni risultato si scarica come `<nome master>-<nome destinazione>.jpg`; con 3 immagini si aggiunge
   `-1`, `-2`, `-3` (es. `gomitolo_mohair-rosso-2.jpg`).

## Sviluppo

```bash
npm install
npm run dev
npm run typecheck
```
