"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, User, CalendarRange } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Expense, PaymentType } from "@/types/database";
import { formatCurrency, formatIntegerInput, parseIntegerInput } from "@/lib/utils";
import { useAuth } from "@/contexts/auth-context";

interface Props {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

type Filter = "all" | "cash" | "transfer";

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getMonthStartStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

interface DraftRow {
  name: string;
  payment_type: PaymentType;
  amount: string;
}

const emptyDraft: DraftRow = { name: "", payment_type: "cash", amount: "" };

export function ExpenseTab({ onError, onSuccess }: Props) {
  const { profile } = useAuth();
  // Range filter for viewing
  const [dateFrom, setDateFrom] = useState(getMonthStartStr());
  const [dateTo, setDateTo] = useState(getTodayStr());
  // Separate date used when adding new expenses
  const [newDate, setNewDate] = useState(getTodayStr());
  const [filter, setFilter] = useState<Filter>("all");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([{ ...emptyDraft }]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const fetchExpenses = useCallback(async () => {
    if (dateFrom > dateTo) {
      onError("Khoảng ngày không hợp lệ (Từ ngày > Đến ngày)");
      setExpenses([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from("expenses")
      .select("*")
      .gte("date", dateFrom)
      .lte("date", dateTo)
      .order("date", { ascending: false })
      .order("created_at");
    if (error) {
      onError("Lỗi tải dữ liệu: " + error.message);
      setLoading(false);
      return;
    }
    const rows = (data as Expense[]) || [];

    // Resolve names for created_by user IDs
    const ids = Array.from(new Set(rows.map((r) => r.created_by).filter((v): v is string => !!v)));
    let nameMap: Record<string, string> = {};
    if (ids.length) {
      const { data: profiles } = await supabase
        .from("user_profiles")
        .select("id, full_name, email")
        .in("id", ids);
      nameMap = Object.fromEntries(
        ((profiles as { id: string; full_name: string; email: string }[]) || []).map((p) => [
          p.id,
          p.full_name || p.email,
        ])
      );
    }
    setExpenses(rows.map((r) => ({ ...r, created_by_name: r.created_by ? nameMap[r.created_by] ?? null : null })));
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateFrom, dateTo]);

  useEffect(() => { fetchExpenses(); }, [fetchExpenses]);

  const updateDraft = (idx: number, field: keyof DraftRow, val: string) => {
    setDrafts((prev) => {
      const next = [...prev];
      const cur = next[idx];
      if (field === "amount") {
        next[idx] = { ...cur, amount: parseIntegerInput(val) };
      } else if (field === "payment_type") {
        next[idx] = { ...cur, payment_type: val as PaymentType };
      } else {
        next[idx] = { ...cur, name: val };
      }
      return next;
    });
  };

  const addDraft = () => setDrafts((prev) => [...prev, { ...emptyDraft }]);
  const removeDraft = (idx: number) =>
    setDrafts((prev) => prev.filter((_, i) => i !== idx).length ? prev.filter((_, i) => i !== idx) : [{ ...emptyDraft }]);

  const handleSaveDrafts = async () => {
    const valid = drafts
      .map((d, i) => ({ ...d, i }))
      .filter((d) => d.name.trim() && parseFloat(d.amount) > 0);
    if (valid.length === 0) {
      onError("Vui lòng nhập ít nhất 1 dòng (tên + số tiền > 0)");
      return;
    }
    setSaving(true);
    const payload = valid.map((d) => ({
      date: newDate,
      name: d.name.trim(),
      payment_type: d.payment_type,
      amount: parseFloat(d.amount),
      created_by: profile?.id ?? null,
    }));
    const { error } = await supabase.from("expenses").insert(payload);
    setSaving(false);
    if (error) {
      onError("Lỗi lưu: " + error.message);
      return;
    }
    onSuccess(`Đã thêm ${valid.length} khoản chi`);
    setDrafts([{ ...emptyDraft }]);
    fetchExpenses();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("expenses").delete().eq("id", id);
    setDeleting(null);
    if (error) {
      onError("Lỗi xóa: " + error.message);
      return;
    }
    onSuccess("Đã xóa");
    setExpenses((prev) => prev.filter((e) => e.id !== id));
  };

  // Apply filter
  const filteredExpenses = expenses.filter((e) =>
    filter === "all" ? true : e.payment_type === filter
  );

  const totalCash = expenses.filter((e) => e.payment_type === "cash").reduce((s, e) => s + e.amount, 0);
  const totalTransfer = expenses.filter((e) => e.payment_type === "transfer").reduce((s, e) => s + e.amount, 0);

  return (
    <div className="space-y-3">
      {/* Date range filter */}
      <div className="px-4 space-y-2">
        <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
          <CalendarRange className="h-3.5 w-3.5" />
          Lọc theo khoảng ngày
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-muted-foreground">Từ ngày</label>
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              max={dateTo}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground">Đến ngày</label>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              min={dateFrom}
              max={getTodayStr()}
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>
        {/* Quick presets */}
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setDateFrom(getTodayStr()); setDateTo(getTodayStr()); }}
            className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Hôm nay
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setDate(d.getDate() - 6);
              setDateFrom(d.toISOString().split("T")[0]);
              setDateTo(getTodayStr());
            }}
            className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
          >
            7 ngày
          </button>
          <button
            onClick={() => { setDateFrom(getMonthStartStr()); setDateTo(getTodayStr()); }}
            className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Tháng này
          </button>
          <button
            onClick={() => {
              const d = new Date();
              d.setMonth(d.getMonth() - 1, 1);
              const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
              const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
              const end = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
              setDateFrom(start);
              setDateTo(end);
            }}
            className="text-[11px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground hover:bg-muted/80"
          >
            Tháng trước
          </button>
        </div>
      </div>

      {/* Totals */}
      <div className="px-4 grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-emerald-700">Tiền mặt</p>
          <p className="font-bold text-emerald-800 text-sm">{formatCurrency(totalCash)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-blue-700">Chuyển khoản</p>
          <p className="font-bold text-blue-800 text-sm">{formatCurrency(totalTransfer)}</p>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-red-700">Tổng chi</p>
          <p className="font-bold text-red-800 text-sm">{formatCurrency(totalCash + totalTransfer)}</p>
        </div>
      </div>

      {/* Filter */}
      <div className="px-4 flex gap-2">
        {([
          { key: "all", label: "Tất cả" },
          { key: "cash", label: "Tiền mặt" },
          { key: "transfer", label: "Chuyển khoản" },
        ] as { key: Filter; label: string }[]).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filter === key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Existing expenses list */}
      <div className="px-4">
        {loading ? (
          <div className="space-y-1.5">
            {[1, 2].map((i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Không có khoản chi nào trong khoảng ngày đã chọn</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-semibold w-10">STT</th>
                  <th className="text-left px-3 py-2 font-semibold w-20">Ngày</th>
                  <th className="text-left px-3 py-2 font-semibold">Tên</th>
                  <th className="text-left px-3 py-2 font-semibold w-28">Loại</th>
                  <th className="text-right px-3 py-2 font-semibold w-32">Số tiền</th>
                  <th className="text-left px-3 py-2 font-semibold w-32">Người nhập</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((e, i) => {
                  const [, m, d] = e.date.split("-");
                  return (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 text-muted-foreground whitespace-nowrap">{d}/{m}</td>
                    <td className="px-3 py-2 font-medium">{e.name}</td>
                    <td className="px-3 py-2">
                      <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                        e.payment_type === "cash"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-blue-100 text-blue-700"
                      }`}>
                        {e.payment_type === "cash" ? "💵 Tiền mặt" : "🏦 Chuyển khoản"}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{formatCurrency(e.amount)}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {e.created_by_name ? (
                        <span className="inline-flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {e.created_by_name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </td>
                    <td className="px-1 py-2">
                      {deleting === e.id ? (
                        <div className="flex gap-1">
                          <Button size="icon" variant="destructive" className="h-7 w-7 text-xs" onClick={() => handleDelete(e.id)}>✓</Button>
                          <Button size="icon" variant="outline" className="h-7 w-7 text-xs" onClick={() => setDeleting(null)}>✕</Button>
                        </div>
                      ) : (
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleting(e.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add new expenses */}
      <div className="px-4 pb-4 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Thêm khoản chi mới
          </p>
          {profile && (
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {profile.full_name || profile.email}
            </span>
          )}
        </div>

        {/* Date picker for new entries */}
        <div className="flex items-center gap-2 bg-muted/50 rounded-lg p-2">
          <label className="text-xs text-muted-foreground shrink-0">Ngày chi:</label>
          <input
            type="date"
            value={newDate}
            onChange={(e) => setNewDate(e.target.value)}
            max={getTodayStr()}
            className="h-8 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {drafts.map((d, idx) => (
          <div key={idx} className="border rounded-xl bg-white p-3 space-y-2">
            <div className="grid grid-cols-12 gap-2">
              <input
                type="text"
                value={d.name}
                onChange={(e) => updateDraft(idx, "name", e.target.value)}
                placeholder="Tên khoản chi (VD: Mua gas, trả lương...)"
                className="col-span-12 h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <select
                value={d.payment_type}
                onChange={(e) => updateDraft(idx, "payment_type", e.target.value)}
                className="col-span-5 h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              >
                <option value="cash">💵 Tiền mặt</option>
                <option value="transfer">🏦 Chuyển khoản</option>
              </select>
              <div className="col-span-6 relative">
                <input
                  type="text"
                  inputMode="numeric"
                  value={formatIntegerInput(d.amount)}
                  onChange={(e) => updateDraft(idx, "amount", e.target.value)}
                  placeholder="Số tiền"
                  className="h-9 w-full rounded-md border border-input bg-background pl-2 pr-7 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">đ</span>
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="col-span-1 h-9 w-9 text-destructive hover:text-destructive"
                onClick={() => removeDraft(idx)}
                disabled={drafts.length === 1 && !d.name && !d.amount}
                title="Xóa dòng"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}

        <Button variant="outline" className="w-full gap-1.5" onClick={addDraft}>
          <Plus className="h-4 w-4" />
          Thêm dòng
        </Button>

        <Button className="w-full h-11 gap-2" onClick={handleSaveDrafts} disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu các khoản chi"}
        </Button>
      </div>
    </div>
  );
}
