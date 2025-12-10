import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "申請ガイド - 介護・福祉事業所の新規開設申請",
  description: "住宅型有料老人ホーム、訪問看護事業所、訪問介護事業所の新規開設に必要な申請情報を検索",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body className={inter.className}>{children}</body>
    </html>
  );
}

