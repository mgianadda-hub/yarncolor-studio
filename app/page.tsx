import { LogOut } from "lucide-react";
import { readDefaultPrompt } from "@/lib/prompt";
import Logo from "./components/Logo";
import Generator from "./Generator";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const defaultPrompt = await readDefaultPrompt();
  return (
    <main className="page">
      <header className="app-header">
        <div className="brand">
          <Logo />
          <div>
            <h1>YarnColor Studio</h1>
            <p>Applica al gomitolo del master il colore del filato dell&apos;immagine destinazione.</p>
          </div>
        </div>
        <form action="/api/logout" method="post">
          <button type="submit" className="btn btn-outline">
            <LogOut size={18} aria-hidden="true" />
            Esci
          </button>
        </form>
      </header>
      <Generator defaultPrompt={defaultPrompt} />
    </main>
  );
}
