"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Search, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Toast, useToast } from "@/components/ui/toast";
import { ProductForm } from "./product-form";
import { supabase } from "@/lib/supabase";
import { Product, ProductCategory } from "@/types/database";
import { formatNumber } from "@/lib/utils";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCategory, setFilterCategory] = useState<ProductCategory | "Tất cả">("Tất cả");
  const [showForm, setShowForm] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { toast, showToast, hideToast } = useToast();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("products")
      .select("*")
      .order("category")
      .order("name");
    if (error) {
      showToast("Lỗi tải dữ liệu: " + error.message, "error");
    } else {
      setProducts(data || []);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) {
      showToast("Lỗi xóa hàng hóa: " + error.message, "error");
    } else {
      showToast("Đã xóa hàng hóa thành công");
      setProducts((prev) => prev.filter((p) => p.id !== id));
    }
    setDeleteConfirm(null);
  };

  const filtered = products.filter((p) => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase());
    const matchCat = filterCategory === "Tất cả" || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  const bepCount = products.filter((p) => p.category === "Bếp").length;
  const quayCount = products.filter((p) => p.category === "Quầy").length;

  return (
    <div className="px-4 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Hàng hóa</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {bepCount} Bếp · {quayCount} Quầy
          </p>
        </div>
        <Button
          size="lg"
          className="gap-2"
          onClick={() => {
            setEditProduct(null);
            setShowForm(true);
          }}
        >
          <Plus className="h-5 w-5" />
          Thêm mới
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2">
        {(["Tất cả", "Bếp", "Quầy"] as const).map((cat) => (
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
        <Input
          placeholder="Tìm tên hàng hóa..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Product list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Package className="h-12 w-12 text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground font-medium">
            {search || filterCategory !== "Tất cả" ? "Không tìm thấy hàng hóa" : "Chưa có hàng hóa nào"}
          </p>
          {!search && filterCategory === "Tất cả" && (
            <p className="text-sm text-muted-foreground mt-1">Nhấn &quot;Thêm mới&quot; để bắt đầu</p>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardContent className="p-0">
                {deleteConfirm === product.id ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                    <p className="text-sm font-medium text-red-800 mb-3">
                      Xác nhận xóa &quot;{product.name}&quot;?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="destructive"
                        className="flex-1"
                        onClick={() => handleDelete(product.id)}
                      >
                        Xóa
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => setDeleteConfirm(null)}
                      >
                        Hủy
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3 p-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-foreground truncate">{product.name}</span>
                        <Badge variant={product.category === "Bếp" ? "bep" : "quay"}>
                          {product.category}
                        </Badge>
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
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9"
                        onClick={() => {
                          setEditProduct(product);
                          setShowForm(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-9 w-9 text-destructive hover:text-destructive"
                        onClick={() => setDeleteConfirm(product.id)}
                      >
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

      {/* Product form modal */}
      {showForm && (
        <ProductForm
          product={editProduct}
          onClose={() => {
            setShowForm(false);
            setEditProduct(null);
          }}
          onSaved={(product, isNew) => {
            if (isNew) {
              setProducts((prev) => [...prev, product]);
            } else {
              setProducts((prev) => prev.map((p) => (p.id === product.id ? product : p)));
            }
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
