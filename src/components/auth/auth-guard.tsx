"use client";
import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/auth-context";

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    // Not logged in → go to login (except already on /login)
    if (!user && pathname !== "/login") {
      router.replace("/login");
      return;
    }

    // Logged in + on login page → redirect based on role
    if (user && profile && pathname === "/login") {
      if (profile.role === "employee") router.replace("/inventory");
      else if (profile.role === "manager") router.replace("/inventory");
      else if (profile.role === "supervisor") router.replace("/inventory");
      else router.replace("/");
      return;
    }

    if (!profile) return;

    if (profile.role === "employee" || profile.role === "manager") {
      // Employees and managers can only access /inventory
      if (!pathname.startsWith("/inventory")) {
        router.replace("/inventory");
      }
    } else if (profile.role === "supervisor") {
      // Supervisors can access /inventory and /reports
      const allowed = ["/inventory", "/reports"];
      if (!allowed.some((r) => pathname.startsWith(r))) {
        router.replace("/inventory");
      }
    }
    // Admin: no restrictions
  }, [user, profile, loading, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  // Show nothing while redirecting (no user, not on login)
  if (!user && pathname !== "/login") return null;

  return <>{children}</>;
}
