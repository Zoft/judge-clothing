import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "穿搭评分实验室",
  description: "上传照片，获取穿搭评分与可执行建议。"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
