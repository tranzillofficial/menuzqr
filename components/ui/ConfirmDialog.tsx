"use client";

import { useState, useTransition, type ReactNode } from "react";
import { Modal } from "./Modal";
import { Button } from "./Button";

export function ConfirmButton({
  title,
  message,
  confirmLabel = "Confirm",
  variant = "danger",
  onConfirm,
  children,
  className,
  disabled,
}: {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  variant?: "danger" | "primary" | "success";
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
  className?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        className={className}
        onClick={() => setOpen(true)}
      >
        {children}
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={title}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={variant}
              loading={pending}
              onClick={() =>
                startTransition(async () => {
                  await onConfirm();
                  setOpen(false);
                })
              }
            >
              {confirmLabel}
            </Button>
          </>
        }
      >
        <div className="text-sm text-ink-600">{message}</div>
      </Modal>
    </>
  );
}
