require('dotenv').config();
const { run, get, all, db } = require('./database');

async function fixKrsAndMigrate() {
  try {
    console.log("Connecting to database and running migrations...");

    // 1. Add KRs for OBJ-TEAM-02 and OBJ-TEAM-03 if missing
    const krFe = await get("SELECT * FROM KeyResults WHERE kr_id = 'KR-FE-PERF'");
    if (!krFe) {
      await run(`
        INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id)
        VALUES ('KR-FE-PERF', 'OBJ-TEAM-02', 'METRIC-01', 'Tỷ lệ tải trang và độ trễ UI/UX đạt chuẩn dưới 200ms', 50, 90, 80.0, 'increase', '%', 'SPC-1793153879989')
      `);
      console.log("Added KR-FE-PERF for OBJ-TEAM-02.");
    }

    const krQa = await get("SELECT * FROM KeyResults WHERE kr_id = 'KR-QA-AUTO'");
    if (!krQa) {
      await run(`
        INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id)
        VALUES ('KR-QA-AUTO', 'OBJ-TEAM-03', 'METRIC-03', 'Tỷ lệ kiểm thử tự động hóa và độ bao phủ pipeline CI/CD đạt trên 85%', 60, 95, 83.3, 'increase', '%', 'SPC-1793153879989')
      `);
      console.log("Added KR-QA-AUTO for OBJ-TEAM-03.");
    }

    // 2. Drop restrictive foreign key constraint if exists
    try {
      await run("ALTER TABLE MeasurementRules DROP CONSTRAINT IF EXISTS measurementrules_kr_id_fkey");
      console.log("Relaxed foreign key constraint on MeasurementRules.");
    } catch (e) {
      console.log("No fkey constraint to drop or error dropping:", e.message);
    }

    // 3. Upgrade MeasurementRules schema
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
    console.log("Upgraded MeasurementRules schema.");

    // 4. Populate MeasurementRules for all Team Objectives (M8 & M9)
    const teamObjectives = [
      {
        objId: 'OBJ-TEAM-01',
        krId: 'KR-MR-SLA',
        title: 'Nâng cao chất lượng và tốc độ Code Review của Nhóm Backend',
        sla: 4,
        formula: 'Số MR approved <= 4h làm việc / Tổng MR hợp lệ * 100%'
      },
      {
        objId: 'OBJ-TEAM-02',
        krId: 'KR-FE-PERF',
        title: 'Tối ưu hóa hiệu năng và chất lượng UI/UX của Nhóm Frontend',
        sla: 2,
        formula: 'Số tương tác UI đạt <= 200ms / Tổng lượt kiểm thử * 100%'
      },
      {
        objId: 'OBJ-TEAM-03',
        krId: 'KR-QA-AUTO',
        title: 'Nâng cao độ bao phủ kiểm thử và tự động hóa CI/CD của Nhóm QA',
        sla: 1,
        formula: 'Số test suite CI/CD đạt chuẩn / Tổng build pipeline * 100%'
      },
      {
        objId: 'OBJ-M9-TEAM-01',
        krId: 'KR-M9-MR-SLA',
        title: 'Tự động hóa CI/CD và rút ngắn thời gian xử lý Merge Request của Nhóm Backend',
        sla: 4,
        formula: 'Số MR backend approved <= 4h làm việc / Tổng MR hợp lệ * 100%'
      },
      {
        objId: 'OBJ-M9-TEAM-02',
        krId: 'KR-M9-FE-PERF',
        title: 'Tối ưu hóa Core Web Vitals và độ mượt giao diện người dùng Nhóm Frontend',
        sla: 2,
        formula: 'Số màn hình đạt chuẩn LCP/FID <= 200ms / Tổng màn hình * 100%'
      },
      {
        objId: 'OBJ-M9-TEAM-03',
        krId: 'KR-M9-QA-AUTO',
        title: 'Nâng cao độ bao phủ kiểm thử hồi quy tự động hóa của Nhóm QA',
        sla: 1,
        formula: 'Số test case hồi quy tự động pass / Tổng test case * 100%'
      }
    ];

    for (const item of teamObjectives) {
      const existing = await get("SELECT * FROM MeasurementRules WHERE objective_id = ? OR kr_id = ?", [item.objId, item.krId]);
      if (existing) {
        await run(`
          UPDATE MeasurementRules 
          SET objective_id = ?,
              kr_id = ?,
              flow_code = ?,
              flow_name = ?,
              flow_url = ?,
              threshold_percent = 90,
              overtime_handling = 'MR tạo ngoài giờ hành chính sẽ bắt đầu tính từ 08:00 sáng ngày làm việc kế tiếp',
              lunch_break_rule = 'Tự động trừ 1.5h giờ trưa (12:00 - 13:30) nếu yêu cầu review vắt qua trưa',
              weekend_holiday_rule = 'Đóng băng SLA trong toàn bộ Thứ 7, Chủ Nhật và các ngày nghỉ lễ quốc gia',
              updated_at = ?
          WHERE rule_id = ?
        `, [
          item.objId,
          item.krId,
          `FLOW-${item.objId}`,
          `GitLab SLA Webhook Flow - ${item.title}`,
          `https://cloud.activepieces.com/flows/flow-${item.objId.toLowerCase()}`,
          new Date().toISOString(),
          existing.rule_id
        ]);
        console.log(`Updated MeasurementRule for ${item.objId}`);
      } else {
        await run(`
          INSERT INTO MeasurementRules (
            rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version,
            objective_id, flow_code, flow_name, flow_url, threshold_percent,
            overtime_handling, lunch_break_rule, weekend_holiday_rule, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          `RULE-${item.objId}`,
          item.krId,
          'merge_request',
          JSON.stringify({ is_draft: false, target_branch: 'main' }),
          'reviewer_assigned',
          'approved',
          item.sla,
          item.formula,
          'v1.0',
          item.objId,
          `FLOW-${item.objId}`,
          `GitLab SLA Webhook Flow - ${item.title}`,
          `https://cloud.activepieces.com/flows/flow-${item.objId.toLowerCase()}`,
          90,
          'MR tạo ngoài giờ hành chính sẽ bắt đầu tính từ 08:00 sáng ngày làm việc kế tiếp',
          'Tự động trừ 1.5h giờ trưa (12:00 - 13:30) nếu yêu cầu review vắt qua trưa',
          'Đóng băng SLA trong toàn bộ Thứ 7, Chủ Nhật và các ngày nghỉ lễ quốc gia',
          new Date().toISOString()
        ]);
        console.log(`Created MeasurementRule for ${item.objId}`);
      }
    }

    // 5. Create WorkingHours table
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
      INSERT INTO WorkingHours (id, space_id, morning_start, morning_end, afternoon_start, afternoon_end, working_days, week_days_json, updated_at)
      VALUES ('DEFAULT', 'SPC-1793153879989', '08:00', '12:00', '13:30', '17:30', ?, ?, ?)
      ON CONFLICT (id) DO UPDATE SET
        morning_start = EXCLUDED.morning_start,
        morning_end = EXCLUDED.morning_end,
        afternoon_start = EXCLUDED.afternoon_start,
        afternoon_end = EXCLUDED.afternoon_end,
        working_days = EXCLUDED.working_days,
        week_days_json = EXCLUDED.week_days_json,
        updated_at = EXCLUDED.updated_at
    `, [
      JSON.stringify(['T2', 'T3', 'T4', 'T5', 'T6']),
      JSON.stringify(defaultWeekDays),
      new Date().toISOString()
    ]);
    console.log("Upserted default WorkingHours.");

    // 6. Create Holidays table
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

    const defaultHolidays = [
      ['HL-01', 'SPC-1793153879989', 'Tết Dương Lịch 2026', '2026-01-01', '2026-01-01', 1, true, 'Nghỉ 1 ngày theo luật'],
      ['HL-02', 'SPC-1793153879989', 'Tết Nguyên Đán Bính Ngọ 2026', '2026-02-15', '2026-02-23', 9, true, 'Nghỉ 9 ngày (từ 28 tháng Chạp đến hết mùng 6 tháng Giêng)'],
      ['HL-03', 'SPC-1793153879989', 'Giỗ Tổ Hùng Vương (10/03 Âm lịch)', '2026-04-26', '2026-04-26', 1, true, 'Nghỉ lễ Quốc gia'],
      ['HL-04', 'SPC-1793153879989', 'Ngày Chiến thắng 30/04 & Quốc tế Lao động 01/05', '2026-04-30', '2026-05-03', 4, true, 'Nghỉ nối ngày cuối tuần'],
      ['HL-05', 'SPC-1793153879989', 'Lễ Quốc Khánh 02/09', '2026-09-01', '2026-09-03', 3, true, 'Nghỉ Quốc khánh 2 ngày theo quy định']
    ];
    for (const h of defaultHolidays) {
      await run(`
        INSERT INTO Holidays (id, space_id, name, start_date, end_date, days_count, is_active, note, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          start_date = EXCLUDED.start_date,
          end_date = EXCLUDED.end_date,
          days_count = EXCLUDED.days_count,
          is_active = EXCLUDED.is_active,
          note = EXCLUDED.note,
          updated_at = EXCLUDED.updated_at
      `, [...h, new Date().toISOString()]);
    }
    console.log("Upserted 5 official Vietnam National Holidays in DB.");

    console.log("=== ALL DB MIGRATIONS FINISHED SUCCESSFULLY! ===");
  } catch (err) {
    console.error("Migration error:", err);
  } finally {
    if (db) await db.end();
  }
}

fixKrsAndMigrate();

