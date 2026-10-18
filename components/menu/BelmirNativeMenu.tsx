'use client';

import type { MenuData } from '@/lib/types';
import { I18nProvider } from '@/components/i18n/I18nProvider';
import { MenuProvider } from './MenuContext';
import { BelmirSocialLinks } from './BelmirSocialLinks';
import { ProductSheet } from './ProductSheet';
import { DemoMenu } from './themes/DemoMenu';

export function BelmirNativeMenu({ data }: { data: MenuData }) {
  return <I18nProvider locale="en"><div dir="ltr" lang="en">
    <MenuProvider data={data} table={null} showPrices showIngredients>
      <DemoMenu showMarketing={false} />
      <BelmirSocialLinks /><ProductSheet />
    </MenuProvider>
  </div></I18nProvider>;
}
