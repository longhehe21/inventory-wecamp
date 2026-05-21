"use client";
import { useState, useEffect, useCallback } from "react";
import { ChevronLeft, ChevronRight, Wallet, Landmark, Banknote, TrendingUp, TrendingDown, Calculator } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/lib/supabase";
import { formatCurrency } from "@/lib/utils";

interface Props {
  onError: (msg: string) => void;
}

type Scope = "month" | "all";

interface Stats {
  revenueCash: number;
  revenueTransfer: number;
  expenseCash: number;
  expenseTransfer: number;
  deposits: number;
}

const ZERO_STATS: Stats = {
  revenueCash: 0,
  revenueTransfer: 0,
  expenseCash: 0,
  expenseTransfer: 0,
  deposits: 0,
};

export function SummaryTab({ onError }: Props) {
  const today = new Date();
  const [scope, setScope] = useState<Scope>("month");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());

  const [monthStats, setMonthStats] = useState<Stats>(ZERO_STATS);
  const [allStats, setAllStats] = useState<Stats>(ZERO_STATS);
  const [loading, setLoading] = useState(false);

  const monthStr = `${year}-${String(month + 1).padStart(2, "0")}`;
  const monthLabel = `Tháng ${month + 1}/${year}`;

  const fetchStats = useCallback(async () => {
    setLoading(true);

    const lastDay = new Date(year, month + 1, 0).getDate();
    const monthStart = `${monthStr}-01`;
    const monthEnd = `${monthStr}-${String(lastDay).padStart(2, "0")}`;

    const [
      revMonthRes, expMonthRes, depMonthRes,
      revAllRes, expAllRes, depAllRes,
    ] = await Promise.all([
      supabase.from("daily_revenue").select("cash, transfer").gte("date", monthStart).lte("date", monthEnd),
      supabase.from("expenses").select("payment_type, amount").gte("date", monthStart).lte("date", monthEnd),
      supabase.from("cash_deposits").select("amount").gte("date", monthStart).lte("date", monthEnd),
      supabase.from("daily_revenue").select("cash, transfer"),
      supabase.from("expenses").select("payment_type, amount"),
      supabase.from("cash_deposits").select("amount"),
    ]);

    const firstError = [revMonthRes, expMonthRes, depMonthRes, revAllRes, expAllRes, depAllRes].find((r) => r.error);
    if (firstError?.error) {
      onError("Lỗi tải tổng hợp: " + firstError.error.message);
      setLoading(false);
      return;
    }

    const sumRevenue = (rows: { cash: number; transfer: number }[]) => ({
      cash: rows.reduce((s, r) => s + (r.cash || 0), 0),
      transfer: rows.reduce((s, r) => s + (r.transfer || 0), 0),
    });
    const sumExpense = (rows: { payment_type: string; amount: number }[]) => ({
      cash: rows.filter((r) => r.payment_type === "cash").reduce((s, r) => s + (r.amount || 0), 0),
      transfer: rows.filter((r) => r.payment_type === "transfer").reduce((s, r) => s + (r.amount || 0), 0),
    });
    const sumDeposit = (rows: { amount: number }[]) => rows.reduce((s, r) => s + (r.amount || 0), 0);

    const monthRev = sumRevenue((revMonthRes.data as { cash: number; transfer: number }[]) || []);
    const monthExp = sumExpense((expMonthRes.data as { payment_type: string; amount: number }[]) || []);
    const monthDep = sumDeposit((depMonthRes.data as { amount: number }[]) || []);

    const allRev = sumRevenue((revAllRes.data as { cash: number; transfer: number }[]) || []);
    const allExp = sumExpense((expAllRes.data as { payment_type: string; amount: number }[]) || []);
    const allDep = sumDeposit((depAllRes.data as { amount: number }[]) || []);

    setMonthStats({
      revenueCash: monthRev.cash,
      revenueTransfer: monthRev.transfer,
      expenseCash: monthExp.cash,
      expenseTransfer: monthExp.transfer,
      deposits: monthDep,
    });
    setAllStats({
      revenueCash: allRev.cash,
      revenueTransfer: allRev.transfer,
      expenseCash: allExp.cash,
      expenseTransfer: allExp.transfer,
      deposits: allDep,
    });
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y);
  };

  const stats = scope === "month" ? monthStats : allStats;

  // Tiền mặt chưa nộp = doanh thu tiền mặt - chi tiền mặt - đã nộp
  // (Chỉ tính chính xác cho toàn bộ — phạm vi tháng chỉ phản ánh tháng đó)
  const cashOnHand = allStats.revenueCash - allStats.expenseCash - allStats.deposits;
  const totalRevenue = stats.revenueCash + stats.revenueTransfer;
  const totalExpense = stats.expenseCash + stats.expenseTransfer;
  const netCashRevenue = stats.revenueCash - stats.expenseCash;
  const netTransferRevenue = stats.revenueTransfer - stats.expenseTransfer;

  return (
    <div className="space-y-3 pb-4">
      {/* Scope switcher */}
      <div className="px-4 flex gap-2">
        <button
          onClick={() => setScope("month")}
          className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
            scope === "month"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-input"
          }`}
        >
          Theo tháng
        </button>
        <button
          onClick={() => setScope("all")}
          className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors ${
            scope === "all"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-background text-muted-foreground border-input"
          }`}
        >
          Tất cả
        </button>
      </div>

      {/* Month navigator (only when scope=month) */}
      {scope === "month" && (
        <div className="mx-4 flex items-center gap-2 bg-muted rounded-xl p-2">
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
      )}

      {loading ? (
        <div className="px-4 space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {/* Cash on hand — luôn tính toàn bộ (cumulative) */}
          <div className="bg-gradient-to-br from-emerald-500 to-emerald-700 text-white rounded-xl p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-1">
              <Wallet className="h-5 w-5" />
              <p className="text-xs uppercase tracking-wide opacity-90">Tiền mặt còn lại (cộng dồn)</p>
            </div>
            <p className="text-2xl font-bold">{formatCurrency(cashOnHand)}</p>
            <p className="text-[10px] opacity-80 mt-1">
              = Thu TM ({formatCurrency(allStats.revenueCash)}) − Chi TM ({formatCurrency(allStats.expenseCash)}) − Đã nộp ({formatCurrency(allStats.deposits)})
            </p>
          </div>

          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide pt-1">
            {scope === "month" ? monthLabel : "Toàn bộ"}
          </p>

          {/* Doanh thu */}
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingUp className="h-4 w-4 text-blue-700" />
                <p className="text-[10px] text-blue-700 font-medium">Doanh thu</p>
              </div>
              <p className="font-bold text-blue-900 text-base">{formatCurrency(totalRevenue)}</p>
              <p className="text-[10px] text-blue-700 mt-1">
                💵 {formatCurrency(stats.revenueCash)} · 🏦 {formatCurrency(stats.revenueTransfer)}
              </p>
            </div>

            {/* Tổng chi */}
            <div className="bg-red-50 border border-red-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="h-4 w-4 text-red-700" />
                <p className="text-[10px] text-red-700 font-medium">Tổng chi</p>
              </div>
              <p className="font-bold text-red-900 text-base">{formatCurrency(totalExpense)}</p>
              <p className="text-[10px] text-red-700 mt-1">
                💵 {formatCurrency(stats.expenseCash)} · 🏦 {formatCurrency(stats.expenseTransfer)}
              </p>
            </div>
          </div>

          {/* Lãi/lỗ */}
          <div className={`border rounded-xl p-3 ${
            totalRevenue - totalExpense >= 0
              ? "bg-purple-50 border-purple-200"
              : "bg-orange-50 border-orange-200"
          }`}>
            <div className="flex items-center gap-1.5 mb-1">
              <Calculator className={`h-4 w-4 ${totalRevenue - totalExpense >= 0 ? "text-purple-700" : "text-orange-700"}`} />
              <p className={`text-[10px] font-medium ${totalRevenue - totalExpense >= 0 ? "text-purple-700" : "text-orange-700"}`}>
                Lợi nhuận (Doanh thu − Tổng chi)
              </p>
            </div>
            <p className={`font-bold text-lg ${totalRevenue - totalExpense >= 0 ? "text-purple-900" : "text-orange-900"}`}>
              {formatCurrency(totalRevenue - totalExpense)}
            </p>
          </div>

          {/* Theo loại thanh toán */}
          <div className="grid grid-cols-1 gap-2">
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Banknote className="h-4 w-4 text-emerald-700" />
                <p className="text-[10px] text-emerald-700 font-medium">Tiền mặt — Thu trừ Chi</p>
              </div>
              <p className="font-bold text-emerald-900 text-base">{formatCurrency(netCashRevenue)}</p>
              <p className="text-[10px] text-emerald-700">
                Thu TM {formatCurrency(stats.revenueCash)} − Chi TM {formatCurrency(stats.expenseCash)}
              </p>
            </div>

            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Landmark className="h-4 w-4 text-indigo-700" />
                <p className="text-[10px] text-indigo-700 font-medium">Chuyển khoản — Thu trừ Chi</p>
              </div>
              <p className="font-bold text-indigo-900 text-base">{formatCurrency(netTransferRevenue)}</p>
              <p className="text-[10px] text-indigo-700">
                Thu CK {formatCurrency(stats.revenueTransfer)} − Chi CK {formatCurrency(stats.expenseTransfer)}
              </p>
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Landmark className="h-4 w-4 text-slate-700" />
                <p className="text-[10px] text-slate-700 font-medium">
                  Đã nộp ngân hàng {scope === "month" ? "(trong tháng)" : "(cộng dồn)"}
                </p>
              </div>
              <p className="font-bold text-slate-900 text-base">{formatCurrency(stats.deposits)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
