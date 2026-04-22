'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { inngest } from '@/lib/inngest/client';

export const signUpWithEmail = async ({
  email,
  password,
  fullName,
  country,
  investmentGoals,
  riskTolerance,
  preferredIndustry,
}: SignUpFormData) => {
  try {
    const supabase = await createServerSupabaseClient();

    // Sign up user
    const { data: { user }, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: fullName,
        },
      },
    });

    if (signUpError) throw signUpError;
    if (!user) throw new Error('User creation failed');

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        name: fullName,
        email,
        country,
        investment_goals: investmentGoals,
        risk_tolerance: riskTolerance,
        preferred_industry: preferredIndustry,
      });

    if (profileError) throw profileError;

    // Trigger welcome email
    await inngest.send({
      name: 'app/user.created',
      data: { email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry },
    });

    return { success: true };
  } catch (error) {
    console.error('Sign up failed:', error);
    return { success: false, error: 'Sign up failed' };
  }
};

export const signInWithEmail = async ({ email, password }: SignInFormData) => {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return { success: true, data };
  } catch (error) {
    console.error('Sign in failed:', error);
    return { success: false, error: 'Sign in failed' };
  }
};

export const signOut = async () => {
  try {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    return { success: true };
  } catch (error) {
    console.error('Sign out failed:', error);
    return { success: false, error: 'Sign out failed' };
  }
};
