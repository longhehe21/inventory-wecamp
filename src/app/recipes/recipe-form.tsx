"use client";
import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { Recipe, Product, RecipeIngredient } from "@/types/database";

interface Props {
  recipe: Recipe | null;
  products: Product[];
  onClose: () => void;
  onSaved: (recipe: Recipe, isNew: boolean) => void;
  onError: (msg: string) => void;
}

export function RecipeForm({ recipe, products, onClose, onSaved, onError }: Props) {
  const [name, setName] = useState(recipe?.name ?? "");
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>(
    recipe?.ingredients ?? []
  );
  const [saving, setSaving] = useState(false);
  const isEdit = !!recipe;

  const addIngredient = () => {
    setIngredients((prev) => [...prev, { product_id: "", quantity: 0 }]);
  };

  const removeIngredient = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateIngredient = (idx: number, field: keyof RecipeIngredient, value: string | number) => {
    setIngredients((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { onError("Vui lòng nhập tên món"); return; }

    const validIngredients = ingredients.filter(
      (ing) => ing.product_id && ing.quantity > 0
    );
    if (validIngredients.length === 0) {
      onError("Cần ít nhất 1 nguyên liệu với định lượng > 0");
      return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      ingredients: validIngredients,
    };

    if (isEdit) {
      const { data, error } = await supabase
        .from("recipes").update(payload).eq("id", recipe.id).select().single();
      if (error) onError("Lỗi cập nhật: " + error.message);
      else onSaved(data as Recipe, false);
    } else {
      const { data, error } = await supabase
        .from("recipes").insert(payload).select().single();
      if (error) onError("Lỗi thêm mới: " + error.message);
      else onSaved(data as Recipe, true);
    }
    setSaving(false);
  };

  // Group products by category for select
  const bepProducts = products.filter((p) => p.category === "Bếp");
  const quayProducts = products.filter((p) => p.category === "Quầy");

  const getUnit = (productId: string) =>
    products.find((p) => p.id === productId)?.unit ?? "";

  const usedProductIds = new Set(ingredients.map((i) => i.product_id));

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa Công thức" : "Thêm Công thức mới"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Tên món *</Label>
            <Input
              placeholder="VD: Cà phê sữa, Đậu sốt cà..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Nguyên liệu (mỗi phần)</Label>
              <Button type="button" size="sm" variant="outline" onClick={addIngredient} className="gap-1">
                <Plus className="h-3.5 w-3.5" />
                Thêm
              </Button>
            </div>

            {ingredients.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                Nhấn &quot;Thêm&quot; để thêm nguyên liệu
              </p>
            )}

            <div className="space-y-3">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-2 items-end">
                  <div className="flex-1 space-y-1">
                    <Select
                      value={ing.product_id}
                      onValueChange={(v) => updateIngredient(idx, "product_id", v)}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Chọn nguyên liệu..." />
                      </SelectTrigger>
                      <SelectContent>
                        {bepProducts.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">🍳 Bếp</div>
                            {bepProducts.map((p) => (
                              <SelectItem
                                key={p.id}
                                value={p.id}
                                disabled={usedProductIds.has(p.id) && p.id !== ing.product_id}
                              >
                                {p.name} ({p.unit})
                              </SelectItem>
                            ))}
                          </>
                        )}
                        {quayProducts.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">☕ Quầy</div>
                            {quayProducts.map((p) => (
                              <SelectItem
                                key={p.id}
                                value={p.id}
                                disabled={usedProductIds.has(p.id) && p.id !== ing.product_id}
                              >
                                {p.name} ({p.unit})
                              </SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-24 space-y-1">
                    <div className="flex items-center gap-1">
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={ing.quantity || ""}
                        onChange={(e) => updateIngredient(idx, "quantity", parseFloat(e.target.value) || 0)}
                        className="h-10 w-full rounded-md border border-input bg-background px-2 text-sm text-center focus:outline-none focus:ring-2 focus:ring-ring"
                        placeholder="SL"
                      />
                      {ing.product_id && (
                        <span className="text-xs text-muted-foreground shrink-0">{getUnit(ing.product_id)}</span>
                      )}
                    </div>
                  </div>

                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="h-10 w-10 text-destructive hover:text-destructive shrink-0"
                    onClick={() => removeIngredient(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Hủy</Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Tạo công thức"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
