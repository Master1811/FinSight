'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const getAllUsersForNewsEmail = async () => {
  try {
    const supabase = await createServerSupabaseClient();

    const { data: users, error } = await supabase
      .from('profiles')
      .select(`
        id,
        name,
        country,
        auth.users!inner(email)
      `)
      .not('name', 'is', null)
      .not('auth.users.email', 'is', null);

    if (error) throw error;

    return (users || [])
      .filter((user) => user.users?.email && user.name)
      .map((user) => ({
        id: user.id,
        email: user.users.email,
        name: user.name,
      }));
  } catch (error) {
    console.error('Error fetching users for news email:', error);
    return [];
  }
};
