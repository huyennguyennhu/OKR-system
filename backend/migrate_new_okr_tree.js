require('dotenv').config();
const { run, get, all } = require('./database');

async function migrate() {
  console.log('--- BẮT ĐẦU TẠO CÂY OKR MỚI CHO THÁNG 10, 11, 12 ---');
  try {
    // 1. Đảm bảo cấu trúc cột parent_kr_id
    await run('ALTER TABLE KeyResults ADD COLUMN IF NOT EXISTS parent_kr_id TEXT');
    console.log('✓ Đã đảm bảo cột parent_kr_id trong KeyResults');

    // 2. Thêm metric MTTR nếu chưa có
    const m6 = await get("SELECT * FROM Metrics WHERE id = 'METRIC-06'");
    if (!m6) {
      await run(`
        INSERT INTO Metrics (id, name, unit, metric_key, is_percent, description)
        VALUES ('METRIC-06', 'Thời gian trung bình giải quyết Bug (MTTR)', 'giờ', 'MTTR_BUG', false, 'Thời gian trung bình khắc phục lỗi Bug trong giờ làm việc')
      `);
      console.log('✓ Đã thêm METRIC-06 (MTTR)');
    }

    // 3. Xóa cây OKR cũ
    console.log('Đang xóa dữ liệu OKR cũ...');
    await run('DELETE FROM EventAssignments');
    await run('DELETE FROM MetricResults');
    await run('DELETE FROM MeasurementRules');
    await run('DELETE FROM KeyResults');
    await run('DELETE FROM Objectives');
    console.log('✓ Đã xóa sạch dữ liệu OKR cũ');

    // 4. Lấy space mặc định
    const spaces = await all('SELECT id FROM Spaces ORDER BY created_at ASC');
    const defaultSpaceId = spaces.length > 0 ? spaces[0].id : 'SPC-1793153879989';

    // 5. Cấu hình danh sách 3 tháng
    const months = [
      {
        monthNum: 10,
        tlId: 'TL-M10-2026',
        prefix: 'M10',
        krPrefix: '', // Tháng 10 dùng trực tiếp KR-A1, KR-B1, KR-C1
        progressMultiplier: 1.0,
        companyProgress: 93.5,
        team1Progress: 94.2,
        team2Progress: 92.8
      },
      {
        monthNum: 11,
        tlId: 'TL-M11-2026',
        prefix: 'M11',
        krPrefix: 'M11-',
        progressMultiplier: 0.95,
        companyProgress: 88.5,
        team1Progress: 89.0,
        team2Progress: 88.0
      },
      {
        monthNum: 12,
        tlId: 'TL-M12-2026',
        prefix: 'M12',
        krPrefix: 'M12-',
        progressMultiplier: 0.88,
        companyProgress: 79.5,
        team1Progress: 80.0,
        team2Progress: 79.0
      }
    ];

    for (const m of months) {
      console.log(`\n--- Đang tạo cây OKR cho Tháng ${m.monthNum} (${m.tlId}) ---`);

      // 1. Company Objective
      const compObjId = `OBJ-${m.prefix}-COMPANY`;
      await run(`
        INSERT INTO Objectives (objective_id, parent_id, level, title, description, timeline_id, progress, assignee_id, metric_id, category, start_value, expected_value, space_id)
        VALUES (?, NULL, 'COMPANY', ?, ?, ?, ?, 'Toàn công ty', 'METRIC-01', 'Objective', 0, 100, ?)
      `, [
        compObjId,
        'Nâng cao hiệu quả và chất lượng phát triển sản phẩm công nghệ',
        `Mục tiêu chiến lược cấp công ty nhằm nâng cao toàn diện hiệu quả thực hiện công việc, năng lực cộng tác kỹ thuật và chất lượng mã nguồn trong Tháng ${m.monthNum}/2026.`,
        m.tlId,
        m.companyProgress,
        defaultSpaceId
      ]);

      // 2. Team Objective 1
      const teamObj1Id = `OBJ-${m.prefix}-TEAM-01`;
      await run(`
        INSERT INTO Objectives (objective_id, parent_id, level, title, description, timeline_id, progress, assignee_id, metric_id, category, start_value, expected_value, space_id)
        VALUES (?, ?, 'TEAM', ?, ?, ?, ?, 'TEAM-FE', 'METRIC-01', 'Objective', 50, 100, ?)
      `, [
        teamObj1Id,
        compObjId,
        'Nâng cao hiệu quả thực hiện công việc và năng lực cộng tác kỹ thuật',
        'Tối ưu hóa quy trình giải quyết Issue đúng cam kết tiến độ và rút ngắn thời gian phản hồi rà soát Merge Request trong giờ làm việc.',
        m.tlId,
        m.team1Progress,
        defaultSpaceId
      ]);

      // 3. Team Objective 2
      const teamObj2Id = `OBJ-${m.prefix}-TEAM-02`;
      await run(`
        INSERT INTO Objectives (objective_id, parent_id, level, title, description, timeline_id, progress, assignee_id, metric_id, category, start_value, expected_value, space_id)
        VALUES (?, ?, 'TEAM', ?, ?, ?, ?, 'TEAM-BE', 'METRIC-06', 'Objective', 12, 8, ?)
      `, [
        teamObj2Id,
        compObjId,
        'Nâng cao chất lượng mã nguồn và tốc độ khắc phục sự cố kỹ thuật',
        'Chuẩn hóa quy trình kiểm soát lỗi, rút ngắn thời gian trung bình giải quyết sự cố kỹ thuật (MTTR) đạt dưới 8.0 giờ làm việc.',
        m.tlId,
        m.team2Progress,
        defaultSpaceId
      ]);

      // ------------------------------------------------------------------
      // KR-A1: Tỷ lệ Issue hoàn thành đúng hạn ≥ 90%
      // ------------------------------------------------------------------
      const krA1Id = `KR-${m.krPrefix}A1`;
      const krA1Current = parseFloat((91.5 * m.progressMultiplier).toFixed(1));
      await run(`
        INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id, parent_kr_id)
        VALUES (?, ?, 'METRIC-02', 'Tỷ lệ Issue hoàn thành đúng hạn ≥ 90%', 0, 90, ?, 'increase', '%', ?, 'Team dev', NULL)
      `, [krA1Id, teamObj1Id, krA1Current, defaultSpaceId]);

      // 5 KRs con của KR-A1
      const krA1Children = [
        {
          id: `KR-${m.krPrefix}A1-01`,
          title: 'Tỷ lệ Issue hoàn thành đúng hạn ≥ 90% - Huyền Nguyễn Như',
          assignee: 'EMP001',
          start: 0,
          expected: 90,
          current: parseFloat((95.0 * m.progressMultiplier).toFixed(1)),
          unit: '%'
        },
        {
          id: `KR-${m.krPrefix}A1-02`,
          title: 'Tỷ lệ Issue hoàn thành đúng hạn ≥ 90% - Alexander Nguyen',
          assignee: 'EMP004',
          start: 0,
          expected: 90,
          current: parseFloat((92.0 * m.progressMultiplier).toFixed(1)),
          unit: '%'
        },
        {
          id: `KR-${m.krPrefix}A1-03`,
          title: 'Tỷ lệ Issue hoàn thành đúng hạn ≥ 90% - Tran Than',
          assignee: 'EMP005',
          start: 0,
          expected: 90,
          current: parseFloat((91.0 * m.progressMultiplier).toFixed(1)),
          unit: '%'
        },
        {
          id: `KR-${m.krPrefix}A1-04`,
          title: 'Tỷ lệ Issue hoàn thành đúng hạn ≥ 90% - Nguyen Anh',
          assignee: 'EMP003',
          start: 0,
          expected: 90,
          current: parseFloat((93.5 * m.progressMultiplier).toFixed(1)),
          unit: '%'
        },
        {
          id: `KR-${m.krPrefix}A1-05`,
          title: 'Tỷ lệ Issue hoàn thành đúng hạn ≥ 90% - Le An',
          assignee: 'EMP002',
          start: 0,
          expected: 90,
          current: parseFloat((90.5 * m.progressMultiplier).toFixed(1)),
          unit: '%'
        }
      ];

      for (const c of krA1Children) {
        await run(`
          INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id, parent_kr_id)
          VALUES (?, ?, 'METRIC-02', ?, ?, ?, ?, 'increase', ?, ?, ?, ?)
        `, [c.id, teamObj1Id, c.title, c.start, c.expected, c.current, c.unit, defaultSpaceId, c.assignee, krA1Id]);
      }

      // ------------------------------------------------------------------
      // KR-B1: Tỷ lệ lượt phân công rà soát Merge Request được phản hồi trong 4 giờ làm việc ≥ 90%
      // ------------------------------------------------------------------
      const krB1Id = `KR-${m.krPrefix}B1`;
      const krB1Current = parseFloat((94.2 * m.progressMultiplier).toFixed(1));
      await run(`
        INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id, parent_kr_id)
        VALUES (?, ?, 'METRIC-01', 'Tỷ lệ lượt phân công rà soát Merge Request được phản hồi trong 4 giờ làm việc ≥ 90%', 0, 90, ?, 'increase', '%', ?, 'Team dev', NULL)
      `, [krB1Id, teamObj1Id, krB1Current, defaultSpaceId]);

      // 5 KRs con của KR-B1
      const krB1Children = [
        {
          id: `KR-${m.krPrefix}B1-01`,
          title: 'Tỷ lệ lượt phân công rà soát Merge Request được phản hồi trong 4 giờ làm việc ≥ 90% - Huyền Nguyễn Như',
          assignee: 'EMP001',
          start: 0,
          expected: 90,
          current: parseFloat((100.0 * m.progressMultiplier).toFixed(1)),
          unit: '%'
        },
        {
          id: `KR-${m.krPrefix}B1-02`,
          title: 'Tỷ lệ lượt phân công rà soát Merge Request được phản hồi trong 4 giờ làm việc ≥ 90% - Alexander Nguyen',
          assignee: 'EMP004',
          start: 0,
          expected: 90,
          current: parseFloat((93.0 * m.progressMultiplier).toFixed(1)),
          unit: '%'
        },
        {
          id: `KR-${m.krPrefix}B1-03`,
          title: 'Tỷ lệ lượt phân công rà soát Merge Request được phản hồi trong 4 giờ làm việc ≥ 90% - Tran Than',
          assignee: 'EMP005',
          start: 0,
          expected: 90,
          current: parseFloat((94.0 * m.progressMultiplier).toFixed(1)),
          unit: '%'
        },
        {
          id: `KR-${m.krPrefix}B1-04`,
          title: 'Tỷ lệ lượt phân công rà soát Merge Request được phản hồi trong 4 giờ làm việc ≥ 90% - Nguyen Anh',
          assignee: 'EMP003',
          start: 0,
          expected: 90,
          current: parseFloat((92.0 * m.progressMultiplier).toFixed(1)),
          unit: '%'
        },
        {
          id: `KR-${m.krPrefix}B1-05`,
          title: 'Tỷ lệ lượt phân công rà soát Merge Request được phản hồi trong 4 giờ làm việc ≥ 90% - Le An',
          assignee: 'EMP002',
          start: 0,
          expected: 90,
          current: parseFloat((95.0 * m.progressMultiplier).toFixed(1)),
          unit: '%'
        }
      ];

      for (const c of krB1Children) {
        await run(`
          INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id, parent_kr_id)
          VALUES (?, ?, 'METRIC-01', ?, ?, ?, ?, 'increase', ?, ?, ?, ?)
        `, [c.id, teamObj1Id, c.title, c.start, c.expected, c.current, c.unit, defaultSpaceId, c.assignee, krB1Id]);
      }

      // ------------------------------------------------------------------
      // KR-C1: Thời gian trung bình giải quyết sự cố Bug (MTTR) ≤ 8,0 giờ làm việc
      // ------------------------------------------------------------------
      const krC1Id = `KR-${m.krPrefix}C1`;
      const krC1Current = parseFloat((6.2 / m.progressMultiplier).toFixed(1)); // Giờ thấp hơn là tốt hơn
      await run(`
        INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id, parent_kr_id)
        VALUES (?, ?, 'METRIC-06', 'Thời gian trung bình giải quyết sự cố Bug (MTTR) ≤ 8,0 giờ làm việc', 12.0, 8.0, ?, 'decrease', 'giờ', ?, 'Team dev', NULL)
      `, [krC1Id, teamObj2Id, krC1Current, defaultSpaceId]);

      // 5 KRs con của KR-C1
      const krC1Children = [
        {
          id: `KR-${m.krPrefix}C1-01`,
          title: 'Thời gian trung bình giải quyết sự cố Bug (MTTR) ≤ 8,0 giờ làm việc - Huyền Nguyễn Như',
          assignee: 'EMP001',
          start: 12.0,
          expected: 8.0,
          current: parseFloat((3.5 / m.progressMultiplier).toFixed(1)),
          unit: 'giờ',
          direction: 'decrease'
        },
        {
          id: `KR-${m.krPrefix}C1-02`,
          title: 'Thời gian trung bình giải quyết sự cố Bug (MTTR) ≤ 8,0 giờ làm việc - Alexander Nguyen',
          assignee: 'EMP004',
          start: 12.0,
          expected: 8.0,
          current: parseFloat((6.8 / m.progressMultiplier).toFixed(1)),
          unit: 'giờ',
          direction: 'decrease'
        },
        {
          id: `KR-${m.krPrefix}C1-03`,
          title: 'Thời gian trung bình giải quyết sự cố Bug (MTTR) ≤ 8,0 giờ làm việc - Tran Than',
          assignee: 'EMP005',
          start: 12.0,
          expected: 8.0,
          current: parseFloat((6.5 / m.progressMultiplier).toFixed(1)),
          unit: 'giờ',
          direction: 'decrease'
        },
        {
          id: `KR-${m.krPrefix}C1-04`,
          title: 'Thời gian trung bình giải quyết sự cố Bug (MTTR) ≤ 8,0 giờ làm việc - Nguyen Anh',
          assignee: 'EMP003',
          start: 12.0,
          expected: 8.0,
          current: parseFloat((7.2 / m.progressMultiplier).toFixed(1)),
          unit: 'giờ',
          direction: 'decrease'
        },
        {
          id: `KR-${m.krPrefix}C1-05`,
          title: 'Thời gian trung bình giải quyết sự cố Bug (MTTR) ≤ 8,0 giờ làm việc - Le An',
          assignee: 'EMP002',
          start: 12.0,
          expected: 8.0,
          current: parseFloat((7.0 / m.progressMultiplier).toFixed(1)),
          unit: 'giờ',
          direction: 'decrease'
        }
      ];

      for (const c of krC1Children) {
        await run(`
          INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id, parent_kr_id)
          VALUES (?, ?, 'METRIC-06', ?, ?, ?, ?, 'decrease', ?, ?, ?, ?)
        `, [c.id, teamObj2Id, c.title, c.start, c.expected, c.current, c.unit, defaultSpaceId, c.assignee, krC1Id]);
      }

      // ------------------------------------------------------------------
      // MeasurementRules cho 3 KR chính
      // ------------------------------------------------------------------
      const flow1Filters = JSON.stringify({
        scheduleTime: '21:00 (Thứ 2 – Thứ 6)',
        startEvent: 'issue_assigned',
        endEvent: 'status_resolved',
        dueDateTime: '23:59:59 (GMT+7)',
        resolvedStatuses: ['RESOLVED', 'DEV_COMPLETED', 'READY IN STAGING', 'PASS IN STAGING'],
        reopenedStatuses: ['REOPENED'],
        excludedStatuses: ['CANCELLED', 'WONTFIX', 'CANNOT REPRODUCE', 'DUPLICATE'],
        validIssueTypes: ['Story', 'Bug', 'Improvement'],
        calculationMode: 'STORY_POINT',
        fallbackStoryPoint: 1,
        thresholdPercent: 90,
        noDataHandling: true,
        friendlyFormula: '\\frac(sum(S_k * W(k)), sum(W(k))) * 100%',
        latexFormula: '\\frac{\\sum_{k \\in I_u} S_k \\cdot W(k)}{\\sum_{k \\in I_u} W(k)} \\times 100\\%'
      });

      await run(`
        INSERT INTO MeasurementRules (rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version, objective_id, flow_code, flow_name, flow_url, threshold_percent, overtime_handling, lunch_break_rule, weekend_holiday_rule)
        VALUES (?, ?, 'issue', ?, 'issue_assigned', 'status_resolved', 24, '\\frac{\\sum_{k \\in I_u} S_k \\cdot W(k)}{\\sum_{k \\in I_u} W(k)} \\times 100\\%', 'v1.0', ?, ?, ?, 'https://cloud.activepieces.com/flows/flow-kr-a1', 90, 'Issue tạo ngoài giờ sẽ tính từ 08:00 sáng ngày làm việc kế tiếp', 'Tự động trừ 1.5h nghỉ trưa (12:00 - 13:30)', 'Đóng băng SLA toàn bộ T7, CN và ngày nghỉ lễ')
      `, [
        `RULE-${m.prefix}-A1`,
        krA1Id,
        flow1Filters,
        teamObj1Id,
        `FLOW-KR-A1-${m.prefix}`,
        `Activepieces SLA Issue Tracker Tháng ${m.monthNum} - KR-A1`
      ]);

      await run(`
        INSERT INTO MeasurementRules (rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version, objective_id, flow_code, flow_name, flow_url, threshold_percent, overtime_handling, lunch_break_rule, weekend_holiday_rule)
        VALUES (?, ?, 'merge_request', '{"is_draft":false}', 'reviewer_assigned', 'approved', 4, 'Số MR phản hồi review <= 4h làm việc / Tổng lượt phân công review * 100%', 'v1.0', ?, ?, ?, 'https://cloud.activepieces.com/flows/flow-kr-b1', 90, 'Yêu cầu rà soát ngoài giờ hành chính sẽ tính từ 08:00 sáng ngày làm việc kế tiếp', 'Tự động trừ 1.5h nghỉ trưa (12:00 - 13:30)', 'Đóng băng SLA toàn bộ T7, CN và ngày lễ')
      `, [
        `RULE-${m.prefix}-B1`,
        krB1Id,
        teamObj1Id,
        `FLOW-KR-B1-${m.prefix}`,
        `Activepieces MR Review SLA Tracker Tháng ${m.monthNum} - KR-B1`
      ]);

      await run(`
        INSERT INTO MeasurementRules (rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version, objective_id, flow_code, flow_name, flow_url, threshold_percent, overtime_handling, lunch_break_rule, weekend_holiday_rule)
        VALUES (?, ?, 'issue', '{"label":"bug"}', 'opened', 'closed', 8, 'Tổng thời gian giải quyết Bug (giờ làm việc) / Tổng số Bug phát sinh', 'v1.0', ?, ?, ?, 'https://cloud.activepieces.com/flows/flow-kr-c1', 90, 'Sự cố phát sinh ngoài giờ làm việc được ghi nhận và bắt đầu tính từ ca trực tiếp theo', 'Tự động trừ 1.5h nghỉ trưa', 'Đóng băng SLA cuối tuần và ngày lễ quốc gia')
      `, [
        `RULE-${m.prefix}-C1`,
        krC1Id,
        teamObj2Id,
        `FLOW-KR-C1-${m.prefix}`,
        `Activepieces MTTR Bug Resolution Tracker Tháng ${m.monthNum} - KR-C1`
      ]);

      console.log(`✓ Đã tạo xong Objectives, KeyResults, MeasurementRules cho Tháng ${m.monthNum}`);
    }

    console.log('\n=== HOÀN TẤT MIGRATION TOÀN DIỆN CÂY OKR ===');
  } catch (err) {
    console.error('Lỗi khi migrate cây OKR:', err);
  } finally {
    process.exit(0);
  }
}

migrate();
