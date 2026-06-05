"use client";
import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import {
  Recipe, Product, CostOverhead, RecipeIngredientNew, RecipeType,
  isLegacyIngredient, isProductIngredient, isOverheadIngredient,
} from "@/types/database";

interface Props {
  recipe: Recipe | null;
  products: Product[];
  onClose: () => void;
  onSaved: (recipe: Recipe, isNew: boolean) => void;
  onError: (msg: string) => void;
}

// Local editor state for an ingredient
type EditIngredient = {
  source: "product" | "overhead";
  ref_id: string;          // product_id or overhead_id
  qty: number;
  unit: string;
  note: string;
};

// Convert any ingredient shape to editor format
function toEditIngredient(ing: Recipe["ingredients"][number], products: Product[]): EditIngredient {
  if (isLegacyIngredient(ing)) {
    const p = products.find((x) => x.id === ing.product_id);
    return {
      source: "product",
      ref_id: ing.product_id,
      qty: ing.quantity,
      unit: p?.unit ?? "",
      note: "",
    };
  }
  if (isProductIngredient(ing)) {
    return { source: "product", ref_id: ing.product_id, qty: ing.qty, unit: ing.unit, note: ing.note ?? "" };
  }
  if (isOverheadIngredient(ing)) {
    return { source: "overhead", ref_id: ing.overhead_id, qty: ing.qty, unit: ing.unit, note: ing.note ?? "" };
  }
  return { source: "product", ref_id: "", qty: 0, unit: "", note: "" };
}

function toDbIngredient(e: EditIngredient): RecipeIngredientNew {
  if (e.source === "product") {
    return { type: "product", product_id: e.ref_id, qty: e.qty, unit: e.unit, note: e.note || undefined };
  }
  return { type: "overhead", overhead_id: e.ref_id, qty: e.qty, unit: e.unit, note: e.note || undefined };
}

