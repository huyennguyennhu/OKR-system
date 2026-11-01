const { db: pool } = require('./database');

async function syncData() {
  console.log('Starting data synchronization...');

  await pool.query('ALTER TABLE Objectives ALTER COLUMN metric_id TYPE TEXT USING metric_id::TEXT;');
  console.log('Altered Objectives.metric_id to TEXT.');

  // 1. Seed Metrics if missing or update
  await pool.query(`
    INSERT INTO Metrics (id, name, unit, metric_key, is_percent, description)
    VALUES 
      ('METRIC-01', 'Tỷ lệ Merge Request đạt chuẩn SLA', '%', 'MR_SLA', true, 'Đo lường tỷ lệ Merge Request được phê duyệt trong thời hạn SLA cam kết'),
      ('METRIC-02', 'Tỷ lệ Issue hoàn thành đúng hạn SLA', '%', 'ISSUE_SLA', true, 'Đo lường tỷ lệ Issue được đóng đúng hạn trong vòng 24 giờ làm việc'),
      ('METRIC-03', 'Tỷ lệ Bug được khắc phục trong SLA', '%', 'BUG_SLA', true, 'Đo lường tỷ lệ lỗi Bug được xử lý triệt để trong vòng 8 giờ làm việc'),
      ('METRIC-04', 'Số lượng Merge Request hoàn tất', 'MR', 'TOTAL_MR', false, 'Tổng số lượng Merge Request đã merge thành công vào nhánh main'),
      ('METRIC-05', 'Thời gian Lead Time', 'giờ', 'LEAD_TIME', false, 'Thời gian trung bình từ khi tạo branch đến khi release lên production')
    ON CONFLICT (id) DO UPDATE SET 
      name = EXCLUDED.name,
      unit = EXCLUDED.unit,
      metric_key = EXCLUDED.metric_key,
      is_percent = EXCLUDED.is_percent,
      description = EXCLUDED.description;
  `);
  console.log('Metrics synced.');

  const spaceId = 'SPC-1793153879989';

  // 2. Insert or update Objectives with rich data
  await pool.query(`
    INSERT INTO Objectives (objective_id, parent_id, level, title, description, timeline_id, progress, assignee_id, metric_id, category, start_value, expected_value, space_id)
    VALUES 
      ('OBJ-COMPANY-01', NULL, 'COMPANY', 'Tối ưu hóa quy trình phát triển sản phẩm phần mềm Q3/2026', 'Nâng cao chất lượng toàn diện của sản phẩm, giảm thiểu lỗi Bug phát sinh và rút ngắn thời gian xử lý quy trình CI/CD trên hệ thống GitLab.', 'TL-Q3-2026', 76.1, 'EMP001', 'METRIC-01', 'Objective', '0', '100', $1)
    ON CONFLICT (objective_id) DO UPDATE SET 
      parent_id = EXCLUDED.parent_id,
      level = EXCLUDED.level,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      timeline_id = EXCLUDED.timeline_id,
      progress = EXCLUDED.progress,
      assignee_id = EXCLUDED.assignee_id,
      metric_id = EXCLUDED.metric_id,
      category = EXCLUDED.category,
      start_value = EXCLUDED.start_value,
      expected_value = EXCLUDED.expected_value,
      space_id = EXCLUDED.space_id;
  `, [spaceId]);

  await pool.query(`
    INSERT INTO Objectives (objective_id, parent_id, level, title, description, timeline_id, progress, assignee_id, metric_id, category, start_value, expected_value, space_id)
    VALUES 
      ('OBJ-TEAM-01', 'OBJ-COMPANY-01', 'TEAM', 'Nâng cao chất lượng và tốc độ Code Review của Nhóm Backend', 'Tối ưu hóa quy trình review mã nguồn trên GitLab, đảm bảo mọi Merge Request được phê duyệt và giải quyết trong SLA cam kết.', 'TL-Q3-2026', 75.0, 'EMP002', 'METRIC-01', 'Objective', '60', '90', $1)
    ON CONFLICT (objective_id) DO UPDATE SET 
      parent_id = EXCLUDED.parent_id,
      level = EXCLUDED.level,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      timeline_id = EXCLUDED.timeline_id,
      progress = EXCLUDED.progress,
      assignee_id = EXCLUDED.assignee_id,
      metric_id = EXCLUDED.metric_id,
      category = EXCLUDED.category,
      start_value = EXCLUDED.start_value,
      expected_value = EXCLUDED.expected_value,
      space_id = EXCLUDED.space_id;
  `, [spaceId]);

  await pool.query(`
    INSERT INTO Objectives (objective_id, parent_id, level, title, description, timeline_id, progress, assignee_id, metric_id, category, start_value, expected_value, space_id)
    VALUES 
      ('OBJ-IND-01', 'OBJ-TEAM-01', 'PERSONAL', 'Xử lý Bug và Merge Request đúng hạn cam kết SLA', 'Đảm bảo tỷ lệ giải quyết các Issue tính năng và khắc phục lỗi Bug hoàn thành đúng hạn cam kết SLA 24h trên hệ thống GitLab.', 'TL-Q3-2026', 78.3, 'EMP003', 'METRIC-02', 'Objective', '50', '85', $1)
    ON CONFLICT (objective_id) DO UPDATE SET 
      parent_id = EXCLUDED.parent_id,
      level = EXCLUDED.level,
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      timeline_id = EXCLUDED.timeline_id,
      progress = EXCLUDED.progress,
      assignee_id = EXCLUDED.assignee_id,
      metric_id = EXCLUDED.metric_id,
      category = EXCLUDED.category,
      start_value = EXCLUDED.start_value,
      expected_value = EXCLUDED.expected_value,
      space_id = EXCLUDED.space_id;
  `, [spaceId]);
  console.log('Objectives synced.');

  // 3. KeyResults
  await pool.query(`
    INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id)
    VALUES 
      ('KR-COMPANY-01', 'OBJ-COMPANY-01', 'METRIC-01', 'Đạt 100% mục tiêu quy trình phát triển và kiểm định toàn diện', 50, 100, 76.1, 'increase', '%', $1),
      ('KR-MR-SLA', 'OBJ-TEAM-01', 'METRIC-01', 'Tỷ lệ Merge Request được phê duyệt đúng thời hạn SLA (4 giờ làm việc)', 60, 90, 75, 'increase', '%', $1),
      ('KR-ISSUE-SLA', 'OBJ-IND-01', 'METRIC-02', 'Tỷ lệ Issue tính năng hoàn thành đúng hạn SLA (24 giờ làm việc)', 50, 85, 70, 'increase', '%', $1),
      ('KR-BUG-SLA', 'OBJ-IND-01', 'METRIC-03', 'Tỷ lệ Lỗi (Bug) được khắc phục trong SLA 8 giờ làm việc', 70, 95, 86.6, 'increase', '%', $1)
    ON CONFLICT (kr_id) DO UPDATE SET 
      objective_id = EXCLUDED.objective_id,
      metric_id = EXCLUDED.metric_id,
      title = EXCLUDED.title,
      start_value = EXCLUDED.start_value,
      expected_value = EXCLUDED.expected_value,
      current_value = EXCLUDED.current_value,
      direction = EXCLUDED.direction,
      unit = EXCLUDED.unit,
      space_id = EXCLUDED.space_id;
  `, [spaceId]);
  console.log('KeyResults synced.');

  // 4. MeasurementRules with valid UTF-8
  await pool.query(`
    INSERT INTO MeasurementRules (rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version)
    VALUES 
      ('RULE-MR-01', 'KR-MR-SLA', 'merge_request', '{"is_draft": false}', 'reviewer_assigned', 'approved', 4, 'Số MR approved <= 4h làm việc / Tổng MR hợp lệ * 100%', 'v1.0'),
      ('RULE-ISSUE-01', 'KR-ISSUE-SLA', 'issue', '{"issue_type": "feature"}', 'opened', 'closed', 24, 'Số Issue đóng <= 24h làm việc / Tổng Issue hoàn thành * 100%', 'v1.0'),
      ('RULE-BUG-01', 'KR-BUG-SLA', 'issue', '{"label": "bug"}', 'opened', 'closed', 8, 'Số Bug đóng <= 8h làm việc / Tổng Bug phát sinh * 100%', 'v1.0')
    ON CONFLICT (rule_id) DO UPDATE SET 
      formula = EXCLUDED.formula,
      sla_value = EXCLUDED.sla_value,
      event_type = EXCLUDED.event_type,
      filters = EXCLUDED.filters,
      start_event = EXCLUDED.start_event,
      end_event = EXCLUDED.end_event;
  `);
  console.log('MeasurementRules synced.');

  console.log('Sync finished successfully.');
  process.exit(0);
}

syncData().catch(err => {
  console.error('Error syncing data:', err);
  process.exit(1);
});
