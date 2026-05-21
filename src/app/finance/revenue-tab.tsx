"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { ChevronLeft, ChevronRight, Save, Download, Upload, FileDown, GlassWater, Ticket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { DailyRevenue, RevenueSource } from "@/types/database";
import { formatCurrency } from "@/lib/utils";
import * as XLSX from "xlsx";

interface Props {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

interface DayRow {
  date: string;
  cash: string;
  transfer: string;
  existing_id?: string;
}

const SOURCES: { key: RevenueSource; label: string; icon: React.ElementType }[] = [
  { key: "bar", label: "Quầy bar", icon: GlassWater },
  { key: "ticket", label: "Vé vào", icon: Ticket },
];

function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const last = new Date(year, month + 1, 0).getDate();
  for (let i = 1; i <= last; i++) {
    days.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
  }
  return days;
}

export function RevenueTab({ onError, onSuccess }: Props) {
  const today = new Date();
  const [source, setSource] = useState<RevenueSource>("bar");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [rows, setRows] = useState<DayRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthLabel = `Tháng ${month + 1}/${year}`;
  const sourceLabel = SOURCES.find((s) => s.key === source)?.label ?? "";

  const fetchMonth = useCallback(async () => {
    setLoading(true);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const { data, error } = await supabase
      .from("daily_revenue")
      .select("*")
      .eq("source", source)
      .gte("date", `${monthStr}-01`)
      .lte("date", `${monthStr}-${String(lastDay).padStart(2, "0")}`)
      .order("date");
    if (error) {
      onError("Lỗi tải dữ liệu: " + error.message);
      setLoading(false);
      return;
    }
    const records = (data as DailyRevenue[]) || [];
    const map = new Map(records.map((r) => [r.date, r]));
    const allDays = getDaysInMonth(year, month);
    setRows(
      allDays.map((d) => {
        const r = map.get(d);
        return {
          date: d,
          cash: r ? r.cash.toString() : "",
          transfer: r ? r.transfer.toString() : "",
          existing_id: r?.id,
        };
      })
    );
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, source]);

  useEffect(() => { fetchMonth(); }, [fetchMonth]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const updateRow = (idx: number, field: "cash" | "transfer", val: string) => {
    const normalized = val.replace(",", ".");
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: normalized };
      return next;
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    let savedCount = 0;
    let errorCount = 0;
    for (const row of rows) {
      const cash = parseFloat(row.cash);
      const transfer = parseFloat(row.transfer);
      const hasCash = !isNaN(cash) && row.cash !== "";
      const hasTransfer = !isNaN(transfer) && row.transfer !== "";
      if (!hasCash && !hasTransfer && !row.existing_id) continue;
      if (!hasCash && !hasTransfer && row.existing_id) {
        const { error } = await supabase.from("daily_revenue").delete().eq("id", row.existing_id);
        if (error) errorCount++;
        else savedCount++;
        continue;
      }
      const payload = {
        date: row.date,
        source,
        cash: hasCash ? cash : 0,
        transfer: hasTransfer ? transfer : 0,
        note: null,
      };
      if (row.existing_id) {
        const { error } = await supabase
          .from("daily_revenue")
          .update({ cash: payload.cash, transfer: payload.transfer })
          .eq("id", row.existing_id);
        if (error) errorCount++;
        else savedCount++;
      } else {
        const { error } = await supabase.from("daily_revenue").insert(payload);
        if (error) errorCount++;
        else savedCount++;
      }
    }
    setSaving(false);
    if (errorCount > 0) onError(`Lỗi lưu ${errorCount} dòng`);
    else onSuccess(`Đã lưu ${savedCount} ngày (${sourceLabel})`);
    fetchMonth();
  };

  const totalCash = rows.reduce((s, r) => s + (parseFloat(r.cash) || 0), 0);
  const totalTransfer = rows.reduce((s, r) => s + (parseFloat(r.transfer) || 0), 0);

  const handleExport = () => {
    const header = ["Ngày", "Tiền mặt", "Chuyển khoản", "Tổng"];
    const dataRows = rows.map((r) => {
      const c = parseFloat(r.cash) || 0;
      const t = parseFloat(r.transfer) || 0;
      return [r.date, c, t, c + t];
    });
    const totalRow = ["TỔNG", totalCash, totalTransfer, totalCash + totalTransfer];
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows, totalRow]);
    ws["!cols"] = [{ wch: 12 }, { wch: 15 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sourceLabel);
    XLSX.writeFile(wb, `thu-${source}-${monthStr}.xlsx`);
  };

  const handleDownloadTemplate = () => {
    const header = ["Ngày", "Tiền mặt", "Chuyển khoản"];
    const dataRows = rows.map((r) => [r.date, "", ""]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws["!cols"] = [{ wch: 12 }, { wch: 15 }, { wch: 15 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sourceLabel);
    XLSX.writeFile(wb, `mau-thu-${source}-${monthStr}.xlsx`);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const buffer = ev.target?.result as ArrayBuffer;
        const wb = XLSX.read(buffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        if (!ws) {
          onError("File Excel không có dữ liệu");
          return;
        }
        const data: unknown[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
        const safe = (v: unknown) => (v === undefined || v === null ? "" : String(v));
        const toNumStr = (s: string) => s.trim().replace(",", ".");

        const updates = new Map<string, { cash: string; transfer: string }>();
        data.slice(1).forEach((row) => {
          if (!row?.length) return;
          const rawDate = safe(row[0]).trim();
          if (!rawDate || rawDate.toUpperCase() === "TỔNG") return;
          let dateStr = rawDate;
          if (rawDate.includes("/")) {
            const [d, m, y] = rawDate.split("/").map((s) => s.trim());
            if (d && m && y) {
              dateStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
            }
          }
          const cash = parseFloat(toNumStr(safe(row[1]))) || 0;
          const transfer = parseFloat(toNumStr(safe(row[2]))) || 0;
          updates.set(dateStr, { cash: cash.toString(), transfer: transfer.toString() });
        });

        let matched = 0;
        setRows((prev) =>
          prev.map((r) => {
            const u = updates.get(r.date);
            if (u) {
              matched++;
              return { ...r, cash: u.cash, transfer: u.transfer };
            }
            return r;
          })
        );
        onSuccess(`Đã nhập ${matched} ngày từ Excel vào ${sourceLabel}`);
      } catch (err) {
        onError("Lỗi đọc Excel: " + (err instanceof Error ? err.message : "định dạng sai"));
      }
    };
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-3">
      {/* Source sub-tabs */}
      <div className="px-4">
        <div className="grid grid-cols-2 gap-2">
          {SOURCES.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setSource(key)}
              className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                source === key
                  ? key === "bar"
                    ? "bg-amber-500 text-white"
                    : "bg-pink-500 text-white"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

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

      {/* Action buttons */}
      <div className="px-4 flex gap-2 flex-wrap">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4" />
          Mẫu
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Import
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
        <Button variant="outline" size="sm" className="gap-1.5 text-green-700 border-green-200 hover:bg-green-50" onClick={handleExport}>
          <FileDown className="h-4 w-4" />
          Xuất Excel
        </Button>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={handleSaveAll} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>

      {/* Totals (per source) */}
      <div className="px-4 grid grid-cols-3 gap-2">
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-emerald-700">Tiền mặt</p>
          <p className="font-bold text-emerald-800 text-sm">{formatCurrency(totalCash)}</p>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-blue-700">Chuyển khoản</p>
          <p className="font-bold text-blue-800 text-sm">{formatCurrency(totalTransfer)}</p>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded-xl p-2.5 text-center">
          <p className="text-[10px] text-purple-700">Tổng {sourceLabel}</p>
          <p className="font-bold text-purple-800 text-sm">{formatCurrency(totalCash + totalTransfer)}</p>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="px-4 space-y-1.5">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-10 bg-muted rounded animate-pulse" />)}
        </div>
      ) : (
        <div className="px-4 pb-4">
          <div className="overflow-x-auto rounded-xl border bg-white">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-3 py-2 font-semibold w-28">Ngày</th>
                  <th className="text-right px-3 py-2 font-semibold">Tiền mặt</th>
                  <th className="text-right px-3 py-2 font-semibold">Chuyển khoản</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const [, m, d] = row.date.split("-");
                  return (
                    <tr key={row.date} className="border-b last:border-0">
                      <td className="px-3 py-1.5 font-medium text-muted-foreground whitespace-nowrap">
                        {d}/{m}
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.cash}
                          onChange={(e) => updateRow(idx, "cash", e.target.value)}
                          placeholder="0"
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="number"
                          min="0"
                          step="any"
                          value={row.transfer}
                          onChange={(e) => updateRow(idx, "transfer", e.target.value)}
                          placeholder="0"
                          className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-right focus:outline-none focus:ring-2 focus:ring-ring"
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <Button className="w-full h-12 text-base gap-2 mt-3" onClick={handleSaveAll} disabled={saving}>
            <Save className="h-5 w-5" />
            {saving ? "Đang lưu..." : `Lưu ${sourceLabel}`}
          </Button>
        </div>
      )}
    </div>
  );
}
