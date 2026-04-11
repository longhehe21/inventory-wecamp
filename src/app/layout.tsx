import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { AuthProvider } from "@/contexts/auth-context";
import { AuthGuard } from "@/components/auth/auth-guard";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "wECAMP Kho - Quản lý Kho & Đối soát",
  description: "Hệ thống Quản lý Kho và Đối soát Lượng dùng cho wECAMP Cafe Retreat",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="vi">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body className={inter.className}>
        <AuthProvider>
          <Navbar />
          <AuthGuard>
            <main className="pt-14 pb-20 min-h-screen bg-background">
              <div className="max-w-2xl mx-auto">
                {children}
              </div>
            </main>
          </AuthGuard>
        </AuthProvider>
      </body>
    </html>
  );
}
