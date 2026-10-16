import { readDefaultPrompt } from "@/lib/prompt";
import Generator from "./Generator";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const defaultPrompt = await readDefaultPrompt();
  return (
    <main>
      <header className="page-header">
        <div>
          <h1>YarnColor Studio</h1>
          <p className="muted" style={{ margin: 0 }}>
            Applica al gomitolo del master il colore del filato dell&apos;immagine destinazione.
          </p>
        </div>
        <form action="/api/logout" method="post">
          <button type="submit" className="secondary">Esci</button>
        </form>
      </header>
      <Generator defaultPrompt={defaultPrompt} />
    </main>
  );
}
