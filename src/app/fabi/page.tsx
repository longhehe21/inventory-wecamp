"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Upload, Trash2, FileSpreadsheet, Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Toast, useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { FabiSale } from "@/types/database";
import { formatNumber, formatDate } from "@/lib/utils";
import * as XLSX from "xlsx";

function getMonthStr(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

interface GroupedSale {
  date: string;
  items: FabiSale[];
  total: number;
}

export default function FabiPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [sales, setSales] = useState<FabiSale[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [deleteDate, setDeleteDate] = useState<string | null>(null);
  const [expandedDate, setExpandedDate] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast, showToast, hideToast } = useToast();

  const fetchSales = useCallback(async () => {
    setLoading(true);
    const monthStr = getMonthStr(year, month);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const lastDayStr = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
    const { data, error } = await supabase
      .from("fabi_sales")
      .select("*")
      .gte("date", `${monthStr}-01`)
      .lte("date", lastDayStr)
      .order("date", { ascending: false })
      .order("item_name");
    if (error) showToast("Lỗi tải dữ liệu: " + error.message, "error");
    else setSales(data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => { fetchSales(); }, [fetchSales]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  // Parse Excel: expect columns: Ngày | Tên món | Số lượng
  // Also support Fabi's own export format (auto-detect)
  const handleExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setUploading(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary", cellDates: true });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: true });

        // Auto-detect header row
        let headerRow = 0;
        for (let i = 0; i < Math.min(5, data.length); i++) {
          const row = data[i].map((c) => String(c || "").toLowerCase());
          if (
            row.some((c) => c.includes("ngày") || c.includes("date")) &&
            row.some((c) => c.includes("tên") || c.includes("món") || c.includes("item"))
          ) {
            headerRow = i;
            break;
          }
        }

        const headers = data[headerRow].map((c) => String(c || "").toLowerCase());
        const dateCol = headers.findIndex((h) => h.includes("ngày") || h.includes("date"));
        const nameCol = headers.findIndex((h) => h.includes("tên") || h.includes("món") || h.includes("item") || h.includes("name"));
        const qtyCol = headers.findIndex((h) => h.includes("số lượng") || h.includes("sl") || h.includes("qty") || h.includes("quantity"));

        if (dateCol < 0 || nameCol < 0 || qtyCol < 0) {
          showToast("Không nhận dạng được cột. Cần: Ngày | Tên món | Số lượng", "error");
          setUploading(false);
          return;
        }

        const rows: { date: string; item_name: string; quantity: number }[] = [];

        for (let i = headerRow + 1; i < data.length; i++) {
          const row = data[i];
          const cellDate = row[dateCol];
          const itemName = String(row[nameCol] || "").trim();
          const qty = parseFloat(String(row[qtyCol] || "0")) || 0;

          if (!cellDate || !itemName || qty <= 0) continue;

          let dateStr = "";

          if (cellDate instanceof Date) {
            // XLSX tạo Date theo local time → dùng local methods (không dùng UTC)
            const y = cellDate.getFullYear();
            const m = String(cellDate.getMonth() + 1).padStart(2, "0");
            const d = String(cellDate.getDate()).padStart(2, "0");
            dateStr = `${y}-${m}-${d}`;
          } else if (typeof cellDate === "number") {
            // Fallback: Excel serial chưa được chuyển → convert qua local time
            const jsDate = new Date(Math.round((cellDate - 25569) * 86400 * 1000));
            const y = jsDate.getFullYear();
            const m = String(jsDate.getMonth() + 1).padStart(2, "0");
            const d = String(jsDate.getDate()).padStart(2, "0");
            dateStr = `${y}-${m}-${d}`;
          } else {
            // Text cell: hỗ trợ yyyy-mm-dd và dd/mm/yyyy
            const rawDate = String(cellDate).trim();
            if (/^\d{4}-\d{2}-\d{2}$/.test(rawDate)) {
              dateStr = rawDate;
            } else if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
              // Gõ tay dạng text: giả định dd/mm/yyyy
              const [d, m, y] = rawDate.split("/");
              dateStr = `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
            } else {
              continue;
            }
          }

          rows.push({ date: dateStr, item_name: itemName, quantity: qty });
        }

        if (rows.length === 0) {
          showToast("Không tìm thấy dữ liệu hợp lệ trong file", "error");
          setUploading(false);
          return;
        }

        // Group by date and delete existing before insert
        const dates = Array.from(new Set(rows.map((r) => r.date)));
        for (const d of dates) {
          await supabase.from("fabi_sales").delete().eq("date", d);
        }

        const { error } = await supabase.from("fabi_sales").insert(rows);
        if (error) {
          showToast("Lỗi lưu dữ liệu: " + error.message, "error");
        } else {
          showToast(`Đã import ${rows.length} dòng (${dates.length} ngày)`);
          // Fetch lại trực tiếp — tránh stale closure của fetchSales
          const monthStr = getMonthStr(year, month);
          const lastDay = new Date(year, month + 1, 0).getDate();
          const lastDayStr = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
          const { data: refreshed } = await supabase
            .from("fabi_sales")
            .select("*")
            .gte("date", `${monthStr}-01`)
            .lte("date", lastDayStr)
            .order("date", { ascending: false })
            .order("item_name");
          setSales(refreshed || []);
        }
      } catch {
        showToast("Lỗi đọc file Excel. Kiểm tra định dạng file.", "error");
      }
      setUploading(false);
    };
    reader.readAsBinaryString(file);
  };

  const handleDeleteDate = async (date: string) => {
    const { error } = await supabase.from("fabi_sales").delete().eq("date", date);
    if (error) showToast("Lỗi xóa: " + error.message, "error");
    else {
      setSales((prev) => prev.filter((s) => s.date !== date));
      showToast(`Đã xóa dữ liệu ngày ${formatDate(date)}`);
    }
    setDeleteDate(null);
  };

  // Group by date
  const groupedByDate: GroupedSale[] = [];
  const dateMap: Record<string, FabiSale[]> = {};
  sales.forEach((s) => {
    if (!dateMap[s.date]) dateMap[s.date] = [];
    dateMap[s.date].push(s);
  });
  Object.keys(dateMap)
    .sort((a, b) => b.localeCompare(a))
    .forEach((date) => {
      groupedByDate.push({
        date,
        items: dateMap[date],
        total: dateMap[date].reduce((sum, s) => sum + s.quantity, 0),
      });
    });

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Dữ liệu Fabi</h1>
          <p className="text-xs text-muted-foreground mt-0.5">Doanh thu từ máy POS</p>
        </div>
        <Button size="lg" className="gap-2" onClick={() => fileRef.current?.click()} disabled={uploading}>
          <Upload className="h-5 w-5" />
          {uploading ? "Đang xử lý..." : "Import Excel"}
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
      </div>

      {/* Excel format hint */}
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-xs text-amber-800">
        <p className="font-semibold mb-1">Định dạng Excel chuẩn:</p>
        <p>Cột A: Ngày · Cột B: Tên món · Cột C: Số lượng</p>
        <p className="mt-1">Ngày dùng dạng <strong>2026-04-11</strong> (yyyy-mm-dd) để tránh nhầm lẫn</p>
      </div>

      {/* Month navigator */}
      <div className="flex items-center gap-2 bg-muted rounded-xl p-2">
        <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => changeMonth(-1)}>
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <span className="flex-1 text-center font-semibold text-sm">
          Tháng {month + 1}/{year}
        </span>
        <Button
          size="icon" variant="ghost" className="h-9 w-9"
          onClick={() => changeMonth(1)}
          disabled={year === today.getFullYear() && month >= today.getMonth()}
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      {/* Data */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : groupedByDate.length === 0 ? (
        <div className="py-16 text-center">
          <FileSpreadsheet className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Chưa có dữ liệu tháng này</p>
          <p className="text-sm text-muted-foreground mt-1">Nhấn &quot;Import Excel&quot; để tải lên</p>
        </div>
      ) : (
        <div className="space-y-3">
          {groupedByDate.map((group) => (
            <Card key={group.date} className="overflow-hidden">
              <CardContent className="p-0">
                {deleteDate === group.date ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-medium text-red-800 mb-3">
                      Xóa dữ liệu ngày {formatDate(group.date)}?
                    </p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleDeleteDate(group.date)}>Xóa</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setDeleteDate(null)}>Hủy</Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      className="w-full flex items-center gap-3 p-4 text-left"
                      onClick={() => setExpandedDate(expandedDate === group.date ? null : group.date)}
                    >
                      <Calendar className="h-5 w-5 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-foreground">{formatDate(group.date)}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {group.items.length} món · Tổng: {formatNumber(group.total, 0)} phần
                        </p>
                      </div>
                      <Button
                        size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive shrink-0"
                        onClick={(e) => { e.stopPropagation(); setDeleteDate(group.date); }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </button>

                    {expandedDate === group.date && (
                      <div className="border-t">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-muted/40">
                              <th className="text-left px-4 py-2 font-medium text-muted-foreground">Tên món</th>
                              <th className="text-right px-4 py-2 font-medium text-muted-foreground">Số lượng</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.items.map((item) => (
                              <tr key={item.id} className="border-t">
                                <td className="px-4 py-2">{item.item_name}</td>
                                <td className="px-4 py-2 text-right font-semibold">
                                  {formatNumber(item.quantity, 0)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </>
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
