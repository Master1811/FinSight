'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export async function getWatchlistSymbolsByEmail(email: string): Promise<string[]> {
  if (!email) return [];

  try {
    const supabase = await createServerSupabaseClient();

    // Get user ID from email
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) throw userError;

    const user = users.find((u) => u.email === email);
    if (!user) return [];

    // Get watchlist symbols
    const { data: items, error: itemError } = await supabase
      .from('watchlist')
      .select('symbol')
      .eq('user_id', user.id);

    if (itemError) throw itemError;
    return (items || []).map((i) => String(i.symbol));
  } catch (error) {
    console.error('getWatchlistSymbolsByEmail error:', error);
    return [];
  }
}

export async function addToWatchlist(userId: string, symbol: string, company: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.from('watchlist').insert({
      user_id: userId,
      symbol: symbol.toUpperCase(),
      company,
    });

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('addToWatchlist error:', error);
    return { success: false, error: 'Failed to add to watchlist' };
  }
}

export async function removeFromWatchlist(userId: string, symbol: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase
      .from('watchlist')
      .delete()
      .eq('user_id', userId)
      .eq('symbol', symbol.toUpperCase());

    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('removeFromWatchlist error:', error);
    return { success: false, error: 'Failed to remove from watchlist' };
  }
}

export async function isInWatchlist(userId: string, symbol: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('watchlist')
      .select('id')
      .eq('user_id', userId)
      .eq('symbol', symbol.toUpperCase())
      .single();

    if (error && error.code !== 'PGRST116') throw error; // PGRST116 = no rows
    return !!data;
  } catch (error) {
    console.error('isInWatchlist error:', error);
    return false;
  }
}

export async function getWatchlist(userId: string) {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase
      .from('watchlist')
      .select('*')
      .eq('user_id', userId)
      .order('added_at', { ascending: false });

    if (error) throw error;
    return data || [];
  } catch (error) {
    console.error('getWatchlist error:', error);
    return [];
  }
}
