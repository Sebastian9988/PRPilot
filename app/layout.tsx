import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PRPilot",
  description: "Paste a git diff and get a fast AI PR review.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
