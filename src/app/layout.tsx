import type { Metadata, Viewport } from "next";
import { Anton, Geist, Geist_Mono, Yellowtail } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
// Display font (Anton), used only for the big "Jarvis" title on the landing page. It has a single weight.
const anton = Anton({ subsets: ["latin"], weight: "400", variable: "--font-display" });
// Signature-style script, used only for the "Hklx" credit at the bottom of the landing page.
const yellowtail = Yellowtail({ subsets: ["latin"], weight: "400", variable: "--font-signature" });

export const metadata: Metadata = {
  title: "Jarvis",
  description: "A press-to-talk voice assistant.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#000000" },
  ],
};

// Runs before the page paints so a saved light/dark choice never flashes the wrong theme.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script above may set data-theme before React loads
    <html lang="en" className={`${geist.variable} ${geistMono.variable} ${anton.variable} ${yellowtail.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
