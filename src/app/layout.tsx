import "./globals.css";
import type { Metadata } from "next";
import { GlobalFooter } from "./GlobalFooter";

export const metadata: Metadata = {
  title: "EMMS — Exam Marking and Moderation System",
  description: "CID-seat anonymous grading tool",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col">
        <div className="flex-1">{children}</div>
        <GlobalFooter />
      </body>
    </html>
  );
}
