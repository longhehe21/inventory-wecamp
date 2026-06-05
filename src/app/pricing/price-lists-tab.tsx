"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Copy, Trash2, FileText, CheckCircle2, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/lib/supabase";
import { PriceList, PriceListItem, Product, Supplier } from "@/types/database";

interface Props {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

const fmtVnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "đ";

export function PriceListsTab({ onError, onSuccess }: Props) {
  const [lists, setLists] = useState<PriceList[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [itemsByList, setItemsByList] = useState<Map<string, PriceListItem[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showNewList, setShowNewList] = useState(false);
  const [showAddItem, setShowAddItem] = useState<string | null>(null);
  const [editItemId, setEditItemId] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ kind: "list" | "item"; id: string; name: string } | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [listsRes, productsRes, suppliersRes, itemsRes] = await Promise.all([
      supabase.from("price_lists").select("*").order("effective_from", { ascending: false }),
      supabase.from("products").select("*").order("name"),
      supabase.from("suppliers").select("*").order("name"),
      supabase.from("price_list_items").select("*"),
    ]);
    if (listsRes.error) onError("Lỗi tải bảng giá: " + listsRes.error.message);
    else setLists(listsRes.data || []);
    if (productsRes.data) setProducts(productsRes.data);
    if (suppliersRes.data) setSuppliers(suppliersRes.data);
    if (itemsRes.data) {
      const m = new Map<string, PriceListItem[]>();
      (itemsRes.data as PriceListItem[]).forEach((it) => {
        if (!m.has(it.price_list_id)) m.set(it.price_list_id, []);
        m.get(it.price_list_id)!.push(it);
      });
      setItemsByList(m);
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const setActive = async (id: string) => {
    // Deactivate all, then activate target — handles partial unique index
    await supabase.from("price_lists").update({ is_active: false }).eq("is_active", true);
    const { error } = await supabase.from("price_lists").update({ is_active: true }).eq("id", id);
    if (error) onError("Lỗi set active: " + error.message);
    else {
      onSuccess("Đã set active bảng giá");
      fetchAll();
    }
  };

  const cloneList = async (src: PriceList) => {
    const today = new Date().toISOString().split("T")[0];
    const { data: newList, error: e1 } = await supabase
      .from("price_lists")
      .insert({
        name: `${src.name} (copy ${today})`,
        effective_from: today,
        is_active: false,
        note: `Cloned từ ${src.name}`,
      })
      .select().single();
    if (e1 || !newList) { onError("Lỗi clone bảng: " + (e1?.message ?? "?")); return; }

    const srcItems = itemsByList.get(src.id) ?? [];
    if (srcItems.length > 0) {
      const newItems = srcItems.map((it) => ({
        price_list_id: newList.id,
        product_id: it.product_id,
        supplier_id: it.supplier_id,
        price: it.price,
        unit: it.unit,
        note: it.note,
      }));
      const { error: e2 } = await supabase.from("price_list_items").insert(newItems);
      if (e2) { onError("Lỗi copy items: " + e2.message); return; }
    }
    onSuccess(`Đã clone "${src.name}" → ${newList.name} (${srcItems.length} items)`);
    fetchAll();
  };

  const deleteList = async (id: string) => {
    const { error } = await supabase.from("price_lists").delete().eq("id", id);
    if (error) onError("Lỗi xóa: " + error.message);
    else { onSuccess("Đã xóa bảng giá"); fetchAll(); }
    setDeleteConfirm(null);
  };

  const deleteItem = async (id: string) => {
    const { error } = await supabase.from("price_list_items").delete().eq("id", id);
    if (error) onError("Lỗi xóa item: " + error.message);
    else { onSuccess("Đã xóa item"); fetchAll(); }
    setDeleteConfirm(null);
  };

  const getProductName = (id: string) => products.find((p) => p.id === id)?.name ?? id.slice(0, 8);
  const getSupplierName = (id: string | null) => id ? (suppliers.find((s) => s.id === id)?.name ?? id.slice(0, 8)) : "—";

  return (
    <div className="px-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{lists.length} bảng giá</p>
        <Button size="sm" className="gap-1.5" onClick={() => setShowNewList(true)}>
          <Plus className="h-4 w-4" /> Tạo bảng mới
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2].map((i) => <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : lists.length === 0 ? (
        <div className="py-16 text-center">
          <FileText className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Chưa có bảng giá</p>
        </div>
      ) : (
        <div className="space-y-2">
          {lists.map((l) => {
            const items = itemsByList.get(l.id) ?? [];
            const expanded = expandedId === l.id;
            return (
              <Card key={l.id} className={l.is_active ? "border-green-500 border-2" : ""}>
                <CardContent className="p-0">
                  <div className="p-3 flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{l.name}</p>
                        {l.is_active && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded-full font-semibold flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3" /> Đang dùng
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Áp dụng từ {l.effective_from} · {items.length} items
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {!l.is_active && (
                        <Button size="sm" variant="outline" onClick={() => setActive(l.id)} title="Set active">
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                      )}
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => cloneList(l)} title="Clone">
                        <Copy className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setExpandedId(expanded ? null : l.id)}>
                        {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive"
                        onClick={() => setDeleteConfirm({ kind: "list", id: l.id, name: l.name })}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {expanded && (
                    <div className="border-t bg-muted/30 p-3 space-y-2">
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Items</p>
                        <Button size="sm" variant="outline" className="h-7 gap-1" onClick={() => setShowAddItem(l.id)}>
                          <Plus className="h-3.5 w-3.5" /> Thêm
                        </Button>
                      </div>
                      {items.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-4">Chưa có item</p>
                      ) : (
                        <div className="space-y-1 max-h-96 overflow-y-auto">
                          {items.slice().sort((a, b) => getProductName(a.product_id).localeCompare(getProductName(b.product_id))).map((it) => (
                            <PriceListItemRow
                              key={it.id}
                              item={it}
                              productName={getProductName(it.product_id)}
                              supplierName={getSupplierName(it.supplier_id)}
                              editing={editItemId === it.id}
                              onEdit={() => setEditItemId(it.id)}
                              onCancel={() => setEditItemId(null)}
                              onSaved={() => { setEditItemId(null); fetchAll(); }}
                              onDelete={() => setDeleteConfirm({ kind: "item", id: it.id, name: getProductName(it.product_id) })}
                              onError={onError}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {showNewList && (
        <NewListForm
          onClose={() => setShowNewList(false)}
          onSaved={() => { setShowNewList(false); fetchAll(); onSuccess("Đã tạo bảng giá mới"); }}
          onError={onError}
        />
      )}

      {showAddItem && (
        <AddItemForm
          priceListId={showAddItem}
          products={products}
          suppliers={suppliers}
          existingItems={itemsByList.get(showAddItem) ?? []}
          onClose={() => setShowAddItem(null)}
          onSaved={() => { setShowAddItem(null); fetchAll(); onSuccess("Đã thêm item"); }}
          onError={onError}
        />
      )}

      {deleteConfirm && (
        <Dialog open onOpenChange={() => setDeleteConfirm(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader><DialogTitle>Xác nhận xóa</DialogTitle></DialogHeader>
            <p className="text-sm">
              Xóa {deleteConfirm.kind === "list" ? "bảng giá" : "item"} &quot;{deleteConfirm.name}&quot;?
              {deleteConfirm.kind === "list" && " (tất cả items trong bảng cũng sẽ bị xóa)"}
            </p>
            <div className="flex gap-2 pt-2">
              <Button variant="outline" className="flex-1" onClick={() => setDeleteConfirm(null)}>Hủy</Button>
              <Button variant="destructive" className="flex-1"
                onClick={() => deleteConfirm.kind === "list" ? deleteList(deleteConfirm.id) : deleteItem(deleteConfirm.id)}>
                Xóa
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function PriceListItemRow({ item, productName, supplierName, editing, onEdit, onCancel, onSaved, onDelete, onError }: {
  item: PriceListItem;
  productName: string;
  supplierName: string;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => void;
  onDelete: () => void;
  onError: (msg: string) => void;
}) {
  const [price, setPrice] = useState<number>(Number(item.price));
  const [unit, setUnit] = useState(item.unit);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("price_list_items").update({ price, unit }).eq("id", item.id);
    setSaving(false);
    if (error) onError("Lỗi: " + error.message);
    else onSaved();
  };

  return (
    <div className="bg-white rounded-md p-2 text-sm border">
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate">{productName}</p>
          <p className="text-xs text-muted-foreground truncate">NCC: {supplierName}</p>
        </div>
        {editing ? (
          <div className="flex items-center gap-1 shrink-0">
            <input type="number" step="any" value={price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
              className="h-8 w-24 rounded border px-2 text-sm" />
            <input value={unit} onChange={(e) => setUnit(e.target.value)}
              className="h-8 w-16 rounded border px-2 text-sm" />
            <Button size="sm" className="h-8 px-2" disabled={saving} onClick={save}>OK</Button>
            <Button size="sm" variant="ghost" className="h-8 px-2" onClick={onCancel}>X</Button>
          </div>
        ) : (
          <div className="flex items-center gap-2 shrink-0">
            <span className="font-bold text-green-700">{fmtVnd(Number(item.price))}<span className="text-xs font-normal text-muted-foreground">/{item.unit}</span></span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={onDelete}>
              <Trash2 className="h-3 w-3" />
            </Button>
          </div>
        )}
      </div>
      {item.note && <p className="text-xs text-muted-foreground italic mt-1">{item.note}</p>}
    </div>
  );
}

function NewListForm({ onClose, onSaved, onError }: {
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(new Date().toISOString().split("T")[0]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { onError("Vui lòng nhập tên"); return; }
    setSaving(true);
    const { error } = await supabase.from("price_lists").insert({
      name: name.trim(),
      effective_from: effectiveFrom,
      is_active: false,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) onError("Lỗi: " + error.message);
    else onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Tạo bảng giá mới</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Tên *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: Bảng giá 6/2026" autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Áp dụng từ *</Label>
            <Input type="date" value={effectiveFrom} onChange={(e) => setEffectiveFrom(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <p className="text-xs text-muted-foreground">💡 Tạo xong rồi mới thêm items hoặc dùng Clone từ bảng có sẵn.</p>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Hủy</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Đang lưu..." : "Tạo"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AddItemForm({ priceListId, products, suppliers, existingItems, onClose, onSaved, onError }: {
  priceListId: string;
  products: Product[];
  suppliers: Supplier[];
  existingItems: PriceListItem[];
  onClose: () => void;
  onSaved: () => void;
  onError: (msg: string) => void;
}) {
  const [productId, setProductId] = useState("");
  const [supplierId, setSupplierId] = useState<string>("");
  const [price, setPrice] = useState<number>(0);
  const [unit, setUnit] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  // auto-fill unit when product changes
  useEffect(() => {
    if (productId) {
      const p = products.find((x) => x.id === productId);
      if (p) setUnit(p.unit);
    }
  }, [productId, products]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productId || price < 0 || !unit) { onError("Vui lòng nhập đủ thông tin"); return; }
    // check duplicate
    const dup = existingItems.find((it) => it.product_id === productId && (it.supplier_id ?? "") === supplierId);
    if (dup) { onError("Đã có item cho product + supplier này"); return; }

    setSaving(true);
    const { error } = await supabase.from("price_list_items").insert({
      price_list_id: priceListId,
      product_id: productId,
      supplier_id: supplierId || null,
      price,
      unit,
      note: note.trim() || null,
    });
    setSaving(false);
    if (error) onError("Lỗi: " + error.message);
    else onSaved();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Thêm item</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Sản phẩm *</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Chọn..." /></SelectTrigger>
              <SelectContent>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.category} · {p.name} ({p.unit})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Nhà cung cấp</Label>
            <Select value={supplierId} onValueChange={setSupplierId}>
              <SelectTrigger><SelectValue placeholder="(không có)" /></SelectTrigger>
              <SelectContent>
                {suppliers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Giá/base unit *</Label>
              <Input type="number" min="0" step="any" value={price || ""} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label>Đơn vị *</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g, ml..." />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} placeholder="vd: Mua 127000đ / 2kg" />
          </div>
          <p className="text-xs text-muted-foreground">⚠ Giá phải tính theo base unit (đã chia package_size)</p>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Hủy</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Đang lưu..." : "Thêm"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
