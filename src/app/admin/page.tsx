"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2, Users, ShieldCheck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Toast, useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/auth-context";
import { UserProfile, UserRole, UserCategory } from "@/types/auth";

const ROLE_LABEL: Record<UserRole, string> = {
  admin: "Admin",
  supervisor: "Giám sát",
  manager: "Quản lý",
  employee: "Nhân viên",
};

const ROLE_ICON: Record<UserRole, React.ReactNode> = {
  admin: <ShieldCheck className="h-4 w-4 text-red-500" />,
  supervisor: <Users className="h-4 w-4 text-indigo-500" />,
  manager: <Users className="h-4 w-4 text-blue-500" />,
  employee: <User className="h-4 w-4 text-green-500" />,
};

interface NewUserForm {
  email: string;
  password: string;
  full_name: string;
  role: UserRole;
  category: UserCategory | "";
}

const emptyForm: NewUserForm = {
  email: "",
  password: "",
  full_name: "",
  role: "employee",
  category: "Bếp",
};

export default function AdminPage() {
  const { profile: currentProfile } = useAuth();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<NewUserForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
  const { toast, showToast, hideToast } = useToast();

  const fetchUsers = async () => {
    const { data, error } = await supabase
      .from("user_profiles")
      .select("*")
      .order("created_at");
    if (error) showToast("Lỗi tải danh sách: " + error.message, "error");
    else setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => { fetchUsers(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Guard: only admin can access
  if (currentProfile && currentProfile.role !== "admin") {
    return (
      <div className="px-4 py-16 text-center text-muted-foreground">
        Bạn không có quyền truy cập trang này
      </div>
    );
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: form.email.trim(),
        password: form.password,
        full_name: form.full_name.trim(),
        role: form.role,
        category: form.role === "employee" ? (form.category || "Bếp") : null,
      }),
    });
    const json = await res.json();
    setSaving(false);
    if (!res.ok) {
      showToast("Lỗi tạo tài khoản: " + json.error, "error");
    } else {
      showToast("Đã tạo tài khoản thành công");
      setForm(emptyForm);
      setShowForm(false);
      fetchUsers();
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/admin/users?id=${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      showToast("Lỗi xóa tài khoản: " + json.error, "error");
    } else {
      showToast("Đã xóa tài khoản");
      setUsers((prev) => prev.filter((u) => u.id !== id));
    }
    setDeleteTarget(null);
  };

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Quản lý tài khoản</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{users.length} tài khoản</p>
        </div>
        <Button size="sm" className="gap-2" onClick={() => setShowForm(!showForm)}>
          <Plus className="h-4 w-4" />
          Tạo tài khoản
        </Button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardContent className="p-4">
            <h2 className="font-semibold mb-3">Tạo tài khoản mới</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Họ tên</label>
                <input
                  type="text"
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  required
                  placeholder="Nguyễn Văn A"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  required
                  placeholder="nhanvien@wecamp.com"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Mật khẩu</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  required
                  minLength={6}
                  placeholder="Tối thiểu 6 ký tự"
                  className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Vai trò</label>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  {(["admin", "supervisor", "manager", "employee"] as UserRole[]).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setForm({ ...form, role: r, category: r === "employee" ? (form.category || "Bếp") : "" })}
                      className={`py-2 rounded-lg text-xs font-medium border transition-colors ${
                        form.role === r
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background text-muted-foreground border-input hover:border-ring"
                      }`}
                    >
                      {ROLE_LABEL[r]}
                    </button>
                  ))}
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Giám sát: tồn kho + đối soát · Quản lý: tồn kho (cả 3 kho) + báo cáo tháng
                </p>
              </div>
              {form.role === "employee" && (
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Phân loại</label>
                  <div className="mt-1 flex gap-2">
                    {(["Bếp", "Quầy", "Lễ tân"] as UserCategory[]).map((cat) => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => setForm({ ...form, category: cat })}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          form.category === cat
                            ? cat === "Bếp"
                              ? "bg-orange-500 text-white border-orange-500"
                              : cat === "Quầy"
                              ? "bg-blue-500 text-white border-blue-500"
                              : "bg-purple-500 text-white border-purple-500"
                            : "bg-background text-muted-foreground border-input"
                        }`}
                      >
                        {cat === "Bếp" ? "🍳 Bếp" : cat === "Quầy" ? "☕ Quầy" : "🛎️ Lễ tân"}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex gap-2 pt-1">
                <Button type="submit" className="flex-1" disabled={saving}>
                  {saving ? "Đang tạo..." : "Tạo tài khoản"}
                </Button>
                <Button type="button" variant="outline" className="flex-1" onClick={() => setShowForm(false)}>
                  Hủy
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* User list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <Card key={u.id} className="overflow-hidden">
              <CardContent className="p-0">
                {deleteTarget === u.id ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-medium text-red-800 mb-1">Xóa tài khoản <strong>{u.full_name}</strong>?</p>
                    <p className="text-xs text-red-600 mb-3">Hành động này không thể hoàn tác.</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleDelete(u.id)}>Xóa</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setDeleteTarget(null)}>Hủy</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        {ROLE_ICON[u.role]}
                        <span className="font-semibold text-sm truncate">{u.full_name}</span>
                        {u.role === "employee" && u.category && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                            u.category === "Bếp" ? "bg-orange-100 text-orange-700"
                            : u.category === "Quầy" ? "bg-blue-100 text-blue-700"
                            : "bg-purple-100 text-purple-700"
                          }`}>
                            {u.category === "Bếp" ? "🍳" : u.category === "Quầy" ? "☕" : "🛎️"} {u.category}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">{u.email}</p>
                      <p className="text-xs text-muted-foreground">{ROLE_LABEL[u.role]}</p>
                    </div>
                    {u.id !== currentProfile?.id && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                        onClick={() => setDeleteTarget(u.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  );
}
