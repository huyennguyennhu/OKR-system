const { Pool } = require('pg');
require('dotenv').config();

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.warn('Warning: DATABASE_URL is not set. Please create a .env file with DATABASE_URL=...');
}

const pool = new Pool({
  connectionString,
  ssl: {
    rejectUnauthorized: false
  }
});

function convertSqlToPg(sql) {
  let counter = 1;
  return sql.replace(/\?/g, () => `$${counter++}`);
}

async function run(sql, params = []) {
  const pgSql = convertSqlToPg(sql);
  try {
    const res = await pool.query(pgSql, params);
    return res;
  } catch (err) {
    console.error('Error running sql:', pgSql, params, err);
    throw err;
  }
}

async function get(sql, params = []) {
  const pgSql = convertSqlToPg(sql);
  try {
    const res = await pool.query(pgSql, params);
    return res.rows[0];
  } catch (err) {
    console.error('Error in get sql:', pgSql, params, err);
    throw err;
  }
}

async function all(sql, params = []) {
  const pgSql = convertSqlToPg(sql);
  try {
    const res = await pool.query(pgSql, params);
    return res.rows;
  } catch (err) {
    console.error('Error in all sql:', pgSql, params, err);
    throw err;
  }
}

async function initDatabase() {
  await run(`
    CREATE TABLE IF NOT EXISTS Employees (
      employee_id TEXT PRIMARY KEY,
      display_code TEXT NOT NULL,
      full_name TEXT NOT NULL,
      team_id TEXT NOT NULL,
      gitlab_user_id TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 2. Objectives table
  await run(`
    CREATE TABLE IF NOT EXISTS Objectives (
      objective_id TEXT PRIMARY KEY,
      parent_id TEXT,
      level TEXT NOT NULL, -- 'company', 'team', 'individual'
      title TEXT NOT NULL,
      timeline_id TEXT DEFAULT 'Q3-2026',
      progress REAL DEFAULT 0.0
    )
  `);

  // 3. KeyResults table
  await run(`
    CREATE TABLE IF NOT EXISTS KeyResults (
      kr_id TEXT PRIMARY KEY,
      objective_id TEXT NOT NULL,
      metric_id TEXT NOT NULL,
      title TEXT NOT NULL,
      start_value REAL NOT NULL,
      expected_value REAL NOT NULL,
      current_value REAL NOT NULL,
      direction TEXT NOT NULL DEFAULT 'increase', -- 'increase' or 'decrease'
      unit TEXT DEFAULT '%',
      FOREIGN KEY (objective_id) REFERENCES Objectives(objective_id)
    )
  `);

  // 4. MeasurementRules table
  await run(`
    CREATE TABLE IF NOT EXISTS MeasurementRules (
      rule_id TEXT PRIMARY KEY,
      kr_id TEXT NOT NULL,
      event_type TEXT NOT NULL, -- 'merge_request', 'issue'
      filters TEXT, -- JSON string e.g. {"label": "bug", "target_branch": "main"}
      start_event TEXT NOT NULL, -- e.g. 'open' or 'assign'
      end_event TEXT NOT NULL,   -- e.g. 'approved' or 'close'
      sla_value REAL NOT NULL,   -- SLA in hours
      formula TEXT NOT NULL,     -- Formula description
      version TEXT DEFAULT 'v1.0',
      FOREIGN KEY (kr_id) REFERENCES KeyResults(kr_id)
    )
  `);

  // 5. GitLabEvents table
  await run(`
    CREATE TABLE IF NOT EXISTS GitLabEvents (
      event_key TEXT PRIMARY KEY,
      project_code TEXT NOT NULL,
      object_kind TEXT NOT NULL,
      object_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      actor_id TEXT NOT NULL,
      event_time TEXT NOT NULL,
      payload_hash TEXT NOT NULL,
      raw_payload TEXT,
      processing_status TEXT DEFAULT 'success' -- 'success', 'duplicate', 'excluded', 'failed'
    )
  `);

  // ----------------------------------------------------
  // OKR SETTINGS TABLES
  // ----------------------------------------------------

  await run(`
    CREATE TABLE IF NOT EXISTS Spaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      space_key TEXT NOT NULL,
      manager_id TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS Timelines (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      start_date TEXT,
      end_date TEXT,
      workspace_id TEXT,
      timeline_category TEXT,
      FOREIGN KEY (workspace_id) REFERENCES Spaces(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS Metrics (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT,
      metric_key TEXT,
      is_percent BOOLEAN DEFAULT false,
      description TEXT
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS SpaceMembers (
      id TEXT PRIMARY KEY,
      space_id TEXT NOT NULL,
      user_name TEXT NOT NULL,
      email TEXT,
      role TEXT,
      FOREIGN KEY (space_id) REFERENCES Spaces(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS MetricConversions (
      id TEXT PRIMARY KEY,
      source_metric_id TEXT NOT NULL,
      target_metric_id TEXT NOT NULL,
      conversion_ratio REAL NOT NULL,
      FOREIGN KEY (source_metric_id) REFERENCES Metrics(id),
      FOREIGN KEY (target_metric_id) REFERENCES Metrics(id)
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS Templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      formula TEXT,
      template_type TEXT NOT NULL -- 'PROGRESS' or 'AGGREGATION'
    )
  `);

  // 6. EventAssignments table (Traceability)
  await run(`
    CREATE TABLE IF NOT EXISTS EventAssignments (
      assignment_id SERIAL PRIMARY KEY,
      event_key TEXT NOT NULL,
      kr_id TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      included INTEGER NOT NULL, -- 1 for true, 0 for false
      reason TEXT NOT NULL,
      duration_minutes REAL,
      on_time INTEGER, -- 1 for true, 0 for false
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_key) REFERENCES GitLabEvents(event_key),
      FOREIGN KEY (kr_id) REFERENCES KeyResults(kr_id),
      FOREIGN KEY (employee_id) REFERENCES Employees(employee_id)
    )
  `);

  // 7. MetricResults table
  await run(`
    CREATE TABLE IF NOT EXISTS MetricResults (
      result_id SERIAL PRIMARY KEY,
      kr_id TEXT NOT NULL,
      period TEXT NOT NULL,
      numerator INTEGER NOT NULL,
      denominator INTEGER NOT NULL,
      current_value REAL NOT NULL,
      progress REAL NOT NULL,
      status TEXT DEFAULT 'calculated',
      calculated_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (kr_id) REFERENCES KeyResults(kr_id)
    )
  `);

  // 8. ProcessingLogs table
  await run(`
    CREATE TABLE IF NOT EXISTS ProcessingLogs (
      run_id TEXT PRIMARY KEY,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT NOT NULL,
      input_count INTEGER DEFAULT 0,
      output_count INTEGER DEFAULT 0,
      error_message TEXT
    )
  `);


  await run(`
    CREATE TABLE IF NOT EXISTS Teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  await run(`
    CREATE TABLE IF NOT EXISTS Roles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  const roleCountInit = await get('SELECT count(*) as count FROM Roles');
  if (parseInt(roleCountInit.count) === 0) {
    await run('INSERT INTO Roles (id, name, code, description) VALUES (?, ?, ?, ?)', 
      ['ROLE-DEV', 'Developer', 'DEV', 'Lập trình viên chịu trách nhiệm viết mã, unit test và giải quyết issues']);
    await run('INSERT INTO Roles (id, name, code, description) VALUES (?, ?, ?, ?)', 
      ['ROLE-LEAD', 'Tech Lead', 'LEAD', 'Trưởng nhóm kỹ thuật phụ trách kiến trúc, code review và SLA quy trình']);
    await run('INSERT INTO Roles (id, name, code, description) VALUES (?, ?, ?, ?)', 
      ['ROLE-QA', 'QA Engineer', 'QA', 'Kỹ sư kiểm thử chất lượng phần mềm, kiểm tra test case và xác nhận SLA bug']);
    await run('INSERT INTO Roles (id, name, code, description) VALUES (?, ?, ?, ?)', 
      ['ROLE-PO', 'Product Owner', 'PO', 'Chủ sở hữu sản phẩm định hướng mục tiêu OKR và phân rã yêu cầu']);
    await run('INSERT INTO Roles (id, name, code, description) VALUES (?, ?, ?, ?)', 
      ['ROLE-DEVOPS', 'DevOps Engineer', 'DEVOPS', 'Kỹ sư vận hành hạ tầng CI/CD, pipeline và tự động hóa hệ thống']);
  }

  // Auto seed initial data if Objectives is empty
  const objCount = await get('SELECT count(*) as count FROM Objectives');
  if (parseInt(objCount.count) === 0) {
    await seedInitialData();
  }
}

async function seedInitialData() {
  console.log('Seeding initial data...');
  // 1. Employees
  const empCount = await get('SELECT count(*) as count FROM Employees');
  if (parseInt(empCount.count) === 0) {
    const employees = [
      ['EMP001', 'DEV-01', 'Nguyễn Văn Anh', 'FE-Team', 'alex.dev', 'active'],
      ['EMP002', 'DEV-02', 'Trần Thị Bình', 'BE-Team', 'sarah.reviewer', 'active'],
      ['EMP003', 'DEV-03', 'Lê Hoàng Cường', 'BE-Team', 'john.coder', 'active'],
      ['EMP004', 'QA-01', 'Phạm Minh Dũng', 'QA-Team', 'emma.qa', 'active']
    ];
    for (const e of employees) {
      await run('INSERT INTO Employees (employee_id, display_code, full_name, team_id, gitlab_user_id, status) VALUES (?, ?, ?, ?, ?, ?)', e);
    }
  }

  // 2. Objectives
  const objCount = await get('SELECT count(*) as count FROM Objectives');
  if (parseInt(objCount.count) === 0) {
    const objectives = [
      ['OBJ-COMPANY-01', null, 'company', 'Tối ưu hóa quy trình phát triển sản phẩm phần mềm Q3/2026', 'Q3-2026', 76.1],
      ['OBJ-TEAM-01', 'OBJ-COMPANY-01', 'team', 'Nâng cao chất lượng và tốc độ Code Review của Nhóm Backend', 'Q3-2026', 75.0],
      ['OBJ-IND-01', 'OBJ-TEAM-01', 'individual', 'Xử lý Bug và Merge Request đúng hạn cam kết SLA', 'Q3-2026', 78.3]
    ];
    for (const o of objectives) {
      await run('INSERT INTO Objectives (objective_id, parent_id, level, title, timeline_id, progress) VALUES (?, ?, ?, ?, ?, ?)', o);
    }
  }

  // 3. KeyResults
  const krCount = await get('SELECT count(*) as count FROM KeyResults');
  if (parseInt(krCount.count) === 0) {
    const keyResults = [
      ['KR-MR-SLA', 'OBJ-TEAM-01', 'METRIC-01', 'Tỷ lệ Merge Request được phê duyệt đúng thời hạn SLA (4 giờ làm việc)', 60, 90, 75, 'increase', '%'],
      ['KR-ISSUE-SLA', 'OBJ-IND-01', 'METRIC-02', 'Tỷ lệ Issue tính năng hoàn thành đúng hạn SLA (24 giờ làm việc)', 50, 85, 70, 'increase', '%'],
      ['KR-BUG-SLA', 'OBJ-IND-01', 'METRIC-03', 'Tỷ lệ Lỗi (Bug) được khắc phục trong SLA 8 giờ làm việc', 70, 95, 83.3, 'increase', '%']
    ];
    for (const k of keyResults) {
      await run('INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', k);
    }
  }

  // 4. MeasurementRules
  const ruleCount = await get('SELECT count(*) as count FROM MeasurementRules');
  if (parseInt(ruleCount.count) === 0) {
    const rules = [
      ['RULE-MR-01', 'KR-MR-SLA', 'merge_request', '{"is_draft": false}', 'reviewer_assigned', 'approved', 4, 'Số MR approved <= 4h làm việc / Tổng MR hợp lệ * 100%', 'v1.0'],
      ['RULE-ISSUE-01', 'KR-ISSUE-SLA', 'issue', '{"issue_type": "feature"}', 'opened', 'closed', 24, 'Số Issue đóng <= 24h làm việc / Tổng Issue hoàn thành * 100%', 'v1.0'],
      ['RULE-BUG-01', 'KR-BUG-SLA', 'issue', '{"label": "bug"}', 'opened', 'closed', 8, 'Số Bug đóng <= 8h làm việc / Tổng Bug phát sinh * 100%', 'v1.0']
    ];
    for (const r of rules) {
      await run('INSERT INTO MeasurementRules (rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)', r);
    }
  }

  // 5. Teams
  const teamCount = await get('SELECT count(*) as count FROM Teams');
  if (parseInt(teamCount.count) === 0) {
    await run('INSERT INTO Teams (id, name, code) VALUES (?, ?, ?)', ['TEAM-BE', 'Nhóm Backend (BE-Team)', 'BE-Team']);
    await run('INSERT INTO Teams (id, name, code) VALUES (?, ?, ?)', ['TEAM-FE', 'Nhóm Frontend (FE-Team)', 'FE-Team']);
    await run('INSERT INTO Teams (id, name, code) VALUES (?, ?, ?)', ['TEAM-QA', 'Nhóm Kiểm thử (QA-Team)', 'QA-Team']);
  }

  // 6. Roles
  const roleCount = await get('SELECT count(*) as count FROM Roles');
  if (parseInt(roleCount.count) === 0) {
    await run('INSERT INTO Roles (id, name, code, description) VALUES (?, ?, ?, ?)', 
      ['ROLE-DEV', 'Developer', 'DEV', 'Lập trình viên chịu trách nhiệm viết mã, unit test và giải quyết issues']);
    await run('INSERT INTO Roles (id, name, code, description) VALUES (?, ?, ?, ?)', 
      ['ROLE-LEAD', 'Tech Lead', 'LEAD', 'Trưởng nhóm kỹ thuật phụ trách kiến trúc, code review và SLA quy trình']);
    await run('INSERT INTO Roles (id, name, code, description) VALUES (?, ?, ?, ?)', 
      ['ROLE-QA', 'QA Engineer', 'QA', 'Kỹ sư kiểm thử chất lượng phần mềm, kiểm tra test case và xác nhận SLA bug']);
    await run('INSERT INTO Roles (id, name, code, description) VALUES (?, ?, ?, ?)', 
      ['ROLE-PO', 'Product Owner', 'PO', 'Chủ sở hữu sản phẩm định hướng mục tiêu OKR và phân rã yêu cầu']);
    await run('INSERT INTO Roles (id, name, code, description) VALUES (?, ?, ?, ?)', 
      ['ROLE-DEVOPS', 'DevOps Engineer', 'DEVOPS', 'Kỹ sư vận hành hạ tầng CI/CD, pipeline và tự động hóa hệ thống']);
  }
  console.log('Seeding initial data complete.');
}

module.exports = {
  db: pool,
  run,
  get,
  all,
  initDatabase,
  seedInitialData
};
