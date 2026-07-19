GRANT SELECT, INSERT ON public.restaurants TO authenticated;
GRANT UPDATE (name, slug, description, logo_url, trash_password, pix_enabled, pix_key, pix_key_type, pix_recipient_name, pix_city, pix_password, table_count, is_open, closed_message, service_mode, delivery_payment_methods, owner_phone, updated_at) ON public.restaurants TO authenticated;
GRANT DELETE ON public.restaurants TO authenticated;
GRANT ALL ON public.restaurants TO service_role;