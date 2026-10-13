export type QrKind = "menu" | "whatsapp" | "table";
export type QrPreference = {
  title: string;
  subtitle: string;
  theme: "simple" | "cream" | "dark";
  template_id?: string;
};
export type QrPreferences = Partial<Record<QrKind, QrPreference>>;
export const QR_KINDS: QrKind[] = ["menu", "whatsapp", "table"];
export function validateQrPreference(value: unknown): value is QrPreference {
  if (!value || typeof value !== "object") return false;
  const v = value as QrPreference;
  return (
    typeof v.title === "string" &&
    v.title.trim().length >= 2 &&
    v.title.length <= 80 &&
    typeof v.subtitle === "string" &&
    v.subtitle.length <= 100 &&
    ["simple", "cream", "dark"].includes(v.theme) &&
    (v.template_id === undefined ||
      (typeof v.template_id === "string" && v.template_id.length <= 64))
  );
}
