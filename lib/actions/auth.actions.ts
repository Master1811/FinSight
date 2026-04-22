'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';
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
    const adminSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: fullName,
        },
      },
    });

    if (signUpError) {
      console.error('Sign up error:', signUpError);
      throw signUpError;
    }

    const user = signUpData.user;
    if (!user) {
      console.error('No user returned from signup');
      throw new Error('User creation failed');
    }

    const { error: profileError } = await adminSupabase
      .from('profiles')
      .upsert({
        id: user.id,
        name: fullName,
        email,
        country,
        investment_goals: investmentGoals,
        risk_tolerance: riskTolerance,
        preferred_industry: preferredIndustry,
      }, { onConflict: 'id' });

    if (profileError) {
      console.error('Profile creation error:', profileError);
      throw profileError;
    }

    // Trigger welcome email
    await inngest.send({
      name: 'app/user.created',
      data: { email, name: fullName, country, investmentGoals, riskTolerance, preferredIndustry },
    });

    return {
      success: true,
      requiresEmailConfirmation: !signUpData.session,
    };
  } catch (error) {
    console.error('Sign up failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Sign up failed' };
  }
};

export const signInWithEmail = async ({ email, password }: SignInFormData) => {
  try {
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('Sign in error:', error);
      throw error;
    }

    console.log('Sign in successful for:', email);
    return { success: true, data };
  } catch (error) {
    console.error('Sign in failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Sign in failed' };
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
