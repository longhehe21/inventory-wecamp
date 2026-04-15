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

  // Helper: product has packaging unit
  const hasPkg = (p: Product) => !!p.package_unit && p.package_size > 0;
  // Convert base units → display units (package or base)
  const toDisplay = (baseVal: number, p: Product) =>
    hasPkg(p) ? baseVal / p.package_size : baseVal;
  // Convert display units → base units for saving
  const toBase = (displayVal: number, p: Product) =>
    hasPkg(p) ? displayVal * p.package_size : displayVal;
  // Unit label shown to user
  const displayUnit = (p: Product) => hasPkg(p) ? p.package_unit! : p.unit;

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
          // Round to 4 decimal places to avoid floating point noise, keep as plain number string
          const toInputStr = (val: number) => parseFloat(toDisplay(val, p).toFixed(4)).toString();
          return {
            product_id: p.id,
            // opening_stock stored in base units
            opening_stock: today.opening_stock,
            // received/closing in display units (package or base)
            received: toInputStr(today.received),
            closing_stock: toInputStr(today.closing_stock),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      const closingDisplay = parseFloat(row.closing_stock);
      if (isNaN(closingDisplay) || row.closing_stock === "") continue; // skip empty rows

      const product = products.find((p) => p.id === row.product_id);
      if (!product) continue;

      // Convert display units → base units before saving
      const closing = toBase(closingDisplay, product);
      const received = toBase(parseFloat(row.received) || 0, product);
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
    const header = ["Tên hàng hóa", "Đơn vị nhập", "Nhập hàng", "Tồn cuối"];
    const dataRows = products.map((p) => [p.name, displayUnit(p), "", ""]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 12 }, { wch: 12 }];
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
            // Col 1: Đơn vị nhập (bỏ qua), Col 2: Nhập hàng, Col 3: Tồn cuối
            // Support both old format (col1=received, col2=closing) and new format (col1=unit, col2=received, col3=closing)
            const hasUnitCol = isNaN(parseFloat((row[1] || "").toString()));
            const receivedDisplay = parseFloat((hasUnitCol ? row[2] : row[1] || "0").toString()) || 0;
            const closingDisplay = ((hasUnitCol ? row[3] : row[2]) || "").toString().trim();
            const idx = products.findIndex(
              (p) => p.name.toLowerCase() === name
            );
            if (idx !== -1) {
              next[idx] = {
                ...next[idx],
                received: receivedDisplay.toString(),
                closing_stock: closingDisplay,
              };
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

  const getActualUsed = (row: RowState, product: Product) => {
    const closingDisplay = parseFloat(row.closing_stock);
    if (isNaN(closingDisplay)) return null;
    const receivedDisplay = parseFloat(row.received) || 0;
    if (hasPkg(product)) {
      // All in display (package) units: convert opening from base first
      const openingDisplay = toDisplay(row.opening_stock, product);
      return openingDisplay + receivedDisplay - closingDisplay;
    }
    return row.opening_stock + receivedDisplay - closingDisplay;
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
            const actualUsed = getActualUsed(row, product);
            const usesPkg = hasPkg(product);
            const unit = displayUnit(product);
            const openingDisplay = usesPkg ? toDisplay(row.opening_stock, product) : row.opening_stock;

            // Conversion hint: show base unit equivalent for closing stock
            const closingVal = parseFloat(row.closing_stock);
            const closingBase = usesPkg && !isNaN(closingVal) ? toBase(closingVal, product) : null;

            return (
              <div
                key={row.product_id}
                className="border rounded-xl bg-white overflow-hidden"
              >
                {/* Product name row */}
                <div className="flex items-center justify-between px-3 pt-3 pb-1">
                  <div>
                    <span className="font-semibold text-sm text-foreground">{product.name}</span>
                    {usesPkg && (
                      <span className="text-[10px] text-blue-600 ml-1.5">
                        1 {product.package_unit} = {formatNumber(product.package_size, 0)} {product.unit}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground">({unit})</span>
                </div>

                {/* Input grid */}
                <div className="grid grid-cols-3 gap-2 px-3 pb-3">
                  {/* Opening stock (read-only) */}
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">Tồn đầu</p>
                    <div className="h-10 bg-muted rounded-md flex items-center justify-center text-sm font-medium">
                      {formatNumber(openingDisplay, 2)}
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

                {/* Conversion hint for package products */}
                {usesPkg && closingBase !== null && (
                  <div className="px-3 pb-1 text-[10px] text-blue-600">
                    = {formatNumber(closingBase, 1)} {product.unit}
                  </div>
                )}

                {/* Actual used */}
                {actualUsed !== null && (
                  <div className={`px-3 pb-2 text-xs font-medium ${actualUsed < 0 ? "text-red-600" : "text-green-700"}`}>
                    Lượng dùng: {formatNumber(actualUsed, 2)} {unit}
                    {usesPkg && (
                      <span className="text-muted-foreground font-normal ml-1">
                        (= {formatNumber(toBase(actualUsed, product), 1)} {product.unit})
                      </span>
                    )}
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
