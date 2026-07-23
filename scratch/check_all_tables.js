const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function checkAll() {
  const tables = ['profiles', 'projects', 'tasks', 'component_batches', 'component_files', 'task_evidence'];
  for (const t of tables) {
    const res = await fetch(`${url}/rest/v1/${t}?select=*`, {
      headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
    });
    const data = await res.json();
    console.log(`=== ${t.toUpperCase()} (${Array.isArray(data) ? data.length : 'error'}) ===`);
    console.log(data);
  }
}

checkAll();
