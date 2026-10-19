import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "우리반 이코노미 · Class Economy OS",
  description: "일하고, 벌고, 쓰고, 함께 배우는 우리 반 경제사회",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
