import "~/styles/globals.css";

import { Analytics } from "@vercel/analytics/react";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import { Toaster } from "~/components/ui/sonner";
import { Footer } from "~/components/layout/footer";
import { Header } from "~/components/layout/header";
import { Providers } from "~/components/providers";

export const metadata = {
  title: "MarLynk",
  description:
    "Open-source tool to generate short links. With a user-friendly interface and robust functionality, MarLynk makes it easy to share and manage links.",
  icons: [{ rel: "icon", url: "/favicon.ico" }],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
  <body
    className={`bg-background text-foreground font-sans ${GeistSans.variable} ${GeistMono.variable} flex min-h-screen flex-col`}
  >
        <Providers>
          <Header />
          <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col px-4">{children}</main>
          <Footer />
          <Toaster />
        </Providers>
        <Analytics />
      </body>
    </html>
  );
}
