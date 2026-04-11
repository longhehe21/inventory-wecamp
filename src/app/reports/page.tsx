"use client";
import { useState, useCallback } from "react";
import { Search, TrendingDown, TrendingUp, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Toast, useToast } from "@/components/ui/toast";
import { supabase } from "@/lib/supabase";
import { Product, Recipe, InventoryDaily, FabiSale } from "@/types/database";
import { formatNumber, formatDate } from "@/lib/utils";

interface ReportRow {
  product: Product;
  actualUsed: number;       // from inventory_daily
  fabiUsed: number;         // calculated from fabi_sales × recipes
  diff: number;             // actualUsed - fabiUsed
}

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

function getMonthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function ReportsPage() {
  const [fromDate, setFromDate] = useState(getMonthStartStr());
  const [toDate, setToDate] = useState(getTodayStr());
  const [rows, setRows] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasRun, setHasRun] = useState(false);
  const [filterText, setFilterText] = useState("");
  const { toast, showToast, hideToast } = useToast();

  const runReport = useCallback(async () => {
    if (!fromDate || !toDate) { showToast("Chọn khoảng ngày", "error"); return; }
    if (fromDate > toDate) { showToast("Ngày bắt đầu phải trước ngày kết thúc", "error"); return; }

    setLoading(true);
    setHasRun(false);

    // Fetch everything in parallel
    const [productsRes, inventoryRes, recipesRes, fabiRes] = await Promise.all([
      supabase.from("products").select("*"),
      supabase.from("inventory_daily").select("*").gte("date", fromDate).lte("date", toDate),
      supabase.from("recipes").select("*"),
      supabase.from("fabi_sales").select("*").gte("date", fromDate).lte("date", toDate),
    ]);

    if (productsRes.error || inventoryRes.error || recipesRes.error || fabiRes.error) {
      showToast("Lỗi tải dữ liệu báo cáo", "error");
      setLoading(false);
      return;
    }

    const products: Product[] = productsRes.data || [];
    const inventoryRecords: InventoryDaily[] = inventoryRes.data || [];
    const recipes: Recipe[] = recipesRes.data || [];
    const fabiSales: FabiSale[] = fabiRes.data || [];

    // 1. Calculate actual used per product from inventory
    const actualMap: Record<string, number> = {};
    inventoryRecords.forEach((inv) => {
      actualMap[inv.product_id] = (actualMap[inv.product_id] || 0) + inv.actual_used;
    });

    // 2. Calculate fabi used per product from sales × recipes
    // Build recipe lookup: item_name (lowercase) → ingredients
    const recipeMap: Record<string, Recipe> = {};
    recipes.forEach((r) => {
      recipeMap[r.name.toLowerCase().trim()] = r;
    });

    const fabiMap: Record<string, number> = {};
    fabiSales.forEach((sale) => {
      const recipe = recipeMap[sale.item_name.toLowerCase().trim()];
      if (!recipe) return;
      recipe.ingredients.forEach((ing) => {
        fabiMap[ing.product_id] = (fabiMap[ing.product_id] || 0) + ing.quantity * sale.quantity;
      });
    });

    // 3. Build report rows for products that appear in either actual or fabi
    const relevantIds = new Set([
      ...Object.keys(actualMap),
      ...Object.keys(fabiMap),
    ]);

    const reportRows: ReportRow[] = products
      .filter((p) => relevantIds.has(p.id))
      .map((p) => {
        const actualUsed = actualMap[p.id] || 0;
        const fabiUsed = fabiMap[p.id] || 0;
        return {
          product: p,
          actualUsed,
          fabiUsed,
          diff: actualUsed - fabiUsed,
        };
      })
      .sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff)); // biggest diff first

    setRows(reportRows);
    setLoading(false);
    setHasRun(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const filtered = rows.filter((r) =>
    r.product.name.toLowerCase().includes(filterText.toLowerCase())
  );

  const totalDiffPos = rows.filter((r) => r.diff > 0).length;
  const totalDiffNeg = rows.filter((r) => r.diff < 0).length;

  return (
    <div className="px-4 py-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Đối soát chênh lệch</h1>
        <p className="text-xs text-muted-foreground mt-0.5">So sánh lượng dùng thực tế vs Fabi (hệ thống)</p>
      </div>

      {/* Date range */}
      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Từ ngày</label>
              <input
                type="date"
                value={fromDate}
                max={toDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-medium text-muted-foreground">Đến ngày</label>
              <input
                type="date"
                value={toDate}
                min={fromDate}
                max={getTodayStr()}
                onChange={(e) => setToDate(e.target.value)}
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <Button className="w-full h-12 text-base" onClick={runReport} disabled={loading}>
            {loading ? "Đang tính toán..." : "Xem báo cáo"}
          </Button>
        </CardContent>
      </Card>

      {hasRun && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-muted rounded-xl p-3 text-center">
              <p className="text-xl font-bold">{rows.length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Hàng hóa</p>
            </div>
            <div className="bg-red-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-red-600">{totalDiffPos}</p>
              <p className="text-[10px] text-red-600 mt-0.5">Dùng vượt</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-xl font-bold text-green-600">{totalDiffNeg}</p>
              <p className="text-[10px] text-green-600 mt-0.5">Dùng thiếu</p>
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center">
            {formatDate(fromDate)} → {formatDate(toDate)}
          </p>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Tìm hàng hóa..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="flex h-11 w-full rounded-md border border-input bg-background pl-10 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>

          {/* Report table */}
          {filtered.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Không có dữ liệu</p>
          ) : (
            <div className="space-y-2">
              {filtered.map((row) => {
                const isOver = row.diff > 0.001;
                const isUnder = row.diff < -0.001;
                const isMatch = !isOver && !isUnder;

                return (
                  <div
                    key={row.product.id}
                    className={`border rounded-xl overflow-hidden ${
                      isOver ? "border-red-200" : isUnder ? "border-amber-200" : "border-green-200"
                    }`}
                  >
                    {/* Product name & category */}
                    <div className={`px-4 py-2 flex items-center justify-between ${
                      isOver ? "bg-red-50" : isUnder ? "bg-amber-50" : "bg-green-50"
                    }`}>
                      <span className="font-semibold text-sm">{row.product.name}</span>
                      <div className="flex items-center gap-1">
                        {isOver && <TrendingUp className="h-4 w-4 text-red-500" />}
                        {isUnder && <TrendingDown className="h-4 w-4 text-amber-500" />}
                        {isMatch && <Minus className="h-4 w-4 text-green-500" />}
                        <span className={`text-xs font-bold ${
                          isOver ? "text-red-600" : isUnder ? "text-amber-600" : "text-green-600"
                        }`}>
                          {isOver ? "+" : ""}{formatNumber(row.diff, 2)} {row.product.unit}
                        </span>
                      </div>
                    </div>

                    {/* Detail row */}
                    <div className="grid grid-cols-2 bg-white">
                      <div className="px-4 py-3 border-r">
                        <p className="text-[10px] text-muted-foreground">Thực tế (kho)</p>
                        <p className="font-semibold text-sm mt-0.5">
                          {formatNumber(row.actualUsed, 2)} {row.product.unit}
                        </p>
                      </div>
                      <div className="px-4 py-3">
                        <p className="text-[10px] text-muted-foreground">Fabi (hệ thống)</p>
                        <p className="font-semibold text-sm mt-0.5">
                          {formatNumber(row.fabiUsed, 2)} {row.product.unit}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  );
}
