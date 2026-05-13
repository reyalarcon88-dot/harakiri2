import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/components/layout/I18nProvider";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "RMC Inventory",
  description: "Sistema de inventario, compras, proyectos y reportes de RMC.",
  keywords: ["RMC", "Inventory", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui"],
  authors: [{ name: "RMC" }],
  icons: {
    icon: "/rmc-logo.png",
  },
  openGraph: {
    title: "RMC Inventory",
    description: "Sistema de inventario, compras, proyectos y reportes de RMC.",
    siteName: "RMC",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RMC Inventory",
    description: "Sistema de inventario, compras, proyectos y reportes de RMC.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <I18nProvider>
            {children}
            <Toaster />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
