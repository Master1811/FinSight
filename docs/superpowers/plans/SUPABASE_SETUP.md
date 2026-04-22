# Supabase Setup Instructions

## Step 1: Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in:
   - **Project name**: `finsight` (or your choice)
   - **Database password**: Create a strong password (save this!)
   - **Region**: Choose closest to your users (e.g., `us-east-1`)
5. Click "Create new project" and wait for it to initialize (~2 minutes)

---

## Step 2: Execute SQL Schema

Once your project is ready:

1. Go to **SQL Editor** in the left sidebar
2. Click **"New query"**
3. Copy the entire contents of `supabase-schema.sql` from this repository
4. Paste it into the SQL editor
5. Click **"Run"** (or press `Ctrl+Enter`)
6. Wait for all queries to complete ✅

Expected output: All queries should execute without errors.

---

## Step 3: Get Your Environment Variables

### From Supabase Dashboard:

1. Go to **Settings** → **API** in the left sidebar
2. You'll see:
   - **Project URL** → Copy this
   - **anon public** → Copy this (this is your ANON_KEY)
3. Scroll down to find **service_role** key (keep this secret, for server-side only)

### Also get JWT Secret:
1. Go to **Settings** → **JWT Settings**
2. Copy the **JWT Secret** value

---

## Step 4: Update Your `.env` File

Create or update `/Users/shresth1811/Documents/PROJECTS/FinSight/.env` with these variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Server-side only (keep this secret!)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
SUPABASE_JWT_SECRET=your-jwt-secret-here

# Keep existing variables if you still need them
FINNHUB_API_KEY=your-finnhub-key
NEXT_PUBLIC_FINNHUB_API_KEY=your-finnhub-key

# Email configuration (from nodemailer setup)
NODEMAILER_EMAIL=your-email@gmail.com
NODEMAILER_PASSWORD=your-app-password

# Inngest configuration
INNGEST_EVENT_KEY=your-inngest-key
```

---

## Step 5: Verify Setup

Run this query in Supabase SQL Editor to verify tables were created:

```sql
SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename;
```

You should see:
- `profiles`
- `watchlist`

---

## Important Notes

⚠️ **DO NOT commit `.env` to git** - it contains secrets!

✅ **Your `.gitignore` should already have `.env`, so you're safe**

🔒 **Keep `SUPABASE_SERVICE_ROLE_KEY` secret** - only use server-side

🌐 **`NEXT_PUBLIC_*` variables are safe** - they're exposed in browser

---

## What to Do Next

Once you've completed these steps, let me know and I'll update the remaining files:
1. Create Supabase client files
2. Update auth actions
3. Update watchlist actions
4. Update middleware
5. Update layouts and components

