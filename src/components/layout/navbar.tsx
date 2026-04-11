"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  Package,
  LayoutDashboard,
  BookOpen,
  BarChart3,
  FileSpreadsheet,
} from "lucide-react";

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/products", label: "Hàng hóa", icon: Package },
  { href: "/inventory", label: "Tồn kho", icon: BarChart3 },
  { href: "/recipes", label: "Công thức", icon: BookOpen },
  { href: "/fabi", label: "Fabi", icon: FileSpreadsheet },
];

export function Navbar() {
  const pathname = usePathname();

  return (
    <>
      {/* Top header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            <span className="font-bold text-base">wECAMP Kho</span>
          </div>
          <span className="text-xs opacity-80">Quản lý Kho & Đối soát</span>
        </div>
      </header>

      {/* Bottom navigation for mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-lg">
        <div className="grid grid-cols-5 h-16">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 text-xs transition-colors",
                  isActive
                    ? "text-primary font-semibold"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
                <span className="text-[10px] leading-tight">{label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
