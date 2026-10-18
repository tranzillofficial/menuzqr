import Image from 'next/image';

/** Original bilingual artwork, used only for Belmir's menu headings. */
export function BelmirBrandName({ transparent = false }: { transparent?: boolean } = {}) {
  return <Image src={transparent ? "/belmir-site/assets/brand/belmir-bilingual-light.svg" : "/belmir-site/assets/brand/belmir-bilingual.svg"} alt="Belmir · بلمير" width={208} height={64} className={`mx-auto block h-16 w-52 max-w-full object-contain ${transparent ? "" : "rounded-md bg-[#eee7d8] p-2"}`} priority />;
}
