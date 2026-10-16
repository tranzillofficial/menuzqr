export const SUPERMARKET_PAGE_SIZE = 10;
export const SUPERMARKET_SECTIONS = {
  bakery: ['مخبوزات', 'Bakery'], beverages: ['مشروبات', 'Beverages'],
  dairy_and_cheese: ['ألبان وجبن', 'Dairy and cheese'],
  detergents_and_household: ['منظفات ومستلزمات منزلية', 'Household'],
  food_products: ['مواد غذائية', 'Groceries'], frozen_and_meat: ['مجمدات ولحوم', 'Frozen and meat'],
  fruits_and_vegetables: ['خضار وفاكهة', 'Fruit and vegetables'],
  personal_care: ['عناية شخصية', 'Personal care'], snacks_and_chocolate: ['مقرمشات وشوكولاتة', 'Snacks and chocolate'],
} as const;
export type SupermarketItem = {id:string;name_ar:string;brand:string|null;category:string;size:number|null;size_unit:string|null;barcode_candidate:string|null;supermarket_catalog_images:{url:string}[]};
