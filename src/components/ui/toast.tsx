"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { X, CheckCircle2, AlertCircle } from "lucide-react";

interface ToastProps {
  message: string;
  type?: "success" | "error";
  onClose: () => void;
}

export function Toast({ message, type = "success", onClose }: ToastProps) {
  React.useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={cn(
        "fixed bottom-4 left-4 right-4 z-50 flex items-center gap-3 rounded-lg p-4 shadow-lg text-sm font-medium",
        type === "success" ? "bg-green-600 text-white" : "bg-red-600 text-white"
      )}
    >
      {type === "success" ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
      <span className="flex-1">{message}</span>
      <button onClick={onClose} className="shrink-0">
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

export function useToast() {
  const [toast, setToast] = React.useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  };

  const hideToast = () => setToast(null);

  return { toast, showToast, hideToast };
}
