const { createClient } = require('@supabase/supabase-js');

const adminSupabase = createClient(
  'https://vjqdkxvmjpfputbpppgt.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqcWRreHZtanBmcHV0YnBwcGd0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Njg3Njc3MCwiZXhwIjoyMDkyNDUyNzcwfQ.QGUGL_27WBkthATr-Y8Zwg9BWSsKML24G2LtRF4qwKo'
);

async function testAdminSignup() {
  try {
    console.log('Testing admin user creation...');
    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: 'testuser@gmail.com',
      password: 'password123',
      email_confirm: true,
      user_metadata: { name: 'Test User' }
    });

    console.log('Result:', {
      success: !error,
      user: data?.user ? { id: data.user.id, email: data.user.email } : null,
      error: error?.message
    });

    if (data?.user) {
      // Test profile creation
      const regularClient = createClient(
        'https://vjqdkxvmjpfputbpppgt.supabase.co',
        'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZqcWRreHZtanBmcHV0YnBwcGd0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY4NzY3NzAsImV4cCI6MjA5MjQ1Mjc3MH0.llNv1zT1JYWbYKGuFYEw-qDoUKCDE7C6jev-LQ6VdJY'
      );

      const { error: profileError } = await regularClient
        .from('profiles')
        .insert({
          id: data.user.id,
          name: 'Test User',
          email: 'testuser@gmail.com',
          country: 'US',
          investment_goals: 'Growth',
          risk_tolerance: 'Medium',
          preferred_industry: 'Technology',
        });

      console.log('Profile creation:', profileError ? 'Failed: ' + profileError.message : 'Success');
    }
  } catch (err) {
    console.error('Test failed:', err.message);
  }
}

testAdminSignup();