import "../styles/globals.css";
import Head from "next/head";
import { AuthProvider } from "../lib/AuthContext";
import GlobalNav from "../components/GlobalNav";
import Footer from "../components/Footer";

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <Head>
        <title>LENSEIQ</title>
        <link rel="icon" href="/uiclips/favicon.png" />
        <meta
          name="description"
          content="LENSEIQ turns long sports footage into share-ready highlights with AI."
        />
        <meta name="theme-color" content="#2563eb" />
      </Head>
      <GlobalNav />
      <Component {...pageProps} />
      <Footer />
    </AuthProvider>
  );
}
