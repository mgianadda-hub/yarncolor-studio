import { LogOut } from "lucide-react";
import { readDefaultPrompt, readHexPrompt } from "@/lib/prompt";
import Logo from "./components/Logo";
import Generator from "./Generator";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [samplePrompt, hexPrompt] = await Promise.all([readDefaultPrompt(), readHexPrompt()]);
  return (
    <main className="page">
      <header className="app-header">
        <div className="brand">
          <Logo />
          <div>
            <h1>YarnColor Studio</h1>
            <p>Ricolora il gomitolo del master partendo da un campione di filato o da un codice colore.</p>
          </div>
        </div>
        <form action="/api/logout" method="post">
          <button type="submit" className="btn btn-outline" aria-label="Esci">
            <LogOut size={18} aria-hidden="true" />
            <span className="btn-label">Esci</span>
          </button>
        </form>
      </header>
      <Generator defaultPrompts={{ sample: samplePrompt, hex: hexPrompt }} />
    </main>
  );
}
