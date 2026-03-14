/**
 * PocketBase Setup Script — compatible with PocketBase v0.23+
 * Run: node backend/setup.mjs
 */

const PB_URL      = 'http://127.0.0.1:8090';
const ADMIN_EMAIL = 'admin@stusta.de';
const ADMIN_PASS  = 'Gym@Admin2026!';

// ── REST helpers ──────────────────────────────────────────────────────────────

async function req(path, method = 'GET', body = null, token = null) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = token;
  const res = await fetch(`${PB_URL}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null,
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${method} ${path} → ${res.status}: ${text}`);
  return text ? JSON.parse(text) : {};
}

async function adminAuth() {
  // PocketBase v0.23+ uses _superusers collection
  const data = await req('/api/collections/_superusers/auth-with-password', 'POST', {
    identity: ADMIN_EMAIL, password: ADMIN_PASS,
  });
  return data.token;
}

async function collectionExists(name, token) {
  try { await req(`/api/collections/${name}`, 'GET', null, token); return true; }
  catch { return false; }
}

// ── Extend the built-in users collection with gym-specific fields ─────────────

async function extendUsersCollection(token) {
  const col = await req('/api/collections/users', 'GET', null, token);
  const existingNames = new Set(col.fields.map(f => f.name));

  const newFields = [
    { name: 'role',            type: 'select', values: ['member','supervisor','admin'], maxSelect: 1 },
    { name: 'house',           type: 'text' },
    { name: 'room',            type: 'text' },
    { name: 'dateOfBirth',     type: 'text' },
    { name: 'membershipStart', type: 'text' },
    { name: 'membershipEnd',   type: 'text' },
    { name: 'avatarInitials',  type: 'text' },
    { name: 'avatarId',        type: 'text' },
  ].filter(f => !existingNames.has(f.name));

  if (newFields.length === 0) {
    console.log('  ⏭  users fields already extended');
    return;
  }

  await req('/api/collections/users', 'PATCH', {
    fields: [...col.fields, ...newFields],
    listRule:   '@request.auth.role = "admin"',
    viewRule:   '@request.auth.id != ""',
    updateRule: '@request.auth.id = id || @request.auth.role = "admin"',
    deleteRule: '@request.auth.role = "admin"',
  }, token);
  console.log(`  ✅ Added ${newFields.length} fields to users collection`);
}

// ── Create base collections ───────────────────────────────────────────────────

async function createBaseCollections(token) {
  const collections = [
    {
      name: 'shift_blocks', type: 'base',
      listRule: '', viewRule: '',
      createRule: '@request.auth.role = "admin" || @request.auth.role = "supervisor"',
      updateRule: '@request.auth.role = "admin" || @request.auth.role = "supervisor"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: 'dayOfWeek',  type: 'number' },   // 0 = Mon … 6 = Sun (0 is valid, not "blank")
        { name: 'startTime', type: 'text', required: true },
        { name: 'endTime',   type: 'text', required: true },
        { name: 'supervisorId',   type: 'text' },
        { name: 'supervisorName', type: 'text' },
      ],
    },
    {
      name: 'spontaneous_openings', type: 'base',
      listRule: '', viewRule: '',
      createRule: '@request.auth.role = "admin" || @request.auth.role = "supervisor"',
      updateRule: '@request.auth.role = "admin" || @request.auth.role = "supervisor"',
      deleteRule: '@request.auth.role = "admin" || @request.auth.role = "supervisor"',
      fields: [
        { name: 'supervisorId',   type: 'text', required: true },
        { name: 'supervisorName', type: 'text', required: true },
        { name: 'date',           type: 'text', required: true },
        { name: 'startTime',      type: 'text', required: true },
        { name: 'endTime',        type: 'text', required: true },
        { name: 'note',           type: 'text' },
      ],
    },
    {
      name: 'notifications', type: 'base',
      listRule:   '@request.auth.id != "" && (targetUserId = @request.auth.id || targetUserId = "all")',
      viewRule:   '@request.auth.id != ""',
      createRule: '@request.auth.role = "admin"',
      updateRule: '@request.auth.id != ""',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: 'targetUserId', type: 'text', required: true },
        { name: 'message',      type: 'text', required: true },
        { name: 'type',         type: 'select', values: ['info','warning','alert'], maxSelect: 1 },
        { name: 'read',         type: 'bool' },
      ],
    },
    {
      name: 'attendance_logs', type: 'base',
      listRule:   '@request.auth.role = "admin"',
      viewRule:   '@request.auth.role = "admin"',
      createRule: '@request.auth.id != ""',
      updateRule: '@request.auth.role = "admin"',
      deleteRule: '@request.auth.role = "admin"',
      fields: [
        { name: 'userId',   type: 'text', required: true },
        { name: 'userName', type: 'text', required: true },
        { name: 'checkIn',  type: 'text', required: true },
        { name: 'checkOut', type: 'text' },
      ],
    },
  ];

  for (const col of collections) {
    if (await collectionExists(col.name, token)) {
      console.log(`  ⏭  "${col.name}" already exists`);
    } else {
      await req('/api/collections', 'POST', col, token);
      console.log(`  ✅ Created "${col.name}"`);
    }
  }
}

