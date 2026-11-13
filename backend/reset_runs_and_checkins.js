const { db, run, all } = require('./database');

async function resetExecutionData() {
  console.log('--- BẮT ĐẦU DỌN DẸP DỮ LIỆU LẦN CHẠY & CHECK-IN ---');

  // 1. Kiểm tra số lượng trước khi xóa
  const beforeCounts = {
    FlowRuns: (await all('SELECT count(*) as c FROM FlowRuns'))[0].c,
    MetricResults: (await all('SELECT count(*) as c FROM MetricResults'))[0].c,
    ProcessingLogs: (await all('SELECT count(*) as c FROM ProcessingLogs'))[0].c,
    Comments: (await all('SELECT count(*) as c FROM Comments'))[0].c,
    AuditLogs: (await all('SELECT count(*) as c FROM AuditLogs'))[0].c,
    EventAssignments: (await all('SELECT count(*) as c FROM EventAssignments'))[0].c,
    GitLabEvents: (await all('SELECT count(*) as c FROM GitLabEvents'))[0].c,
    KeyResults: (await all('SELECT count(*) as c FROM KeyResults'))[0].c,
    Objectives: (await all('SELECT count(*) as c FROM Objectives'))[0].c,
    MeasurementRules: (await all('SELECT count(*) as c FROM MeasurementRules'))[0].c,
    Employees: (await all('SELECT count(*) as c FROM Employees'))[0].c,
  };
  console.log('Số lượng bản ghi TRƯỚC khi dọn dẹp:', beforeCounts);

  // 2. Thực hiện xóa dữ liệu các lần chạy, check-in, nhật ký
  await run('DELETE FROM EventAssignments');
  await run('DELETE FROM GitLabEvents');
  await run('DELETE FROM MetricResults');
  await run('DELETE FROM ProcessingLogs');
  await run('DELETE FROM FlowRuns');
  await run('DELETE FROM Comments');
  await run('DELETE FROM AuditLogs');

  // 3. Reset KeyResults về trạng thái khởi điểm sạch (current_value = start_value)
  // Với các KR hoàn thành đúng hạn (increase): start_value = 0 => current_value = 0
  // Với các KR MTTR (decrease): start_value = 12 => current_value = 12
  await run('UPDATE KeyResults SET current_value = start_value');

  // 4. Reset tiến độ của Objectives về 0%
  await run('UPDATE Objectives SET progress = 0.0');

  // 5. Kiểm tra lại số lượng SAU khi dọn dẹp
  const afterCounts = {
    FlowRuns: (await all('SELECT count(*) as c FROM FlowRuns'))[0].c,
    MetricResults: (await all('SELECT count(*) as c FROM MetricResults'))[0].c,
    ProcessingLogs: (await all('SELECT count(*) as c FROM ProcessingLogs'))[0].c,
    Comments: (await all('SELECT count(*) as c FROM Comments'))[0].c,
    AuditLogs: (await all('SELECT count(*) as c FROM AuditLogs'))[0].c,
    EventAssignments: (await all('SELECT count(*) as c FROM EventAssignments'))[0].c,
    GitLabEvents: (await all('SELECT count(*) as c FROM GitLabEvents'))[0].c,
    KeyResults: (await all('SELECT count(*) as c FROM KeyResults'))[0].c,
    Objectives: (await all('SELECT count(*) as c FROM Objectives'))[0].c,
    MeasurementRules: (await all('SELECT count(*) as c FROM MeasurementRules'))[0].c,
    Employees: (await all('SELECT count(*) as c FROM Employees'))[0].c,
  };
  console.log('Số lượng bản ghi SAU khi dọn dẹp:', afterCounts);

  // 6. Kiểm tra mẫu KeyResults và Objectives
  const sampleKrs = await all('SELECT kr_id, title, start_value, expected_value, current_value, direction FROM KeyResults LIMIT 6');
  console.log('\nMẫu Key Results sau khi reset:');
  console.table(sampleKrs);

  const sampleObjs = await all('SELECT objective_id, title, level, progress FROM Objectives LIMIT 6');
  console.log('\nMẫu Objectives sau khi reset:');
  console.table(sampleObjs);

  console.log('\n--- HOÀN TẤT DỌN DẸP THÀNH CÔNG 100%! HỆ THỐNG ĐÃ SẴN SÀNG CHO LẦN CHẠY TỐI NAY ---');
  process.exit(0);
}

resetExecutionData().catch(err => {
  console.error('Lỗi khi dọn dẹp:', err);
  process.exit(1);
});

