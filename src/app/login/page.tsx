"use client";
import { useState } from "react";
import { useAuth } from "@/contexts/auth-context";
import { Button } from "@/components/ui/button";
import { Package, Eye, EyeOff } from "lucide-react";

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const err = await signIn(email.trim(), password);
    if (err) {
      setError(err.includes("Invalid login") ? "Email hoặc mật khẩu không đúng" : err);
      setLoading(false);
    }
    // If successful, AuthGuard will redirect automatically
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm space-y-6">
        {/* Logo */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Package className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold">wECAMP Kho</h1>
          <p className="text-sm text-muted-foreground">Quản lý Kho & Đối soát</p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              placeholder="email@wecamp.com"
              className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Mật khẩu</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                placeholder="••••••••"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full h-11" disabled={loading}>
            {loading ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
      </div>
    </div>
  );
}
