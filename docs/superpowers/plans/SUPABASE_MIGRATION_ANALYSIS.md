# FinSight: MongoDB → Supabase Migration Analysis

## Executive Summary
Migrating from MongoDB + Better Auth to Supabase (PostgreSQL + Supabase Auth) requires significant changes across the application. This document outlines all the required modifications.

---

## 1. ARCHITECTURE OVERVIEW

### Current Stack
- **Database**: MongoDB (NoSQL, document-based)
- **Auth**: Better Auth (custom auth library with MongoDB adapter)
- **ORM**: Mongoose (MongoDB driver)
- **Session Management**: Better Auth cookies

### Target Stack
- **Database**: Supabase (PostgreSQL, relational)
- **Auth**: Supabase Auth (built-in auth system)
- **ORM**: Supabase JS client + raw SQL or Prisma
- **Session Management**: Supabase Auth cookies

---

## 2. PACKAGE CHANGES

### Remove
```json
"better-auth": "^1.3.7"
"mongodb": "^6.19.0"
"mongoose": "^8.18.0"
```

### Add
```json
"@supabase/supabase-js": "^2.x.x"
"@supabase/auth-helpers-nextjs": "^0.x.x"
```

**Optional** (for ORM):
- Prisma: `"@prisma/client": "^5.x.x"` (recommended for PostgreSQL)

---

## 3. DATABASE SCHEMA CHANGES

### MongoDB Collections → Supabase Tables

#### 3.1 Users Table
**MongoDB**: Managed by Better Auth (collections: `user`, `account`, `verification`)

**Supabase**: Handled by built-in `auth.users` table
```sql
-- Supabase automatically creates:
CREATE TABLE auth.users (
  id UUID PRIMARY KEY,
  email TEXT UNIQUE,
  encrypted_password TEXT,
  email_confirmed_at TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP,
  ...
);

-- Create public.profiles for additional user data
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  country TEXT,
  investment_goals TEXT,
  risk_tolerance TEXT,
  preferred_industry TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### 3.2 Watchlist Table
**MongoDB**:
```javascript
{
  userId: String (indexed),
  symbol: String (uppercase, indexed),
  company: String,
  addedAt: Date,
  _id: ObjectId
}
// Unique constraint: { userId: 1, symbol: 1 }
```

**Supabase (PostgreSQL)**:
```sql
CREATE TABLE public.watchlist (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  symbol VARCHAR(10) NOT NULL,
  company TEXT NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(user_id, symbol),
  INDEX idx_user_id (user_id)
);
```

#### 3.3 Sessions Table (if using custom sessions)
**Supabase** handles sessions automatically, but if needed:
```sql
CREATE TABLE public.sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## 4. ENVIRONMENT VARIABLES

### Remove
```env
MONGODB_URI=
BETTER_AUTH_SECRET=
BETTER_AUTH_URL=
```

### Add
```env
NEXT_PUBLIC_SUPABASE_URL=https://[project].supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc... (for server-side operations)
SUPABASE_JWT_SECRET=your-jwt-secret (for middleware/verification)
```

---

## 5. FILES TO CREATE/MODIFY

### New Files to Create

#### 5.1 `/lib/supabase/client.ts` - Supabase Client Setup
```typescript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
```

#### 5.2 `/lib/supabase/server.ts` - Server-Side Supabase Client
```typescript
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        },
      },
    }
  );
  
  return supabase;
}
```

#### 5.3 `/lib/supabase/auth.ts` - Auth Helper Functions
```typescript
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
```

### Files to Modify

#### 5.4 `/lib/actions/auth.actions.ts`
**Current**: Uses `better-auth` API
**Changes**:
- Replace `auth.api.signUpEmail()` → Supabase `signUp()`
- Replace `auth.api.signInEmail()` → Supabase `signInWithPassword()`
- Replace `auth.api.signOut()` → Supabase `signOut()`
- Update error handling to match Supabase error format
- Store additional profile data in `profiles` table after signup

**New Implementation**:
```typescript
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
    });
    
    if (signUpError) throw signUpError;
    if (!user) throw new Error('User creation failed');
    
    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        name: fullName,
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
```

#### 5.5 `/lib/actions/user.actions.ts`
**Current**: Uses MongoDB direct connection via mongoose
**Changes**:
- Replace MongoDB collection queries with Supabase SQL queries
- Update to use `profiles` table instead of `user` collection

```typescript
'use server';

import { createServerSupabaseClient } from '@/lib/supabase/server';

export const getAllUsersForNewsEmail = async () => {
  try {
    const supabase = await createServerSupabaseClient();
    
    const { data: users, error } = await supabase
      .from('profiles')
      .select('id, email:auth.users(email), name')
      .not('email', 'is', null);
    
    if (error) throw error;
    
    return (users || [])
      .filter((user) => user.email && user.name)
      .map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
      }));
  } catch (error) {
    console.error('Error fetching users:', error);
    return [];
  }
};
```

#### 5.6 `/lib/actions/watchlist.actions.ts`
**Current**: Uses Mongoose model
**Changes**:
- Replace `Watchlist.find()` with Supabase queries
- Update query syntax

```typescript
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
```

#### 5.7 `/lib/actions/watchlist.actions.ts` (Additional Functions)
Add these new functions:
```typescript
'use server';

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
```

