"use client";
import { useState } from "react";
import { Wallet, Receipt, Landmark, BarChart3 } from "lucide-react";
import { Toast, useToast } from "@/components/ui/toast";
import { useAuth } from "@/contexts/auth-context";
import { RevenueTab } from "./revenue-tab";
import { ExpenseTab } from "./expense-tab";
import { DepositTab } from "./deposit-tab";
import { SummaryTab } from "./summary-tab";

type Tab = "revenue" | "expense" | "deposit" | "summary";

const TABS: { key: Tab; label: string; icon: React.ElementType }[] = [
  { key: "revenue", label: "Thu", icon: Wallet },
  { key: "expense", label: "Chi", icon: Receipt },
  { key: "deposit", label: "Nộp", icon: Landmark },
  { key: "summary", label: "Tổng hợp", icon: BarChart3 },
];

export default function FinancePage() {
  const { profile } = useAuth();
  const [tab, setTab] = useState<Tab>("revenue");
  const { toast, showToast, hideToast } = useToast();

  // Only admin, supervisor, manager can access
  const allowed = profile && (profile.role === "admin" || profile.role === "supervisor" || profile.role === "manager");
  if (!allowed) {
    return (
      <div className="px-4 py-16 text-center text-muted-foreground">
        Bạn không có quyền truy cập trang này
      </div>
    );
  }

  const onError = (msg: string) => showToast(msg, "error");
  const onSuccess = (msg: string) => showToast(msg);

  return (
    <div className="space-y-3">
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-xl font-bold">Thu chi</h1>
      </div>

      {/* Tab switcher */}
      <div className="px-4">
        <div className="grid grid-cols-4 gap-1 bg-muted rounded-xl p-1">
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

      {tab === "revenue" && <RevenueTab onError={onError} onSuccess={onSuccess} />}
      {tab === "expense" && <ExpenseTab onError={onError} onSuccess={onSuccess} />}
      {tab === "deposit" && <DepositTab onError={onError} onSuccess={onSuccess} />}
      {tab === "summary" && <SummaryTab onError={onError} />}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  );
}
