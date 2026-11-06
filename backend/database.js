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
      email TEXT,
      role TEXT,
      status TEXT DEFAULT 'active',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await run('ALTER TABLE Employees ADD COLUMN IF NOT EXISTS email TEXT');
    await run('ALTER TABLE Employees ADD COLUMN IF NOT EXISTS role TEXT');
  } catch (e) {}

  // 2. Objectives table (partitioned by space_id)
  await run(`
    CREATE TABLE IF NOT EXISTS Objectives (
      objective_id TEXT PRIMARY KEY,
      parent_id TEXT,
      level TEXT NOT NULL, -- 'company', 'team', 'individual'
      title TEXT NOT NULL,
      timeline_id TEXT DEFAULT 'Q3-2026',
      progress REAL DEFAULT 0.0,
      description TEXT,
      assignee_id TEXT,
      metric_id TEXT,
      category TEXT,
      start_value REAL DEFAULT 0,
      expected_value REAL DEFAULT 100,
      space_id TEXT
    )
  `);

  try {
    await run('ALTER TABLE Objectives ADD COLUMN IF NOT EXISTS space_id TEXT');
    await run('ALTER TABLE Objectives ALTER COLUMN metric_id TYPE TEXT USING metric_id::TEXT');
  } catch (e) {}

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
      space_id TEXT,
      assignee_id TEXT,
      parent_kr_id TEXT,
      description TEXT,
      FOREIGN KEY (objective_id) REFERENCES Objectives(objective_id)
    )
  `);

  try {
    await run('ALTER TABLE KeyResults ADD COLUMN IF NOT EXISTS space_id TEXT');
    await run('ALTER TABLE KeyResults ADD COLUMN IF NOT EXISTS assignee_id TEXT');
    await run('ALTER TABLE KeyResults ADD COLUMN IF NOT EXISTS parent_kr_id TEXT');
  } catch (e) {}

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
      version TEXT DEFAULT 'v1.0'
    )
  `);

  try {
    await run(`
      ALTER TABLE MeasurementRules 
      ADD COLUMN IF NOT EXISTS objective_id TEXT,
      ADD COLUMN IF NOT EXISTS flow_code TEXT,
      ADD COLUMN IF NOT EXISTS flow_name TEXT,
      ADD COLUMN IF NOT EXISTS flow_url TEXT,
      ADD COLUMN IF NOT EXISTS threshold_percent REAL DEFAULT 90,
      ADD COLUMN IF NOT EXISTS overtime_handling TEXT,
      ADD COLUMN IF NOT EXISTS lunch_break_rule TEXT,
      ADD COLUMN IF NOT EXISTS weekend_holiday_rule TEXT,
      ADD COLUMN IF NOT EXISTS updated_at TEXT
    `);
  } catch (e) {}

  // WorkingHours table
  await run(`
    CREATE TABLE IF NOT EXISTS WorkingHours (
      id TEXT PRIMARY KEY,
      space_id TEXT DEFAULT 'SPC-1793153879989',
      morning_start TEXT DEFAULT '08:00',
      morning_end TEXT DEFAULT '12:00',
      afternoon_start TEXT DEFAULT '13:30',
      afternoon_end TEXT DEFAULT '17:30',
      working_days TEXT DEFAULT '["T2","T3","T4","T5","T6"]',
      week_days_json TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Holidays table
  await run(`
    CREATE TABLE IF NOT EXISTS Holidays (
      id TEXT PRIMARY KEY,
      space_id TEXT DEFAULT 'SPC-1793153879989',
      name TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date TEXT NOT NULL,
      days_count INTEGER NOT NULL DEFAULT 1,
      is_active BOOLEAN NOT NULL DEFAULT true,
      note TEXT,
      updated_at TEXT DEFAULT CURRENT_TIMESTAMP
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
      FOREIGN KEY (workspace_id) REFERENCES Spaces(id) ON DELETE CASCADE
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
      team_name TEXT,
      FOREIGN KEY (space_id) REFERENCES Spaces(id) ON DELETE CASCADE
    )
  `);
  try {
    await run('ALTER TABLE SpaceMembers ADD COLUMN IF NOT EXISTS team_name TEXT');
  } catch (e) {}

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
      note TEXT,
      author TEXT,
      target_field TEXT,
      run_id TEXT,
      flow_code TEXT,
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

  // 8b. FlowRuns table (Quản lý các lần chạy & dữ liệu tạo ra của từng Flow Activepieces)
  await run(`
    CREATE TABLE IF NOT EXISTS FlowRuns (
      run_id TEXT PRIMARY KEY,
      flow_code TEXT NOT NULL,
      flow_name TEXT NOT NULL,
      trigger_type TEXT DEFAULT 'Schedule',
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      duration_ms INTEGER DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'SUCCESS',
      input_count INTEGER DEFAULT 0,
      output_count INTEGER DEFAULT 0,
      data_created TEXT,
      payload_json TEXT,
      error_message TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 8c. Comments table (Lưu vết bình luận, phản hồi và ghi chú check-in từ Activepieces & người dùng)
  await run(`
    CREATE TABLE IF NOT EXISTS Comments (
      comment_id SERIAL PRIMARY KEY,
      objective_id TEXT,
      kr_id TEXT,
      author TEXT NOT NULL,
      author_id TEXT,
      author_avatar TEXT,
      content TEXT NOT NULL,
      source TEXT DEFAULT 'activepieces',
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);

  try {
    await run('CREATE INDEX IF NOT EXISTS idx_comments_objective ON Comments(objective_id)');
    await run('CREATE INDEX IF NOT EXISTS idx_comments_kr ON Comments(kr_id)');
  } catch (e) {}

  // 10. AuditLogs table (Lịch sử chỉnh sửa các thuộc tính KR / Objective)
  await run(`
    CREATE TABLE IF NOT EXISTS AuditLogs (
      log_id SERIAL PRIMARY KEY,
      target_entity TEXT,
      kr_id TEXT,
      objective_id TEXT,
      actor TEXT,
      author TEXT NOT NULL DEFAULT 'Y Nguyen',
      author_avatar TEXT,
      field_name TEXT NOT NULL,
      old_value TEXT,
      new_value TEXT,
      new_value_avatar TEXT,
      source TEXT,
      reason TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
    )
  `);
  try {
    await run('ALTER TABLE AuditLogs ADD COLUMN IF NOT EXISTS target_entity TEXT');
    await run('ALTER TABLE AuditLogs ADD COLUMN IF NOT EXISTS actor TEXT');
    await run('ALTER TABLE AuditLogs ADD COLUMN IF NOT EXISTS source TEXT');
    await run('ALTER TABLE AuditLogs ADD COLUMN IF NOT EXISTS reason TEXT');
    await run('CREATE INDEX IF NOT EXISTS idx_auditlogs_kr ON AuditLogs(kr_id)');
  } catch (e) {}


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

  // Populate space_id on existing Objectives & KeyResults if null
  try {
    const defaultSpace = await get("SELECT workspace_id FROM Timelines WHERE workspace_id IS NOT NULL LIMIT 1") 
                      || await get("SELECT id as workspace_id FROM Spaces LIMIT 1");
    if (defaultSpace && defaultSpace.workspace_id) {
      await run('UPDATE Objectives SET space_id = ? WHERE space_id IS NULL', [defaultSpace.workspace_id]);
      await run(`
        UPDATE KeyResults kr
        SET space_id = o.space_id
        FROM Objectives o
        WHERE kr.objective_id = o.objective_id AND kr.space_id IS NULL
      `);
    }
  } catch (e) {
    console.warn('Migration warning for space_id:', e.message);
  }

  // Enforce Relational Integrity & Foreign Keys
  const constraints = [
    { table: 'Employees', name: 'employees_team_id_fkey', sql: 'FOREIGN KEY (team_id) REFERENCES Teams(id) ON DELETE RESTRICT' },
    { table: 'Roles', name: 'roles_team_id_fkey', sql: 'FOREIGN KEY (team_id) REFERENCES Teams(id) ON DELETE SET NULL' },
    { table: 'Objectives', name: 'objectives_parent_id_fkey', sql: 'FOREIGN KEY (parent_id) REFERENCES Objectives(objective_id) ON DELETE SET NULL' },
    { table: 'Objectives', name: 'objectives_timeline_id_fkey', sql: 'FOREIGN KEY (timeline_id) REFERENCES Timelines(id) ON DELETE CASCADE' },
    { table: 'Objectives', name: 'objectives_space_id_fkey', sql: 'FOREIGN KEY (space_id) REFERENCES Spaces(id) ON DELETE CASCADE' },
    { table: 'Objectives', name: 'objectives_metric_id_fkey', sql: 'FOREIGN KEY (metric_id) REFERENCES Metrics(id) ON DELETE SET NULL' },
    { table: 'KeyResults', name: 'keyresults_parent_kr_id_fkey', sql: 'FOREIGN KEY (parent_kr_id) REFERENCES KeyResults(kr_id) ON DELETE SET NULL' },
    { table: 'KeyResults', name: 'keyresults_space_id_fkey', sql: 'FOREIGN KEY (space_id) REFERENCES Spaces(id) ON DELETE CASCADE' },
    { table: 'KeyResults', name: 'keyresults_metric_id_fkey', sql: 'FOREIGN KEY (metric_id) REFERENCES Metrics(id) ON DELETE RESTRICT' },
    { table: 'MeasurementRules', name: 'measurementrules_kr_id_fkey', sql: 'FOREIGN KEY (kr_id) REFERENCES KeyResults(kr_id) ON DELETE CASCADE' },
    { table: 'MeasurementRules', name: 'measurementrules_objective_id_fkey', sql: 'FOREIGN KEY (objective_id) REFERENCES Objectives(objective_id) ON DELETE CASCADE' },
    { table: 'Comments', name: 'comments_objective_id_fkey', sql: 'FOREIGN KEY (objective_id) REFERENCES Objectives(objective_id) ON DELETE CASCADE' },
    { table: 'Comments', name: 'comments_kr_id_fkey', sql: 'FOREIGN KEY (kr_id) REFERENCES KeyResults(kr_id) ON DELETE CASCADE' },
    { table: 'AuditLogs', name: 'auditlogs_kr_id_fkey', sql: 'FOREIGN KEY (kr_id) REFERENCES KeyResults(kr_id) ON DELETE SET NULL' },
    { table: 'AuditLogs', name: 'auditlogs_objective_id_fkey', sql: 'FOREIGN KEY (objective_id) REFERENCES Objectives(objective_id) ON DELETE SET NULL' },
    { table: 'EventAssignments', name: 'eventassignments_employee_id_fkey', sql: 'FOREIGN KEY (employee_id) REFERENCES Employees(employee_id) ON DELETE CASCADE' },
    { table: 'MetricResults', name: 'metricresults_run_id_fkey', sql: 'FOREIGN KEY (run_id) REFERENCES FlowRuns(run_id) ON DELETE SET NULL' },
    { table: 'Holidays', name: 'holidays_space_id_fkey', sql: 'FOREIGN KEY (space_id) REFERENCES Spaces(id) ON DELETE CASCADE' },
    { table: 'WorkingHours', name: 'workinghours_space_id_fkey', sql: 'FOREIGN KEY (space_id) REFERENCES Spaces(id) ON DELETE CASCADE' },
    { table: 'Timelines', name: 'timelines_parent_id_fkey', sql: 'FOREIGN KEY (parent_id) REFERENCES Timelines(id) ON DELETE SET NULL' },
    { table: 'SpaceMembers', name: 'spacemembers_employee_id_fkey', sql: 'FOREIGN KEY (employee_id) REFERENCES Employees(employee_id) ON DELETE CASCADE' },
    { table: 'ProcessingLogs', name: 'processinglogs_run_id_fkey', sql: 'FOREIGN KEY (run_id) REFERENCES FlowRuns(run_id) ON DELETE CASCADE' }
  ];

  for (const c of constraints) {
    try {
      await run(`ALTER TABLE "${c.table}" DROP CONSTRAINT IF EXISTS "${c.name}"`);
      await run(`ALTER TABLE "${c.table}" ADD CONSTRAINT "${c.name}" ${c.sql}`);
    } catch (e) {
      // Ignore if table or constraint already structured
    }
  }

  // Auto seed initial data if Objectives is empty
  const objCount = await get('SELECT count(*) as count FROM Objectives');
  if (parseInt(objCount.count) === 0) {
    await seedInitialData();
  }
}

async function seedInitialData() {
  console.log('Seeding initial data...');
  // 0. Metrics
  const metricCount = await get('SELECT count(*) as count FROM Metrics');
  if (parseInt(metricCount.count) === 0) {
    const metrics = [
      ['METRIC-01', 'Tỷ lệ Merge Request đạt chuẩn SLA', '%', 'MR_SLA', true, 'Đo lường tỷ lệ Merge Request được phê duyệt trong thời hạn SLA cam kết'],
      ['METRIC-02', 'Tỷ lệ Issue hoàn thành đúng hạn SLA', '%', 'ISSUE_SLA', true, 'Đo lường tỷ lệ Issue được đóng đúng hạn trong vòng 24 giờ làm việc'],
      ['METRIC-03', 'Tỷ lệ Bug được khắc phục trong SLA', '%', 'BUG_SLA', true, 'Đo lường tỷ lệ lỗi Bug được xử lý triệt để trong vòng 8 giờ làm việc'],
      ['METRIC-04', 'Số lượng Merge Request hoàn tất', 'MR', 'TOTAL_MR', false, 'Tổng số lượng Merge Request đã merge thành công vào nhánh main'],
      ['METRIC-05', 'Thời gian Lead Time', 'giờ', 'LEAD_TIME', false, 'Thời gian trung bình từ khi tạo branch đến khi release lên production']
    ];
    for (const m of metrics) {
      await run('INSERT INTO Metrics (id, name, unit, metric_key, is_percent, description) VALUES (?, ?, ?, ?, ?, ?)', m);
    }
  }

  // 1. Employees
  const empCount = await get('SELECT count(*) as count FROM Employees');
  if (parseInt(empCount.count) === 0) {
    const employees = [
      ['EMP001', 'LEAD', 'Huyền Nguyễn Như', 'TEAM-BE', 'huyennn23406', 'nhuhuyen2221@gmail.com', 'Tech Lead', 'active'],
      ['EMP002', 'DEV-BE', 'Le An', 'TEAM-BE', 'LeThaiAn', 'anonymousisthebestoftheworld@gmail.com', 'BE', 'active'],
      ['EMP003', 'DEV-FE', 'Nguyen Anh', 'TEAM-FE', 'nguyentuananh2221', 'nguyentrantuannhoo@gmail.com', 'FE', 'active'],
      ['EMP004', 'SUBLEAD-FE', 'Alexander Nguyen', 'TEAM-FE', 'AlexanderNguyen26', 'alexanderbdfx@gmail.com', 'Sublead, FE', 'active'],
      ['EMP005', 'SUBLEAD-BE', 'Tran Than', 'TEAM-BE', 'TranLongThan', 'nhunganhmatthatthan@gmail.com', 'Sublead, BE', 'active']
    ];
    for (const e of employees) {
      await run('INSERT INTO Employees (employee_id, display_code, full_name, team_id, gitlab_user_id, email, role, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', e);
    }
  }

  // 2. Objectives (Linked to space_id)
  const objCount = await get('SELECT count(*) as count FROM Objectives');
  if (parseInt(objCount.count) === 0) {
    const spaces = await all('SELECT id FROM Spaces ORDER BY created_at ASC');
    const defaultSpaceId = spaces.length > 0 ? spaces[0].id : 'SPC-1793153879989';
    const months = [
      { num: 10, tl: 'TL-M10-2026', pre: 'M10', krPre: '', compP: 93.5, t1P: 94.2, t2P: 92.8, mult: 1.0 },
      { num: 11, tl: 'TL-M11-2026', pre: 'M11', krPre: 'M11-', compP: 88.5, t1P: 89.0, t2P: 88.0, mult: 0.95 },
      { num: 12, tl: 'TL-M12-2026', pre: 'M12', krPre: 'M12-', compP: 79.5, t1P: 80.0, t2P: 79.0, mult: 0.88 }
    ];

    for (const m of months) {
      const compId = `OBJ-${m.pre}-COMPANY`;
      const t1Id = `OBJ-${m.pre}-TEAM-01`;
      const t2Id = `OBJ-${m.pre}-TEAM-02`;

      await run(`INSERT INTO Objectives (objective_id, parent_id, level, title, description, timeline_id, progress, assignee_id, metric_id, category, start_value, expected_value, space_id)
        VALUES (?, NULL, 'COMPANY', 'Nâng cao hiệu quả và chất lượng phát triển sản phẩm công nghệ', ?, ?, ?, 'Ban Giám Đốc', 'METRIC-01', 'Objective', 0, 100, ?)`,
        [compId, `Mục tiêu chiến lược Tháng ${m.num}/2026`, m.tl, m.compP, defaultSpaceId]);

      await run(`INSERT INTO Objectives (objective_id, parent_id, level, title, description, timeline_id, progress, assignee_id, metric_id, category, start_value, expected_value, space_id)
        VALUES (?, ?, 'TEAM', 'Nâng cao hiệu quả thực hiện công việc và năng lực cộng tác kỹ thuật', 'Tối ưu hóa quy trình giải quyết Issue và phản hồi Code Review', ?, ?, 'TEAM-FE', 'METRIC-01', 'Objective', 50, 100, ?)`,
        [t1Id, compId, m.tl, m.t1P, defaultSpaceId]);

      await run(`INSERT INTO Objectives (objective_id, parent_id, level, title, description, timeline_id, progress, assignee_id, metric_id, category, start_value, expected_value, space_id)
        VALUES (?, ?, 'TEAM', 'Nâng cao chất lượng mã nguồn và tốc độ khắc phục sự cố kỹ thuật', 'Tối ưu chỉ số MTTR giải quyết Bug dưới 8.0 giờ', ?, ?, 'TEAM-BE', 'METRIC-06', 'Objective', 12, 8, ?)`,
        [t2Id, compId, m.tl, m.t2P, defaultSpaceId]);

      // KR-A1
      const krA1Id = `KR-${m.krPre}A1`;
      await run(`INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id, parent_kr_id)
        VALUES (?, ?, 'METRIC-02', 'Tỷ lệ Issue hoàn thành đúng hạn ≥ 90%', 0, 90, ?, 'increase', '%', ?, 'Team dev', NULL)`,
        [krA1Id, t1Id, parseFloat((91.5 * m.mult).toFixed(1)), defaultSpaceId]);

      const a1Children = [
        [`KR-${m.krPre}A1-01`, t1Id, 'METRIC-02', 'Tỷ lệ Issue kiến trúc cốt lõi hoàn thành đúng hạn ≥ 95% - Huyền Nguyễn Như', 0, 95, parseFloat((95.0 * m.mult).toFixed(1)), 'increase', '%', defaultSpaceId, 'EMP001', krA1Id],
        [`KR-${m.krPre}A1-02`, t1Id, 'METRIC-02', 'Tỷ lệ Issue Frontend hoàn thành đúng hạn ≥ 90% - Alexander Nguyen', 0, 90, parseFloat((92.0 * m.mult).toFixed(1)), 'increase', '%', defaultSpaceId, 'EMP004', krA1Id],
        [`KR-${m.krPre}A1-03`, t1Id, 'METRIC-02', 'Tỷ lệ Issue Backend hoàn thành đúng hạn ≥ 90% - Tran Than', 0, 90, parseFloat((91.0 * m.mult).toFixed(1)), 'increase', '%', defaultSpaceId, 'EMP005', krA1Id],
        [`KR-${m.krPre}A1-04`, t1Id, 'METRIC-02', 'Tỷ lệ Issue UI Component hoàn thành đúng hạn ≥ 90% - Nguyen Anh', 0, 90, parseFloat((93.5 * m.mult).toFixed(1)), 'increase', '%', defaultSpaceId, 'EMP003', krA1Id],
        [`KR-${m.krPre}A1-05`, t1Id, 'METRIC-02', 'Tỷ lệ Issue RESTful API hoàn thành đúng hạn ≥ 90% - Le An', 0, 90, parseFloat((90.5 * m.mult).toFixed(1)), 'increase', '%', defaultSpaceId, 'EMP002', krA1Id]
      ];
      for (const row of a1Children) {
        await run(`INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id, parent_kr_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, row);
      }

      // KR-B1
      const krB1Id = `KR-${m.krPre}B1`;
      await run(`INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id, parent_kr_id)
        VALUES (?, ?, 'METRIC-01', 'Tỷ lệ lượt phân công rà soát Merge Request được phản hồi trong 4 giờ làm việc ≥ 90%', 0, 90, ?, 'increase', '%', ?, 'Team dev', NULL)`,
        [krB1Id, t1Id, parseFloat((94.2 * m.mult).toFixed(1)), defaultSpaceId]);

      const b1Children = [
        [`KR-${m.krPre}B1-01`, t1Id, 'METRIC-01', 'Tỷ lệ rà soát Merge Request tầng Core phản hồi trong 4 giờ làm việc = 100% - Huyền Nguyễn Như', 0, 100, parseFloat((100.0 * m.mult).toFixed(1)), 'increase', '%', defaultSpaceId, 'EMP001', krB1Id],
        [`KR-${m.krPre}B1-02`, t1Id, 'METRIC-01', 'Tỷ lệ rà soát chéo Merge Request Frontend phản hồi trong 4 giờ làm việc ≥ 90% - Alexander Nguyen', 0, 90, parseFloat((93.0 * m.mult).toFixed(1)), 'increase', '%', defaultSpaceId, 'EMP004', krB1Id],
        [`KR-${m.krPre}B1-03`, t1Id, 'METRIC-01', 'Tỷ lệ rà soát chéo Merge Request Backend phản hồi trong 4 giờ làm việc ≥ 90% - Tran Than', 0, 90, parseFloat((94.0 * m.mult).toFixed(1)), 'increase', '%', defaultSpaceId, 'EMP005', krB1Id],
        [`KR-${m.krPre}B1-04`, t1Id, 'METRIC-01', 'Tỷ lệ rà soát Merge Request Frontend phản hồi trong 4 giờ làm việc ≥ 90% - Nguyen Anh', 0, 90, parseFloat((92.0 * m.mult).toFixed(1)), 'increase', '%', defaultSpaceId, 'EMP003', krB1Id],
        [`KR-${m.krPre}B1-05`, t1Id, 'METRIC-01', 'Tỷ lệ rà soát Merge Request Backend phản hồi trong 4 giờ làm việc ≥ 90% - Le An', 0, 90, parseFloat((95.0 * m.mult).toFixed(1)), 'increase', '%', defaultSpaceId, 'EMP002', krB1Id]
      ];
      for (const row of b1Children) {
        await run(`INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id, parent_kr_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, row);
      }

      // KR-C1
      const krC1Id = `KR-${m.krPre}C1`;
      await run(`INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id, parent_kr_id)
        VALUES (?, ?, 'METRIC-06', 'Thời gian trung bình giải quyết sự cố Bug (MTTR) ≤ 8,0 giờ làm việc', 12.0, 8.0, ?, 'decrease', 'giờ', ?, 'Team dev', NULL)`,
        [krC1Id, t2Id, parseFloat((6.2 / m.mult).toFixed(1)), defaultSpaceId]);

      const c1Children = [
        [`KR-${m.krPre}C1-01`, t2Id, 'METRIC-06', 'Thời gian trung bình giải quyết sự cố nghiêm trọng (Bug P1) ≤ 4,0 giờ làm việc - Huyền Nguyễn Như', 8.0, 4.0, parseFloat((3.5 / m.mult).toFixed(1)), 'decrease', 'giờ', defaultSpaceId, 'EMP001', krC1Id],
        [`KR-${m.krPre}C1-02`, t2Id, 'METRIC-06', 'Thời gian trung bình giải quyết Bug Frontend (P2, P3) ≤ 8,0 giờ làm việc - Alexander Nguyen', 12.0, 8.0, parseFloat((6.8 / m.mult).toFixed(1)), 'decrease', 'giờ', defaultSpaceId, 'EMP004', krC1Id],
        [`KR-${m.krPre}C1-03`, t2Id, 'METRIC-06', 'Thời gian trung bình giải quyết Bug Backend (P1, P2) ≤ 8,0 giờ làm việc - Tran Than', 12.0, 8.0, parseFloat((6.5 / m.mult).toFixed(1)), 'decrease', 'giờ', defaultSpaceId, 'EMP005', krC1Id],
        [`KR-${m.krPre}C1-04`, t2Id, 'METRIC-06', 'Thời gian trung bình giải quyết Bug giao diện (P3, P4) ≤ 8,0 giờ làm việc - Nguyen Anh', 12.0, 8.0, parseFloat((7.2 / m.mult).toFixed(1)), 'decrease', 'giờ', defaultSpaceId, 'EMP003', krC1Id],
        [`KR-${m.krPre}C1-05`, t2Id, 'METRIC-06', 'Thời gian trung bình giải quyết Bug API (P2, P3) ≤ 8,0 giờ làm việc - Le An', 12.0, 8.0, parseFloat((7.0 / m.mult).toFixed(1)), 'decrease', 'giờ', defaultSpaceId, 'EMP002', krC1Id]
      ];
      for (const row of c1Children) {
        await run(`INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id, parent_kr_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, row);
      }

      // MeasurementRules
      await run(`INSERT INTO MeasurementRules (rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version, objective_id, flow_code, flow_name, flow_url, threshold_percent, overtime_handling, lunch_break_rule, weekend_holiday_rule)
        VALUES (?, ?, 'issue', '{"labels":["story","bug","improvement"]}', 'opened', 'closed', 24, 'Số Issue đóng <= Due Date / Tổng Issue * 100%', 'v1.0', ?, ?, ?, 'https://cloud.activepieces.com/flows/flow-kr-a1', 90, 'Issue ngoài giờ tính từ 08:00 hôm sau', 'Trừ 1.5h trưa', 'Đóng băng cuối tuần và lễ')`,
        [`RULE-${m.pre}-A1`, krA1Id, t1Id, `FLOW-KR-A1-${m.pre}`, `Activepieces SLA Issue Tracker Tháng ${m.num}`]);

      await run(`INSERT INTO MeasurementRules (rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version, objective_id, flow_code, flow_name, flow_url, threshold_percent, overtime_handling, lunch_break_rule, weekend_holiday_rule)
        VALUES (?, ?, 'merge_request', '{"is_draft":false}', 'reviewer_assigned', 'approved', 4, 'Số MR phản hồi <= 4h / Tổng lượt * 100%', 'v1.0', ?, ?, ?, 'https://cloud.activepieces.com/flows/flow-kr-b1', 90, 'Ngoài giờ tính từ 08:00 hôm sau', 'Trừ 1.5h trưa', 'Đóng băng cuối tuần và lễ')`,
        [`RULE-${m.pre}-B1`, krB1Id, t1Id, `FLOW-KR-B1-${m.pre}`, `Activepieces MR Review SLA Tracker Tháng ${m.num}`]);

      await run(`INSERT INTO MeasurementRules (rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version, objective_id, flow_code, flow_name, flow_url, threshold_percent, overtime_handling, lunch_break_rule, weekend_holiday_rule)
        VALUES (?, ?, 'issue', '{"label":"bug"}', 'opened', 'closed', 8, 'Thời gian giải quyết Bug (giờ làm việc) / Tổng số bug', 'v1.0', ?, ?, ?, 'https://cloud.activepieces.com/flows/flow-kr-c1', 90, 'Ngoài giờ tính ca tiếp theo', 'Trừ 1.5h trưa', 'Đóng băng cuối tuần và lễ')`,
        [`RULE-${m.pre}-C1`, krC1Id, t2Id, `FLOW-KR-C1-${m.pre}`, `Activepieces MTTR Bug Resolution Tracker Tháng ${m.num}`]);
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

  // 7. WorkingHours
  const whCount = await get('SELECT count(*) as count FROM WorkingHours');
  if (parseInt(whCount.count) === 0) {
    const defaultWeekDays = [
      { code: 'T2', name: 'Thứ 2', isWork: true },
      { code: 'T3', name: 'Thứ 3', isWork: true },
      { code: 'T4', name: 'Thứ 4', isWork: true },
      { code: 'T5', name: 'Thứ 5', isWork: true },
      { code: 'T6', name: 'Thứ 6', isWork: true },
      { code: 'T7', name: 'Thứ 7', isWork: false },
      { code: 'CN', name: 'Chủ Nhật', isWork: false }
    ];
    await run(`
      INSERT INTO WorkingHours (id, space_id, morning_start, morning_end, afternoon_start, afternoon_end, working_days, week_days_json)
      VALUES ('DEFAULT', 'SPC-1793153879989', '08:00', '12:00', '13:30', '17:30', ?, ?)
    `, [JSON.stringify(['T2', 'T3', 'T4', 'T5', 'T6']), JSON.stringify(defaultWeekDays)]);
  }

  // 8. Holidays
  const hlCount = await get('SELECT count(*) as count FROM Holidays');
  if (parseInt(hlCount.count) === 0) {
    const defaultHolidays = [
      ['HL-01', 'SPC-1793153879989', 'Tết Dương Lịch 2026', '2026-01-01', '2026-01-01', 1, true, 'Nghỉ 1 ngày theo luật'],
      ['HL-02', 'SPC-1793153879989', 'Tết Nguyên Đán Bính Ngọ 2026', '2026-02-15', '2026-02-23', 9, true, 'Nghỉ 9 ngày (từ 28 tháng Chạp đến hết mùng 6 tháng Giêng)'],
      ['HL-03', 'SPC-1793153879989', 'Giỗ Tổ Hùng Vương (10/03 Âm lịch)', '2026-04-26', '2026-04-26', 1, true, 'Nghỉ lễ Quốc gia'],
      ['HL-04', 'SPC-1793153879989', 'Ngày Chiến thắng 30/04 & Quốc tế Lao động 01/05', '2026-04-30', '2026-05-03', 4, true, 'Nghỉ nối ngày cuối tuần'],
      ['HL-05', 'SPC-1793153879989', 'Lễ Quốc Khánh 02/09', '2026-09-01', '2026-09-03', 3, true, 'Nghỉ Quốc khánh 2 ngày theo quy định']
    ];
    for (const h of defaultHolidays) {
      await run(`
        INSERT INTO Holidays (id, space_id, name, start_date, end_date, days_count, is_active, note)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `, h);
    }
  }

  // 9. FlowRuns
  const flowRunCount = await get('SELECT count(*) as count FROM FlowRuns');
  if (parseInt(flowRunCount.count) === 0) {
    const sampleFlowRuns = [
      ['RUN-20261028-090015', 'FLOW-KR-A1', 'Activepieces SLA Issue Tracker (KR-A1)', 'Schedule', '2026-10-28 09:00:15', '2026-10-28 09:00:18', 1850, 'SUCCESS', 15, 5, 'Quét 15 issues GitLab, lọc 10 issues hợp lệ (Story/Bug/Improvement) đến hạn trong kỳ. Cập nhật tỷ lệ IC_i cho 5 thành viên. Roll-up KR-A1 đạt 91.5%.', '{"status":"SUCCESS","rollup":{"target_kr":"KR-A1","new_current_value":91.5}}'],
      ['RUN-20261027-090012', 'FLOW-KR-A1', 'Activepieces SLA Issue Tracker (KR-A1)', 'Schedule', '2026-10-27 09:00:12', '2026-10-27 09:00:14', 1620, 'SUCCESS', 14, 5, 'Quét 14 issues GitLab, đối chiếu hạn Due Date. Cập nhật tỷ lệ hoàn thành đúng hạn của 5 thành viên. Roll-up KR-A1 đạt 91.2%.', '{"status":"SUCCESS","rollup":{"target_kr":"KR-A1","new_current_value":91.2}}'],
      ['RUN-20261026-090008', 'FLOW-KR-A1', 'Activepieces SLA Issue Tracker (KR-A1)', 'Schedule', '2026-10-26 09:00:08', '2026-10-26 09:00:10', 1740, 'SUCCESS', 12, 5, 'Quét 12 issues GitLab đầu tuần, cập nhật chỉ số IC_i cho 5 thành viên. Roll-up KR-A1 đạt 90.8%.', '{"status":"SUCCESS","rollup":{"target_kr":"KR-A1","new_current_value":90.8}}'],
      ['RUN-20261028-142530', 'FLOW-KR-B1', 'Activepieces MR Review SLA Tracker (KR-B1)', 'Webhook', '2026-10-28 14:25:30', '2026-10-28 14:25:31', 1240, 'SUCCESS', 1, 1, 'Xử lý sự kiện reviewer_assigned cho MR !42 ("refactor: core security interceptor"). Thời gian phản hồi 2.5h làm việc (Đạt SLA 4h). Roll-up KR-B1 đạt 94.2%.', '{"status":"SUCCESS","rollup":{"target_kr":"KR-B1","new_current_value":94.2}}'],
      ['RUN-20261028-111005', 'FLOW-KR-B1', 'Activepieces MR Review SLA Tracker (KR-B1)', 'Webhook', '2026-10-28 11:10:05', '2026-10-28 11:10:06', 1100, 'SUCCESS', 1, 1, 'Xử lý sự kiện approved cho MR !41 ("feat: dynamic timeline tree widget"). Thời gian review 1.8h làm việc (Đạt SLA 4h). Roll-up KR-B1 đạt 94.0%.', '{"status":"SUCCESS","rollup":{"target_kr":"KR-B1","new_current_value":94.0}}'],
      ['RUN-20261027-154020', 'FLOW-KR-B1', 'Activepieces MR Review SLA Tracker (KR-B1)', 'Webhook', '2026-10-27 15:40:20', '2026-10-27 15:40:21', 1380, 'SUCCESS', 1, 1, 'Xử lý MR !40 ("fix: postgres timezone calculation"). Thời gian review 3.1h làm việc (Đạt SLA 4h). Roll-up KR-B1 đạt 93.8%.', '{"status":"SUCCESS","rollup":{"target_kr":"KR-B1","new_current_value":93.8}}'],
      ['RUN-20261028-164510', 'FLOW-KR-C1', 'Activepieces MTTR Bug Resolution Tracker (KR-C1)', 'Webhook', '2026-10-28 16:45:10', '2026-10-28 16:45:12', 1420, 'SUCCESS', 1, 1, 'Khắc phục sự cố Bug P2 #88 ("Null pointer exception on empty assignee"). Thời gian xử lý 6.5h làm việc (Đạt SLA 8.0h). Cập nhật MTTR KR-C1 đạt 6.2 giờ.', '{"status":"SUCCESS","rollup":{"target_kr":"KR-C1","new_current_value":6.2}}'],
      ['RUN-20261027-101530', 'FLOW-KR-C1', 'Activepieces MTTR Bug Resolution Tracker (KR-C1)', 'Webhook', '2026-10-27 10:15:30', '2026-10-27 10:15:31', 1290, 'SUCCESS', 1, 1, 'Khắc phục sự cố nghiêm trọng Bug P1 #87 ("Database connection pool timeout"). Thời gian xử lý 3.5h làm việc (Đạt SLA 4.0h). Cập nhật MTTR KR-C1 đạt 6.3 giờ.', '{"status":"SUCCESS","rollup":{"target_kr":"KR-C1","new_current_value":6.3}}']
    ];
    for (const r of sampleFlowRuns) {
      await run(`
        INSERT INTO FlowRuns (run_id, flow_code, flow_name, trigger_type, start_time, end_time, duration_ms, status, input_count, output_count, data_created, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, r);
    }
  }

  // 10. AuditLogs & Comments (Chỉ lưu vết thực tế khi có thao tác phát sinh từ người dùng hoặc Activepieces Flow)



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
