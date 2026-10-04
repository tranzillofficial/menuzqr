import type { TranslationKey } from './en';

export const retailTranslations: Record<'ar'|'en', Partial<Record<TranslationKey,string>>> = {
  ar: {
    "status.accepted":"مفتوح", "status.preparing":"مفتوح", "status.ready":"مفتوح", "orders.complete":"إنهاء الطلب",
    'dash.checkRestaurant':'تم إنشاء بيانات الفرع', 'dash.noActivity':'الطلبات الجديدة بتظهر هنا فورًا.', 'dash.newOrderBody':'عميل بعت طلب جديد.', 'orders.noActiveBody':'لما عميل يبعت طلب من رابط الأصناف، هيظهر هنا فورًا.', 'orders.noTable':'طلب مباشر', 'station.kitchen':'تجهيز الطلبات', 'station.fromKitchen':'فريق التجهيز', 'station.waitingPickup':'جاهز للاستلام', 'disabled.body':'إدارة النشاط أوقفت الحساب ده. تواصل معاهم لإعادة تفعيله.',

    'nav.restaurant':'الفرع', 'restaurant.title':'الفرع', 'restaurant.details':'بيانات الفرع', 'restaurant.name':'اسم الفرع', 'restaurant.createTitle':'اعمل بيانات نشاطك', 'restaurant.create':'إنشاء الفرع', 'restaurant.saveFirst':'احفظ بيانات الفرع الأول، وبعدها ارفع اللوجو وصورة الغلاف.',
    'menu.noteForKitchen':'ملاحظة على الطلب', 'menu.notePlaceholder':'اكتب أي تفاصيل تخص طلبك أو التغليف…', 'menu.specialRequest':'ملاحظة على الصنف', 'menu.specialPlaceholder':'مثلاً: تغليف منفصل أو تجهيز كهدية…', 'menu.chooseSize':'اختار العبوة أو الحجم', 'menu.size':'العبوة / الحجم', 'menu.noAccountNote':'ابعت طلبك من غير حساب، ونسّق الدفع والاستلام مع الفرع.',
    'products.emptyBody':'ضيف أول صنف عندك، وحدد العبوات أو الأحجام وأسعارها.', 'products.ingredientsHint':'عدّل تفاصيل ومكونات المنتج. التعديل بيخص نشاطك بس. افصل بين المكونات بفاصلة.', 'products.sizesSub':'ضيف العبوات أو الأوزان أو الأحجام المتاحة، وسعر كل اختيار.',
    'orders.sub':'تابع طلبات العملاء وحالتها. الصفحة بتحدّث نفسها.', 'orders.needsWaiter':'محتاج متابعة', 'orders.waiterCalls':'طلبات المساعدة ({count})',
    'alerts.sub':'اختار إزاي تنبيهات الطلبات الجديدة توصلك.', 'alerts.soundOn':'بيشتغل صوت مع كل طلب جديد.', 'settings.soundSub':'تشغيل نغمة مع كل طلب جديد.',
    'staff.emptyBody':'ضيف موظفين وحدد صلاحيات كل حساب.', 'staff.explain':'كل موظف ليه بيانات دخول مستقلة. تقدر تغيّر صلاحياته أو توقفه في أي وقت. الاشتراك وإعدادات النشاط خاصة بالإدارة.', 'staff.roleChef':'تجهيز الطلبات', 'staff.roleWaiter':'خدمة العملاء',
    'plans.menuP3':'استقبال طلبات العملاء ومتابعتها', 'dash.setupTitle':'جهّز بيانات نشاطك', 'dash.setupCta':'إنشاء بيانات الفرع',
  },
  en: {
    "status.accepted":"Open", "status.preparing":"Open", "status.ready":"Open", "orders.complete":"Complete order",
    'dash.checkRestaurant':'Branch profile created', 'dash.noActivity':'New orders appear here instantly.', 'dash.newOrderBody':'A customer sent a new order.', 'orders.noActiveBody':'Customer orders from the product link appear here instantly.', 'orders.noTable':'Direct order', 'station.kitchen':'Order preparation', 'station.fromKitchen':'Preparation team', 'station.waitingPickup':'Ready for pickup', 'disabled.body':'The business disabled this account. Contact management to restore it.',

    'nav.restaurant':'Branch', 'restaurant.title':'Branch', 'restaurant.details':'Branch details', 'restaurant.name':'Branch name', 'restaurant.createTitle':'Set up your business', 'restaurant.create':'Create branch', 'restaurant.saveFirst':'Save your branch first, then upload its logo and cover photo.',
    'menu.noteForKitchen':'Order note', 'menu.notePlaceholder':'Add order or packaging details…', 'menu.specialRequest':'Product note', 'menu.specialPlaceholder':'For example: separate packaging or gift wrapping…', 'menu.chooseSize':'Choose pack or size', 'menu.size':'Pack / size', 'menu.noAccountNote':'Order without an account. Arrange payment and pickup with the branch.',
    'products.emptyBody':'Add your first product with its packs or sizes and prices.', 'products.ingredientsHint':'Edit product details and ingredients for your business. Separate ingredients with commas.', 'products.sizesSub':'Add available packs, weights or sizes and their prices.',
    'orders.sub':'Follow customer orders and their status. Updates automatically.', 'orders.needsWaiter':'Needs attention', 'orders.waiterCalls':'Assistance requests ({count})', 'alerts.sub':'Choose how to receive new-order alerts.', 'alerts.soundOn':'Play a sound with every new order.', 'settings.soundSub':'Play a sound with every new order.',
    'staff.emptyBody':'Add employees and choose their permissions.', 'staff.explain':'Each employee has an individual login. Change permissions or disable access anytime. Business settings and subscriptions are restricted to management.', 'staff.roleChef':'Order preparation', 'staff.roleWaiter':'Customer service', 'plans.menuP3':'Receive and manage customer orders', 'dash.setupTitle':'Set up your business', 'dash.setupCta':'Create branch profile',
  },
};
