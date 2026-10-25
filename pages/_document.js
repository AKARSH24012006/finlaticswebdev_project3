import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;1,9..144,500&family=IBM+Plex+Mono:wght@400;600&family=Public+Sans:wght@400;600&display=swap"
          rel="stylesheet"
        />
        <meta name="description" content="Upload a PDF and chat with it — RAG with OpenAI embeddings, pgvector cosine search and streamed, cited answers." />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='7' fill='%23b4472b'/><text x='16' y='22' font-size='17' text-anchor='middle' fill='white' font-family='Georgia'>R</text></svg>" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
