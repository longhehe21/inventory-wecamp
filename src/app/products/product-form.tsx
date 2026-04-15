"use client";
import { useState } from "react";
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
import { Product, ProductCategory, ProductUnit, PackageUnit } from "@/types/database";

interface ProductFormProps {
  product: Product | null;
  onClose: () => void;
  onSaved: (product: Product, isNew: boolean) => void;
  onError: (message: string) => void;
}

const CATEGORIES: ProductCategory[] = ["Bếp", "Quầy", "Lễ tân"];

const BASE_UNITS: { value: ProductUnit; label: string }[] = [
  { value: "g",    label: "g (gram)" },
  { value: "kg",   label: "kg (kilogram)" },
  { value: "ml",   label: "ml (mililít)" },
  { value: "l",    label: "l (lít)" },
  { value: "con",  label: "con (con gà, con cá...)" },
  { value: "cái",  label: "cái (cái trứng, cái...)" },
  { value: "phần", label: "phần (phần ăn)" },
];

const PACKAGE_UNITS: { value: PackageUnit; label: string }[] = [
  { value: "túi",   label: "Túi" },
  { value: "hộp",   label: "Hộp" },
  { value: "chai",  label: "Chai" },
  { value: "gói",   label: "Gói" },
  { value: "lon",   label: "Lon" },
  { value: "thùng", label: "Thùng" },
  { value: "cái",   label: "Cái" },
  { value: "kg",    label: "Kg (cân ký)" },
  { value: "lít",   label: "Lít (can lít)" },
];

export function ProductForm({ product, onClose, onSaved, onError }: ProductFormProps) {
  const [form, setForm] = useState({
    name: product?.name ?? "",
    category: (product?.category ?? "Bếp") as ProductCategory,
    unit: (product?.unit ?? "g") as ProductUnit,
    package_unit: (product?.package_unit ?? "") as PackageUnit | "",
    package_size: product?.package_size ? product.package_size.toString() : "",
  });
  const [saving, setSaving] = useState(false);

  const isEdit = !!product;
  const hasPackage = !!form.package_unit;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      onError("Vui lòng nhập tên hàng hóa");
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
            <Select
              value={form.unit}
              onValueChange={(v) => setForm((f) => ({ ...f, unit: v as ProductUnit }))}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {BASE_UNITS.map(({ value, label }) => (
                  <SelectItem key={value} value={value}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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
                <SelectTrigger>
                  <SelectValue placeholder="Chọn loại bao bì..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Không có bao bì —</SelectItem>
                  {PACKAGE_UNITS.map(({ value, label }) => (
                    <SelectItem key={value} value={value}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
