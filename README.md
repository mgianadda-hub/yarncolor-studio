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

## Smoke test (temporaneo)

`/smoke-test` esegue una chiamata reale per ciascun modello e mostra tempi, size e peso dei risultati.
Va rimosso (`app/smoke-test`, `app/api/smoke-test`) dopo la verifica sul deploy di anteprima.

## Sviluppo

```bash
npm install
npm run dev
npm run typecheck
```
