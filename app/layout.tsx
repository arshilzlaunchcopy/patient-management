import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Dr. Khaled Nur Zihad — Clinic Management",
    template: "%s · Clinic Management",
  },
  description: "Patient management for Dr. Khaled Nur Zihad, diabetology, Pabna.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
