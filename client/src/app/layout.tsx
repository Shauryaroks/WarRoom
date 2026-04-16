import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { Toaster } from "sonner";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Complex",
  description: "Case Competition Platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans antialiased pb-6`}>
        {children}
        {/* Terminal Status Bar */}
        <footer className="fixed bottom-0 left-0 w-full h-6 flex justify-between items-center px-6 z-50 overflow-hidden bg-[#0e0e0e] border-t border-[#2a2a2a]">
          <div className="font-mono text-[9px] font-medium text-[#40e56c] uppercase">
            SYSTEM_STABLE // LATENCY: 14MS
          </div>
          <div className="flex gap-6">
            <span className="font-mono text-[9px] font-medium text-gray-600 hover:text-white cursor-pointer uppercase transition-colors">API_DOCS</span>
            <span className="font-mono text-[9px] font-medium text-gray-600 hover:text-white cursor-pointer uppercase transition-colors">RULES</span>
            <span className="font-mono text-[9px] font-medium text-gray-600 hover:text-white cursor-pointer uppercase transition-colors">HELP_DESK</span>
          </div>
        </footer>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: {
              background: "#201f1f",
              border: "1px solid #404752",
              color: "#e5e2e1",
            },
          }}
        />
      </body>
    </html>
  );
}
