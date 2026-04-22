import { createServerSupabaseClient } from './server';

export async function getCurrentUser() {
  const supabase = await createServerSupabaseClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function getUserProfile(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) throw error;
  return data;
}

export async function getUserProfileWithEmail(userId: string) {
  const supabase = await createServerSupabaseClient();
  const { data, error } = await supabase
    .from('profiles')
    .select(`
      *,
      auth.users!inner(email)
    `)
    .eq('id', userId)
    .single();

  if (error) throw error;
  return {
    ...data,
    email: data.users?.email
  };
}