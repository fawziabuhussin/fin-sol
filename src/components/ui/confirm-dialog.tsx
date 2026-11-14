"use client";

import { useCallback, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

/** In-app replacement for window.confirm (which looks broken in the iOS shell). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "تأكيد",
  destructive = false,
  pending = false,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
  pending?: boolean;
  onConfirm: () => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pb-4">
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            variant={destructive ? "destructive" : "default"}
            disabled={pending}
            onClick={onConfirm}
          >
            {pending ? "جارٍ التنفيذ…" : confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type ConfirmOptions = {
  title: string;
  description?: React.ReactNode;
  confirmLabel?: string;
  destructive?: boolean;
};

/**
 * Promise-based replacement for window.confirm:
 *   const [ask, confirmDialog] = useConfirm();
 *   if (!(await ask({ title: "حذف؟", destructive: true }))) return;
 *   ...render {confirmDialog} once in the component.
 */
export function useConfirm(): [(opts: ConfirmOptions) => Promise<boolean>, React.ReactNode] {
  const [state, setState] = useState<(ConfirmOptions & { resolve: (ok: boolean) => void }) | null>(null);
  const ask = useCallback(
    (opts: ConfirmOptions) => new Promise<boolean>((resolve) => setState({ ...opts, resolve })),
    []
  );
  const close = (ok: boolean) => {
    state?.resolve(ok);
    setState(null);
  };
  const dialog = (
    <ConfirmDialog
      open={state != null}
      onOpenChange={(open) => !open && close(false)}
      title={state?.title ?? ""}
      description={state?.description}
      confirmLabel={state?.confirmLabel ?? (state?.destructive ? "حذف" : "تأكيد")}
      destructive={state?.destructive}
      onConfirm={() => close(true)}
    />
  );
  return [ask, dialog];
}
