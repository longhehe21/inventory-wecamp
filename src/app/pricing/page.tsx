"use client";
import { useState } from "react";
import { Users, FileText, Zap } from "lucide-react";
import { Toast, useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/auth-context";
import { SuppliersTab } from "./suppliers-tab";
import { PriceListsTab } from "./price-lists-tab";
import { CostOverheadTab } from "./cost-overhead-tab";

type Tab = "price-lists" | "suppliers" | "overhead";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "price-lists", label: "Bảng giá", icon: FileText },
  { key: "suppliers", label: "NCC", icon: Users },
  { key: "overhead", label: "Định mức", icon: Zap },
];

export default function PricingPage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("price-lists");
  const { toast, showToast, hideToast } = useToast();

  if (profile && profile.role !== "admin") {
    return (
      <div className="px-4 py-16 text-center text-muted-foreground">
        Bạn không có quyền truy cập trang này
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold">Giá vốn</h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          Quản lý bảng giá nguyên liệu, nhà cung cấp, và chi phí định mức để tính cost món
        </p>
      </div>

      <div className="px-4">
        <div className="grid grid-cols-3 gap-1 bg-muted rounded-xl p-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 rounded-lg text-xs font-medium transition-colors ${
                tab === key
                  ? "bg-white shadow text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        {tab === "price-lists" && <PriceListsTab onError={(m) => showToast(m, "error")} onSuccess={(m) => showToast(m)} />}
        {tab === "suppliers" && <SuppliersTab onError={(m) => showToast(m, "error")} onSuccess={(m) => showToast(m)} />}
        {tab === "overhead" && <CostOverheadTab onError={(m) => showToast(m, "error")} onSuccess={(m) => showToast(m)} />}
      </div>

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  );
}
