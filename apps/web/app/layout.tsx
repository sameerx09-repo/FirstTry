import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "FirstTry — new things to try",
  description:
    "Discover little games, useful tools, and your next favorite mini-app.",
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
