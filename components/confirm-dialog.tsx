"use client";

import { ModalDialog } from "./modal-dialog";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  loading?: boolean;
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = "Delete",
  loading = false,
}: ConfirmDialogProps) {
  return (
    <ModalDialog open={open} onClose={onClose} title={title} maxWidthClass="max-w-md">
      <div className="space-y-6">
        <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        <div className="flex items-center justify-end gap-3">
          <button
            type="button"
            autoFocus
            disabled={loading}
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition-colors cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={onConfirm}
            className="px-5 py-2.5 rounded-xl bg-red-600 text-sm font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50"
          >
            {loading ? "Deleting…" : confirmLabel}
          </button>
        </div>
      </div>
    </ModalDialog>
  );
}
