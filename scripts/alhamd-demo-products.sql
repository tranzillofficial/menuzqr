-- One-time, explicitly requested demo data. Not run by migrations or deployments.
-- These are ordinary products: owners can edit, hide or delete them in the dashboard.
begin;
do $$
declare r uuid; root uuid; section uuid; product uuid; item record;
begin
 select id into r from restaurants where slug='alhamd' for update;
 if r is null then raise exception 'Alhamd account not found'; end if;
 select id into root from categories where restaurant_id=r and parent_id is null and name='منتجات تجريبية' limit 1;
 if root is null then insert into categories(restaurant_id,name,description,sort_order) values(r,'منتجات تجريبية','أصناف وأسعار توضيحية للتجربة فقط؛ قابلة للتعديل والحذف.',100) returning id into root; end if;
 for item in select * from (values
 ('شوكولاتة','شوكولاتة بالحليب (تجريبي)',30,'عبوة 100 جم — تجريبية'),
 ('شوكولاتة','شوكولاتة داكنة (تجريبي)',45,'عبوة 100 جم — تجريبية'),
 ('شوكولاتة','شوكولاتة بالبندق (تجريبي)',55,'عبوة 100 جم — تجريبية'),
 ('شوكولاتة','شوكولاتة بالكراميل (تجريبي)',40,'عبوة 100 جم — تجريبية'),
 ('مكسرات','لوز محمص (تجريبي)',80,'عبوة 250 جم — تجريبية'),
 ('مكسرات','كاجو محمص (تجريبي)',95,'عبوة 250 جم — تجريبية'),
 ('مكسرات','فستق (تجريبي)',120,'عبوة 250 جم — تجريبية'),
 ('مكسرات','مكسرات مشكلة (تجريبي)',100,'عبوة 250 جم — تجريبية'),
 ('لبان وحلوى','لبان بالنعناع (تجريبي)',10,'عبوة — تجريبية'),
 ('لبان وحلوى','لبان بالفواكه (تجريبي)',15,'عبوة — تجريبية'),
 ('لبان وحلوى','حلوى بالفراولة (تجريبي)',20,'عبوة — تجريبية'),
 ('لبان وحلوى','حلوى بالكراميل (تجريبي)',25,'عبوة — تجريبية')
 ) as demo(section_name,name,price,variant_name) loop
 select id into section from categories where restaurant_id=r and parent_id=root and name=item.section_name limit 1;
 if section is null then insert into categories(restaurant_id,parent_id,name,sort_order) values(r,root,item.section_name,100) returning id into section; end if;
 if not exists(select 1 from products where restaurant_id=r and name=item.name) then
 insert into products(restaurant_id,category_id,name,description,image_source,sort_order,vat_code) values(r,section,item.name,'منتج تجريبي لتجربة عرض الأصناف والسلة فقط. الاسم والسعر والعبوة والرسم توضيحيون، ويمكن تعديلهم أو حذف المنتج من الداشبورد.','none',100,'zero') returning id into product;
 insert into product_variants(restaurant_id,product_id,name,price) values(r,product,item.variant_name,item.price);
 end if;
 end loop;
end $$;
commit;
