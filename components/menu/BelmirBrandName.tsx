import Image from 'next/image';

/** Original bilingual artwork, used only for Belmir's menu headings. */
export function BelmirBrandName() {
  return <Image src="/belmir-site/assets/brand/belmir-bilingual.svg" alt="Belmir · بلمير" width={208} height={64} className="mx-auto block h-16 w-52 max-w-full rounded-md bg-[#eee7d8] object-contain p-2" priority />;
}
