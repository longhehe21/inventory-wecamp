"use client";
import { useState, useEffect, useCallback } from "react";
import { Plus, Pencil, Trash2, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { CostOverhead } from "@/types/database";

interface Props {
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
}

const fmtVnd = (n: number) => new Intl.NumberFormat("vi-VN").format(n) + "đ";

export function CostOverheadTab({ onError, onSuccess }: Props) {
  const [items, setItems] = useState<CostOverhead[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<CostOverhead | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from("cost_overhead").select("*").order("name");
    if (error) onError("Lỗi tải: " + error.message);
    else setItems(data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from("cost_overhead").delete().eq("id", id);
    if (error) onError("Lỗi xóa: " + error.message);
    else {
      setItems((p) => p.filter((s) => s.id !== id));
      onSuccess("Đã xóa");
    }
    setDeleteId(null);
  };

  return (
    <div className="px-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} loại định mức</p>
        <Button size="sm" className="gap-1.5" onClick={() => { setEditItem(null); setShowForm(true); }}>
          <Plus className="h-4 w-4" /> Thêm
        </Button>
      </div>

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />)}</div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center">
          <Zap className="h-12 w-12 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-muted-foreground">Chưa có chi phí định mức</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((s) => (
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
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium">{s.name}</p>
                        <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded font-mono">{s.code}</span>
                      </div>
                      <p className="text-sm font-bold text-green-700 mt-0.5">
                        {fmtVnd(Number(s.cost))} <span className="font-normal text-muted-foreground">/ {s.unit}</span>
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
        <OverheadForm
          item={editItem}
          onClose={() => { setShowForm(false); setEditItem(null); }}
          onSaved={(s, isNew) => {
            if (isNew) setItems((p) => [...p, s].sort((a, b) => a.name.localeCompare(b.name)));
            else setItems((p) => p.map((x) => x.id === s.id ? s : x));
            onSuccess(isNew ? "Đã thêm" : "Đã cập nhật");
            setShowForm(false); setEditItem(null);
          }}
          onError={onError}
        />
      )}
    </div>
  );
}

function OverheadForm({ item, onClose, onSaved, onError }: {
  item: CostOverhead | null;
  onClose: () => void;
  onSaved: (s: CostOverhead, isNew: boolean) => void;
  onError: (msg: string) => void;
}) {
  const [code, setCode] = useState(item?.code ?? "");
  const [name, setName] = useState(item?.name ?? "");
  const [unit, setUnit] = useState(item?.unit ?? "");
  const [cost, setCost] = useState<number>(Number(item?.cost ?? 0));
  const [note, setNote] = useState(item?.note ?? "");
  const [saving, setSaving] = useState(false);
  const isEdit = !!item;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim() || !name.trim() || !unit.trim()) { onError("Vui lòng nhập đủ mã, tên, đơn vị"); return; }
    setSaving(true);
    const payload = {
      code: code.trim(),
      name: name.trim(),
      unit: unit.trim(),
      cost,
      note: note.trim() || null,
    };
    if (isEdit) {
      const { data, error } = await supabase.from("cost_overhead").update(payload).eq("id", item.id).select().single();
      if (error) onError("Lỗi cập nhật: " + error.message);
      else onSaved(data, false);
    } else {
      const { data, error } = await supabase.from("cost_overhead").insert(payload).select().single();
      if (error) onError("Lỗi thêm: " + error.message);
      else onSaved(data, true);
    }
    setSaving(false);
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{isEdit ? "Sửa định mức" : "Thêm định mức"}</DialogTitle></DialogHeader>
        <form onSubmit={submit} className="space-y-3 mt-2">
          <div className="space-y-1.5">
            <Label>Mã (snake_case) *</Label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="vd: da_vien, dien_chien" autoFocus disabled={isEdit} />
          </div>
          <div className="space-y-1.5">
            <Label>Tên *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="vd: Đá viên" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Cost *</Label>
              <Input type="number" min="0" step="any" value={cost || ""} onChange={(e) => setCost(parseFloat(e.target.value) || 0)} />
            </div>
            <div className="space-y-1.5">
              <Label>Đơn vị *</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="suất, lần, bộ" />
            </div>
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
