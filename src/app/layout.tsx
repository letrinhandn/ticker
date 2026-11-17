import type { Metadata } from "next";
import { Nunito } from "next/font/google";
import { Providers } from "@/components/shell/Providers";
import "./globals.css";

/** One rounded sans for UI + brand — readable game-app type, not serif “AI” display. */
const nunito = Nunito({
  variable: "--font-nunito",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "TICKER",
  description:
    "Buy, sell, and survive the market. Two players or a bot. No accounts.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${nunito.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
