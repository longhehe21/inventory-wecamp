"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Save, Upload, RefreshCw, Package, Download, Trash2 } from "lucide-react";
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
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  // Bếp & Lễ tân use package units (hộp, túi...); Quầy uses base units (g, ml...)
  const usesPackageInput = (p: Product) =>
    (p.category === "Bếp" || p.category === "Lễ tân") &&
    !!p.package_unit && p.package_size > 0;
  const inputUnit = (p: Product) =>
    usesPackageInput(p) ? p.package_unit! : p.unit;
  const toDisplay = (baseVal: number, p: Product) =>
    usesPackageInput(p) ? baseVal / p.package_size : baseVal;
  const toBase = (displayVal: number, p: Product) =>
    usesPackageInput(p) ? displayVal * p.package_size : displayVal;

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
          // received/closing stored in DB as base units; convert for display when Lễ tân
          const toInputStr = (val: number) => parseFloat(toDisplay(val, p).toFixed(4)).toString();
          return {
            product_id: p.id,
            opening_stock: today.opening_stock, // kept in base for internal reference
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
    []
  );

  useEffect(() => {
    buildRows(products, date);
  }, [products, date, buildRows]);

  const updateRow = (idx: number, field: "received" | "closing_stock", val: string) => {
    // Convert any comma decimal separator to dot (Vietnamese keyboards often produce "4,1")
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
      const closingDisplay = parseFloat(row.closing_stock);
      if (isNaN(closingDisplay) || row.closing_stock === "") continue; // skip empty rows

      const product = products.find((p) => p.id === row.product_id);
      if (!product) continue;

      // Convert display → base units (only Lễ tân multiplies by package_size)
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

  // Xóa tất cả nhập hàng + tồn cuối của ngày hiện tại (cho hàng hóa đang xem)
  const handleClearAll = async () => {
    setClearing(true);
    const productIds = products.map((p) => p.id);
    const { error } = await supabase
      .from("inventory_daily")
      .delete()
      .eq("date", date)
      .in("product_id", productIds);

    setClearing(false);
    setConfirmingClear(false);

    if (error) {
      onError("Lỗi xóa: " + error.message);
      return;
    }

    // Reset state: keep opening_stock (from yesterday), clear received/closing
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        received: "0",
        closing_stock: "",
        existing_id: undefined,
      }))
    );
    onSuccess(`Đã xóa nhập hàng + tồn cuối ngày ${date.split("-").reverse().join("/")}`);
  };

  // Tải file Excel mẫu với danh sách hàng hóa hiện tại
  const handleDownloadTemplate = () => {
    const header = ["Tên hàng hóa", "Đơn vị nhập", "Nhập hàng", "Tồn cuối"];
    const dataRows = products.map((p) => [p.name, inputUnit(p), "", ""]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);
    ws["!cols"] = [{ wch: 25 }, { wch: 10 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Tồn kho");
    XLSX.writeFile(wb, `ton-kho-${date}.xlsx`);
  };

  // Excel import: expect columns: Tên hàng hóa | Đơn vị nhập | Nhập hàng | Tồn cuối
  const handleExcelUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
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
        // Normalize unicode + lowercase + strip extra whitespace for robust matching
        const norm = (s: string) =>
          s.normalize("NFC").trim().toLowerCase().replace(/\s+/g, " ");

        // Compute all updates synchronously BEFORE calling setRows.
        // (Mutating counters inside a setState updater is unreliable — the updater
        //  may run async/twice in React 18 strict mode, so the counts read after
        //  setRows would be wrong.)
        const toNumStr = (s: string) => s.trim().replace(",", ".");
        const updates: { idx: number; received: string; closing: string }[] = [];
        const unmatched: string[] = [];
        let totalRows = 0;

        data.slice(1).forEach((row) => {
          if (!row || !row.length) return;
          const rawName = safe(row[0]).trim();
          if (!rawName) return;
          totalRows++;
          const name = norm(rawName);

          // Support old (3 cols: name|received|closing) and new (4 cols: name|unit|received|closing)
          const col1 = safe(row[1]).trim();
          const hasUnitCol = col1 !== "" && isNaN(parseFloat(toNumStr(col1)));
          const receivedRaw = hasUnitCol ? safe(row[2]) : safe(row[1]);
          const closingRaw = hasUnitCol ? safe(row[3]) : safe(row[2]);

          const received = parseFloat(toNumStr(receivedRaw)) || 0;
          const closingNum = parseFloat(toNumStr(closingRaw));
          const closing = isNaN(closingNum) ? "" : closingNum.toString();

          const idx = products.findIndex((p) => norm(p.name) === name);
          if (idx !== -1) {
            updates.push({ idx, received: received.toString(), closing });
          } else {
            unmatched.push(rawName);
          }
        });

        const matched = updates.length;

        // Apply all updates in a single setRows call
        setRows((prev) => {
          const next = [...prev];
          updates.forEach(({ idx, received, closing }) => {
            next[idx] = { ...next[idx], received, closing_stock: closing };
          });
          return next;
        });

        if (matched === 0 && totalRows > 0) {
          const sample = unmatched.slice(0, 3).join(", ");
          onError(
            `Không khớp được hàng hóa nào (${totalRows} dòng). ` +
            `Kiểm tra kho đang chọn (${products.length > 0 ? products[0].category : "?"}) ` +
            `có chứa các tên: ${sample}${unmatched.length > 3 ? "..." : ""}`
          );
        } else if (matched < totalRows) {
          onSuccess(`Đã nhập ${matched}/${totalRows} hàng hóa (${totalRows - matched} không khớp tên)`);
        } else {
          onSuccess(`Đã nhập ${matched} hàng hóa từ Excel`);
        }
      } catch (err) {
        onError("Lỗi đọc file Excel: " + (err instanceof Error ? err.message : "định dạng không hợp lệ"));
      }
    };
    reader.onerror = () => onError("Không đọc được file Excel");
    reader.readAsArrayBuffer(file);
    e.target.value = "";
  };

  const getActualUsed = (row: RowState, product: Product) => {
    const closingDisplay = parseFloat(row.closing_stock);
    if (isNaN(closingDisplay)) return null;
    const receivedDisplay = parseFloat(row.received) || 0;
    // Compute in display units; opening_stock is base, convert for Lễ tân
    const openingDisplay = toDisplay(row.opening_stock, product);
    return openingDisplay + receivedDisplay - closingDisplay;
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
      <div className="px-4 flex gap-2 flex-wrap">
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
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-red-600 hover:bg-red-50 hover:text-red-700 border-red-200"
          onClick={() => setConfirmingClear(true)}
          disabled={clearing}
        >
          <Trash2 className="h-4 w-4" />
          Xóa tất cả
        </Button>
        <Button size="sm" className="gap-1.5 ml-auto" onClick={handleSaveAll} disabled={saving}>
          <Save className="h-4 w-4" />
          {saving ? "Đang lưu..." : "Lưu"}
        </Button>
      </div>

      {/* Confirmation banner for "Xóa tất cả" */}
      {confirmingClear && (
        <div className="mx-4 p-3 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm font-medium text-red-800 mb-1">
            Xóa tất cả Nhập hàng và Tồn cuối ngày {date.split("-").reverse().join("/")}?
          </p>
          <p className="text-xs text-red-600 mb-3">
            Sẽ xóa {products.length} hàng hóa của kho hiện tại. Tồn đầu (từ hôm qua) vẫn giữ lại. Hành động không thể hoàn tác.
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" className="flex-1" onClick={handleClearAll} disabled={clearing}>
              {clearing ? "Đang xóa..." : "Xóa hết"}
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setConfirmingClear(false)} disabled={clearing}>
              Hủy
            </Button>
          </div>
        </div>
      )}

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
            const usesPkg = usesPackageInput(product);
            const unit = inputUnit(product);
            const openingDisplay = toDisplay(row.opening_stock, product);

            // Conversion hint for Lễ tân: show base unit equivalent
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

                {/* Conversion hint for Lễ tân */}
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