// ── Seed data ─────────────────────────────────────────────────────────────────

const USERS_DATA = [
  { email: 'admin@stusta.de',  password: 'Admin1234!',  name: 'Alex Admin',       role: 'admin',      house: 'Haus 1', room: '101', dateOfBirth: '1998-03-15', membershipStart: '2023-10-01', membershipEnd: '2026-09-30', avatarInitials: 'AA' },
  { email: 'sara@stusta.de',   password: 'Super1234!',  name: 'Sara Supervisor',  role: 'supervisor', house: 'Haus 2', room: '205', dateOfBirth: '2000-07-22', membershipStart: '2024-01-01', membershipEnd: '2026-12-31', avatarInitials: 'SS' },
  { email: 'jan@stusta.de',    password: 'Super1234!',  name: 'Jan Supervisor',   role: 'supervisor', house: 'Haus 3', room: '312', dateOfBirth: '1999-11-08', membershipStart: '2023-05-15', membershipEnd: '2026-05-14', avatarInitials: 'JS' },
  { email: 'max@stusta.de',    password: 'Member1234!', name: 'Max Member',       role: 'member',     house: 'Haus 4', room: '408', dateOfBirth: '2001-02-14', membershipStart: '2025-01-01', membershipEnd: '2025-12-31', avatarInitials: 'MM' },
  { email: 'lisa@stusta.de',   password: 'Member1234!', name: 'Lisa Member',      role: 'member',     house: 'Haus 1', room: '115', dateOfBirth: '2000-09-30', membershipStart: '2024-10-01', membershipEnd: '2025-09-30', avatarInitials: 'LM' },
];

async function seedUsers(token) {
  const idMap = {};
  for (const u of USERS_DATA) {
    const existing = await req(`/api/collections/users/records?filter=email%3D"${encodeURIComponent(u.email)}"`, 'GET', null, token);
    if (existing.items?.length > 0) {
      idMap[u.email] = existing.items[0].id;
      console.log(`  ⏭  "${u.name}" already exists`);
      continue;
    }
    const { password, ...rest } = u;
    const created = await req('/api/collections/users/records', 'POST', {
      ...rest, password, passwordConfirm: password, emailVisibility: true,
    }, token);
    idMap[u.email] = created.id;
    console.log(`  ✅ Created "${u.name}"`);
  }
  return idMap;
}

async function seedShifts(token, idMap) {
  const existing = await req('/api/collections/shift_blocks/records?perPage=1', 'GET', null, token);
  if (existing.totalItems > 0) { console.log(`  ⏭  Shifts already seeded (${existing.totalItems})`); return; }

  const saraSup = idMap['sara@stusta.de'];
  const janSup  = idMap['jan@stusta.de'];
  const SHIFTS = [
    [0,'06:00','09:00'],
    [0,'09:00','12:00','jan'],
    [0,'15:00','18:00','sara'],
    [0,'18:00','21:00'],
    [1,'06:00','09:00'],
    [1,'09:00','12:00'],
    [1,'15:00','18:00','jan'],
    [1,'18:00','21:00'],
    [2,'09:00','12:00','sara'],
    [2,'15:00','18:00'],
    [3,'06:00','09:00'],
    [3,'09:00','12:00','jan'],
    [3,'15:00','18:00','sara'],
    [3,'18:00','21:00'],
    [4,'09:00','12:00'],
    [4,'15:00','18:00','jan'],
    [4,'18:00','21:00'],
    [5,'09:00','12:00','sara'],
    [5,'15:00','18:00'],
    [5,'18:00','21:00','jan'],
    [6,'10:00','14:00','sara'],
    [6,'14:00','18:00'],
  ];
  for (const [dow, st, et, sup] of SHIFTS) {
    await req('/api/collections/shift_blocks/records', 'POST', {
      dayOfWeek: dow, startTime: st, endTime: et,
      supervisorId:   sup === 'sara' ? saraSup : sup === 'jan' ? janSup : '',
      supervisorName: sup === 'sara' ? 'Sara Supervisor' : sup === 'jan' ? 'Jan Supervisor' : '',
    }, token);
  }
  console.log(`  ✅ Created ${SHIFTS.length} shift blocks`);
}

