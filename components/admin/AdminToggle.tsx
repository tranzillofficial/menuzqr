"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setUserAdminAction } from "@/lib/actions/admin";
import { Switch } from "@/components/ui/Field";
import { useToast } from "@/components/ui/Toast";

export function AdminToggle({ userId, isAdmin }: { userId: string; isAdmin: boolean }) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  return (
    <label className="flex items-center gap-2">
      <span className="text-xs font-medium text-ink-600">Admin</span>
      <Switch
        checked={isAdmin}
        disabled={pending}
        label="Platform admin"
        onChange={(value) =>
          startTransition(async () => {
            const result = await setUserAdminAction(userId, value);
            toast(result?.message ?? "Updated.", result?.ok ? "success" : "error");
            router.refresh();
          })
        }
      />
    </label>
  );
}
