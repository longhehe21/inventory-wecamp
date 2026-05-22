"use client";
import { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { DailyInputTab } from "./daily-input-tab";
import { MonthlyReportTab } from "./monthly-report-tab";
import { supabase } from "@/lib/supabase";
import { Product, Warehouse } from "@/types/database";
import { useAuth } from "@/contexts/auth-context";

type Tab = "daily" | "monthly";

function getTodayStr() {
  return new Date().toISOString().split("T")[0];
}

export default function InventoryPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("daily");
  const [date, setDate] = useState(getTodayStr());
  const [products, setProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState(true);
  const { toast, showToast, hideToast } = useToast();

  // Only employees are locked to their assigned warehouse
  const isEmployee = profile?.role === "employee";
  const defaultWarehouse: Warehouse = isEmployee && profile?.category
    ? (profile.category as Warehouse)
    : "Bếp";
  const [warehouse, setWarehouse] = useState<Warehouse>(defaultWarehouse);

  useEffect(() => {
    if (isEmployee && profile?.category) {
      setWarehouse(profile.category as Warehouse);
    }
  }, [isEmployee, profile?.category]); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProducts = useCallback(async () => {
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("name");
    if (error) showToast("Lỗi tải hàng hóa: " + error.message, "error");
    else setProducts(data || []);
    setLoadingProducts(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const changeDate = (delta: number) => {
    const d = new Date(date);
    d.setDate(d.getDate() + delta);
    setDate(d.toISOString().split("T")[0]);
  };

  // Products visible in current warehouse:
  //  - Bếp / Quầy: products of that category
  //  - Lễ tân: category === 'Lễ tân' OR in_letan flag set
  const filteredProducts = useMemo(
    () =>
      products.filter((p) =>
        warehouse === "Lễ tân"
          ? p.category === "Lễ tân" || p.in_letan
          : p.category === warehouse
      ),
    [products, warehouse]
  );

  const warehouseStyles: Record<Warehouse, { active: string; pill: string; label: string }> = {
    "Bếp": { active: "bg-orange-500 text-white", pill: "bg-orange-100 text-orange-700", label: "🍳 Bếp" },
    "Quầy": { active: "bg-blue-500 text-white", pill: "bg-blue-100 text-blue-700", label: "☕ Quầy" },
    "Lễ tân": { active: "bg-purple-500 text-white", pill: "bg-purple-100 text-purple-700", label: "🛎️ Lễ tân" },
  };

  return (
    <div className="space-y-0">
      {/* Top controls */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Tồn kho</h1>
          {!isEmployee && (
            <div className="flex gap-1 bg-muted rounded-lg p-1">
              <button
                onClick={() => setTab("daily")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  tab === "daily" ? "bg-white shadow text-foreground" : "text-muted-foreground"
                }`}
              >
                Nhập hàng ngày
              </button>
              <button
                onClick={() => setTab("monthly")}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  tab === "monthly" ? "bg-white shadow text-foreground" : "text-muted-foreground"
                }`}
              >
                Báo cáo tháng
              </button>
            </div>
          )}
        </div>

        {/* Warehouse switcher — hidden for employees (locked to their warehouse) */}
        {isEmployee ? (
          <div className={`flex items-center justify-center py-2.5 rounded-xl text-sm font-semibold ${warehouseStyles[warehouse].pill}`}>
            Khu vực {warehouseStyles[warehouse].label}
          </div>
        ) : (
          <div className="flex gap-2">
            {(["Bếp", "Quầy", "Lễ tân"] as Warehouse[]).map((w) => (
              <button
                key={w}
                onClick={() => setWarehouse(w)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  warehouse === w ? warehouseStyles[w].active : "bg-muted text-muted-foreground"
                }`}
              >
                {warehouseStyles[w].label}
              </button>
            ))}
          </div>
        )}

        {/* Date picker (daily only) */}
        {tab === "daily" && (
          <div className="flex items-center gap-2 bg-muted rounded-xl p-2">
            <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0" onClick={() => changeDate(-1)}>
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <div className="flex-1 flex items-center justify-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="text-sm font-semibold bg-transparent outline-none text-center"
                max={getTodayStr()}
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-9 w-9 shrink-0"
              onClick={() => changeDate(1)}
              disabled={date >= getTodayStr()}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        )}
      </div>

      {tab === "daily" ? (
        <DailyInputTab
          date={date}
          warehouse={warehouse}
          products={filteredProducts}
          loadingProducts={loadingProducts}
          onError={(msg) => showToast(msg, "error")}
          onSuccess={(msg) => showToast(msg)}
        />
      ) : (
        <MonthlyReportTab
          warehouse={warehouse}
          products={filteredProducts}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  );
}
