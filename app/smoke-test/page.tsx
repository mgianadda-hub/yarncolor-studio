// TEMPORANEO: pagina dello smoke test, da rimuovere dopo la verifica sul deploy di anteprima.
import { readDefaultPrompt } from "@/lib/prompt";
import SmokeTestClient from "./SmokeTestClient";

export const dynamic = "force-dynamic";

export default async function SmokeTestPage() {
  const prompt = await readDefaultPrompt();
  return (
    <main>
      <h1>Smoke test API</h1>
      <p className="muted">
        Pagina temporanea: esegue una chiamata reale a images/edits per ciascun modello selezionato
        (in parallelo, una immagine per modello) e mostra tempi, dimensioni e peso dei risultati.
      </p>
      <SmokeTestClient defaultPrompt={prompt} />
    </main>
  );
}
