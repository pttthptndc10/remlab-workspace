const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function check() {
  const resFiles = await fetch(`${url}/rest/v1/component_files?select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const files = await resFiles.json();

  const resBatches = await fetch(`${url}/rest/v1/component_batches?select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const batches = await resBatches.json();

  const resProjects = await fetch(`${url}/rest/v1/projects?select=*`, {
    headers: { 'apikey': key, 'Authorization': `Bearer ${key}` }
  });
  const projects = await resProjects.json();

  console.log("=== PROJECTS ===");
  console.log(projects);

  console.log("=== BATCHES ===");
  console.log(batches);

  console.log("=== FILES ===");
  console.log(files);
}

check();