export function RecipeForm({ recipe, products, onClose, onSaved, onError }: Props) {
  const [name, setName] = useState(recipe?.name ?? "");
  const [recipeType, setRecipeType] = useState<RecipeType>(recipe?.recipe_type ?? "final");
  const [outputProductId, setOutputProductId] = useState<string>(recipe?.output_product_id ?? "");
  const [outputQty, setOutputQty] = useState<number>(recipe?.output_qty ?? 0);
  const [outputUnit, setOutputUnit] = useState<string>(recipe?.output_unit ?? "");
  const [overheads, setOverheads] = useState<CostOverhead[]>([]);
  const [ingredients, setIngredients] = useState<EditIngredient[]>(
    recipe?.ingredients.map((i) => toEditIngredient(i, products)) ?? []
  );
  const [saving, setSaving] = useState(false);
  const isEdit = !!recipe;

  // Load cost_overhead options
  useEffect(() => {
    supabase.from("cost_overhead").select("*").order("name").then(({ data }) => {
      if (data) setOverheads(data);
    });
  }, []);

  const addProductIngredient = () => {
    setIngredients((prev) => [...prev, { source: "product", ref_id: "", qty: 0, unit: "", note: "" }]);
  };

  const addOverheadIngredient = () => {
    setIngredients((prev) => [...prev, { source: "overhead", ref_id: "", qty: 1, unit: "lần", note: "" }]);
  };

  const removeIngredient = (idx: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateIngredient = (idx: number, patch: Partial<EditIngredient>) => {
    setIngredients((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      // Auto-fill unit when product changes
      if (patch.ref_id !== undefined && next[idx].source === "product") {
        const p = products.find((x) => x.id === patch.ref_id);
        if (p) next[idx].unit = p.unit;
      }
      if (patch.ref_id !== undefined && next[idx].source === "overhead") {
        const o = overheads.find((x) => x.id === patch.ref_id);
        if (o) next[idx].unit = o.unit;
      }
      return next;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { onError("Vui lòng nhập tên món"); return; }

    const validIngs = ingredients.filter((i) => i.ref_id && i.qty > 0);
    if (validIngs.length === 0) {
      onError("Cần ít nhất 1 nguyên liệu với định lượng > 0"); return;
    }
    if (recipeType === "sub" && (!outputProductId || outputQty <= 0)) {
      onError("Sub-recipe cần có output product + output qty > 0"); return;
    }

    setSaving(true);
    const payload = {
      name: name.trim(),
      ingredients: validIngs.map(toDbIngredient),
      recipe_type: recipeType,
      output_product_id: recipeType === "sub" ? outputProductId : null,
      output_qty: recipeType === "sub" ? outputQty : null,
      output_unit: recipeType === "sub" ? outputUnit : null,
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

  // Group products
  const bepProducts = products.filter((p) => p.category === "Bếp");
  const quayProducts = products.filter((p) => p.category === "Quầy");

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa công thức" : "Thêm công thức mới"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          <div className="space-y-1.5">
            <Label>Tên món *</Label>
            <Input
              placeholder="VD: Trà sữa chuối nướng, Ủ cốt trà nhài..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label>Loại công thức</Label>
            <Select value={recipeType} onValueChange={(v) => setRecipeType(v as RecipeType)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="final">🍽 Món bán cho khách</SelectItem>
                <SelectItem value="sub">🍵 Sub-recipe (ủ cốt) — tạo ra intermediate product</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {recipeType === "sub" && (
            <div className="border rounded-lg p-3 space-y-2 bg-blue-50/30">
              <Label className="text-xs font-semibold text-blue-800">Output (ủ ra)</Label>
              <Select value={outputProductId} onValueChange={setOutputProductId}>
                <SelectTrigger><SelectValue placeholder="Chọn product intermediate..." /></SelectTrigger>
                <SelectContent>
                  {products.filter((p) => p.is_intermediate).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2">
                <Input
                  type="number" min="0" step="any" placeholder="Số lượng"
                  value={outputQty || ""}
                  onChange={(e) => setOutputQty(parseFloat(e.target.value) || 0)}
                />
                <Input
                  placeholder="Đơn vị (g, ml...)"
                  value={outputUnit}
                  onChange={(e) => setOutputUnit(e.target.value)}
                  className="w-32"
                />
              </div>
            </div>
          )}

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Nguyên liệu</Label>
              <div className="flex gap-1">
                <Button type="button" size="sm" variant="outline" onClick={addProductIngredient} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Hàng
                </Button>
                <Button type="button" size="sm" variant="outline" onClick={addOverheadIngredient} className="gap-1">
                  <Plus className="h-3.5 w-3.5" /> Định mức
                </Button>
              </div>
            </div>

            {ingredients.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4 border-2 border-dashed rounded-lg">
                Thêm nguyên liệu hoặc chi phí định mức
              </p>
            )}

            <div className="space-y-3">
              {ingredients.map((ing, idx) => (
                <div key={idx} className="border rounded-lg p-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded font-semibold ${
                      ing.source === "product" ? "bg-green-100 text-green-700" : "bg-orange-100 text-orange-700"
                    }`}>
                      {ing.source === "product" ? "🛒 Hàng" : "⚡ Định mức"}
                    </span>
                    <Button
                      type="button" size="icon" variant="ghost"
                      className="h-7 w-7 ml-auto text-destructive"
                      onClick={() => removeIngredient(idx)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>

                  {ing.source === "product" ? (
                    <Select value={ing.ref_id} onValueChange={(v) => updateIngredient(idx, { ref_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Chọn nguyên liệu..." /></SelectTrigger>
                      <SelectContent>
                        {bepProducts.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">🍳 Bếp</div>
                            {bepProducts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit}){p.is_intermediate ? " [cốt]" : ""}</SelectItem>
                            ))}
                          </>
                        )}
                        {quayProducts.length > 0 && (
                          <>
                            <div className="px-2 py-1 text-xs font-semibold text-muted-foreground">☕ Quầy</div>
                            {quayProducts.map((p) => (
                              <SelectItem key={p.id} value={p.id}>{p.name} ({p.unit}){p.is_intermediate ? " [cốt]" : ""}</SelectItem>
                            ))}
                          </>
                        )}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Select value={ing.ref_id} onValueChange={(v) => updateIngredient(idx, { ref_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Chọn loại định mức..." /></SelectTrigger>
                      <SelectContent>
                        {overheads.map((o) => (
                          <SelectItem key={o.id} value={o.id}>
                            {o.name} ({Number(o.cost).toLocaleString("vi-VN")}đ/{o.unit})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <div className="flex gap-2">
                    <input
                      type="number" min="0" step="any" placeholder="SL"
                      value={ing.qty || ""}
                      onChange={(e) => updateIngredient(idx, { qty: parseFloat(e.target.value) || 0 })}
                      className="h-9 flex-1 rounded-md border border-input bg-background px-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <Input
                      placeholder="đơn vị"
                      value={ing.unit}
                      onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                      className="w-24"
                    />
                  </div>
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
