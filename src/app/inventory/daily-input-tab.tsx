"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Save, Upload, RefreshCw, Package, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { Product, InventoryDaily } from "@/types/database";
import { formatNumber } from "@/lib/utils";
import * as XLSX from "xlsx";

interface RowState {
  product_id: string;
  opening_stock: number;
  received: string;     // editable
  closing_stock: string; // editable
  existing_id?: string;
}

interface Props {
  date: string;
  products: Product[];
  loadingProducts: boolean;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function DailyInputTab({ date, products, loadingProducts, onError, onSuccess }: Props) {
  const [rows, setRows] = useState<RowState[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const buildRows = useCallback(
    async (prods: Product[], selectedDate: string) => {
      if (!prods.length) return;
      setLoading(true);

      // Get yesterday's closing stock
      const prevDate = new Date(selectedDate);
      prevDate.setDate(prevDate.getDate() - 1);
      const prevStr = prevDate.toISOString().split("T")[0];

      const productIds = prods.map((p) => p.id);

      const [prevRes, todayRes] = await Promise.all([
        supabase
          .from("inventory_daily")
          .select("product_id, closing_stock")
          .eq("date", prevStr)
          .in("product_id", productIds),
        supabase
          .from("inventory_daily")
          .select("*")
          .eq("date", selectedDate)
          .in("product_id", productIds),
      ]);

      const prevMap: Record<string, number> = {};
      (prevRes.data || []).forEach((r: { product_id: string; closing_stock: number }) => {
        prevMap[r.product_id] = r.closing_stock;
      });

      const todayMap: Record<string, InventoryDaily> = {};
      (todayRes.data || []).forEach((r: InventoryDaily) => {
        todayMap[r.product_id] = r;
      });

      const newRows: RowState[] = prods.map((p) => {
        const today = todayMap[p.id];
        const prevClosing = prevMap[p.id] ?? 0;
        if (today) {
          return {
            product_id: p.id,
            opening_stock: today.opening_stock,
            received: today.received.toString(),
            closing_stock: today.closing_stock.toString(),
            existing_id: today.id,
          };
        }
        return {
          product_id: p.id,
          opening_stock: prevClosing,
          received: "0",
          closing_stock: "",
          existing_id: undefined,
        };
      });

      setRows(newRows);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    buildRows(products, date);
  }, [products, date, buildRows]);

  const updateRow = (idx: number, field: "received" | "closing_stock", val: string) => {
    setRows((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: val };
      return next;
    });
  };

  const handleSaveAll = async () => {
    setSaving(true);
    let savedCount = 0;
    let errorCount = 0;

    for (const row of rows) {
      const closing = parseFloat(row.closing_stock);
      if (isNaN(closing) || row.closing_stock === "") continue; // skip empty rows

      const received = parseFloat(row.received) || 0;
      const opening = row.opening_stock;

      const payload = {
        product_id: row.product_id,
        date,
        opening_stock: opening,
        received,
        closing_stock: closing,
      };

      if (row.existing_id) {
        const { error } = await supabase
          .from("inventory_daily")
          .update({ received, closing_stock: closing })
          .eq("id", row.existing_id);
        if (error) errorCount++;
        else savedCount++;
      } else {
        const { error } = await supabase
          .from("inventory_daily")
          .insert(payload);
        if (error) errorCount++;
        else savedCount++;
      }
    }

    setSaving(false);
    if (errorCount > 0) onError(`Lỗi lưu ${errorCount} dòng`);
    else onSuccess(`Đã lưu ${savedCount} hàng hóa ngày ${date.split("-").reverse().join("/")}`);
    // Refresh to get IDs for newly inserted rows
    buildRows(products, date);
  };

  // Tải file Excel mẫu với danh sách hàng hóa hiện tại
  const handleDownloadTemplate = () => {
    const header = ["Tên hàng hóa", "Nhập hàng", "Tồn cuối"];
    const dataRows = products.map((p) => [p.name, "", ""]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tồn kho");
    XLSX.writeFile(wb, `ton-kho-${date}.xlsx`);
  };

  // Excel import: expect columns: Tên hàng hóa | Nhập hàng | Tồn cuối
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const data: string[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

        let matched = 0;
        setRows((prev) => {
          const next = [...prev];
          data.slice(1).forEach((row: string[]) => {
            const name = (row[0] || "").toString().trim().toLowerCase();
            const received = parseFloat((row[1] || "0").toString()) || 0;
            const closing = (row[2] || "").toString().trim();
            const idx = products.findIndex(
              (p) => p.name.toLowerCase() === name
            );
            if (idx !== -1) {
              next[idx] = { ...next[idx], received: received.toString(), closing_stock: closing };
              matched++;
            }
          });
          return next;
        });
        onSuccess(`Đã nhập ${matched} hàng hóa từ Excel`);
      } catch {
        onError("Lỗi đọc file Excel. Kiểm tra định dạng file.");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const getActualUsed = (row: RowState) => {
    const closing = parseFloat(row.closing_stock);
    if (isNaN(closing)) return null;
    return row.opening_stock + (parseFloat(row.received) || 0) - closing;
  };

  if (loadingProducts) {
    return (
      <div className="px-4 space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
      </div>
    );
  }

  if (!products.length) {
    return (
      <div className="px-4 py-12 text-center">
        <Package className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-muted-foreground">Chưa có hàng hóa nào cho phân loại này</p>
        <p className="text-sm text-muted-foreground mt-1">Thêm hàng hóa trong tab &quot;Hàng hóa&quot;</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Action buttons */}
      <div className="px-4 flex gap-2">
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleDownloadTemplate}>
          <Download className="h-4 w-4" />
          Mẫu
        </Button>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => fileRef.current?.click()}>
          <Upload className="h-4 w-4" />
          Import
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleExcelUpload} />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => buildRows(products, date)} disabled={loading}>
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Làm mới
        </Button>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={handleSaveAll} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>

