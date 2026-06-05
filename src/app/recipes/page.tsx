"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, BookOpen, ChevronDown, ChevronUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Toast, useToast } from "@/components/ui/toast";
import { RecipeForm } from "./recipe-form";
import { supabase } from "@/lib/supabase";
import {
  Recipe, Product, CostOverhead, RecipeCostActive,
  isLegacyIngredient, isOverheadIngredient, isProductIngredient,
} from "@/types/database";
import { formatNumber } from "@/lib/utils";
import * as XLSX from "xlsx";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [overheads, setOverheads] = useState<CostOverhead[]>([]);
  const [costs, setCosts] = useState<Map<string, RecipeCostActive>>(new Map());
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<"all" | "final" | "sub">("all");
  const { toast, showToast, hideToast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [recipesRes, productsRes, overheadsRes, costsRes] = await Promise.all([
      supabase.from("recipes").select("*").order("recipe_type").order("name"),
      supabase.from("products").select("*").order("name"),
      supabase.from("cost_overhead").select("*").order("name"),
      supabase.from("recipe_costs_active").select("*"),
    ]);
    if (recipesRes.error) showToast("Lỗi tải công thức: " + recipesRes.error.message, "error");
    else setRecipes((recipesRes.data as Recipe[]) || []);
    if (productsRes.error) showToast("Lỗi tải hàng hóa: " + productsRes.error.message, "error");
    else setProducts(productsRes.data || []);
    if (overheadsRes.error) console.warn("cost_overhead chưa tồn tại:", overheadsRes.error.message);
    else setOverheads(overheadsRes.data || []);
    if (costsRes.error) console.warn("recipe_costs_active view chưa tồn tại:", costsRes.error.message);
    else {
      const m = new Map<string, RecipeCostActive>();
      (costsRes.data as RecipeCostActive[] || []).forEach((c) => m.set(c.recipe_id, c));
      setCosts(m);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("recipes").delete().eq("id", id);
    if (error) showToast("Lỗi xóa: " + error.message, "error");
    else {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      showToast("Đã xóa công thức");
    }
    setDeleteConfirm(null);
  };

  const getProductName = (productId: string) =>
    products.find((p) => p.id === productId)?.name ?? productId;

  const getProductUnit = (productId: string) =>
    products.find((p) => p.id === productId)?.unit ?? "";

  const getOverheadName = (overheadId: string) =>
    overheads.find((o) => o.id === overheadId)?.name ?? overheadId;

  const handleDownloadTemplate = () => {
    const header = ["Tên món", "Tên nguyên liệu", "Số lượng", "Đơn vị"];
    const rows: (string | number)[][] = [];

    if (recipes.length > 0) {
      // Xuất các công thức hiện có làm mẫu
      recipes.forEach((recipe) => {
        recipe.ingredients.forEach((ing) => {
          if (isLegacyIngredient(ing)) {
            rows.push([recipe.name, getProductName(ing.product_id), ing.quantity, getProductUnit(ing.product_id)]);
          } else if (isProductIngredient(ing)) {
            rows.push([recipe.name, getProductName(ing.product_id), ing.qty, ing.unit]);
          } else if (isOverheadIngredient(ing)) {
            rows.push([recipe.name, "[OH] " + getOverheadName(ing.overhead_id), ing.qty, ing.unit]);
          }
        });
      });
    } else {
      rows.push(["Cà phê sữa", "Cà phê hạt", 15, "g"]);
      rows.push(["Cà phê sữa", "Sữa đặc", 20, "ml"]);
    }

    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    ws["!cols"] = [{ wch: 20 }, { wch: 22 }, { wch: 12 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Công thức");
    XLSX.writeFile(wb, "mau-cong-thuc.xlsx");
  };

  const fmtVnd = (n: number | null | undefined) =>
    n == null ? "—" : new Intl.NumberFormat("vi-VN").format(Math.round(n)) + "đ";

  const filteredRecipes = recipes.filter((r) => {
    if (filterType === "all") return true;
    return (r.recipe_type ?? "final") === filterType;
  });

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Công thức</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{recipes.length} món</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDownloadTemplate}>
            <Download className="h-4 w-4" />
            Mẫu
          </Button>
          <Button size="sm" className="gap-1.5" onClick={() => { setEditRecipe(null); setShowForm(true); }}>
            <Plus className="h-4 w-4" />
            Thêm mới
          </Button>
        </div>
      </div>

      {/* Filter by type */}
      <div className="flex gap-2">
        <Button
          size="sm"
          variant={filterType === "all" ? "default" : "outline"}
          onClick={() => setFilterType("all")}
        >Tất cả ({recipes.length})</Button>
        <Button
          size="sm"
          variant={filterType === "final" ? "default" : "outline"}
          onClick={() => setFilterType("final")}
        >🍽 Món bán ({recipes.filter(r => (r.recipe_type ?? "final") === "final").length})</Button>
        <Button
          size="sm"
          variant={filterType === "sub" ? "default" : "outline"}
          onClick={() => setFilterType("sub")}
        >🍵 Ủ cốt ({recipes.filter(r => r.recipe_type === "sub").length})</Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : filteredRecipes.length === 0 ? (
        <div className="py-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Chưa có công thức nào</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRecipes.map((recipe) => {
            const cost = costs.get(recipe.id);
            const isSubRecipe = recipe.recipe_type === "sub";
            return (
              <Card key={recipe.id} className="overflow-hidden">
                <CardContent className="p-0">
                  {deleteConfirm === recipe.id ? (
                    <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                      <p className="text-sm font-medium text-red-800 mb-3">
                        Xác nhận xóa &quot;{recipe.name}&quot;?
                      </p>
                      <div className="flex gap-2">
                        <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleDelete(recipe.id)}>Xóa</Button>
                        <Button size="sm" variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Hủy</Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-3 p-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-foreground">
                              {isSubRecipe ? "🍵 " : "🍽 "}{recipe.name}
                            </p>
                            {isSubRecipe && recipe.output_qty && (
                              <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full">
                                → {recipe.output_qty} {recipe.output_unit}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <p className="text-xs text-muted-foreground">
                              {recipe.ingredients.length} nguyên liệu
                            </p>
                            {cost && (
                              <p className="text-sm font-bold text-green-700">
                                💰 {fmtVnd(cost.total_cost)}
                                {isSubRecipe && cost.unit_cost && (
                                  <span className="font-normal text-xs text-muted-foreground ml-1">
                                    ({fmtVnd(cost.unit_cost)}/{recipe.output_unit})
                                  </span>
                                )}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            size="icon" variant="ghost" className="h-9 w-9"
                            onClick={() => setExpandedId(expandedId === recipe.id ? null : recipe.id)}
                          >
                            {expandedId === recipe.id
                              ? <ChevronUp className="h-4 w-4" />
                              : <ChevronDown className="h-4 w-4" />}
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-9 w-9"
                            onClick={() => { setEditRecipe(recipe); setShowForm(true); }}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon" variant="ghost" className="h-9 w-9 text-destructive hover:text-destructive"
                            onClick={() => setDeleteConfirm(recipe.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {expandedId === recipe.id && recipe.ingredients.length > 0 && (
                        <div className="px-4 pb-4 border-t pt-3 space-y-1.5">
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            Định mức nguyên liệu (1 phần)
                          </p>
                          {recipe.ingredients.map((ing, i) => {
                            // Handle both legacy and new format
                            let label = "";
                            let qty = 0;
                            let unit = "";
                            let isOverhead = false;

                            if (isLegacyIngredient(ing)) {
                              label = getProductName(ing.product_id);
                              qty = ing.quantity;
                              unit = getProductUnit(ing.product_id);
                            } else if (isProductIngredient(ing)) {
                              label = getProductName(ing.product_id);
                              qty = ing.qty;
                              unit = ing.unit;
                            } else if (isOverheadIngredient(ing)) {
                              label = getOverheadName(ing.overhead_id);
                              qty = ing.qty;
                              unit = ing.unit;
                              isOverhead = true;
                            }

                            return (
                              <div key={i} className="flex items-center justify-between py-1">
                                <span className={`text-sm ${isOverhead ? "text-orange-700" : "text-foreground"}`}>
                                  {isOverhead && "⚡ "}{label}
                                </span>
                                <span className="text-sm font-semibold">
                                  {formatNumber(qty, 2)} {unit}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showForm && (
        <RecipeForm
          recipe={editRecipe}
          products={products}
          onClose={() => { setShowForm(false); setEditRecipe(null); }}
          onSaved={(recipe, isNew) => {
            if (isNew) setRecipes((prev) => [...prev, recipe]);
            else setRecipes((prev) => prev.map((r) => r.id === recipe.id ? recipe : r));
            showToast(isNew ? "Đã thêm công thức mới" : "Đã cập nhật công thức");
            setShowForm(false); setEditRecipe(null);
            // Refresh costs after save
            supabase.from("recipe_costs_active").select("*").then(({ data }) => {
              if (data) {
                const m = new Map<string, RecipeCostActive>();
                (data as RecipeCostActive[]).forEach((c) => m.set(c.recipe_id, c));
                setCosts(m);
              }
            });
          }}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  );
}
