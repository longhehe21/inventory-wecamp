"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { Supplier } from "@/types/database";

interface Props {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

export function SuppliersTab({ onError, onSuccess }: Props) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<Supplier | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("suppliers").select("*").order("name");
    if (error) onError("Lỗi tải: " + error.message);
    else setSuppliers(data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("suppliers").delete().eq("id", id);
    if (error) onError("Lỗi xóa: " + error.message);
    else {
      setSuppliers((p) => p.filter((s) => s.id !== id));
      onSuccess("Đã xóa nhà cung cấp");
    }
    setDeleteId(null);
  };

  return (
    <div className="px-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{suppliers.length} nhà cung cấp</p>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditItem(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Thêm
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : suppliers.length === 0 ? (
        <div className="py-16 text-center">
          <Users className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Chưa có nhà cung cấp</p>
        </div>
      ) : (
        <div className="space-y-2">
          {suppliers.map((s) => (
            <Card key={s.id}>
              <CardContent className="p-3">
                {deleteId === s.id ? (
                  <div className="bg-red-50 -m-3 p-3 rounded-xl">
                    <p className="text-sm font-medium text-red-800 mb-3">Xóa &quot;{s.name}&quot;?</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="destructive" className="flex-1" onClick={() => handleDelete(s.id)}>Xóa</Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => setDeleteId(null)}>Hủy</Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{s.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {s.phone || "—"} {s.address && `· ${s.address}`}
                      </p>
                      {s.note && <p className="text-xs text-muted-foreground italic mt-0.5">{s.note}</p>}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditItem(s); setShowForm(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
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
        <SupplierForm
          item={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={(s, isNew) => {
            if (isNew) setSuppliers((p) => [...p, s].sort((a, b) => a.name.localeCompare(b.name)));
            else setSuppliers((p) => p.map((x) => x.id === s.id ? s : x));
            onSuccess(isNew ? "Đã thêm nhà cung cấp" : "Đã cập nhật");
            setShowForm(false); setEditItem(null);
          }}
          onError={onError}
        />
      )}
    </div>
  );
}

function SupplierForm({ item, onClose, onSaved, onError }: {
  item: Supplier | null;
  onClose: () => void;
  onSaved: (s: Supplier, isNew: boolean) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(item?.name ?? "");
  const [phone, setPhone] = useState(item?.phone ?? "");
  const [address, setAddress] = useState(item?.address ?? "");
  const [note, setNote] = useState(item?.note ?? "");
  const [saving, setSaving] = useState(false);
  const isEdit = !!item;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { onError("Vui lòng nhập tên"); return; }
    setSaving(true);
    const payload = {
      name: name.trim(),
      phone: phone.trim() || null,
      address: address.trim() || null,
      note: note.trim() || null,
    };
    if (isEdit) {
      const { data, error } = await supabase.from("suppliers").update(payload).eq("id", item.id).select().single();
      if (error) onError("Lỗi cập nhật: " + error.message);
      else onSaved(data, false);
    } else {
      const { data, error } = await supabase.from("suppliers").insert(payload).select().single();
      if (error) onError("Lỗi thêm: " + error.message);
      else onSaved(data, true);
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Sửa nhà cung cấp" : "Thêm nhà cung cấp"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Tên *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </div>
          <div className="space-y-1.5">
            <Label>Điện thoại</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Địa chỉ</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Ghi chú</Label>
            <Input value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
          <div className="flex gap-2 pt-2">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>Hủy</Button>
            <Button type="submit" className="flex-1" disabled={saving}>{saving ? "Đang lưu..." : isEdit ? "Cập nhật" : "Thêm"}</Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
