import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google';
import Link from 'next/link';
import './globals.css';

const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--f-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], variable: '--f-mono' });

export const metadata = {
  title: 'Garimpo · Mineração de Produtos',
  description: 'Produtos em alta na Amazon US para importar da China e vender via FBA',
  robots: { index: false, follow: false },
};

export default function Layout({ children }) {
  return (
    <html lang="pt-BR" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <header className="topo">
          <Link href="/" className="marca">
            <span className="marca-ponto" aria-hidden /> Garimpo
          </Link>
          <nav>
            <span className="topo-tag">Amazon US</span>
            <span className="topo-tag apagado" title="Fase 2">TikTok Shop · em breve</span>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
