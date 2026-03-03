import type { Metadata } from "next";
import "./globals.css";
import ClientRootLayout from "./ClientRootLayout";

export const metadata: Metadata = {
  title: "AI Chatbot RP - Create & Chat with AI Characters",
  description: "Create and chat with AI-powered character bots. Build custom personas and engage in immersive roleplay conversations.",
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
