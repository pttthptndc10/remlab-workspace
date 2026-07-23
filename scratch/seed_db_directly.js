const fs = require('fs');
const env = fs.readFileSync('.env.local', 'utf8');
const urlMatch = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/) || env.match(/NEXT_PUBLIC_SUPABASE_ANON_KEY=(.*)/);

const url = urlMatch[1].trim();
const key = keyMatch[1].trim();

async function seed() {
  const headers = {
    'apikey': key,
    'Authorization': `Bearer ${key}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
  };

  console.log("1. Checking existing profile...");
  let resProf = await fetch(`${url}/rest/v1/profiles?select=*`, { headers });
  let profiles = await resProf.json();
  let adminId = profiles && profiles.length > 0 ? profiles[0].id : null;

  console.log("Admin profile ID:", adminId);

  // 2. Insert Project
  console.log("2. Seeding Project 'GẬY CÂN BẰNG PID'...");
  let resProj = await fetch(`${url}/rest/v1/projects`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'GẬY CÂN BẰNG PID',
      description: 'Dự án chế tạo gậy cân bằng PID',
      deadline: '2026-08-01T00:00:00Z',
      status: 'in_progress',
      priority: 'medium',
      created_by: adminId
    })
  });
  let projects = await resProj.json();
  console.log("Project created:", projects);
  if (!projects || projects.error || !projects[0]) {
    console.error("Failed to insert project:", projects);
    return;
  }
  const projectId = projects[0].id;

  // 3. Insert Tasks
  console.log("3. Seeding Tasks...");
  const tasksToInsert = [
    {
      project_id: projectId,
      title: 'code thuật',
      status: 'todo',
      priority: 'medium',
      progress: 0,
      notes: 'Ngày 1-3: đọc IMU, lọc dữ liệu, tính góc|notes-divider|Ngày 4-6: xuất dữ liệu serial, kiểm tra độ ổn định|notes-divider|Ngày 7-10: PID cơ',
      start_date: '2026-07-06T00:00:00Z',
      deadline: '2026-07-15T00:00:00Z',
      assignee_id: adminId,
      created_by: adminId
    },
    {
      project_id: projectId,
      title: 'lắp ráp cơ khí và PID',
      status: 'todo',
      priority: 'medium',
      progress: 0,
      notes: '',
      assignee_id: adminId,
      created_by: adminId
    },
    {
      project_id: projectId,
      title: 'mua linh kiện và lắp thử',
      status: 'todo',
      priority: 'medium',
      progress: 0,
      notes: 'từ ngày 1 tới ngày 3 t còn dưới quê chưa lên sài gòn nên trong tgian đó t sẽ chạy mô phỏng, còn 2 ngày cuối t sẽ mua linh kiện và chạy demo',
      start_date: '2026-07-01T00:00:00Z',
      deadline: '2026-07-05T00:00:00Z',
      assignee_id: adminId,
      created_by: adminId
    }
  ];

  let resTasks = await fetch(`${url}/rest/v1/tasks`, {
    method: 'POST',
    headers,
    body: JSON.stringify(tasksToInsert)
  });
  console.log("Tasks created:", await resTasks.json());

  // 4. Insert Component Batch
  console.log("4. Seeding Component Batch...");
  let resBatch = await fetch(`${url}/rest/v1/component_batches`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      name: 'Phiên gom linh kiện tháng 7',
      status: 'active',
      created_by: adminId
    })
  });
  let batches = await resBatch.json();
  console.log("Batch created:", batches);
  const batchId = Array.isArray(batches) && batches.length > 0 ? batches[0].id : null;

  // 5. Insert Component File (Tab Linh Kiện)
  console.log("5. Seeding Component File for Tab Linh Kiện...");
  const componentItems = [
    {
      id: "comp-1",
      name: "Module cảm biến MPU6050 (Gia tốc & Góc nghiêng)",
      price: 45000,
      quantity: 2,
      shop: "Shopee - Linh Kiện NTM",
      notes: "Dùng đo góc nghiêng gậy cân bằng"
    },
    {
      id: "comp-2",
      name: "Động cơ DC giảm tốc GA25 (12V 300RPM)",
      price: 120000,
      quantity: 2,
      shop: "Lazada - Robotics Store",
      notes: "Động cơ tạo lực mô-men xoắn giữ cân bằng"
    },
    {
      id: "comp-3",
      name: "Mạch điều khiển công suất động cơ L298N",
      price: 35000,
      quantity: 1,
      shop: "Linh Kiện ST",
      notes: "Mạch cầu H điều khiển chiều & tốc độ động cơ"
    },
    {
      id: "comp-4",
      name: "Bo mạch vi điều khiển Arduino Uno R3 (CH340)",
      price: 130000,
      quantity: 1,
      shop: "Minh Hà Electronics",
      notes: "Nạp thuật toán PID điều khiển cân bằng"
    }
  ];

  let resFile = await fetch(`${url}/rest/v1/component_files`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      project_id: projectId,
      batch_id: batchId,
      created_by: adminId,
      content: componentItems
    })
  });
  console.log("Component File created:", await resFile.json());

  console.log("\n✅ ALL SEED DATA SUCCESSFULLY RECREATED IN SUPABASE!");
}

seed();
