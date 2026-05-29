import type { Metadata } from "next";
import { BrandFavicon } from "@/components/brand-favicon";
import "./globals.css";

export const metadata: Metadata = {
  title: "森岳 AI Agent",
  description: "私有 AI 对话系统，支持 OpenAI 云端模型和 OpenAI 兼容本地模型。",
  icons: {
    icon: [
      { url: "/api/brand/logo" },
      { url: "/icon", type: "image/png" },
    ],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>
        <BrandFavicon />
        {children}
      </body>
    </html>
  );
}
