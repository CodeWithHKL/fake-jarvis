import { Assistant } from "@/components/Assistant";
import { ThemeToggle } from "@/components/ThemeToggle";

export default function Home() {
  return (
    <div className="shell">
      <header className="header">
        <span className="wordmark">Jarvis</span>
        <ThemeToggle />
      </header>
      <main className="main">
        <Assistant />
      </main>
    </div>
  );
}
