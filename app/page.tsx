export default function HomePage() {
  return (
    <main>
      <h1>YarnColor Studio</h1>
      <p className="muted">
        L&apos;interfaccia di generazione è in sviluppo. Per ora è disponibile lo{" "}
        <a href="/smoke-test">smoke test delle API</a> (temporaneo).
      </p>
      <form action="/api/logout" method="post">
        <button type="submit" className="secondary">Esci</button>
      </form>
    </main>
  );
}
