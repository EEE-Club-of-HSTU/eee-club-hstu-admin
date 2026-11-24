"use client";

import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";

interface ModalDialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  maxWidthClass?: string;
  children: React.ReactNode;
}

export function ModalDialog({
  open,
  onClose,
  title,
  maxWidthClass = "max-w-xl",
  children,
}: ModalDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", handleClose);

    // Light-dismiss fallback only where native <dialog closedby> is unsupported.
    let cleanupBackdrop: (() => void) | undefined;
    if (!("closedBy" in HTMLDialogElement.prototype)) {
      let pressedOutside = false;
      const isOutside = (e: PointerEvent) => {
        const rect = dialog.getBoundingClientRect();
        return (
          e.clientX < rect.left ||
          e.clientX > rect.right ||
          e.clientY < rect.top ||
          e.clientY > rect.bottom
        );
      };
      const onPointerDown = (e: PointerEvent) => {
        pressedOutside = isOutside(e);
      };
      const onPointerUp = (e: PointerEvent) => {
        if (pressedOutside && isOutside(e) && dialog.open) {
          dialog.close();
        }
        pressedOutside = false;
      };
      dialog.addEventListener("pointerdown", onPointerDown);
      dialog.addEventListener("pointerup", onPointerUp);
      cleanupBackdrop = () => {
        dialog.removeEventListener("pointerdown", onPointerDown);
        dialog.removeEventListener("pointerup", onPointerUp);
      };
    }

    return () => {
      dialog.removeEventListener("close", handleClose);
      cleanupBackdrop?.();
    };
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      {...({ closedby: "any" } as Record<string, string>)}
      className={`m-auto w-[calc(100%-2rem)] ${maxWidthClass} max-h-[90dvh] rounded-[28px] border border-slate-200 bg-white p-0 text-[#08090B] shadow-[0_24px_64px_rgba(8,9,11,0.22)] open:flex open:flex-col overflow-hidden`}
    >
      <div className="flex items-center justify-between gap-4 px-6 py-5 border-b border-slate-100 shrink-0">
        <h1 id={titleId} className="text-lg font-bold tracking-tight text-[#08090B]">
          {title}
        </h1>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close dialog"
          className="p-2 rounded-xl text-slate-500 hover:bg-slate-100 hover:text-[#08090B] transition-colors cursor-pointer"
        >
          <X className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>
      <div className="p-6 overflow-y-auto">{children}</div>
    </dialog>
  );
}