      {/* Inventory table */}
      {loading ? (
        <div className="px-4 space-y-2">
          {products.map((_, i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="px-4 space-y-2">
          {rows.map((row, idx) => {
            const product = products.find((p) => p.id === row.product_id);
            if (!product) return null;
            const actualUsed = getActualUsed(row);

            return (
              <div
                key={row.product_id}
                className="border rounded-xl bg-white overflow-hidden"
              >
                {/* Product name row */}
                <div className="flex items-center justify-between px-3 pt-3 pb-1">
                  <span className="font-semibold text-sm text-foreground">{product.name}</span>
                  <span className="text-xs text-muted-foreground">({product.unit})</span>
                </div>

                {/* Input grid */}
                <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                  {/* Opening stock (read-only) */}
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Tồn đầu</p>
                    <div className="h-10 bg-muted rounded-md flex items-center justify-center text-sm font-medium">
                      {formatNumber(row.opening_stock, 1)}
                    </div>
                  </div>

                  {/* Received */}
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Nhập hàng</p>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.received}
                      onChange={(e) => updateRow(idx, "received", e.target.value)}
                      className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="0"
                    />
                  </div>

                  {/* Closing stock */}
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Tồn cuối *</p>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      value={row.closing_stock}
                      onChange={(e) => updateRow(idx, "closing_stock", e.target.value)}
                      className="h-10 w-full rounded-md border-2 border-primary bg-background px-2 text-sm text-center font-semibold focus:outline-none focus:ring-2 focus:ring-ring"
                      placeholder="Nhập..."
                    />
                  </div>
                </div>

                {/* Actual used */}
                {actualUsed !== null && (
                  <div className={`px-3 pb-2 text-xs font-medium ${actualUsed < 0 ? "text-red-600" : "text-green-700"}`}>
                    Lượng dùng: {formatNumber(actualUsed, 1)} {product.unit}
                    {actualUsed < 0 && " ⚠️ âm - kiểm tra lại"}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Bottom save button */}
      <div className="px-4 pb-4">
        <Button className="w-full h-12 text-base gap-2" onClick={handleSaveAll} disabled={saving}>
          <Save className="h-5 w-5" />
          {saving ? "Đang lưu..." : "Lưu tồn kho"}
        </Button>
      </div>
    </div>
  );
}