async function seedMisc(token, idMap) {
  const todayStr = new Date().toISOString().slice(0, 10);
  const saraSup  = idMap['sara@stusta.de'];

  // Spontaneous
  const sp = await req('/api/collections/spontaneous_openings/records?perPage=1', 'GET', null, token);
  if (sp.totalItems === 0) {
    await req('/api/collections/spontaneous_openings/records', 'POST', {
      supervisorId: saraSup, supervisorName: 'Sara Supervisor',
      date: todayStr, startTime: '17:00', endTime: '19:00',
      note: 'Extra session — bring a friend!',
    }, token);
    console.log('  ✅ Created 1 spontaneous opening');
  } else { console.log('  ⏭  Spontaneous openings already seeded'); }

  // Notifications
  const nf = await req('/api/collections/notifications/records?perPage=1', 'GET', null, token);
  if (nf.totalItems === 0) {
    await req('/api/collections/notifications/records', 'POST', { targetUserId: 'all', message: '🏋️ Gym equipment maintenance on Sunday 10:00–12:00.', type: 'warning', read: false }, token);
    await req('/api/collections/notifications/records', 'POST', { targetUserId: 'all', message: '✅ New lockers installed in changing rooms!', type: 'info', read: false }, token);
    console.log('  ✅ Created 2 notifications');
  } else { console.log('  ⏭  Notifications already seeded'); }

  // Attendance
  const at = await req('/api/collections/attendance_logs/records?perPage=1', 'GET', null, token);
  if (at.totalItems === 0) {
    const now = Date.now();
    const logs = [
      { userId: idMap['max@stusta.de'],  userName: 'Max Member',  checkIn: new Date(now-3600000).toISOString(), checkOut: new Date(now-1800000).toISOString() },
      { userId: idMap['lisa@stusta.de'], userName: 'Lisa Member', checkIn: new Date(now-7200000).toISOString(), checkOut: new Date(now-5400000).toISOString() },
      { userId: idMap['max@stusta.de'],  userName: 'Max Member',  checkIn: new Date(now-86400000).toISOString(), checkOut: new Date(now-82800000).toISOString() },
    ];
    for (const l of logs) await req('/api/collections/attendance_logs/records', 'POST', l, token);
    console.log('  ✅ Created 3 attendance logs');
  } else { console.log('  ⏭  Attendance logs already seeded'); }
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('\n🏋️  StuSta Gym — PocketBase Setup (v0.23+)\n');

  console.log('1. Authenticating…');
  const token = await adminAuth();
  console.log('   ✅ Authenticated\n');

  console.log('2. Extending users collection with gym fields…');
  await extendUsersCollection(token);
  console.log();

  console.log('3. Creating base collections…');
  await createBaseCollections(token);
  console.log();

  console.log('4. Seeding users…');
  const idMap = await seedUsers(token);
  console.log();

  console.log('5. Seeding shifts…');
  await seedShifts(token, idMap);
  console.log();

  console.log('6. Seeding misc (openings, notifications, attendance)…');
  await seedMisc(token, idMap);

  console.log('\n✅ All done!\n');
  console.log('📋 Test accounts:');
  console.log('   admin@stusta.de  / Admin1234!   (admin)');
  console.log('   sara@stusta.de   / Super1234!   (supervisor)');
  console.log('   jan@stusta.de    / Super1234!   (supervisor)');
  console.log('   max@stusta.de    / Member1234!  (member)');
  console.log('   lisa@stusta.de   / Member1234!  (member)\n');
  console.log('🌐 Admin UI:  http://127.0.0.1:8090/_/');
  console.log('   Superuser:  admin@stusta.de  /  Gym@Admin2026!\n');
}

main().catch(err => { console.error('\n❌ Setup failed:', err.message); process.exit(1); });
