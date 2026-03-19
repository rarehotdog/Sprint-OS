import type { Metadata, Viewport } from "next";
import type { CSSProperties } from "react";
import "./globals.css";

const fontVariables: CSSProperties = {
  "--font-geist-sans":
    'ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  "--font-geist-mono":
    'ui-monospace, "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
} as CSSProperties;

export const metadata: Metadata = {
  title: "GMAT Sprint OS",
  description: "GMAT 805 training console for retrieval-first practice.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: "/favicon.ico",
    apple: "/favicon.ico",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased" style={fontVariables}>{children}</body>
    </html>
  );
}
