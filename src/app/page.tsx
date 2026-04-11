import Link from "next/link";
import { Package, BarChart3, BookOpen, FileSpreadsheet, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const modules = [
  {
    href: "/products",
    icon: Package,
    title: "Hàng hóa",
    desc: "Thêm, sửa, xóa nguyên liệu",
    color: "bg-orange-50 text-orange-600 border-orange-200",
  },
  {
    href: "/inventory",
    icon: BarChart3,
    title: "Tồn kho",
    desc: "Nhập tồn hàng ngày - Bếp & Quầy",
    color: "bg-blue-50 text-blue-600 border-blue-200",
  },
  {
    href: "/recipes",
    icon: BookOpen,
    title: "Công thức",
    desc: "Định mức nguyên liệu theo món",
    color: "bg-purple-50 text-purple-600 border-purple-200",
  },
  {
    href: "/fabi",
    icon: FileSpreadsheet,
    title: "Dữ liệu Fabi",
    desc: "Import doanh thu từ máy POS",
    color: "bg-teal-50 text-teal-600 border-teal-200",
  },
  {
    href: "/reports",
    icon: TrendingUp,
    title: "Đối soát",
    desc: "So sánh lượng dùng thực tế vs Fabi",
    color: "bg-red-50 text-red-600 border-red-200",
  },
];

export default function HomePage() {
  return (
    <div className="px-4 py-6 space-y-6">
      {/* Welcome */}
      <div className="text-center space-y-1">
        <h1 className="text-2xl font-bold text-foreground">wECAMP Cafe</h1>
        <p className="text-muted-foreground text-sm">Hệ thống Quản lý Kho & Đối soát Lượng dùng</p>
      </div>

      {/* Quick stats placeholder */}
      <div className="grid grid-cols-2 gap-3">
        <Card className="border-green-200 bg-green-50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-700">0</p>
            <p className="text-xs text-green-600 mt-1">Hàng hóa</p>
          </CardContent>
        </Card>
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-blue-700">0</p>
            <p className="text-xs text-blue-600 mt-1">Công thức</p>
          </CardContent>
        </Card>
      </div>

      {/* Module cards */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide px-1">
          Phân hệ chức năng
        </h2>
        {modules.map(({ href, icon: Icon, title, desc, color }) => (
          <Link key={href} href={href}>
            <Card className={`border ${color} transition-all active:scale-[0.98]`}>
              <CardContent className="p-4 flex items-center gap-4">
                <div className={`p-3 rounded-lg ${color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{desc}</p>
                </div>
                <svg
                  className="h-4 w-4 text-muted-foreground shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
