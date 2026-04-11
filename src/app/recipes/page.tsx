"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Toast, useToast } from "@/components/ui/toast";
import { RecipeForm } from "./recipe-form";
import { supabase } from "@/lib/supabase";
import { Recipe, Product } from "@/types/database";
import { formatNumber } from "@/lib/utils";

export default function RecipesPage() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const { toast, showToast, hideToast } = useToast();

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [recipesRes, productsRes] = await Promise.all([
      supabase.from("recipes").select("*").order("name"),
      supabase.from("products").select("*").order("name"),
    ]);
    if (recipesRes.error) showToast("Lỗi tải công thức: " + recipesRes.error.message, "error");
    else setRecipes(recipesRes.data || []);
    if (productsRes.error) showToast("Lỗi tải hàng hóa: " + productsRes.error.message, "error");
    else setProducts(productsRes.data || []);
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

  return (
    <div className="px-4 py-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">Công thức</h1>
          <p className="text-xs text-muted-foreground mt-0.5">{recipes.length} món</p>
        </div>
        <Button
          size="lg"
          className="gap-2"
          onClick={() => { setEditRecipe(null); setShowForm(true); }}
        >
          <Plus className="h-5 w-5" />
          Thêm mới
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}
        </div>
      ) : recipes.length === 0 ? (
        <div className="py-16 text-center">
          <BookOpen className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Chưa có công thức nào</p>
          <p className="text-sm text-muted-foreground mt-1">Nhấn &quot;Thêm mới&quot; để tạo công thức đầu tiên</p>
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.map((recipe) => (
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
                        <p className="font-semibold text-foreground">{recipe.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {recipe.ingredients.length} nguyên liệu
                        </p>
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
                        {recipe.ingredients.map((ing, i) => (
                          <div key={i} className="flex items-center justify-between py-1">
                            <span className="text-sm text-foreground">{getProductName(ing.product_id)}</span>
                            <span className="text-sm font-semibold">
                              {formatNumber(ing.quantity, 1)} {getProductUnit(ing.product_id)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          ))}
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
          }}
          onError={(msg) => showToast(msg, "error")}
        />
      )}

      {toast && <Toast message={toast.message} type={toast.type} onClose={hideToast} />}
    </div>
  );
}
