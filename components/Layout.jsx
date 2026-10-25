import Head from "next/head";
import Link from "next/link";
import { useRouter } from "next/router";

export default function Layout({ title, children, footer = true }) {
  const { pathname } = useRouter();
  const pageTitle = title ? `${title} · The Reading Room` : "The Reading Room — Chat with your PDFs";
  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>
      <header className="topbar">
        <div className="wrap">
          <Link href="/" className="brand">
            <b>The Reading Room</b>
            <span>Document RAG</span>
          </Link>
          <nav className="nav">
            <Link href="/" className={pathname === "/" ? "active" : ""}>Upload</Link>
            <Link href="/documents" className={pathname.startsWith("/documents") || pathname.startsWith("/chat") ? "active" : ""}>Library</Link>
          </nav>
        </div>
      </header>
      <main>{children}</main>
      {footer && (
        <footer className="footer">
          <div className="wrap">
            pdf-parse → 500-token chunks (50 overlap) → OpenAI text-embedding-3-small → pgvector → cosine top-5 → streamed answer with citations
          </div>
        </footer>
      )}
    </>
  );
}
