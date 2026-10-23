REVOKE EXECUTE ON FUNCTION public.avi_user_id(), public.avi_family_ids(), public.avi_family_user_ids() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.avi_user_id(), public.avi_family_ids(), public.avi_family_user_ids() TO authenticated;
