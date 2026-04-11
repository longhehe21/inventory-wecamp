"use client";
import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface Props {
  onClose: () => void;
}

export function ChangePasswordModal({ onClose }: Props) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (next.length < 6) { setError("Mật khẩu mới tối thiểu 6 ký tự"); return; }
    if (next !== confirm) { setError("Xác nhận mật khẩu không khớp"); return; }

    setLoading(true);
    // Re-authenticate with current password first
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setError("Không lấy được thông tin người dùng"); setLoading(false); return; }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: current,
    });
    if (signInErr) { setError("Mật khẩu hiện tại không đúng"); setLoading(false); return; }

    const { error: updateErr } = await supabase.auth.updateUser({ password: next });
    setLoading(false);
    if (updateErr) { setError("Lỗi đổi mật khẩu: " + updateErr.message); return; }
    setSuccess(true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-bold text-base">Đổi mật khẩu</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {success ? (
          <div className="space-y-4">
            <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-700 text-center">
              Đổi mật khẩu thành công!
            </div>
            <Button className="w-full" onClick={onClose}>Đóng</Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mật khẩu hiện tại</label>
              <input
                type="password"
                value={current}
                onChange={(e) => setCurrent(e.target.value)}
                required
                placeholder="••••••••"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Mật khẩu mới</label>
              <input
                type="password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={6}
                placeholder="Tối thiểu 6 ký tự"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Xác nhận mật khẩu mới</label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                placeholder="Nhập lại mật khẩu mới"
                className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            {error && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
            <div className="flex gap-2 pt-1">
              <Button type="submit" className="flex-1" disabled={loading}>
                {loading ? "Đang lưu..." : "Đổi mật khẩu"}
              </Button>
              <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
                Hủy
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
