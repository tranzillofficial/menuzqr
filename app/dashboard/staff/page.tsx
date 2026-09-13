import type { Metadata } from "next";
import { PageHeader } from "@/components/dashboard/Shell";
import { StaffManager } from "@/components/dashboard/StaffManager";
import { listStaffAction } from "@/lib/actions/staff";
import { requireManager } from "@/lib/membership";
import { getT } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Team" };

export default async function StaffPage() {
  const [membership, t] = await Promise.all([requireManager("/dashboard/staff"), getT()]);
  const staff = await listStaffAction();

  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title={t("staff.title")} description={t("staff.sub")} />
      <StaffManager staff={staff} currentUserId={membership.userId} />
    </div>
  );
}
