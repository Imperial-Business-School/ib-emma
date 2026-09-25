import "./globals.css";
import type { Metadata } from "next";

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
      <body>{children}</body>
    </html>
  );
}
