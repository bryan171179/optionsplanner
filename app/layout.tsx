import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Options Planner",
  description: "Plan covered call strategies without external dependencies.",
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
