"use client";
import { useState, useEffect, useCallback } from "react";
import { Calendar, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Toast, useToast } from "@/components/ui/toast";
import { DailyInputTab } from "./daily-input-tab";
import { MonthlyReportTab } from "./monthly-report-tab";
import { supabase } from "@/lib/supabase";
import { Product, ProductCategory } from "@/types/database";
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

  // Determine category: employees are locked to their category
  const isEmployee = profile?.role === "employee";
  const defaultCategory: ProductCategory = isEmployee && profile?.category
    ? (profile.category as ProductCategory)
    : "Bếp";
  const [category, setCategory] = useState<ProductCategory>(defaultCategory);

  // Sync category when profile loads
  useEffect(() => {
    if (isEmployee && profile?.category) {
      setCategory(profile.category as ProductCategory);
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

  const filteredProducts = products.filter((p) => p.category === category);

  return (
    <div className="space-y-0">
      {/* Top controls */}
      <div className="px-4 pt-4 pb-3 space-y-3">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">Tồn kho</h1>
          {/* Employees only see daily input, not monthly report for manager view */}
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

        {/* Category filter — hidden for employees (locked) */}
        {isEmployee ? (
          <div className={`flex items-center justify-center py-2.5 rounded-xl text-sm font-semibold ${
            category === "Bếp" ? "bg-orange-100 text-orange-700"
            : category === "Quầy" ? "bg-blue-100 text-blue-700"
            : "bg-purple-100 text-purple-700"
          }`}>
            {category === "Bếp" ? "🍳 Khu vực Bếp" : category === "Quầy" ? "☕ Khu vực Quầy" : "🛎️ Khu vực Lễ tân"}
          </div>
        ) : (
          <div className="flex gap-2">
            {(["Bếp", "Quầy", "Lễ tân"] as ProductCategory[]).map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors ${
                  category === cat
                    ? cat === "Bếp"
                      ? "bg-orange-500 text-white"
                      : cat === "Quầy"
                      ? "bg-blue-500 text-white"
                      : "bg-purple-500 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {cat === "Bếp" ? "🍳 Bếp" : cat === "Quầy" ? "☕ Quầy" : "🛎️ Lễ tân"}
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

      {/* Tab content */}
      {tab === "daily" ? (
        <DailyInputTab
          date={date}
          products={filteredProducts}
          loadingProducts={loadingProducts}
          onError={(msg) => showToast(msg, "error")}
          onSuccess={(msg) => showToast(msg)}
        />
      ) : (
        <MonthlyReportTab
          products={filteredProducts}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  );
}
