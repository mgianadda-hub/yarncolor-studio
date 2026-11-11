# YarnColor Studio — decisioni di progetto

App Next.js (App Router, TypeScript) pubblicata su Vercel. Ricolora la foto di un gomitolo
(**immagine master**) tramite l'endpoint di image edit di OpenAI, in tre **modalità** (schede) alternative:

- **"Da campione"** (`mode: "sample"`, default): il colore viene dal filato di un'altra immagine
  (**immagine destinazione**, un dettaglio del filato).
- **"Da codice colore"** (`mode: "hex"`): il colore è un **codice esadecimale**; si invia solo il master.
- **"Multipack"** (`mode: "pack"`): fino a tre master fissi (Pack 2, 5, 10 pz) ricolorati con la stessa immagine
  destinazione; un'immagine per ogni master caricato.

L'app **non elabora le immagini**: le inoltra così come sono e mostra il risultato.

> **Tieni aggiornato questo file.** Ogni volta che con l'utente si prende una nuova decisione
> (parametri, comportamento, interfaccia, deploy), aggiorna la sezione relativa nello stesso commit della modifica.
> Le decisioni più recenti dell'utente prevalgono su quelle precedenti: in caso di dubbio, chiedi.

## Parametri API

- Endpoint: `POST /v1/images/edits` tramite l'SDK ufficiale `openai` (`client.images.edit`), in `lib/openai-edit.ts`.
- `image`:
  - "Da campione": sempre **[master, destinazione]**, in quest'ordine;
  - "Da codice colore": **solo [master]** (il server ignora un'eventuale destinazione);
  - "Multipack": **[master del pack, destinazione]**, in quest'ordine, una chiamata per ogni pack caricato.
- `quality: "high"`.
- Output: `output_format: "jpeg"`, `output_compression: 80`.
- `input_fidelity`: **non va passato** (la documentazione lo prevede solo per `gpt-image-1.5` e `1-mini`;
  per gpt-image-2 dice di ometterlo).
- `n: 1`: **una immagine per chiamata**. Scegliendo 3 immagini il browser fa **3 chiamate in parallelo**
  a `/api/generate`, tutte partendo dal master (e dalla destinazione, in modalità "Da campione").
- La route `/api/generate` restituisce il JPEG in binario (`image/jpeg`, header `X-Output-Size`),
  `maxDuration = 300` (limite del piano Hobby). Il client OpenAI non fa retry automatici (`maxRetries: 0`).
- Modelli, qualità, formato e dimensione proporzionale sono **gli stessi in tutte le modalità**.
- La route riceve il campo `mode` (`sample` | `hex` | `pack`; `pack` è trattato come `sample`: master + destinazione);
  in modalità `hex` anche `hex`, cioè l'esadecimale
  **di quella singola immagine** (con la variazione di luminosità ogni chiamata ha il suo). Il **nome colore non
  viene mai inviato** né al server né all'API.
- I valori stanno in `config/app.config.ts` (`quality`, `outputFormat`, `outputCompression`).

## Modelli

- Preselezionato: **`gpt-image-2.6-sunburst`** (decisione dell'utente, 11/11/2026: il default precedente era
  `gpt-image-2.5-sunburst`, si passa alla sua versione 2.6).
- Ordine nel selettore (con la nota mostrata accanto):
  1. `gpt-image-2.6-sunburst` — "default, più dettaglio"
  2. `gpt-image-2.6-flare` — "più veloce"
  3. `gpt-image-2.5-sunburst` — "versione precedente"
- `gpt-image-2` e `gpt-image-2.5-flare` sono stati **rimossi** dal selettore (la PR #9 aveva per errore
  `gpt-image-2.6-flare` come default e `gpt-image-2.5-flare` come versione precedente; corretto subito dopo).
- Definiti in `config/app.config.ts` (`models`, `defaultModel`); la route accetta solo questi.
- **Verifica dei modelli 2.6** (SDK `openai` 7.55.0 del 10/11/2026; il sito di documentazione OpenAI non è
  raggiungibile dall'ambiente di Claude): sono accettati da `images.edit`; `quality: "high"` e `output_format: "jpeg"`
  con `output_compression` valgono per tutti i modelli GPT Image; `input_fidelity` resta non passato. La **dimensione
  libera** (`WIDTHxHEIGHT`) è documentata solo per gpt-image-2 e 2.5, non esplicitamente per la 2.6 (fonti non ufficiali
  riportano gli stessi limiti): va confermata con una generazione reale. Per la 2.6 non esistono ancora snapshot con data.
  L'SDK del progetto resta alla 7.34.0 (il campo `model` accetta qualsiasi stringa).
- Smoke test reale precedente (anteprima Vercel, master 1536×1024 → 1504×1008): 2.5-sunburst ~30 s, 2.5-flare ~17 s,
  gpt-image-2 ~75 s; JPEG ~0,2 MB. Tempi della 2.6 non ancora misurati.

## Dimensione output

- Proporzionale al master: **lato lungo 1504 px** (`outputLongSide` in `config/app.config.ts`),
  lato corto proporzionale **arrotondato al multiplo di 16 più vicino**. Master quadrato → 1504×1504.
- Le dimensioni del master si leggono dall'intestazione del file (`image-size`), senza modificarlo;
  l'orientamento EXIF viene applicato come fa il browser.
- Limiti dei modelli (documentati per gpt-image-2 e 2.5; per la 2.6 da confermare, vedi "Modelli"): lati multipli
  di 16, rapporto massimo 3:1, massimo 3840×2160, oltre 2560×1440 la risoluzione è "experimental".
- Se il master supera i limiti (es. rapporto oltre 3:1) l'app mostra un **messaggio chiaro** e non genera.
- Logica in `lib/output-size.ts`, usata sia dal browser (per mostrare la size) sia dal server (che la ricalcola).

## Prompt

- Un prompt di default per modalità, **da non modificare senza richiesta esplicita dell'utente**:
  - "Da campione": **`config/default-prompt.txt`**;
  - "Da codice colore": **`config/hex-prompt.txt`** (caricato dall'utente);
  - "Multipack": **`config/pack-prompt.txt`** (caricato dall'utente, senza segnaposto).
- Nell'interfaccia il prompt della modalità attiva è in un campo di testo modificabile; le modifiche valgono
  **solo per la generazione in corso** (non vengono salvate) e ogni modalità conserva le sue.
  Il pulsante **"Ripristina"** compare quando il prompt è stato modificato.
- "Da codice colore": al momento dell'invio, **lato server**, ogni occorrenza di **`{TARGET_HEX}`** viene sostituita
  con l'esadecimale normalizzato (`lib/hex.ts`). Se il prompt non contiene `{TARGET_HEX}` l'app mostra un
  **avviso** e non invia (il pulsante Genera è disattivato; la route rifiuta comunque la richiesta).
  Nella textarea il segnaposto resta visibile, non sostituito.
- Limite OpenAI: 32.000 caratteri (controllato dalla route dopo la sostituzione).

## Input

- Formati: JPG, PNG, WebP. Peso massimo complessivo dei file inviati: **4 MB** (Vercel accetta richieste fino a ~4,5 MB).
- Gli input vanno direttamente alla route come multipart; nessun Vercel Blob.
- "Da codice colore":
  - **Codice esadecimale obbligatorio**: accetta 6 cifre con o senza `#` (spazi ai lati ignorati), normalizzato in
    **maiuscolo con `#`** (es. `1a2b3c` → `#1A2B3C`). Formati a 3 o 8 cifre non sono accettati.
    Validato nel browser e di nuovo nel server (`normalizeHex` in `lib/hex.ts`).
  - Color picker e anteprima del colore sincronizzati con il campo di testo.
  - **"Nome colore" facoltativo**: serve **solo** per il nome del file; non va mai nel prompt né all'API.

### Multipack

- Tre **spazi di caricamento fissi** per i master: **"Pack 2 pz"**, **"Pack 5 pz"**, **"Pack 10 pz"**
  (`packs` in `config/app.config.ts`: etichetta e tag `2pz`/`5pz`/`10pz`). Ognuno è **facoltativo**, ma serve
  **almeno un master**. Ogni spazio si può svuotare con la "×".
- Un'**immagine destinazione** (colore) obbligatoria, comune a tutti i pack, e il campo **"Nome colore"** facoltativo,
  usato **solo** per il nome dei file e **mai inviato** al server né all'API.
- **Generazione**: per ogni master caricato una chiamata a `/api/generate` (**in parallelo**) con
  `mode: "pack"` e immagini **[master, destinazione]**; ogni master produce **un'immagine** (`n: 1`).
  Il numero di immagini non si sceglie: è il numero di pack caricati.
- Dimensione proporzionale calcolata **su ciascun master** (ogni pack mostra "Verrà generata a W × H" o l'errore,
  es. rapporto oltre 3:1, che blocca la generazione).
- Limite di 4 MB verificato **per ogni chiamata** (master del pack + destinazione).
- Stato separato dalle altre schede (master, destinazione e nome colore propri).

### Variazione di luminosità ("Da codice colore", solo con 3 immagini)

- Con 3 immagini compare la casella **"Varia luminosità"** (disattivata all'inizio) con un campo percentuale,
  **default 5%** (`hexVariation` in `config/app.config.ts`: default 5, minimo 0,5, massimo 50).
- Se attiva, le 3 immagini usano nell'ordine: **(1) esadecimale −percentuale, (2) esadecimale impostato,
  (3) esadecimale +percentuale**.
- Calcolo in **OKLCH** (`lib/oklch.ts`): cambia solo la luminosità **L**, mantenendo tinta (h) e croma (C).
  La percentuale è in **punti di L** (L va da 0 a 1: 5% = −0,05 / +0,05). Se la variante con la stessa croma non
  esiste in sRGB, la croma viene ridotta al minimo indispensabile e l'interfaccia mostra una nota.
- **Colore troppo scuro o troppo chiaro**: se L − percentuale < 0 o L + percentuale > 1 (o se la variante non cambia
  esadecimale) l'app mostra un messaggio e **blocca la generazione** finché non si riduce/aumenta la percentuale o
  si disattiva la variazione.
- Le varianti si calcolano nel browser; il server riceve solo l'esadecimale di ogni chiamata e lo sostituisce a
  `{TARGET_HEX}` come sempre (validazione e sostituzione invariate).
- **Disattivata**: le 3 immagini usano tutte l'esadecimale impostato. **Con 1 immagine** si usa sempre l'esadecimale
  impostato (la casella non compare).

## File scaricati

Logica in `lib/filenames.ts`. I nomi originali sono usati senza estensione.

- **"Da campione"**: **`<nome master>-<nome destinazione>.jpg`**, es. `gomitolo_mohair-rosso.jpg`.
  Con 3 immagini si aggiunge **`-1`, `-2`, `-3`**: `gomitolo_mohair-rosso-1.jpg`, ecc.
- **"Da codice colore"**: **`<nome master>_<esadecimale usato senza #>_<nome colore>.jpg`**; senza nome colore
  **`<nome master>_<esadecimale usato senza #>.jpg`**. Es. `master_1A2B3C_navy.jpg`, `master_1A2B3C.jpg`.
  - Con la **variazione di luminosità** ogni file ha il **proprio esadecimale** (nessun suffisso):
    `master_0E1F2F_navy.jpg`, `master_1A2B3C_navy.jpg`, `master_263849_navy.jpg`.
  - Con **3 immagini e variazione disattivata** si aggiunge **`_1`, `_2`, `_3`** per evitare duplicati:
    `master_1A2B3C_navy_1.jpg`, ecc.
  - Nel nome colore spazi e caratteri speciali diventano trattini e gli accenti vengono tolti
    (`"Blu notte è"` → `Blu-notte-e`); le maiuscole restano come digitate.
- **"Multipack"**: **`<nome master>-<tag pack>-<nome colore>.jpg`**; senza nome colore **`<nome master>-<tag pack>.jpg`**,
  con tag `2pz` / `5pz` / `10pz` in base allo spazio di caricamento. Es. `gomitolo-5pz-navy.jpg`, `gomitolo-5pz.jpg`.
  - Se il nome del master **contiene già il tag** del pack (anche in maiuscolo o con separatore: `5pz`, `5PZ`,
    `5 pz`, `5_pz`) il tag **non viene ripetuto** (`gomitolo-5pz.png` → `gomitolo-5pz-navy.jpg`); una cifra prima
    indica un altro pack (`15pz` non contiene `5pz`).
  - Nome colore trattato come nelle altre schede (accenti tolti, spazi e caratteri speciali → trattini).
- Nomi e "Riprova" usano gli input dell'**ultima generazione**, anche se nel frattempo si cambia un file o il colore.

## Accesso e segreti

Accesso con **Google tramite AWS Cognito** (Hosted UI, **App Client pubblico con PKCE, senza client secret**).
Il login con password e `APP_PASSWORD` sono stati rimossi.

- **Dove è attivo**: ovunque tranne nei deploy di anteprima. Con `VERCEL_ENV=preview` l'autenticazione dell'app è
  **disattivata** (le anteprime sono protette da Vercel Deployment Protection): niente controllo, `/login` porta alla
  home e il pulsante "Esci" non compare. In produzione (e in caso di dubbio, es. variabile assente) è **attiva**;
  se manca la configurazione l'app resta chiusa ("configurazione incompleta"). Logica in `lib/auth/config.ts`.
- **Variabili d'ambiente** (Vercel, Production): `COGNITO_REGION`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`,
  `COGNITO_LOGIN_DOMAIN` (dominio della Hosted UI, con o senza `https://`), `COGNITO_ALLOWED_GROUP`, `AUTH_SECRET`.
  **`COGNITO_CLIENT_SECRET` non esiste e non va richiesta.** Il nome del gruppo si legge solo dalla variabile.
- **Librerie**: `openid-client` (PKCE, state, nonce, scambio del codice, verifica del token di identità inclusa la
  firma con le chiavi del pool) e `jose` (cookie cifrati).
- **Flusso** (tutto lato server):
  1. `/login`: pulsante **"Accedi con Google"** → `GET /api/auth/login`, che crea PKCE/state/nonce in un cookie
     temporaneo cifrato (`yc_login`, 10 minuti) e reindirizza a `/oauth2/authorize` della Hosted UI con
     `identity_provider=Google` e scope `openid email profile`. Il login riparte sempre dal dominio di produzione.
  2. `GET /api/auth/callback`: scambio del codice, verifica del token di identità, lettura di `cognito:groups`.
     Se l'utente è nel gruppo `COGNITO_ALLOWED_GROUP` crea la sessione e torna alla pagina richiesta; altrimenti
     `/login?error=unauthorized` con il messaggio "Accesso non autorizzato" e il pulsante
     "Esci e accedi con un altro account" (che chiude anche la sessione Cognito).
  3. **Sessione**: cookie `yc_session` HTTP-only, Secure, SameSite=Lax, cifrato (JWE A256GCM) con chiave derivata da
     `AUTH_SECRET`; contiene email, nome e gruppi (nessun token Cognito). **Durata 30 giorni**
     (`auth.sessionMaxAgeDays` in `config/app.config.ts`): uso interno, si privilegia la comodità. Cambiare
     `AUTH_SECRET` invalida tutte le sessioni; togliere un utente dal gruppo vale al login successivo (il proxy
     controlla comunque che la sessione contenga il gruppo configurato).
  4. **`proxy.ts`** protegge tutte le pagine (redirect a `/login?next=…`) e le API (401), tranne `/login`,
     `/api/auth/login`, `/api/auth/callback`, `/api/logout`.
  5. **Logout** (`POST /api/logout`): cancella i cookie e reindirizza a `/logout` di Cognito (`client_id`,
     `logout_uri`), che chiude la sessione Cognito e torna a `/login`. La sessione Google del browser resta aperta.
- **Indirizzi registrati nell'App Client Cognito** (basati su `auth.productionUrl` = `https://yarncolor-studio.vercel.app`
  in `config/app.config.ts`):
  - Callback URL: `https://yarncolor-studio.vercel.app/api/auth/callback`
  - Sign-out URL: `https://yarncolor-studio.vercel.app/login`
  - App Client: pubblico (senza secret), grant "Authorization code", scope `openid` `email` `profile`,
    identity provider Google.
- **Nuovi utenti**: un utente Google viene creato nel pool al primo login (che risulta "non autorizzato"); va poi
  aggiunto al gruppo dalla console Cognito e al login successivo entra.
- La pagina di login usa il logo "G" di Google nei colori ufficiali (`app/components/GoogleIcon.tsx`): unica eccezione
  alla regola dei token di colore, richiesta dalle linee guida di Google.
- **`OPENAI_API_KEY`** resta **solo lato server** (mai esposta al browser).

## Deploy e verifiche

- **Vercel, piano Hobby** per ora. `OPENAI_API_KEY` per Production e Preview; variabili Cognito e `AUTH_SECRET`
  per Production.
- `main` va in produzione; ogni push su altro branch crea un deploy di anteprima.
- Si lavora su un branch e si apre una pull request verso `main`; il merge lo fa l'utente.
- **L'utente non esegue nulla in locale.** Claude, prima di ogni push, esegue typecheck, build e test
  dell'interfaccia con Playwright contro un **server OpenAI simulato** (`OPENAI_BASE_URL` verso un mock locale).
  Le **chiamate reali a OpenAI si verificano sui deploy di anteprima** Vercel.
- Autenticazione: Claude la prova con un **Cognito simulato** (authorize, token con controllo PKCE e assenza di
  client secret, JWKS, logout) dietro un proxy HTTPS locale che simula i domini reali. Poiché le anteprime non hanno
  autenticazione, il **login reale con Cognito si verifica direttamente in produzione** dopo il merge (scelta
  dell'utente); se non funziona si annulla il merge. Il primo accesso reale in produzione è stato
  **verificato dall'utente il 25/10/2026** (PR #6).

## Interfaccia

Stile definito a partire dalle immagini di riferimento fornite dall'utente (una per 1 immagine, una per 3 immagini).
Le modifiche future devono restare coerenti con quanto segue.

### Struttura della pagina (dall'alto)

1. **Intestazione**: logo a gomitolo (`app/components/Logo.tsx`) + titolo "YarnColor Studio" in serif +
   sottotitolo; a destra il pulsante "Esci" con icona (su schermi piccoli solo icona; nascosto nelle anteprime,
   dove l'autenticazione è disattivata).
2. **Selettore di modalità** (`ModeSwitch.tsx`): tre opzioni affiancate "Da campione" (Master + foto del filato),
   "Da codice colore" (Master + codice esadecimale) e "Multipack" (Pack 2/5/10 pz + foto del filato), con icona in
   cerchio; quella attiva ha sfondo accento tenue e icona piena. Sotto i 520 px restano solo le etichette, centrate
   (senza icone). Disattivato durante la generazione.
3. **Due card affiancate** (una sotto l'altra sotto i 1080 px): "1 Immagine master" e, a seconda della modalità,
   "2 Immagine destinazione" oppure "2 Colore di destinazione", con badge numerato. Dentro: a sinistra l'anteprima grande in un riquadro tratteggiato; a destra il pulsante
   "Scegli file / o trascina un'immagine qui", nome e peso del file, per il master le "Dimensioni master" e un
   riquadro evidenziato (colore accento tenue) "L'immagine generata avrà dimensioni W × H"
   o il messaggio d'errore. Si può trascinare un file sulla card o cliccare l'anteprima.
   - "Colore di destinazione" (`ColorCard.tsx`): a sinistra un riquadro grande riempito con il colore e una
     pillola con l'esadecimale (tratteggiato con "Nessun colore" se vuoto); a destra il campo "Codice esadecimale *"
     in monospace con accanto il pulsante color picker (bordo arcobaleno con pallino del colore), messaggio di
     validazione, poi "Nome colore (facoltativo)" con la nota "Serve solo per il nome del file…" e l'elenco dei
     nomi file che verranno salvati. Con la variazione di luminosità attiva il riquadro si divide in **tre bande**
     affiancate (−%, impostato, +%) ciascuna con la pillola dell'esadecimale.
   - **"Multipack"**: le card occupano **tutta la larghezza**, una sotto l'altra. "1 Immagini master"
     (`PackCard.tsx`) con **tre spazi affiancati** (uno sotto l'altro su schermi stretti): pillola con l'etichetta del
     pack (piena quando c'è un'immagine), "×" per svuotare, anteprima tratteggiata ("Facoltativo" se vuota),
     "Scegli file / Sostituisci" con trascinamento, nome, peso e dimensioni del file e "Verrà generata a W × H".
     Poi "2 Colore destinazione" (`UploadCard` con anteprima limitata a 320 px di altezza) con il campo
     "Nome colore (facoltativo)", la nota e l'elenco dei nomi file.
4. **Card "Prompt" + "Impostazioni"** affiancati (prompt ~1,6/2,6 della larghezza, separatore verticale):
   - Prompt: icona matita, nota "Le modifiche valgono solo per questa sessione…", textarea monospace,
     sotto "Prompt di default / modificato (modalità) · N caratteri" e, in "Da codice colore",
     "`{TARGET_HEX}` sarà sostituito con #…"; pulsante "Ripristina" nell'intestazione. Se manca `{TARGET_HEX}`,
     riquadro di avviso rosso tenue sotto la textarea.
   - Impostazioni: icona ingranaggio; select "Modello" con icona scintille; "Numero di immagini" come due pulsanti
     radio affiancati ("1 immagine" / "3 immagini", quello attivo con bordo e sfondo accento tenue);
     in "Da codice colore" con 3 immagini, riquadro **"Varia luminosità"** (`HexVariation.tsx`: casella, campo %,
     tre campioni affiancati con esadecimale ed etichetta "1 · −5%", "2 · impostato", "3 · +5%", avviso rosso se il
     colore è troppo chiaro/scuro, nota se la saturazione è stata ridotta; sfondo accento tenue quando attivo);
     pulsante grande arrotondato "Genera immagine" / "Genera 3 immagini" (icona scintille + freccia);
     sotto, cosa manca o il peso degli input. In "Multipack" al posto della scelta 1/3 c'è il riquadro
     "Una per ogni pack caricato: N", il pulsante dice "Genera N immagini" e sotto compare il peso per chiamata.
5. **Card "Risultato"**:
   - Vuota: messaggio "i risultati compariranno qui".
   - **1 immagine**: anteprima grande a sinistra con lente in alto a destra; a destra pannello
     "Dettagli immagine" (Dimensioni, Dimensione file, Modello, Colore con pallino solo in "Da codice colore",
     Generata il) e pulsante "Scarica immagine";
     nell'intestazione pillola verde "Generata in N secondi".
   - **3 immagini**: tre riquadri affiancati "Immagine 1/2/3" con lente, immagine, sotto l'immagine (solo in
     "Da codice colore") l'**esadecimale usato** con pallino e, con la variazione, l'etichetta "−5%/impostato/+5%";
     poi "Generata in N s" e pulsante "Scarica"; nell'intestazione pillola "N di 3 pronte".
   - **"Multipack"**: sempre **tre riquadri fissi "Pack 2 pz / 5 pz / 10 pz"**, allineati agli spazi di caricamento;
     il riquadro di un pack senza master è tratteggiato con "Nessun master caricato". Ogni pack ha il proprio stato
     (attesa, errore con "Riprova", risultato con "Scarica"); pillola "N di M pronte"; lo zoom mostra il nome del pack.
   - In attesa: rotellina e secondi trascorsi. In errore: riquadro rosso tenue con messaggio e "Riprova".
   - La lente apre lo **zoom a schermo intero** (`Lightbox.tsx`) con "Scarica"; si chiude con Esc o clic fuori.

### Colori (token in `app/globals.css`)

Palette calda, neutra con accento marrone-cuoio:
- Sfondo pagina `#f7f3ee` con leggere sfumature radiali; card bianche `#ffffff`, superfici secondarie `#faf7f3`.
- Testo `#2b211b`, testo secondario `#7b6f66`, bordi `#ebe3d9` / `#ddd2c5`.
- Accento `#8a4a2b` (hover `#743c22`), accento tenue `#fbece1` / `#f6dfcf`, verde stato `#2f9e5b`,
  errore `#b42318` su `#fdecea`.
- Tema scuro automatico (`prefers-color-scheme: dark`) con gli stessi token ridefiniti.
- Usare sempre i token CSS (`var(--accent)` ecc.), mai colori sparsi nei componenti.

### Tipografia

- Titoli del marchio (logo, login): **Fraunces** (serif), via `next/font/google`.
- Testo e interfaccia: **Inter**; titoli delle card in grassetto ~1,1 rem; testi secondari in grigio caldo.
- Prompt in font monospace.

### Componenti e forme

- Card con angoli arrotondati (18 px), bordo sottile e ombra morbida; elementi interni con raggio 12 px.
- Icone **lucide-react** (stile lineare); icone di sezione in cerchi color accento tenue; step numerati in
  cerchi pieni color accento.
- Pulsanti: primario pieno accento; secondario con bordo; "tenue" (sfondo accento chiaro) per
  "Scarica immagine"; pulsante "Genera" a pillola.
- Componenti: `app/Generator.tsx` (stato e logica), `app/components/ModeSwitch.tsx`,
  `app/components/UploadCard.tsx`, `app/components/PackCard.tsx`, `app/components/ColorCard.tsx`,
  `app/components/HexVariation.tsx`,
  `app/components/ResultsSection.tsx`,
  `app/components/Lightbox.tsx`, `app/components/Logo.tsx`.
- Pagina di login nello stesso stile (logo, titolo serif, card centrata) con il solo pulsante
  "Accedi con Google" (bordo, logo "G"); in caso di errore, riquadro rosso tenue con il messaggio sopra il pulsante.

### Smartphone

Verificato a 320 px (iPhone SE), 412 px (Pixel 7) e 768 px (iPad Mini):
- tutto in una colonna, nessuno scorrimento orizzontale (griglie con `minmax(0, 1fr)`);
- campi di testo e select a **16 px** su touch/schermi stretti, per evitare lo zoom automatico di iOS;
- pulsanti con area di tocco ≥ 36 px; testi brevi dei pulsanti senza a capo;
- sotto i 600 px il sottotitolo dell'intestazione è nascosto e "Esci" mostra solo l'icona;
- sotto i 400 px margini e padding ridotti.
Le regole responsive stanno **in fondo** a `globals.css`, così sovrascrivono quelle base.

## Struttura del codice

| Percorso | Contenuto |
|---|---|
| `config/app.config.ts` | Modelli, `outputLongSide`, limiti di size, qualità, formato, compressione, limiti upload, `hexVariation`, `packs`, `auth` |
| `config/default-prompt.txt` | Prompt di default "Da campione" (non modificare senza richiesta) |
| `config/hex-prompt.txt` | Prompt di default "Da codice colore" con `{TARGET_HEX}` (non modificare senza richiesta) |
| `config/pack-prompt.txt` | Prompt di default "Multipack" (non modificare senza richiesta) |
| `lib/hex.ts` | Validazione/normalizzazione dell'esadecimale e sostituzione di `{TARGET_HEX}` |
| `lib/oklch.ts` | Conversioni sRGB ⇄ OKLCH e varianti di luminosità |
| `lib/filenames.ts` | Nomi dei file scaricati per le tre modalità |
| `lib/openai-edit.ts` | Chiamata a `images.edit` e traduzione degli errori |
| `lib/output-size.ts` | Lettura dimensioni master e calcolo della size di output |
| `lib/upload.ts` | Validazione input, formattazione pesi |
| `lib/auth/config.ts` | Attivazione (produzione/anteprime), variabili Cognito, URL di callback/logout |
| `lib/auth/session.ts` | Cookie cifrati di sessione e del login in corso |
| `lib/auth/oidc.ts` | Client OpenID Connect per Cognito (PKCE, verifica del token, gruppi) |
| `proxy.ts`, `app/login`, `app/api/auth/login`, `app/api/auth/callback`, `app/api/logout` | Accesso con Google/Cognito |
| `lib/prompt.ts` | Lettura dei tre prompt di default |
| `app/api/generate/route.ts` | Generazione di una immagine (tutte le modalità) |
| `app/page.tsx`, `app/Generator.tsx`, `app/components/*` | Interfaccia |
