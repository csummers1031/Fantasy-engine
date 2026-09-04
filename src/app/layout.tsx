import type { Metadata } from "next";
import "./globals.css";
import { Shell } from "@/components/layout/shell";
import { TooltipProvider } from "@/components/ui/tooltip";

export const metadata: Metadata = {
  title: "Fantasy Engine | Draft War Room",
  description: "Multi-league autonomous fantasy football draft engine and live strategy war room",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="dark">
      <body>
        <TooltipProvider delayDuration={150}>
          <Shell>{children}</Shell>
        </TooltipProvider>
      </body>
    </html>
  );
}
