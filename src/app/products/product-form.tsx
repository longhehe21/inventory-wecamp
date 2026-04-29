"use client";
import { useState, useEffect } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { Product, ProductCategory, ProductUnit, PackageUnit, Unit, UnitType } from "@/types/database";

interface ProductFormProps {
  product: Product | null;
  onClose: () => void;
  onSaved: (product: Product, isNew: boolean) => void;
  onError: (message: string) => void;
}

const CATEGORIES: ProductCategory[] = ["Bếp", "Quầy", "Lễ tân"];

export function ProductForm({ product, onClose, onSaved, onError }: ProductFormProps) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    category: (product?.category ?? "Bếp") as ProductCategory,
    unit: (product?.unit ?? "") as ProductUnit,
    package_unit: (product?.package_unit ?? "") as PackageUnit | "",
    package_size: product?.package_size ? product.package_size.toString() : "",
  });
  const [saving, setSaving] = useState(false);

  // Units fetched from DB
  const [baseUnits, setBaseUnits] = useState<Unit[]>([]);
  const [packageUnits, setPackageUnits] = useState<Unit[]>([]);

  // Inline "add new unit" UI state
  const [addingType, setAddingType] = useState<UnitType | null>(null);
  const [newUnitName, setNewUnitName] = useState("");
  const [savingUnit, setSavingUnit] = useState(false);

  const isEdit = !!product;
  const hasPackage = !!form.package_unit;

  // Load units on mount
  useEffect(() => {
    const fetchUnits = async () => {
      const { data, error } = await supabase
        .from("units")
        .select("*")
        .order("name");
      if (error) {
        onError("Lỗi tải đơn vị: " + error.message);
        return;
      }
      const units = (data as Unit[]) || [];
      setBaseUnits(units.filter((u) => u.type === "base"));
      setPackageUnits(units.filter((u) => u.type === "package"));
      // Set default base unit if not editing
      if (!product && units.length > 0) {
        const firstBase = units.find((u) => u.type === "base");
        if (firstBase) setForm((f) => (f.unit ? f : { ...f, unit: firstBase.name }));
      }
    };
    fetchUnits();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAddUnit = async (type: UnitType) => {
    const name = newUnitName.trim();
    if (!name) {
      onError("Vui lòng nhập tên đơn vị");
      return;
    }
    setSavingUnit(true);
    const { data, error } = await supabase
      .from("units")
      .insert({ name, type })
      .select()
      .single();
    setSavingUnit(false);
    if (error) {
      onError("Lỗi thêm đơn vị: " + error.message);
      return;
    }
    const newUnit = data as Unit;
    if (type === "base") {
      setBaseUnits((prev) => [...prev, newUnit].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, unit: newUnit.name }));
    } else {
      setPackageUnits((prev) => [...prev, newUnit].sort((a, b) => a.name.localeCompare(b.name)));
      setForm((f) => ({ ...f, package_unit: newUnit.name }));
    }
    setNewUnitName("");
    setAddingType(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      onError("Vui lòng nhập tên hàng hóa");
      return;
    }
    if (!form.unit) {
      onError("Vui lòng chọn đơn vị tính cơ bản");
      return;
    }
    if (hasPackage && (!form.package_size || parseFloat(form.package_size) <= 0)) {
      onError("Nhập quy đổi: 1 " + form.package_unit + " = ? " + form.unit);
      return;
    }

    setSaving(true);
    const payload = {
      name: form.name.trim(),
      category: form.category,
      unit: form.unit,
      package_unit: form.package_unit || null,
      package_size: form.package_unit ? (parseFloat(form.package_size) || 0) : 0,
    };

    if (isEdit) {
      const { data, error } = await supabase
        .from("products").update(payload).eq("id", product.id).select().single();
      if (error) onError("Lỗi cập nhật: " + error.message);
      else onSaved(data as Product, false);
    } else {
      const { data, error } = await supabase
        .from("products").insert(payload).select().single();
      if (error) onError("Lỗi thêm mới: " + error.message);
      else onSaved(data as Product, true);
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Chỉnh sửa Hàng hóa" : "Thêm Hàng hóa mới"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-2">
          {/* Tên */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Tên hàng hóa *</Label>
            <Input
              id="name"
              placeholder="VD: Cà chua, Sữa tươi..."
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              autoFocus
            />
          </div>

          {/* Phân loại */}
          <div className="space-y-1.5">
            <Label>Phân loại</Label>
            <Select
              value={form.category}
              onValueChange={(v) => setForm((f) => ({ ...f, category: v as ProductCategory }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === "Bếp" ? "🍳 Bếp" : cat === "Quầy" ? "☕ Quầy" : "🛎️ Lễ tân"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Đơn vị cơ bản */}
          <div className="space-y-1.5">
            <Label>Đơn vị tính cơ bản</Label>
            <div className="flex gap-2">
              <Select
                value={form.unit}
                onValueChange={(v) => setForm((f) => ({ ...f, unit: v as ProductUnit }))}
              >
                <SelectTrigger className="flex-1"><SelectValue placeholder="Chọn đơn vị..." /></SelectTrigger>
                <SelectContent>
                  {baseUnits.map((u) => (
                    <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-10 w-10 shrink-0"
                title="Thêm đơn vị mới"
                onClick={() => { setAddingType("base"); setNewUnitName(""); }}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {addingType === "base" && (
              <div className="flex gap-2 mt-2 p-2 bg-muted rounded-md">
                <Input
                  placeholder="VD: thìa, lát, miếng..."
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  className="flex-1 h-9"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  className="h-9"
                  onClick={() => handleAddUnit("base")}
                  disabled={savingUnit}
                >
                  {savingUnit ? "..." : "Thêm"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={() => { setAddingType(null); setNewUnitName(""); }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Đơn vị dùng để nhập tồn kho và tính định mức
            </p>
          </div>

          {/* Divider */}
          <div className="border-t pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Thông tin bao bì (tuỳ chọn)
            </p>

            {/* Đơn vị bao bì */}
            <div className="space-y-1.5">
              <Label>Đơn vị bao bì</Label>
              <div className="flex gap-2">
                <Select
                  value={form.package_unit || "none"}
                  onValueChange={(v) =>
                    setForm((f) => ({
                      ...f,
                      package_unit: v === "none" ? "" : v as PackageUnit,
                      package_size: v === "none" ? "" : f.package_size,
                    }))
                  }
                >
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Chọn loại bao bì..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— Không có bao bì —</SelectItem>
                    {packageUnits.map((u) => (
                      <SelectItem key={u.id} value={u.name}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-10 w-10 shrink-0"
                  title="Thêm đơn vị bao bì mới"
                  onClick={() => { setAddingType("package"); setNewUnitName(""); }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              {addingType === "package" && (
                <div className="flex gap-2 mt-2 p-2 bg-muted rounded-md">
                  <Input
                    placeholder="VD: vỉ, khay, két..."
                    value={newUnitName}
                    onChange={(e) => setNewUnitName(e.target.value)}
                    className="flex-1 h-9"
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    className="h-9"
                    onClick={() => handleAddUnit("package")}
                    disabled={savingUnit}
                  >
                    {savingUnit ? "..." : "Thêm"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    onClick={() => { setAddingType(null); setNewUnitName(""); }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Quy đổi — chỉ hiện khi đã chọn bao bì */}
            {hasPackage && (
              <div className="mt-3 space-y-1.5">
                <Label htmlFor="package_size">
                  Quy đổi: 1 {form.package_unit} = ? {form.unit}
                </Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground shrink-0 font-medium">
                    1 {form.package_unit} =
                  </span>
                  <Input
                    id="package_size"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="Nhập số lượng..."
                    value={form.package_size}
                    onChange={(e) => setForm((f) => ({ ...f, package_size: e.target.value }))}
                    className="flex-1"
                  />
                  <span className="text-sm font-semibold text-foreground shrink-0">
                    {form.unit}
                  </span>
                </div>
                {form.package_size && parseFloat(form.package_size) > 0 && (
                  <p className="text-xs text-green-600 font-medium">
                    ✓ 1 {form.package_unit} = {parseFloat(form.package_size).toLocaleString("vi-VN")} {form.unit}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Hủy
            </Button>
            <Button type="submit" className="flex-1" disabled={saving}>
              {saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Thêm mới"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
