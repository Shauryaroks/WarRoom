import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/contexts/AuthContext";

export const metadata: Metadata = {
  metadataBase: new URL("https://complex.helixtiet.in"),
  title: {
    default: "COMPLEX | Corporate Strategy Case Arena",
    template: "%s | COMPLEX",
  },
  description:
    "High-intensity synchronous multiplayer business simulation. 50 teams compete in a live market simulation with LLM-driven strategic evaluation.",
  keywords: [
    "business simulation",
    "case competition",
    "strategy game",
    "multiplayer",
    "LLM",
    "stock market",
    "corporate strategy",
  ],
  authors: [{ name: "HELIX TIET" }],
  creator: "HELIX TIET",
  publisher: "HELIX TIET",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "https://complex.helixtiet.in",
    siteName: "COMPLEX",
    title: "COMPLEX | Corporate Strategy Case Arena",
    description:
      "High-intensity synchronous multiplayer business simulation. 50 teams compete in a live market simulation with LLM-driven strategic evaluation.",
    images: [
      {
        url: "/ComplexBanner.png",
        width: 1200,
        height: 630,
        alt: "COMPLEX - Corporate Strategy Case Arena",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "COMPLEX | Corporate Strategy Case Arena",
    description: "High-intensity synchronous multiplayer business simulation",
    images: ["/ComplexBanner.png"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:wght,FILL@100..700,0..1&display=swap"
        />
        <link rel="icon" href="/favicon.ico" sizes="any" />
      </head>
      <body className="antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
