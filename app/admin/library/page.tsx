import type { Metadata } from "next";
import { createServerSupabase } from "@/lib/supabase/server";
import { Card, CardHeader } from "@/components/ui/Card";
import { LibraryUploader } from "@/components/admin/LibraryUploader";
import { LibraryImageCard } from "@/components/admin/LibraryImageCard";
import type { LibraryImage } from "@/lib/types";

export const metadata: Metadata = { title: "Admin — Image library" };

export default async function AdminLibraryPage() {
  const supabase = await createServerSupabase();
  const { data } = await supabase
    .from("menu_images")
    .select("*")
    .order("group_name")
    .order("category")
    .order("sort_order");

  const images = (data ?? []) as LibraryImage[];
  const groups = new Map<string, LibraryImage[]>();
  for (const image of images) {
    groups.set(image.group_name, [...(groups.get(image.group_name) ?? []), image]);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink-900">Image library</h1>
        <p className="mt-1 text-sm text-ink-500">
          Shared artwork every restaurant can use on its menu. {images.length} images.
        </p>
      </div>

      <Card className="border-amber-200 bg-amber-50 p-5">
        <h2 className="text-sm font-semibold text-amber-900">Licensing rules</h2>
        <ul className="mt-2 space-y-1 text-sm text-amber-900">
          <li>• Only add photos you own, or stock that is explicitly cleared for commercial use.</li>
          <li>• Never add images taken from an image search, a competitor, or a restaurant&apos;s site.</li>
          <li>• Always record the licence — it is stored with the image and is required.</li>
        </ul>
      </Card>

      <LibraryUploader />

      {images.length === 0 && (
        <Card className="p-10 text-center">
          <p className="text-sm font-medium text-ink-900">The library is empty</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-500">
            Upload photos above and they appear in every restaurant&apos;s image picker straight
            away. Each upload is resized and compressed in the browser first.
          </p>
        </Card>
      )}

      {[...groups.entries()].map(([group, items]) => (
        <Card key={group}>
          <CardHeader title={group} description={`${items.length} images`} />
          <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4 lg:grid-cols-6">
            {items.map((image) => (
              <LibraryImageCard key={image.id} image={image} />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}
