"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { setRestaurantStatusAction } from "@/lib/actions/admin";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import { buttonClass } from "@/components/ui/Button";
import type { RestaurantStatus } from "@/lib/constants";

export function RestaurantActions({
  restaurantId,
  restaurantName,
  status,
  size = "sm",
}: {
  restaurantId: string;
  restaurantName: string;
  status: RestaurantStatus;
  size?: "sm" | "md";
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();

  function change(next: RestaurantStatus) {
    startTransition(async () => {
      const result = await setRestaurantStatusAction(restaurantId, next);
      toast(result?.message ?? "Updated.", result?.ok ? "success" : "error");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== "active" && (
        <ConfirmButton
          title={`Activate "${restaurantName}"?`}
          message="This publishes their public menu immediately and marks the one-time payment as received. Only do this once you have confirmed the $20 payment."
          confirmLabel="Activate restaurant"
          variant="success"
          onConfirm={() => change("active")}
          disabled={pending}
          className={buttonClass("success", size)}
        >
          Activate
        </ConfirmButton>
      )}

      {status === "active" && (
        <ConfirmButton
          title={`Deactivate "${restaurantName}"?`}
          message="Their public menu and table QR codes stop working until you activate them again. Their data is kept."
          confirmLabel="Deactivate"
          onConfirm={() => change("inactive")}
          disabled={pending}
          className={buttonClass("secondary", size)}
        >
          Deactivate
        </ConfirmButton>
      )}

      {status !== "suspended" && (
        <ConfirmButton
          title={`Suspend "${restaurantName}"?`}
          message="Use this for abuse or non-payment. The public menu is hidden and the owner sees a suspended notice."
          confirmLabel="Suspend"
          onConfirm={() => change("suspended")}
          disabled={pending}
          className={buttonClass("danger", size)}
        >
          Suspend
        </ConfirmButton>
      )}
    </div>
  );
}
