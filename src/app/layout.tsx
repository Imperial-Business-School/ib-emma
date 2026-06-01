import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "IB Anonymous Exam Grading",
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
