import type { Metadata } from "next";
import { Geist, Geist_Mono, Cairo } from "next/font/google";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/app/components/ThemeProvider";
import { cookies, headers } from "next/headers";
import { LanguageProvider, type Locale } from "@/lib/i18n";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const cairo = Cairo({
  variable: "--font-cairo",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Smart IT Helpdesk",
    template: "%s | Smart IT Helpdesk",
  },
  description: "Manage and resolve IT support tickets efficiently with AI-powered triage.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Resolve the locale on the server (cookie first, then browser language) so the
  // server-rendered HTML matches what the client hydrates with.
  const cookieStore = await cookies();
  const headerStore = await headers();
  const stored = cookieStore.get("helpdesk-lang")?.value;
  const locale: Locale =
    stored === "ar" || stored === "en"
      ? stored
      : headerStore.get("accept-language")?.toLowerCase().startsWith("ar")
        ? "ar"
        : "en";

  return (
    <html
      lang={locale}
      dir={locale === "ar" ? "rtl" : "ltr"}
      data-lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${cairo.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col antialiased bg-background text-foreground">
        <LanguageProvider initialLocale={locale}>
          <ThemeProvider>
            {children}
            <Toaster
              position="bottom-right"
              richColors
              toastOptions={{
                style: {
                  background: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  color: "hsl(var(--foreground))",
                  fontFamily: "var(--font-sans)",
                },
              }}
            />
          </ThemeProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}
