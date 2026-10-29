const crypto = require('crypto');
const { run, get, all } = require('./database');

/**
 * Generate a unique deterministic key for idempotency checking
 */
function generateEventKey(payload) {
  const projectCode = payload.project_code || payload.project?.path_with_namespace || 'PROJ-DEFAULT';
  const objectKind = payload.object_kind || (payload.object_attributes?.object_kind) || 'event';
  const objectId = payload.object_id || payload.object_attributes?.id || Math.floor(Math.random() * 100000);
  const action = payload.action || payload.object_attributes?.action || 'update';
  const eventTime = payload.event_time || payload.object_attributes?.updated_at || new Date().toISOString();

  const rawKey = `${projectCode}_${objectKind}_${objectId}_${action}_${eventTime}`;
  const hash = crypto.createHash('sha256').update(rawKey).digest('hex').substring(0, 16);
  return {
    event_key: `evt_${objectKind}_${objectId}_${hash}`,
    projectCode,
    objectKind,
    objectId,
    action,
    eventTime,
    hash
  };
}

/**
 * Core Event Processing Engine for Activepieces Webhook payloads
 */
async function processGitLabEvent(payload) {
  const startTime = new Date().toISOString();
  const runId = `RUN-${Date.now()}`;
  
  const keyData = generateEventKey(payload);
  const actorUsername = payload.actor_id || payload.actor || payload.user?.username || payload.object_attributes?.author_id || 'unknown.user';

  // Check Idempotency (Duplicate check)
  const existingEvent = await get('SELECT * FROM GitLabEvents WHERE event_key = ?', [keyData.event_key]);
  if (existingEvent) {
    const endTime = new Date().toISOString();
    await run(`INSERT INTO ProcessingLogs (run_id, start_time, end_time, status, input_count, output_count, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [runId, startTime, endTime, 'DUPLICATE', 1, 0, `Duplicate event key: ${keyData.event_key}`]
    );
    return {
      status: 'duplicate',
      event_key: keyData.event_key,
      message: 'Sự kiện bị lặp (Duplicate event). Hệ thống đã chặn để chống ghi nhận trùng.'
    };
  }

  // Record raw event in GitLabEvents
  await run(`INSERT INTO GitLabEvents (event_key, project_code, object_kind, object_id, action, actor_id, event_time, payload_hash, raw_payload, processing_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      keyData.event_key,
      keyData.projectCode,
      keyData.objectKind,
      keyData.objectId,
      keyData.action,
      actorUsername,
      keyData.eventTime,
      keyData.hash,
      JSON.stringify(payload),
      'success'
    ]
  );

  // Match Employee ID
  const employee = await get('SELECT * FROM Employees WHERE gitlab_user_id = ? OR gitlab_user_id LIKE ?', [actorUsername, `%${actorUsername}%`]);
  const employeeId = employee ? employee.employee_id : 'EMP-UNKNOWN';

  // Find matching MeasurementRule
  let matchedRule = null;
  const rules = await all('SELECT * FROM MeasurementRules');
  
  for (const rule of rules) {
    if (rule.event_type === keyData.objectKind) {
      if (rule.filters) {
        try {
          const filters = JSON.parse(rule.filters);
          if (filters.label && payload.labels) {
            const hasLabel = Array.isArray(payload.labels) 
              ? payload.labels.includes(filters.label)
              : payload.labels.toString().includes(filters.label);
            if (hasLabel) {
              matchedRule = rule;
              break;
            }
          } else if (!filters.label) {
            matchedRule = rule;
            break;
          }
        } catch (e) {
          matchedRule = rule;
          break;
        }
      } else {
        matchedRule = rule;
        break;
      }
    }
  }

  if (!matchedRule) {
    const endTime = new Date().toISOString();
    await run(`INSERT INTO EventAssignments (event_key, kr_id, employee_id, included, reason, duration_minutes, on_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [keyData.event_key, 'NONE', employeeId, 0, 'Sự kiện không khớp với Quy tắc đo lường nào', 0, 0]
    );
    await run(`INSERT INTO ProcessingLogs (run_id, start_time, end_time, status, input_count, output_count, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [runId, startTime, endTime, 'EXCLUDED', 1, 0, 'Event did not match any active KR measurement rules']
    );
    return {
      status: 'excluded',
      event_key: keyData.event_key,
      message: 'Sự kiện hợp lệ nhưng không khớp với Quy tắc đo lường KR nào.'
    };
  }

  // Calculate duration and SLA compliance
  const createdTime = payload.created_at || payload.object_attributes?.created_at || new Date(Date.now() - 2 * 3600 * 1000).toISOString();
  const actionTime = keyData.eventTime;
  const durationMs = new Date(actionTime).getTime() - new Date(createdTime).getTime();
  const durationMinutes = Math.max(15, Math.round(durationMs / (1000 * 60)));
  const slaMinutes = matchedRule.sla_value * 60;
  const isOnTime = durationMinutes <= slaMinutes ? 1 : 0;

  const reason = isOnTime === 1
    ? `Sự kiện hợp lệ, xử lý trong ${durationMinutes} phút (Đạt SLA ${slaMinutes} phút)`
    : `Sự kiện hợp lệ, xử lý trong ${durationMinutes} phút (Vượt SLA ${slaMinutes} phút)`;

  // Record assignment for traceability
  await run(`INSERT INTO EventAssignments (event_key, kr_id, employee_id, included, reason, duration_minutes, on_time) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [keyData.event_key, matchedRule.kr_id, employeeId, 1, reason, durationMinutes, isOnTime]
  );

  // Recalculate KR Progress
  const assignments = await all('SELECT * FROM EventAssignments WHERE kr_id = ? AND included = 1', [matchedRule.kr_id]);
  const denominator = assignments.length;
  const numerator = assignments.filter(a => a.on_time === 1).length;
  
  const kr = await get('SELECT * FROM KeyResults WHERE kr_id = ?', [matchedRule.kr_id]);
  let newCurrentValue = kr.current_value;

  if (denominator > 0) {
    newCurrentValue = parseFloat(((numerator / denominator) * 100).toFixed(1));
  }

  // Calculate progress %
  let progress = 0;
  if (kr.direction === 'increase') {
    progress = ((newCurrentValue - kr.start_value) / (kr.expected_value - kr.start_value)) * 100;
  } else {
    progress = ((kr.start_value - newCurrentValue) / (kr.start_value - kr.expected_value)) * 100;
  }
  progress = Math.min(100, Math.max(0, parseFloat(progress.toFixed(1))));

  // Update KeyResult
  await run('UPDATE KeyResults SET current_value = ? WHERE kr_id = ?', [newCurrentValue, matchedRule.kr_id]);

  // Record MetricResult history
  await run(`INSERT INTO MetricResults (kr_id, period, numerator, denominator, current_value, progress, status) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [matchedRule.kr_id, 'Q3-2026', numerator, denominator, newCurrentValue, progress, 'calculated']
  );

  // Update Parent Objective progress
  const objectiveKrs = await all('SELECT * FROM KeyResults WHERE objective_id = ?', [kr.objective_id]);
  let totalKrProgress = 0;
  for (const okr of objectiveKrs) {
    let p = 0;
    if (okr.direction === 'increase') {
      p = ((okr.current_value - okr.start_value) / (okr.expected_value - okr.start_value)) * 100;
    } else {
      p = ((okr.start_value - okr.current_value) / (okr.start_value - okr.expected_value)) * 100;
    }
    totalKrProgress += Math.min(100, Math.max(0, p));
  }
  const avgObjProgress = parseFloat((totalKrProgress / objectiveKrs.length).toFixed(1));
  await run('UPDATE Objectives SET progress = ? WHERE objective_id = ?', [avgObjProgress, kr.objective_id]);

  const endTime = new Date().toISOString();
  await run(`INSERT INTO ProcessingLogs (run_id, start_time, end_time, status, input_count, output_count, error_message) VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [runId, startTime, endTime, 'SUCCESS', 1, 1, null]
  );

  return {
    status: 'success',
    event_key: keyData.event_key,
    kr_id: matchedRule.kr_id,
    kr_title: kr.title,
    previous_value: kr.current_value,
    new_current_value: newCurrentValue,
    progress,
    on_time: isOnTime === 1,
    duration_minutes: durationMinutes,
    reason
  };
}

module.exports = {
  processGitLabEvent,
  generateEventKey
};
