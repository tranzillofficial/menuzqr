"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setPosStatusAction } from "@/lib/actions/admin";
import { Button } from "@/components/ui/Button";
import { ConfirmButton } from "@/components/ui/ConfirmDialog";
import { Select } from "@/components/ui/Field";
import { Icon } from "@/components/ui/Icons";
import { useToast } from "@/components/ui/Toast";
import { formatDate } from "@/lib/utils";
import type { PosPlan, PosStatus } from "@/lib/constants";

/**
 * POS activation, admin side. The expiry is computed from the plan when it is
 * switched on, so there is no date to mistype.
 */
export function PosControls({
  restaurantId,
  status,
  plan,
  expiresAt,
  couponCode,
}: {
  restaurantId: string;
  status: PosStatus;
  plan: PosPlan | null;
  expiresAt: string | null;
  couponCode: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [nextPlan, setNextPlan] = useState<PosPlan>(plan ?? "yearly");

  const run = (nextStatus: PosStatus, withPlan: PosPlan | null) =>
    startTransition(async () => {
      const result = await setPosStatusAction(restaurantId, nextStatus, withPlan);
      if (result?.message) toast(result.message, result.ok ? "success" : "error");
      router.refresh();
    });

  const tone =
    status === "active"
      ? "bg-emerald-100 text-emerald-800"
      : status === "requested"
        ? "bg-amber-100 text-amber-800"
        : "bg-ink-100 text-ink-600";

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>POS: {status}</span>
        {plan && <span className="text-xs text-ink-500">{plan}</span>}
        {expiresAt && (
          <span className="ltr-nums text-xs text-ink-500">until {formatDate(expiresAt)}</span>
        )}
        {couponCode && (
          <span className="ltr-nums rounded-lg bg-ink-900 px-2 py-0.5 font-mono text-[11px] text-white">
            {couponCode}
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          value={nextPlan}
          onChange={(event) => setNextPlan(event.target.value as PosPlan)}
          aria-label="POS plan"
          className="h-9 w-auto"
        >
          <option value="monthly">Monthly</option>
          <option value="yearly">Yearly</option>
        </Select>

        {status === "active" ? (
          <>
            <Button size="sm" variant="secondary" loading={pending} onClick={() => run("active", nextPlan)}>
              <Icon.arrowUp className="size-3.5" />
              Renew
            </Button>
            <ConfirmButton
              title="Switch POS off?"
              message="The restaurant loses POS access immediately."
              confirmLabel="Switch off"
              onConfirm={() => run("cancelled", nextPlan)}
            >
              Switch off
            </ConfirmButton>
          </>
        ) : (
          <Button size="sm" loading={pending} onClick={() => run("active", nextPlan)}>
            <Icon.check className="size-3.5" />
            Activate POS
          </Button>
        )}
      </div>
    </div>
  );
}
