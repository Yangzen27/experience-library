import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "经历库｜AI 求职助手",
  description: "将个人职业材料整理为可追溯、可复用的经历库。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
