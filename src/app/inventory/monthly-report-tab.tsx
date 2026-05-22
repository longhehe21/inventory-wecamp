"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Product, InventoryDaily, Warehouse } from "@/types/database";
import { formatNumber } from "@/lib/utils";
import * as XLSX from "xlsx";

interface Props {
  warehouse: Warehouse;
  products: Product[];
  onError: (msg: string) => void;
}

interface ReportRow {
  product: Product;
  days: Record<string, { opening: number; received: number; closing: number; used: number } | null>;
  totalUsed: number;
  totalReceived: number;
}

function getMonthStr(year: number, month: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}`;
}

function getDaysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const d = new Date(year, month + 1, 0);
  for (let i = 1; i <= d.getDate(); i++) {
    days.push(`${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`);
  }
  return days;
}

export function MonthlyReportTab({ warehouse, products, onError }: Props) {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [records, setRecords] = useState<InventoryDaily[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchRecords = useCallback(async () => {
    if (!products.length) return;
    setLoading(true);
    const monthStr = getMonthStr(year, month);
    // Tính ngày cuối tháng chính xác (tránh lỗi với tháng 30 ngày)
    const lastDay = new Date(year, month + 1, 0).getDate();
    const lastDayStr = `${monthStr}-${String(lastDay).padStart(2, "0")}`;
    const { data, error } = await supabase
      .from("inventory_daily")
      .select("*")
      .eq("warehouse", warehouse)
      .gte("date", `${monthStr}-01`)
      .lte("date", lastDayStr)
      .in("product_id", products.map((p) => p.id))
      .order("date");
    if (error) onError("Lỗi tải báo cáo: " + error.message);
    else setRecords(data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month, products, warehouse]);

  useEffect(() => { fetchRecords(); }, [fetchRecords]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const days = getDaysInMonth(year, month);
  const monthLabel = `Tháng ${month + 1}/${year}`;

  // Build report rows
  const reportRows: ReportRow[] = products.map((product) => {
    const dayMap: ReportRow["days"] = {};
    let totalUsed = 0;
    let totalReceived = 0;

    records
      .filter((r) => r.product_id === product.id)
      .forEach((r) => {
        dayMap[r.date] = {
          opening: r.opening_stock,
          received: r.received,
          closing: r.closing_stock,
          used: r.actual_used,
        };
        totalUsed += r.actual_used;
        totalReceived += r.received;
      });

    return { product, days: dayMap, totalUsed, totalReceived };
  });

  // Only show days that have any data
  const activeDays = days.filter((d) =>
    reportRows.some((r) => r.days[d] !== undefined)
  );

  // Build a worksheet (full month grid) for a given set of products + records
  const buildMonthSheet = (prods: Product[], recs: InventoryDaily[]) => {
    const productRows: ReportRow[] = prods.map((product) => {
      const dayMap: ReportRow["days"] = {};
      let totalUsed = 0;
      let totalReceived = 0;
      recs.filter((r) => r.product_id === product.id).forEach((r) => {
        dayMap[r.date] = {
          opening: r.opening_stock,
          received: r.received,
          closing: r.closing_stock,
          used: r.actual_used,
        };
        totalUsed += r.actual_used;
        totalReceived += r.received;
      });
      return { product, days: dayMap, totalUsed, totalReceived };
    });

    const monthDays = getDaysInMonth(year, month);
    const usedDays = monthDays.filter((d) => productRows.some((r) => r.days[d] !== undefined));

    const header = [
      "Hàng hóa",
      "Đơn vị",
      ...usedDays.map((d) => `${d.split("-")[2]}/${d.split("-")[1]}`),
      "Tổng nhập",
      "Tổng dùng",
    ];
    const dataRows = productRows.map((row) => [
      row.product.name,
      row.product.unit,
      ...usedDays.map((d) => {
        const cell = row.days[d];
        return cell ? Number(cell.used.toFixed(4)) : "";
      }),
      Number(row.totalReceived.toFixed(4)),
      Number(row.totalUsed.toFixed(4)),
    ]);

    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws["!cols"] = [
      { wch: 25 }, { wch: 10 },
      ...usedDays.map(() => ({ wch: 8 })),
      { wch: 12 }, { wch: 12 },
    ];
    return ws;
  };

  // Export current warehouse only
  const handleExportCurrent = () => {
    if (!products.length) {
      onError("Chưa có hàng hóa để xuất");
      return;
    }
    const ws = buildMonthSheet(products, records);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, warehouse);
    XLSX.writeFile(wb, `bao-cao-${warehouse}-${getMonthStr(year, month)}.xlsx`);
  };

  // Export all warehouses in one workbook (3 sheets)
  const handleExportAll = async () => {
    const monthStr = getMonthStr(year, month);
    const lastDay = new Date(year, month + 1, 0).getDate();
    const lastDayStr = `${monthStr}-${String(lastDay).padStart(2, "0")}`;

    const { data: allProductsData, error: pErr } = await supabase
      .from("products")
      .select("*")
      .order("name");
    if (pErr) {
      onError("Lỗi tải hàng hóa: " + pErr.message);
      return;
    }
    const allProducts = (allProductsData as Product[]) || [];

    const { data: allRecords, error: rErr } = await supabase
      .from("inventory_daily")
      .select("*")
      .gte("date", `${monthStr}-01`)
      .lte("date", lastDayStr)
      .in("product_id", allProducts.map((p) => p.id));
    if (rErr) {
      onError("Lỗi tải báo cáo: " + rErr.message);
      return;
    }
    const recs = (allRecords as InventoryDaily[]) || [];

    const wb = XLSX.utils.book_new();
    (["Bếp", "Quầy", "Lễ tân"] as Warehouse[]).forEach((wh) => {
      const prods =
        wh === "Lễ tân"
          ? allProducts.filter((p) => p.category === "Lễ tân" || p.in_letan)
          : allProducts.filter((p) => p.category === wh);
      if (!prods.length) return;
      const whRecs = recs.filter((r) => r.warehouse === wh);
      const ws = buildMonthSheet(prods, whRecs);
      XLSX.utils.book_append_sheet(wb, ws, wh);
    });

    if (wb.SheetNames.length === 0) {
      onError("Không có dữ liệu để xuất");
      return;
    }
    XLSX.writeFile(wb, `bao-cao-tat-ca-${monthStr}.xlsx`);
  };

  return (
    <div className="space-y-3 px-4">
      {/* Month navigator */}
      <div className="flex items-center gap-2 bg-muted rounded-xl p-2">
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

      {/* Export buttons */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
          onClick={handleExportCurrent}
          disabled={loading || products.length === 0}
        >
          <FileDown className="h-4 w-4" />
          Xuất kho hiện tại
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="flex-1 gap-1.5 text-green-700 border-green-200 hover:bg-green-50"
          onClick={handleExportAll}
          disabled={loading}
        >
          <FileDown className="h-4 w-4" />
          Xuất tất cả kho
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-12 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : activeDays.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p>Chưa có dữ liệu tồn kho tháng này</p>
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="space-y-2">
            {reportRows
              .filter((r) => r.totalUsed !== 0 || r.totalReceived !== 0)
              .map((row) => (
                <div key={row.product.id} className="border rounded-xl bg-white p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-sm">{row.product.name}</span>
                    <span className="text-xs text-muted-foreground">{row.product.unit}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-blue-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] text-blue-600">Tổng nhập</p>
                      <p className="font-bold text-blue-700 text-sm">{formatNumber(row.totalReceived, 1)}</p>
                    </div>
                    <div className="bg-green-50 rounded-lg px-3 py-2 text-center">
                      <p className="text-[10px] text-green-600">Tổng dùng</p>
                      <p className="font-bold text-green-700 text-sm">{formatNumber(row.totalUsed, 1)}</p>
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Detail table */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
              Chi tiết từng ngày (lượng dùng)
            </p>
            <div className="overflow-x-auto rounded-xl border bg-white">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="sticky left-0 bg-muted/50 text-left px-3 py-2 font-semibold min-w-[120px]">
                      Hàng hóa
                    </th>
                    {activeDays.map((d) => (
                      <th key={d} className="px-2 py-2 font-medium text-center whitespace-nowrap min-w-[50px]">
                        {d.split("-")[2]}/{d.split("-")[1]}
                      </th>
                    ))}
                    <th className="px-3 py-2 font-semibold text-center bg-green-50 text-green-700 min-w-[70px]">
                      Tổng
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {reportRows.map((row, i) => (
                    <tr key={row.product.id} className={i % 2 === 0 ? "" : "bg-muted/20"}>
                      <td className="sticky left-0 bg-white px-3 py-2 font-medium border-r text-xs">
                        {row.product.name}
                        <span className="text-muted-foreground ml-1">({row.product.unit})</span>
                      </td>
                      {activeDays.map((d) => {
                        const cell = row.days[d];
                        return (
                          <td key={d} className="px-2 py-2 text-center">
                            {cell ? (
                              <span className={cell.used < 0 ? "text-red-600 font-medium" : ""}>
                                {formatNumber(cell.used, 1)}
                              </span>
                            ) : (
                              <span className="text-muted-foreground/40">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2 text-center font-bold text-green-700 bg-green-50">
                        {formatNumber(row.totalUsed, 1)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
