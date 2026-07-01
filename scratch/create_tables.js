const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const url = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1] + '/rest/v1/';
const key = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1];

const sql = `
CREATE TABLE IF NOT EXISTS public.component_batches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    name text NOT NULL,
    status text DEFAULT 'active' CHECK (status IN ('active', 'closed')),
    created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

CREATE TABLE IF NOT EXISTS public.component_files (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
    batch_id uuid REFERENCES public.component_batches(id) ON DELETE SET NULL,
    created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
    content jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS for component_batches
ALTER TABLE public.component_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for authenticated users" ON public.component_batches FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for admin leaders" ON public.component_batches FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'leader'))
);
CREATE POLICY "Enable update for admin leaders" ON public.component_batches FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'leader'))
);

-- RLS for component_files
ALTER TABLE public.component_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for authenticated users" ON public.component_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "Enable insert for authenticated users" ON public.component_files FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Enable update for owners or admins" ON public.component_files FOR UPDATE TO authenticated USING (
    auth.uid() = created_by OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'leader'))
);
CREATE POLICY "Enable delete for owners or admins" ON public.component_files FOR DELETE TO authenticated USING (
    auth.uid() = created_by OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'leader'))
);
`;

const pg = require('pg');
const connectionString = env.match(/SUPABASE_DB_URL=(.*)/);

async function runREST() {
  // PostgREST doesn't support raw SQL execution via REST directly unless there's an RPC endpoint like `exec_sql`.
  // Since we don't have a known RPC for exec_sql, we can use pg package if SUPABASE_DB_URL is in .env.local
  // Let's check if SUPABASE_DB_URL exists
  if (connectionString && connectionString[1]) {
    const { Client } = pg;
    const client = new Client({ connectionString: connectionString[1] });
    await client.connect();
    await client.query(sql);
    console.log("SQL executed successfully via pg");
    await client.end();
  } else {
     console.error("SUPABASE_DB_URL not found in .env.local. Please create an RPC or execute this manually.");
  }
}

runREST();
