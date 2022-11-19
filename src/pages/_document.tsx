import Document, {
  DocumentContext,
  Html,
  Head,
  Main,
  NextScript,
} from "next/document";

export default class MyDocument extends Document {
  static async getInitialProps(ctx: DocumentContext) {
    const initialProps = await Document.getInitialProps(ctx);
    return { ...initialProps };
  }

  render() {
    return (
      <Html>
        <Head>
          {/* <!-- HTML Meta Tags --> */}
          <meta name="description" content="Stream Pay decentralized application" />

          {/* <!-- Facebook Meta Tags --> */}
          <meta property="og:url" content="https://stream-pay.netlify.app" />
          <meta property="og:type" content="website" />
          <meta property="og:title" content="Stream Pay" />
          <meta property="og:description" content="Stream Pay decentralized application" />
          <meta property="og:image" content="https://stream-pay.netlify.app/page.png" />

          {/* <!-- Twitter Meta Tags --> */}
          <meta name="twitter:card" content="summary_large_image" />
          <meta property="twitter:domain" content="stream-pay.netlify.app" />
          <meta property="twitter:url" content="https://stream-pay.netlify.app" />
          <meta name="twitter:title" content="Stream Pay" />
          <meta name="twitter:description" content="Stream Pay decentralized application" />
          <meta name="twitter:image" content="https://stream-pay.netlify.app/page.png" />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}
