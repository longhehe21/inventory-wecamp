"use client";
import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";
import { ChangePasswordModal } from "@/components/auth/change-password-modal";
import {
  Package,
  LayoutDashboard,
  BookOpen,
  BarChart3,
  FileSpreadsheet,
  ShieldCheck,
  LogOut,
  KeyRound,
  ChevronDown,
} from "lucide-react";

type NavItem = { href: string; label: string; icon: React.ElementType; roles: string[] };

const ALL_NAV: NavItem[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, roles: ["admin"] },
  { href: "/products", label: "Hàng hóa", icon: Package, roles: ["admin"] },
  { href: "/inventory", label: "Tồn kho", icon: BarChart3, roles: ["admin", "supervisor", "manager", "employee"] },
  { href: "/recipes", label: "Công thức", icon: BookOpen, roles: ["admin"] },
  { href: "/reports", label: "Đối soát", icon: FileSpreadsheet, roles: ["admin", "supervisor"] },
  { href: "/fabi", label: "Fabi", icon: FileSpreadsheet, roles: ["admin"] },
  { href: "/admin", label: "Tài khoản", icon: ShieldCheck, roles: ["admin"] },
];

export function Navbar() {
  const pathname = usePathname();
  const { profile, signOut } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showChangePw, setShowChangePw] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (pathname === "/login") return null;

  const role = profile?.role ?? "employee";
  const navItems = ALL_NAV.filter((item) => item.roles.includes(role));

  const roleLabel =
    profile?.role === "admin" ? "Admin" :
    profile?.role === "supervisor" ? "Giám sát" :
    profile?.role === "manager" ? "Quản lý" :
    profile?.category ? `NV ${profile.category}` : "Nhân viên";

  return (
    <>
      {/* Top header */}
      <header className="fixed top-0 left-0 right-0 z-40 bg-primary text-primary-foreground shadow-md">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <Package className="h-6 w-6" />
            <span className="font-bold text-base">wECAMP Kho</span>
          </div>

          {/* User menu */}
          {profile && (
            <div className="relative" ref={menuRef}>
              <button
                onClick={() => setShowMenu(!showMenu)}
                className="flex items-center gap-1.5 bg-white/20 hover:bg-white/30 transition-colors rounded-full pl-3 pr-2 py-1.5"
              >
                <div className="text-right">
                  <p className="text-xs font-semibold leading-tight">{profile.full_name}</p>
                  <p className="text-[10px] opacity-80 leading-tight">{roleLabel}</p>
                </div>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showMenu ? "rotate-180" : ""}`} />
              </button>

              {showMenu && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden z-50">
                  <button
                    onClick={() => { setShowMenu(false); setShowChangePw(true); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    <KeyRound className="h-4 w-4 text-gray-400" />
                    Đổi mật khẩu
                  </button>
                  <div className="border-t border-gray-100" />
                  <button
                    onClick={() => { setShowMenu(false); signOut(); }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Đăng xuất
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-border shadow-lg">
        <div
          className="grid h-16"
          style={{ gridTemplateColumns: `repeat(${navItems.length}, minmax(0, 1fr))` }}
        >
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

      {/* Change password modal */}
      {showChangePw && <ChangePasswordModal onClose={() => setShowChangePw(false)} />}
    </>
  );
}
