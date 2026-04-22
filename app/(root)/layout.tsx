import { createServerSupabaseClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Header from '@/components/Header';

const Layout = async ({ children }: { children: React.ReactNode }) => {
  const supabase = await createServerSupabaseClient();

  const { data: { session }, error } = await supabase.auth.getSession();

  if (!session?.user) redirect('/sign-in');

  const user = {
    id: session.user.id,
    name: session.user.user_metadata?.name || session.user.email,
    email: session.user.email,
  };

  return (
    <main className="min-h-screen text-gray-400">
      <Header user={user} />
      <div className="container py-10">
        {children}
      </div>
    </main>
  );
};

export default Layout;
