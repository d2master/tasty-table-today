
-- Drop existing foreign key constraints and recreate with ON DELETE CASCADE

-- order_items -> products
ALTER TABLE public.order_items DROP CONSTRAINT order_items_product_id_fkey;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_product_id_fkey 
  FOREIGN KEY (product_id) REFERENCES public.products(id) ON DELETE CASCADE;

-- order_items -> orders
ALTER TABLE public.order_items DROP CONSTRAINT order_items_order_id_fkey;
ALTER TABLE public.order_items ADD CONSTRAINT order_items_order_id_fkey 
  FOREIGN KEY (order_id) REFERENCES public.orders(id) ON DELETE CASCADE;

-- products -> categories
ALTER TABLE public.products DROP CONSTRAINT products_category_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_category_id_fkey 
  FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE;

-- products -> restaurants
ALTER TABLE public.products DROP CONSTRAINT products_restaurant_id_fkey;
ALTER TABLE public.products ADD CONSTRAINT products_restaurant_id_fkey 
  FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- categories -> restaurants
ALTER TABLE public.categories DROP CONSTRAINT categories_restaurant_id_fkey;
ALTER TABLE public.categories ADD CONSTRAINT categories_restaurant_id_fkey 
  FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

-- orders -> restaurants
ALTER TABLE public.orders DROP CONSTRAINT orders_restaurant_id_fkey;
ALTER TABLE public.orders ADD CONSTRAINT orders_restaurant_id_fkey 
  FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;
