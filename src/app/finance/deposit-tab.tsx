"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Plus, Trash2, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { CashDeposit } from "@/types/database";
import { formatCurrency } from "@/lib/utils";

interface Props {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

function getTodayStr(): string {
  return new Date().toISOString().split("T")[0];
}

function getMonthStr(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

export function DepositTab({ onError, onSuccess }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [deposits, setDeposits] = useState<CashDeposit[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Form to add new deposit
  const [newDate, setNewDate] = useState(getTodayStr());
  const [newAmount, setNewAmount] = useState("");
  const [newNote, setNewNote] = useState("");

  const monthStr = getMonthStr(year, month);
  const monthLabel = `Tháng ${month + 1}/${year}`;

  const fetchDeposits = useCallback(async () => {
    setLoading(true);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const { data, error } = await supabase
      .from("cash_deposits")
      .select("*")
      .gte("date", `${monthStr}-01`)
      .lte("date", `${monthStr}-${String(lastDay).padStart(2, "0")}`)
      .order("date", { ascending: false });
    if (error) onError("Lỗi tải dữ liệu: " + error.message);
    else setDeposits((data as CashDeposit[]) || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => { fetchDeposits(); }, [fetchDeposits]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const handleAdd = async () => {
    const amount = parseFloat(newAmount.replace(",", "."));
    if (!newDate || isNaN(amount) || amount <= 0) {
      onError("Vui lòng nhập ngày và số tiền hợp lệ");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("cash_deposits").insert({
      date: newDate,
      amount,
      note: newNote.trim() || null,
    });
    setSaving(false);
    if (error) {
      onError("Lỗi lưu: " + error.message);
      return;
    }
    onSuccess("Đã thêm khoản nộp");
    setNewAmount("");
    setNewNote("");
    fetchDeposits();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("cash_deposits").delete().eq("id", id);
    setDeleting(null);
    if (error) {
      onError("Lỗi xóa: " + error.message);
      return;
    }
    onSuccess("Đã xóa");
    setDeposits((prev) => prev.filter((d) => d.id !== id));
  };

  const totalMonth = deposits.reduce((s, d) => s + d.amount, 0);

  return (
    <div className="space-y-3">
      {/* Month navigator */}
      <div className="px-4 flex items-center gap-2 bg-muted rounded-xl p-2 mx-4">
        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => changeMonth(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="flex-1 text-center font-semibold text-sm">{monthLabel}</span>
        <Button
          size="icon"
          variant="ghost"
          className="h-9 w-9"
          onClick={() => changeMonth(1)}
          disabled={year === today.getFullYear() && month >= today.getMonth()}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Total card */}
      <div className="px-4">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3">
          <Landmark className="h-6 w-6 text-emerald-700 shrink-0" />
          <div className="flex-1">
            <p className="text-[10px] text-emerald-700">Đã nộp trong tháng</p>
            <p className="font-bold text-emerald-800">{formatCurrency(totalMonth)}</p>
          </div>
        </div>
      </div>

      {/* Add form */}
      <div className="px-4">
        <div className="border rounded-xl bg-white p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Thêm khoản nộp
          </p>
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
              max={getTodayStr()}
              className="h-9 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <input
              type="number"
              min="0"
              step="any"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="Số tiền"
              className="h-9 rounded-md border border-input bg-background px-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <input
            type="text"
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="Ghi chú (tuỳ chọn): mã giao dịch, số sổ..."
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button className="w-full h-10 gap-1.5" onClick={handleAdd} disabled={saving}>
            <Plus className="h-4 w-4" />
            {saving ? "Đang lưu..." : "Thêm khoản nộp"}
          </Button>
        </div>
      </div>

      {/* History */}
      <div className="px-4 pb-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
          Lịch sử nộp
        </p>
        {loading ? (
          <div className="space-y-1.5">
            {[1, 2].map((i) => <div key={i} className="h-12 bg-muted rounded animate-pulse" />)}
          </div>
        ) : deposits.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">Chưa có khoản nộp nào trong tháng</p>
        ) : (
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-semibold w-24">Ngày</th>
                  <th className="text-right px-3 py-2 font-semibold w-32">Số tiền</th>
                  <th className="text-left px-3 py-2 font-semibold">Ghi chú</th>
                  <th className="w-10" />
                </tr>
              </thead>
              <tbody>
                {deposits.map((d) => {
                  const [, m, day] = d.date.split("-");
                  return (
                    <tr key={d.id} className="border-b last:border-0">
                      <td className="px-3 py-2 font-medium text-muted-foreground whitespace-nowrap">{day}/{m}</td>
                      <td className="px-3 py-2 text-right font-medium text-emerald-700">{formatCurrency(d.amount)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{d.note || "—"}</td>
                      <td className="px-1 py-2">
                        {deleting === d.id ? (
                          <div className="flex gap-1">
                            <Button size="icon" variant="destructive" className="h-7 w-7 text-xs" onClick={() => handleDelete(d.id)}>✓</Button>
                            <Button size="icon" variant="outline" className="h-7 w-7 text-xs" onClick={() => setDeleting(null)}>✕</Button>
                          </div>
                        ) : (
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleting(d.id)}>
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
    </div>
  );
}
