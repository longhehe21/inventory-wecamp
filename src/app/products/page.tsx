"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Pencil, Trash2, Search, Package, Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Toast, useToast } from "@/components/ui/toast";
import { ProductForm } from "./product-form";
import { supabase } from "@/lib/supabase";
import { Product, ProductCategory, ProductUnit, PackageUnit } from "@/types/database";
import { formatNumber } from "@/lib/utils";
import * as XLSX from "xlsx";

const VALID_UNITS: ProductUnit[] = ["g", "kg", "l", "ml", "con", "cái", "phần"];
const VALID_CATEGORIES: ProductCategory[] = ["Bếp", "Quầy", "Lễ tân"];
const VALID_PACKAGE_UNITS: PackageUnit[] = ["túi", "hộp", "chai", "gói", "lon", "thùng", "cái", "kg", "lít"];

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<ProductCategory | "Tất cả">("Tất cả");
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast, showToast, hideToast } = useToast();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name");
    if (error) showToast("Lỗi tải dữ liệu: " + error.message, "error");
    else setProducts(data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchProducts(); }, [fetchProducts]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) showToast("Lỗi xóa hàng hóa: " + error.message, "error");
    else {
      showToast("Đã xóa hàng hóa thành công");
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
    setDeleteConfirm(null);
  };

  // Tải file Excel mẫu
  const handleDownloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ["Tên hàng hóa", "Phân loại", "Đơn vị", "Đơn vị bao bì", "Quy đổi (1 bao bì = ? đơn vị)"],
      ["Cà chua", "Bếp", "kg", "", ""],
      ["Gà nguyên con", "Bếp", "con", "", ""],
      ["Sữa tươi", "Quầy", "ml", "hộp", "200"],
      ["Cà phê hạt", "Quầy", "g", "túi", "500"],
      ["Nước suối", "Lễ tân", "ml", "chai", "500"],
    ]);
    ws["!cols"] = [{ wch: 25 }, { wch: 12 }, { wch: 10 }, { wch: 15 }, { wch: 25 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Hàng hóa");
    XLSX.writeFile(wb, "mau-hang-hoa.xlsx");
  };

  // Import Excel
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";
    setImporting(true);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, raw: false });

        const toInsert: {
          name: string; category: ProductCategory;
          unit: ProductUnit; package_unit: PackageUnit | null; package_size: number;
        }[] = [];
        const errors: string[] = [];

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          const name = String(row[0] || "").trim();
          const category = String(row[1] || "").trim() as ProductCategory;
          const unit = String(row[2] || "").trim().toLowerCase() as ProductUnit;
          const packageUnit = String(row[3] || "").trim().toLowerCase() as PackageUnit;
          const packageSize = parseFloat(String(row[4] || "0")) || 0;

          if (!name) continue; // bỏ qua dòng trống
          if (!VALID_CATEGORIES.includes(category)) {
            errors.push(`Dòng ${i + 1}: Phân loại "${category}" không hợp lệ (Bếp/Quầy)`);
            continue;
          }
          if (!VALID_UNITS.includes(unit)) {
            errors.push(`Dòng ${i + 1}: Đơn vị "${unit}" không hợp lệ`);
            continue;
          }
          const hasPkg = packageUnit && VALID_PACKAGE_UNITS.includes(packageUnit);

          toInsert.push({
            name,
            category,
            unit,
            package_unit: hasPkg ? packageUnit : null,
            package_size: hasPkg ? packageSize : 0,
          });
        }

        if (toInsert.length === 0) {
          showToast(errors.length ? errors[0] : "Không tìm thấy dữ liệu hợp lệ", "error");
          setImporting(false);
          return;
        }

        // Upsert theo tên + category (tránh trùng)
        const { error } = await supabase.from("products").upsert(toInsert, {
          onConflict: "name,category",
          ignoreDuplicates: false,
        });

        if (error) {
          // Nếu không có unique constraint, insert bình thường (bỏ qua trùng tên)
          const existing = products.map((p) => p.name.toLowerCase() + "|" + p.category);
          const newItems = toInsert.filter(
            (p) => !existing.includes(p.name.toLowerCase() + "|" + p.category)
          );
          if (newItems.length === 0) {
            showToast("Tất cả hàng hóa đã tồn tại", "error");
          } else {
            const { error: e2 } = await supabase.from("products").insert(newItems);
            if (e2) showToast("Lỗi import: " + e2.message, "error");
            else {
              showToast(`Đã import ${newItems.length} hàng hóa${errors.length ? ` (bỏ qua ${errors.length} lỗi)` : ""}`);
              fetchProducts();
            }
          }
        } else {
          showToast(`Đã import ${toInsert.length} hàng hóa${errors.length ? ` (bỏ qua ${errors.length} lỗi)` : ""}`);
          fetchProducts();
        }
      } catch {
        showToast("Lỗi đọc file Excel", "error");
      }
      setImporting(false);
    };
    reader.readAsBinaryString(file);
  };

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "Tất cả" || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  const bepCount = products.filter((p) => p.category === "Bếp").length;
  const quayCount = products.filter((p) => p.category === "Quầy").length;
  const letanCount = products.filter((p) => p.category === "Lễ tân").length;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Hàng hóa</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{bepCount} Bếp · {quayCount} Quầy · {letanCount} Lễ tân</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4" />
            Mẫu
          </Button>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => fileRef.current?.click()} disabled={importing}>
            <Upload className="h-4 w-4" />
            {importing ? "Đang xử lý..." : "Import"}
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setEditProduct(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" />
            Thêm
          </Button>
        </div>
        <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
      </div>

      {/* Excel format hint */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-800">
        <p className="font-semibold mb-0.5">Format Excel import:</p>
        <p>Cột A: Tên · B: Phân loại (Bếp/Quầy/Lễ tân) · C: Đơn vị (g/kg/ml/l/con/cái/phần) · D: Bao bì · E: Quy đổi</p>
        <p className="mt-1">Nhấn <strong>Mẫu</strong> để tải file Excel mẫu</p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {(["Tất cả", "Bếp", "Quầy", "Lễ tân"] as const).map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
              filterCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Tìm tên hàng hóa..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Product list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">
            {search || filterCategory !== "Tất cả" ? "Không tìm thấy hàng hóa" : "Chưa có hàng hóa nào"}
          </p>
          {!search && filterCategory === "Tất cả" && (
            <p className="text-sm text-muted-foreground mt-1">Nhấn &quot;Thêm&quot; hoặc &quot;Import&quot; để bắt đầu</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardContent className="p-0">
                {deleteConfirm === product.id ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-medium text-red-800 mb-3">Xác nhận xóa &quot;{product.name}&quot;?</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleDelete(product.id)}>Xóa</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Hủy</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground truncate">{product.name}</span>
                        <Badge variant={product.category === "Bếp" ? "bep" : product.category === "Quầy" ? "quay" : "letan"}>{product.category}</Badge>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Đơn vị: <strong>{product.unit}</strong>
                        {product.package_unit && product.package_size > 0 && (
                          <span className="ml-1 text-blue-600">
                            · 1 {product.package_unit} = {formatNumber(product.package_size, 0)} {product.unit}
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-9 w-9" onClick={() => { setEditProduct(product); setShowForm(true); }}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => setDeleteConfirm(product.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showForm && (
        <ProductForm
          product={editProduct}
          onClose={() => { setShowForm(false); setEditProduct(null); }}
          onSaved={(product, isNew) => {
            if (isNew) setProducts((prev) => [...prev, product]);
            else setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)));
            showToast(isNew ? "Đã thêm hàng hóa mới" : "Đã cập nhật hàng hóa");
            setShowForm(false);
            setEditProduct(null);
          }}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  );
}
