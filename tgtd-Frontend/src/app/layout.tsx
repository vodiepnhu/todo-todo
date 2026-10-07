import type { Metadata } from "next";
import { Quicksand, Nunito } from "next/font/google";
import { Toaster } from "sonner";
import { Agentation } from "agentation";
import { LocaleProvider } from "@/lib/i18n";
import "./globals.css";

const quicksand = Quicksand({
  subsets: ["latin", "vietnamese"],
  variable: "--font-quicksand",
  display: "swap",
});

const nunito = Nunito({
  subsets: ["latin", "vietnamese"],
  variable: "--font-nunito",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Togo Wishlist — Future Travel & Bucket List",
  description: "Save and plan places you want to visit in the future",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`h-full antialiased ${quicksand.variable} ${nunito.variable}`}
    >
      <body className="min-h-full flex flex-col font-sans">
        <LocaleProvider>
          {children}
          <Toaster richColors position="top-center" />
          {process.env.NODE_ENV !== "production" ? (
            <Agentation appName="Togo Todo" useHashLocation />
          ) : null}
        </LocaleProvider>
      </body>
    </html>
  );
}