#### 5.8 `/middleware/index.ts`
**Current**: Uses `better-auth` cookie extraction
**Changes**:
- Replace with Supabase middleware pattern

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  await supabase.auth.getSession();
  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sign-in|sign-up|assets).*)',
  ],
};
```

#### 5.9 `/app/(root)/layout.tsx`
**Current**: Uses `better-auth` to get session
**Changes**:
- Replace with Supabase auth

```typescript
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
      <div className="container py-10">{children}</div>
    </main>
  );
};

export default Layout;
```

#### 5.10 `/components/WatchlistButton.tsx`
**Changes**: Add actual watchlist operations (currently just UI)

```typescript
'use client';
import React, { useMemo, useState } from 'react';
import { addToWatchlist, removeFromWatchlist } from '@/lib/actions/watchlist.actions';

const WatchlistButton = ({
  symbol,
  company,
  isInWatchlist: initialIsInWatchlist,
  userId,
  ...props
}: WatchlistButtonProps & { userId: string }) => {
  const [added, setAdded] = useState<boolean>(!!initialIsInWatchlist);
  const [isLoading, setIsLoading] = useState(false);

  const handleClick = async () => {
    setIsLoading(true);
    try {
      if (added) {
        await removeFromWatchlist(userId, symbol);
      } else {
        await addToWatchlist(userId, symbol, company);
      }
      setAdded(!added);
      props.onWatchlistChange?.(symbol, !added);
    } catch (error) {
      console.error('Watchlist operation failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // ... rest of component
};
```

#### 5.11 Delete These Files
```
/database/mongoose.ts - REMOVE (Supabase handles connections)
/database/models/watchlist.model.ts - REMOVE (using Supabase tables directly)
/lib/better-auth/auth.ts - REMOVE (using Supabase Auth)
```

---

## 6. MIGRATION STEPS

### Phase 1: Setup
1. Create Supabase project
2. Create PostgreSQL tables (users → auth.users, profiles, watchlist)
3. Set up environment variables
4. Install Supabase dependencies

### Phase 2: Code Migration
1. Create Supabase client files
2. Update auth actions
3. Update user actions
4. Update watchlist actions
5. Update middleware
6. Update layout files
7. Update components to pass userId

### Phase 3: Testing
1. Test sign-up flow
2. Test sign-in flow
3. Test watchlist operations (add/remove)
4. Test news email delivery
5. Test session persistence

### Phase 4: Data Migration
1. Export existing MongoDB data
2. Transform to PostgreSQL format
3. Import into Supabase
4. Verify data integrity

---

## 7. KEY DIFFERENCES

| Aspect | MongoDB + Better Auth | Supabase |
|--------|----------------------|----------|
| **Auth Storage** | MongoDB collections | PostgreSQL (auth schema) |
| **User Profiles** | Manual collection | profiles table |
| **Session Mgmt** | Better Auth cookies | Supabase auth cookies |
| **Query Language** | Mongoose/MongoDB | SQL/Supabase JS client |
| **Transactions** | Limited | Full ACID support |
| **Relations** | Manual/embedding | Foreign keys |
| **Constraints** | Schema-less | Strict schemas |
| **Real-time** | Polling | Built-in subscriptions |

---

## 8. BREAKING CHANGES

1. **User ID Format**: MongoDB ObjectId → UUID
2. **Email Verification**: May need to implement if previously auto-verified
3. **Query Syntax**: Complete change from Mongoose to SQL
4. **Error Handling**: Supabase uses different error codes
5. **Rate Limiting**: Supabase has built-in rate limits
6. **File Storage**: Use Supabase Storage instead of external solutions

---

## 9. ESTIMATED EFFORT

| Task | Difficulty | Time |
|------|-----------|------|
| Setup Supabase project | Low | 30 min |
| Create database schema | Medium | 1 hour |
| Update auth system | High | 3 hours |
| Update database queries | High | 3 hours |
| Update middleware | Medium | 1 hour |
| Update components | Medium | 1.5 hours |
| Testing | High | 2 hours |
| Data migration | High | 2 hours |
| **Total** | - | **~13.5 hours** |

---

## 10. BENEFITS OF MIGRATION

✅ Built-in authentication (no custom implementation)
✅ PostgreSQL (ACID transactions, relational integrity)
✅ Row-level security (RLS) for fine-grained access control
✅ Real-time subscriptions out-of-the-box
✅ File storage included
✅ Easier scalability
✅ Better documentation and community support
✅ Simplified deployment
✅ Cost-effective at scale

---

## 11. POTENTIAL CHALLENGES

⚠️ User ID format change (UUID vs ObjectId)
⚠️ Learning curve for PostgreSQL/SQL
⚠️ Data type mapping differences
⚠️ Real-time functionality changes if currently not implemented
⚠️ Need to set up Row-Level Security (RLS) policies
⚠️ Connection pooling considerations

---

## 12. REFERENCE LINKS

- Supabase Docs: https://supabase.com/docs
- Supabase Auth: https://supabase.com/docs/guides/auth
- Supabase JS Client: https://github.com/supabase/supabase-js
- Next.js Integration: https://supabase.com/docs/guides/getting-started/quickstarts/nextjs
- PostgreSQL Docs: https://www.postgresql.org/docs/

