import type { Metadata, Viewport } from "next";
import "./globals.css";
import ClientRootLayout from "./ClientRootLayout";

export const metadata: Metadata = {
  title: "Botainy - Create & Chat with AI Characters",
  description: "Botainy — create and chat with AI-powered character bots. Build custom personas and engage in immersive roleplay conversations.",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Botainy",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover", // handles iPhone notch/dynamic island
  themeColor: "#030712", // matches bg-gray-950
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased bg-gray-950 text-white">
        <ClientRootLayout>
          {children}
        </ClientRootLayout>
      </body>
    </html>
  );
}
