const express = require('express');
const cors = require('cors');
const { initDatabase, all, get, run, seedInitialData } = require('./database');
const { processGitLabEvent } = require('./engine');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));
app.use(express.json());

// Initialize Database on startup
initDatabase().then(() => {
  console.log('Database initialized successfully.');
}).catch(err => {
  console.error('Database initialization error:', err);
});

// Root & Health Check Endpoints (For Render / Vercel Monitoring)
app.get('/', (req, res) => {
  res.json({
    status: 'ok',
    service: 'OKR GitLab Measurement Backend',
    timestamp: new Date().toISOString()
  });
});

app.get('/api/health', async (req, res) => {
  try {
    const dbTest = await get('SELECT 1 as connected');
    res.json({
      status: 'healthy',
      database: dbTest ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (err) {
    res.status(500).json({
      status: 'unhealthy',
      database_error: err.message
    });
  }
});

// API Routes

// Employees Endpoint
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await all('SELECT * FROM Employees ORDER BY created_at DESC, employee_id ASC');
    res.json(employees);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/employees', async (req, res) => {
  try {
    const { employee_id, display_code, full_name, team_id, gitlab_user_id, email, role } = req.body;
    if (!employee_id || !full_name || !team_id || !gitlab_user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    await run(
      'INSERT INTO Employees (employee_id, display_code, full_name, team_id, gitlab_user_id, email, role, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [employee_id, display_code || role || 'DEV', full_name, team_id, gitlab_user_id, email || '', role || '', 'active']
    );
    res.status(201).json({ success: true, message: 'Employee created successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// 1. Webhook Endpoint for Activepieces Integration
app.post('/api/webhooks/activepieces', async (req, res) => {
  try {
    const payload = req.body;
    console.log('Received Activepieces Webhook Payload:', JSON.stringify(payload, null, 2));

    if (!payload || Object.keys(payload).length === 0) {
      return res.status(400).json({ error: 'Payload empty or invalid JSON' });
    }

    // Direct KR update by kr_id
    if (payload.kr_id && payload.current_value !== undefined) {
      const wfPayload = {
        ...payload,
        source: payload.source || 'activepieces',
        author: (!payload.author || payload.author.toLowerCase().includes('syrix') || payload.author.toLowerCase().includes('activepieces')) ? 'bot' : payload.author
      };
      const updated = await recalculateOkrProgress(payload.kr_id, payload.current_value, wfPayload);

      // Auto-record to FlowRuns (Lưu vết lần chạy Flow)
      const flowRunId = payload.run_id || `RUN-${Date.now()}`;
      const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
      try {
        await run(`
          INSERT INTO FlowRuns (run_id, flow_code, flow_name, trigger_type, start_time, end_time, duration_ms, status, input_count, output_count, data_created, payload_json)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?, ?, ?)
          ON CONFLICT (run_id) DO NOTHING
        `, [
          flowRunId,
          payload.flow_code || `FLOW-${payload.kr_id}`,
          payload.flow_name || `Activepieces Automation Flow (${payload.kr_id})`,
          payload.trigger_type || 'Webhook',
          payload.start_time || nowIso,
          payload.end_time || nowIso,
          payload.duration_ms || 1200,
          payload.input_count || 1,
          payload.output_count || 1,
          `Đồng bộ giá trị C = ${payload.current_value} cho ${payload.kr_id}. Ghi chú: ${payload.comment || payload.note || 'None'}.`,
          JSON.stringify(payload, null, 2)
        ]);
      } catch (flowErr) {
        console.warn('FlowRuns auto-log warning:', flowErr.message);
      }

      return res.status(200).json({
        success: true,
        message: `Updated KR ${payload.kr_id} to ${payload.current_value}`,
        updated
      });
    }

    // Individual KR update from Activepieces Loop Piece
    if (payload.event_type === 'individual_kr_update' && payload.employee_id) {
      let targetKr = null;
      if (payload.kr_title) {
        targetKr = await get(
          'SELECT * FROM KeyResults WHERE assignee_id = ? AND title LIKE ? LIMIT 1',
          [payload.employee_id, `%${payload.kr_title}%`]
        );
      }
      if (!targetKr) {
        targetKr = await get(
          'SELECT * FROM KeyResults WHERE assignee_id = ? AND parent_kr_id IS NOT NULL LIMIT 1',
          [payload.employee_id]
        );
      }
      if (targetKr) {
        const updated = await recalculateOkrProgress(targetKr.kr_id, payload.current_value, {
          numerator: payload.numerator,
          denominator: payload.denominator,
          actor_id: payload.employee_id,
          comment: payload.comment || payload.note || payload.reason,
          author: (!payload.author || payload.author.toLowerCase().includes('syrix') || payload.author.toLowerCase().includes('activepieces')) ? 'bot' : payload.author
        });

        // Auto-record to FlowRuns (Lưu vết lần chạy Flow)
        const flowRunId = payload.run_id || `RUN-${Date.now()}`;
        const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);
        try {
          await run(`
            INSERT INTO FlowRuns (run_id, flow_code, flow_name, trigger_type, start_time, end_time, duration_ms, status, input_count, output_count, data_created, payload_json)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?, ?, ?)
            ON CONFLICT (run_id) DO NOTHING
          `, [
            flowRunId,
            payload.flow_code || `FLOW-${targetKr.kr_id}`,
            payload.flow_name || `Activepieces Automation Flow (${targetKr.kr_id})`,
            payload.trigger_type || 'Schedule',
            payload.start_time || nowIso,
            payload.end_time || nowIso,
            payload.duration_ms || 950,
            payload.input_count || 1,
            payload.output_count || 1,
            `Cập nhật chỉ số cá nhân IC_i = ${payload.current_value} cho nhân viên ${payload.employee_id} (${targetKr.kr_id}).`,
            JSON.stringify(payload, null, 2)
          ]);
        } catch (flowErr) {
          console.warn('FlowRuns auto-log warning:', flowErr.message);
        }

        return res.status(200).json({
          success: true,
          message: `Updated KR ${targetKr.kr_id} for employee ${payload.employee_id}`,
          updated
        });
      }
    }

    const result = await processGitLabEvent(payload);
    return res.status(200).json({
      success: true,
      timestamp: new Date().toISOString(),
      result
    });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Internal Server Error', details: error.message });
  }
});

// Helper to resolve timeline IDs and its children for hierarchical filtering
async function getTimelineFilterIds(targetTlId) {
  if (!targetTlId || targetTlId === 'all') return null;

  let effectiveId = String(targetTlId).trim();
  // Find timeline by id or title
  const found = await get('SELECT id, parent_id, level FROM Timelines WHERE id = ? OR id = ? OR title = ?', [effectiveId, `TL-${effectiveId}`, effectiveId]);
  if (found) {
    effectiveId = found.id;
  }

  const descendants = [effectiveId];
  // Check direct children
  const children = await all('SELECT id FROM Timelines WHERE parent_id = ?', [effectiveId]);
  if (children && children.length > 0) {
    const childIds = children.map(c => c.id);
    descendants.push(...childIds);
    // Check grandchildren (e.g. Year -> Quarter -> Month)
    for (const cid of childIds) {
      const grandChildren = await all('SELECT id FROM Timelines WHERE parent_id = ?', [cid]);
      if (grandChildren && grandChildren.length > 0) {
        descendants.push(...grandChildren.map(g => g.id));
      }
    }
  }

  // Also include versions without 'TL-' prefix to handle legacy/shorthand formats (e.g. 'M8-2026' vs 'TL-M8-2026')
  const finalSet = new Set();
  descendants.forEach(id => {
    finalSet.add(id);
    if (id.startsWith('TL-')) {
      finalSet.add(id.replace(/^TL-/, ''));
    } else {
      finalSet.add(`TL-${id}`);
    }
  });

  return Array.from(finalSet);
}

// 2. Objectives Endpoint (with progress calculation & space + timeline filtering)
app.get('/api/objectives', async (req, res) => {
  try {
    const { space_id, workspace_id, timeline_id } = req.query;
    const targetSpace = space_id || workspace_id;

    let objectives;
    const baseQuery = `
      SELECT o.*, 
        CASE 
          WHEN UPPER(o.level) = 'COMPANY' THEN 'Toàn công ty'
          ELSE COALESCE(tm.name, e.full_name, o.assignee_id)
        END as assignee_name, 
        e.display_code as assignee_code, 
        COALESCE(tm.name, e_team.name) as team_name 
      FROM Objectives o 
      LEFT JOIN Employees e ON o.assignee_id = e.employee_id 
      LEFT JOIN Teams e_team ON e.team_id = e_team.id
      LEFT JOIN Teams tm ON (o.assignee_id = tm.id OR o.assignee_id = tm.code)
    `;
    const whereClauses = [];
    const queryParams = [];

    if (targetSpace && targetSpace !== 'all') {
      whereClauses.push('o.space_id = ?');
      queryParams.push(targetSpace);
    }

    const tlIds = await getTimelineFilterIds(timeline_id);
    if (tlIds && tlIds.length > 0) {
      const placeholders = tlIds.map(() => '?').join(', ');
      whereClauses.push(`o.timeline_id IN (${placeholders})`);
      queryParams.push(...tlIds);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    objectives = await all(`${baseQuery} ${whereSql} ORDER BY o.objective_id ASC`, queryParams);

    // Smart Fallback: if space_id yielded 0 objectives, re-query without space constraint
    if (objectives.length === 0 && targetSpace && targetSpace !== 'all') {
      const fallbackClauses = [];
      const fallbackParams = [];
      if (tlIds && tlIds.length > 0) {
        const placeholders = tlIds.map(() => '?').join(', ');
        fallbackClauses.push(`o.timeline_id IN (${placeholders})`);
        fallbackParams.push(...tlIds);
      }
      const fallbackWhere = fallbackClauses.length > 0 ? `WHERE ${fallbackClauses.join(' AND ')}` : '';
      objectives = await all(`${baseQuery} ${fallbackWhere} ORDER BY o.objective_id ASC`, fallbackParams);
    }

    const allKeyResults = await all(`
      SELECT kr.*, 
             COALESCE(e.full_name, kr.assignee_id) as assignee_name, 
             e.display_code as assignee_code, 
             COALESCE(t.name, e_team.name) as team_name,
             COALESCE(t.id, e.team_id) as team_id,
             COALESCE(mr.flow_code, mr_p.flow_code) as flow_code,
             COALESCE(mr.sla_value, mr_p.sla_value) as sla_value,
             COALESCE(mr.threshold_percent, mr_p.threshold_percent) as threshold_percent
      FROM KeyResults kr
      LEFT JOIN Employees e ON kr.assignee_id = e.employee_id
      LEFT JOIN Teams e_team ON e.team_id = e_team.id
      LEFT JOIN Teams t ON (kr.assignee_id = t.id OR kr.assignee_id = t.code)
      LEFT JOIN MeasurementRules mr ON kr.kr_id = mr.kr_id
      LEFT JOIN MeasurementRules mr_p ON kr.parent_kr_id = mr_p.kr_id
    `);
    const objIds = new Set(objectives.map(o => o.objective_id));
    const keyResults = allKeyResults
      .filter(kr => objIds.has(kr.objective_id))
      .map(kr => {
        let progress = 0;
        if (kr.direction === 'increase') {
          progress = ((kr.current_value - kr.start_value) / (kr.expected_value - kr.start_value)) * 100;
        } else {
          progress = ((kr.start_value - kr.current_value) / (kr.start_value - kr.expected_value)) * 100;
        }
        progress = Math.min(100, Math.max(0, parseFloat(progress.toFixed(1))));
        return {
          ...kr,
          progress
        };
      });
    
    // Attach KeyResults to Objectives
    const tree = objectives.map(obj => {
      const krs = keyResults.filter(kr => kr.objective_id === obj.objective_id);
      return {
        ...obj,
        key_results: krs
      };
    });

    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: OKR Tree Structure for TreeTable (Filtered by space_id and timeline_id)
app.get('/api/okr-tree', async (req, res) => {
  try {
    const { space_id, workspace_id, timeline_id } = req.query;
    const targetSpace = space_id || workspace_id;

    let objectives;
    const baseQuery = `
      SELECT o.*, 
        CASE 
          WHEN UPPER(o.level) = 'COMPANY' THEN 'Toàn công ty'
          ELSE COALESCE(tm.name, e.full_name, o.assignee_id)
        END as assignee_name, 
        e.display_code as assignee_code, 
        COALESCE(tm.name, e_team.name) as team_name 
      FROM Objectives o 
      LEFT JOIN Employees e ON o.assignee_id = e.employee_id 
      LEFT JOIN Teams e_team ON e.team_id = e_team.id
      LEFT JOIN Teams tm ON (o.assignee_id = tm.id OR o.assignee_id = tm.code)
    `;
    const whereClauses = [];
    const queryParams = [];

    if (targetSpace && targetSpace !== 'all') {
      whereClauses.push('o.space_id = ?');
      queryParams.push(targetSpace);
    }

    const tlIds = await getTimelineFilterIds(timeline_id);
    if (tlIds && tlIds.length > 0) {
      const placeholders = tlIds.map(() => '?').join(', ');
      whereClauses.push(`o.timeline_id IN (${placeholders})`);
      queryParams.push(...tlIds);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';
    objectives = await all(`${baseQuery} ${whereSql} ORDER BY o.objective_id ASC`, queryParams);

    // Smart Fallback: if space_id yielded 0 objectives, re-query without space constraint
    if (objectives.length === 0 && targetSpace && targetSpace !== 'all') {
      const fallbackClauses = [];
      const fallbackParams = [];
      if (tlIds && tlIds.length > 0) {
        const placeholders = tlIds.map(() => '?').join(', ');
        fallbackClauses.push(`o.timeline_id IN (${placeholders})`);
        fallbackParams.push(...tlIds);
      }
      const fallbackWhere = fallbackClauses.length > 0 ? `WHERE ${fallbackClauses.join(' AND ')}` : '';
      objectives = await all(`${baseQuery} ${fallbackWhere} ORDER BY o.objective_id ASC`, fallbackParams);
    }

    const allKeyResults = await all(`
      SELECT kr.*, 
             COALESCE(e.full_name, kr.assignee_id) as assignee_name, 
             e.display_code as assignee_code, 
             COALESCE(t.name, e_team.name) as team_name,
             COALESCE(t.id, e.team_id) as team_id,
             COALESCE(mr.flow_code, mr_p.flow_code) as flow_code,
             COALESCE(mr.sla_value, mr_p.sla_value) as sla_value,
             COALESCE(mr.threshold_percent, mr_p.threshold_percent) as threshold_percent
      FROM KeyResults kr
      LEFT JOIN Employees e ON kr.assignee_id = e.employee_id
      LEFT JOIN Teams e_team ON e.team_id = e_team.id
      LEFT JOIN Teams t ON (kr.assignee_id = t.id OR kr.assignee_id = t.code)
      LEFT JOIN MeasurementRules mr ON kr.kr_id = mr.kr_id
      LEFT JOIN MeasurementRules mr_p ON kr.parent_kr_id = mr_p.kr_id
    `);
    const objIds = new Set(objectives.map(o => o.objective_id));
    const keyResults = allKeyResults
      .filter(kr => objIds.has(kr.objective_id))
      .map(kr => {
        let progress = 0;
        if (kr.direction === 'increase') {
          progress = ((kr.current_value - kr.start_value) / (kr.expected_value - kr.start_value)) * 100;
        } else {
          progress = ((kr.start_value - kr.current_value) / (kr.start_value - kr.expected_value)) * 100;
        }
        progress = Math.min(100, Math.max(0, parseFloat(progress.toFixed(1))));
        return {
          ...kr,
          progress
        };
      });

    const employees = await all('SELECT * FROM Employees');
    const allTeams = await all('SELECT * FROM Teams');
    const rules = await all('SELECT * FROM MeasurementRules');

    // Transform KeyResult to TreeNode
    const mapKrToNode = (kr, parentLevel, parentTl) => {
      let progress = 0;
      if (kr.direction === 'increase') {
        const span = kr.expected_value - kr.start_value;
        progress = span !== 0 ? ((kr.current_value - kr.start_value) / span) * 100 : 100;
      } else {
        const span = kr.start_value - kr.expected_value;
        progress = span !== 0 ? ((kr.start_value - kr.current_value) / span) * 100 : 100;
      }
      progress = Math.min(100, Math.max(0, parseFloat(progress.toFixed(1))));

      const rule = rules.find(r => r.kr_id === kr.kr_id);
      const isInd = parentLevel === 'individual' || parentLevel === 'PERSONAL' || !!kr.parent_kr_id || (!!kr.assignee_id && employees.some(e => e.employee_id === kr.assignee_id || e.full_name === kr.assignee_id));
      const type = isInd ? 'ind_kr' : 'team_kr';

      let assignTo = 'Team dev';
      let assignToAvatar = undefined;
      if (kr.assignee_id) {
        const emp = employees.find(e => e.employee_id === kr.assignee_id || e.full_name === kr.assignee_id);
        const tm = allTeams.find(t => t.id === kr.assignee_id || t.code === kr.assignee_id || t.name === kr.assignee_id);
        if (emp) {
          assignTo = emp.full_name;
          assignToAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.full_name)}&background=3157D5&color=fff`;
        } else if (tm) {
          assignTo = tm.name;
        } else {
          assignTo = kr.assignee_id;
        }
      }

      const risk = progress < 50 ? 'danger' : (progress < 75 ? 'warning' : 'none');

      // Recursively map child KRs
      const childKrs = keyResults.filter(k => k.parent_kr_id === kr.kr_id);
      const childKrNodes = childKrs.map(cKr => mapKrToNode(cKr, 'individual', parentTl));

      return {
        id: kr.kr_id,
        title: kr.title,
        type,
        progress,
        expanded: true,
        assignTo,
        assignToAvatar,
        metricName: kr.metric_id || 'GitLab SLA',
        metricSub: rule ? `${rule.event_type} <= ${rule.sla_value}h` : (kr.unit || '%'),
        aggType: 'AVG',
        resultS: String(kr.start_value),
        resultC: String(kr.current_value),
        resultE: String(kr.expected_value),
        risk,
        tl: parentTl || 'TL-M10-2026',
        objective_id: kr.objective_id,
        parent_kr_id: kr.parent_kr_id,
        unit: kr.unit || '%',
        direction: kr.direction || 'increase',
        description: rule ? `Quy tắc đo lường SLA: ${rule.event_type} <= ${rule.sla_value}h. ${rule.formula}` : 'Chỉ số đo lường hiệu năng kỹ thuật tự động qua GitLab Activepieces Flow.',
        children: childKrNodes
      };
    };

    // Transform Objective to TreeNode
    const mapObjToNode = (obj) => {
      const isCompany = obj.level === 'company' || obj.level === 'COMPANY';
      const isTeam = obj.level === 'team' || obj.level === 'TEAM';
      const type = isCompany ? 'company_obj' : 'team_obj';

      const progress = parseFloat((obj.progress || 0).toFixed(1));
      const risk = progress < 50 ? 'danger' : (progress < 75 ? 'warning' : 'none');

      // Direct child KRs (only top-level KRs of this objective, NOT nested individual KRs)
      const myKrs = keyResults.filter(kr => kr.objective_id === obj.objective_id && !kr.parent_kr_id);
      const krNodes = myKrs.map(kr => mapKrToNode(kr, obj.level, obj.timeline_id));

      // Direct child Objectives
      const childObjs = objectives.filter(o => o.parent_id === obj.objective_id);
      const childObjNodes = childObjs.map(mapObjToNode);

      let assignTo = 'Toàn công ty';
      if (isCompany) {
        assignTo = 'Toàn công ty';
      } else if (isTeam) {
        if (!obj.assignee_id || obj.assignee_id === 'COMPANY' || obj.assignee_id === 'ALL' || obj.assignee_id === 'Toàn công ty') {
          assignTo = 'Đội ngũ Kỹ thuật';
        } else {
          const tm = allTeams.find(t => t.id === obj.assignee_id || t.code === obj.assignee_id);
          assignTo = tm ? (tm.name || tm.code) : (obj.assignee_id || 'Đội ngũ Kỹ thuật');
        }
      } else {
        const emp = employees.find(e => e.employee_id === obj.assignee_id);
        assignTo = emp ? emp.full_name : 'Cá nhân';
      }

      return {
        id: obj.objective_id,
        title: obj.title,
        type,
        progress,
        expanded: true,
        assignTo,
        assignToAvatar: undefined,
        metricName: obj.category || 'Mục tiêu Chiến lược',
        metricSub: 'AVG(Score)',
        aggType: 'AVG',
        resultS: String(obj.start_value || 0),
        resultC: String(progress),
        resultE: String(obj.expected_value || 100),
        risk,
        tl: obj.timeline_id || 'Q3-2026',
        objective_id: obj.objective_id,
        description: obj.description || '',
        children: [...childObjNodes, ...krNodes]
      };
    };

    // Root objectives (no parent_id or parent not found)
    const rootObjectives = objectives.filter(o => !o.parent_id || !objectives.some(p => p.objective_id === o.parent_id));
    const tree = rootObjectives.map(mapObjToNode);

    res.json(tree);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/objectives/:id', async (req, res) => {
  try {
    const { id } = req.params;
    let objective = await get('SELECT * FROM Objectives WHERE objective_id = $1', [id]);
    if (!objective) {
      const kr = await get('SELECT * FROM KeyResults WHERE kr_id = $1', [id]);
      if (kr) {
        objective = await get('SELECT * FROM Objectives WHERE objective_id = $1', [kr.objective_id]);
      }
    }
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    // Parent Objective & Ancestor Chain (from root down to direct parent)
    const ancestors = [];
    let currParentId = objective.parent_id;
    const visited = new Set();
    while (currParentId && !visited.has(currParentId)) {
      visited.add(currParentId);
      const parentObj = await get(`
        SELECT o.*, 
          CASE 
            WHEN UPPER(o.level) = 'COMPANY' THEN 'Toàn Công Ty'
            WHEN UPPER(o.level) = 'TEAM' THEN COALESCE(t.name, t.code, o.assignee_id, 'Toàn nhóm')
            ELSE COALESCE(e.full_name, o.assignee_id, 'Chưa phân công')
          END as assignee_name 
        FROM Objectives o 
        LEFT JOIN Employees e ON o.assignee_id = e.employee_id 
        LEFT JOIN Teams t ON (o.assignee_id = t.id OR o.assignee_id = t.code)
        WHERE o.objective_id = $1
      `, [currParentId]);
      if (!parentObj) break;
      ancestors.unshift(parentObj);
      currParentId = parentObj.parent_id;
    }
    objective.ancestors = ancestors;
    objective.parent = ancestors.length > 0 ? ancestors[ancestors.length - 1] : null;

    // Child Objectives
    const childObjectives = await all(`
      SELECT o.*, 
        CASE 
          WHEN UPPER(o.level) = 'COMPANY' THEN 'Toàn Công Ty'
          WHEN UPPER(o.level) = 'TEAM' THEN COALESCE(t.name, t.code, o.assignee_id, 'Toàn nhóm')
          ELSE COALESCE(e.full_name, o.assignee_id, 'Chưa phân công')
        END as assignee_name,
        t.name as team_name,
        t.code as team_code
      FROM Objectives o 
      LEFT JOIN Employees e ON o.assignee_id = e.employee_id 
      LEFT JOIN Teams t ON (o.assignee_id = t.id OR o.assignee_id = t.code)
      WHERE o.parent_id = $1
      ORDER BY o.objective_id ASC
    `, [id]);
    objective.child_objectives = childObjectives || [];

    // Key Results with Measurement Rule & SLA formula info
    const keyResults = await all(`
      SELECT kr.*, mr.formula, mr.sla_value, mr.event_type 
      FROM KeyResults kr 
      LEFT JOIN MeasurementRules mr ON kr.kr_id = mr.kr_id 
      WHERE kr.objective_id = $1
      ORDER BY kr.kr_id ASC
    `, [id]);
    objective.key_results = keyResults || [];

    // Assignee details
    if (objective.level && objective.level.toUpperCase() === 'COMPANY') {
      objective.assignee_id = null;
      objective.assignee_name = null;
      objective.assignee_code = null;
    } else if (objective.level && objective.level.toUpperCase() === 'TEAM') {
      const tm = await get('SELECT name, code FROM Teams WHERE id = $1 OR code = $1', [objective.assignee_id]);
      objective.assignee_name = tm ? (tm.name || tm.code) : (objective.assignee_id || 'Toàn nhóm');
      objective.assignee_code = tm ? tm.code : objective.assignee_id;
    } else if (objective.assignee_id) {
      const emp = await get('SELECT full_name, display_code, gitlab_user_id FROM Employees WHERE employee_id = $1', [objective.assignee_id]);
      if (emp) {
        objective.assignee_name = emp.full_name;
        objective.assignee_code = emp.display_code;
        objective.gitlab_user_id = emp.gitlab_user_id;
      }
    }

    // Calculate current_value from KeyResults if objective has KRs
    if (objective.key_results && objective.key_results.length > 0) {
      const sumCurrent = objective.key_results.reduce((acc, k) => acc + (parseFloat(k.current_value) || 0), 0);
      objective.current_value = parseFloat((sumCurrent / objective.key_results.length).toFixed(1));
    } else {
      objective.current_value = objective.start_value || 0;
    }

    res.json(objective);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/objectives', async (req, res) => {
  try {
    const { 
      objective_id, 
      parent_id, 
      level, 
      title, 
      timeline_id, 
      progress, 
      description, 
      assignee_id, 
      metric_id, 
      category, 
      start_value, 
      expected_value,
      space_id 
    } = req.body;

    let assignedSpaceId = space_id;
    if (!assignedSpaceId) {
      if (parent_id) {
        const parent = await get('SELECT space_id FROM Objectives WHERE objective_id = ?', [parent_id]);
        if (parent && parent.space_id) assignedSpaceId = parent.space_id;
      }
      if (!assignedSpaceId && timeline_id) {
        const tl = await get('SELECT workspace_id FROM Timelines WHERE id = ?', [timeline_id]);
        if (tl && tl.workspace_id) assignedSpaceId = tl.workspace_id;
      }
      if (!assignedSpaceId) {
        const firstSpace = await get('SELECT id FROM Spaces ORDER BY created_at ASC LIMIT 1');
        if (firstSpace) assignedSpaceId = firstSpace.id;
      }
    }

    await run(
      `INSERT INTO Objectives 
       (objective_id, parent_id, level, title, timeline_id, progress, description, assignee_id, metric_id, category, start_value, expected_value, space_id) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
      [
        objective_id || `OBJ-${Math.floor(Math.random()*10000)}`, 
        parent_id || null, 
        level || 'PERSONAL', 
        title, 
        timeline_id || null, 
        progress || 0, 
        description || '', 
        assignee_id || null, 
        metric_id || null, 
        category || 'Objective', 
        start_value || 0, 
        expected_value || 100,
        assignedSpaceId || null
      ]
    );
    res.status(201).json({ success: true, message: 'Created successfully', space_id: assignedSpaceId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clone Objective or KeyResult
app.post('/api/objectives/:id/clone', async (req, res) => {
  try {
    const { id } = req.params;
    const { assignee_id } = req.body || {};

    // Check if it's an Objective
    const objective = await get('SELECT * FROM Objectives WHERE objective_id = ?', [id]);
    if (objective) {
      const newObjId = `OBJ-${Date.now().toString().slice(-6)}`;
      const newTitle = `${objective.title} (Bản sao)`;
      const finalAssigneeId = assignee_id !== undefined ? assignee_id : objective.assignee_id;
      await run(
        `INSERT INTO Objectives (objective_id, parent_id, level, title, timeline_id, progress, description, assignee_id, metric_id, category, start_value, expected_value, space_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newObjId,
          objective.parent_id,
          objective.level,
          newTitle,
          objective.timeline_id,
          0,
          objective.description,
          finalAssigneeId,
          objective.metric_id,
          objective.category,
          objective.start_value,
          objective.expected_value,
          objective.space_id
        ]
      );

      // Clone child KeyResults if any
      const krs = await all('SELECT * FROM KeyResults WHERE objective_id = ?', [id]);
      for (let i = 0; i < krs.length; i++) {
        const kr = krs[i];
        const newKrId = `KR-${Date.now().toString().slice(-5)}-${i + 1}`;
        await run(
          `INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newKrId,
            newObjId,
            kr.metric_id,
            `${kr.title} (Bản sao)`,
            kr.start_value,
            kr.expected_value,
            kr.start_value,
            kr.direction,
            kr.unit,
            objective.space_id,
            kr.assignee_id || null
          ]
        );
      }

      return res.json({ success: true, new_id: newObjId, message: 'Nhân bản Mục tiêu thành công!' });
    }

    // Check if it's a KeyResult
    const kr = await get('SELECT * FROM KeyResults WHERE kr_id = ?', [id]);
    if (kr) {
      const parentObj = await get('SELECT space_id FROM Objectives WHERE objective_id = ?', [kr.objective_id]);
      const newKrId = `KR-${Date.now().toString().slice(-6)}`;
      const newTitle = `${kr.title} (Bản sao)`;
      const finalAssigneeId = assignee_id !== undefined ? assignee_id : (kr.assignee_id || null);
      await run(
        `INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newKrId,
          kr.objective_id,
          kr.metric_id,
          newTitle,
          kr.start_value,
          kr.expected_value,
          kr.start_value,
          kr.direction,
          kr.unit,
          parentObj ? parentObj.space_id : null,
          finalAssigneeId
        ]
      );
      return res.json({ success: true, new_id: newKrId, message: 'Nhân bản Key Result thành công!' });
    }

    return res.status(404).json({ error: 'Không tìm thấy mục tiêu hoặc kết quả then chốt để nhân bản' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Assign Objective template to OKR Tree with a specific assignee
app.post('/api/objectives/:id/assign-to-tree', async (req, res) => {
  try {
    const { id } = req.params;
    const { assignee_id, title } = req.body || {};

    const template = await get('SELECT * FROM Objectives WHERE objective_id = ?', [id]);
    if (!template) {
      return res.status(404).json({ error: 'Không tìm thấy Objective gốc' });
    }

    const newObjId = `OBJ-${Date.now().toString().slice(-6)}`;
    const finalTitle = title && title.trim() ? title.trim() : template.title;

    await run(
      `INSERT INTO Objectives (objective_id, parent_id, level, title, timeline_id, progress, description, assignee_id, metric_id, category, start_value, expected_value, space_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        newObjId,
        template.parent_id,
        template.level,
        finalTitle,
        template.timeline_id,
        0,
        template.description,
        assignee_id || null,
        template.metric_id,
        template.category,
        template.start_value,
        template.expected_value,
        template.space_id
      ]
    );

    // Copy child Key Results associated with this Objective
    const krs = await all('SELECT * FROM KeyResults WHERE objective_id = ?', [id]);
    for (let i = 0; i < krs.length; i++) {
      const kr = krs[i];
      const newKrId = `KR-${Date.now().toString().slice(-5)}-${i + 1}`;
      const krAssignee = (template.level === 'PERSONAL' || template.level === 'INDIVIDUAL')
        ? (assignee_id || kr.assignee_id || null)
        : (kr.assignee_id || null);

      await run(
        `INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit, space_id, assignee_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newKrId,
          newObjId,
          kr.metric_id,
          kr.title,
          kr.start_value,
          kr.expected_value,
          kr.start_value,
          kr.direction,
          kr.unit,
          template.space_id,
          krAssignee
        ]
      );
    }

    return res.json({
      success: true,
      new_id: newObjId,
      message: 'Đã thêm Mục tiêu vào OKR Tree thành công!'
    });
  } catch (error) {
    console.error('Error assigning objective to tree:', error);
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/objectives/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, level, timeline_id, assignee_id, metric_id, category, start_value, expected_value, progress, space_id } = req.body;
    
    // Check existing objective level
    const existing = await get('SELECT level FROM Objectives WHERE objective_id = $1', [id]);
    const isCompany = (level && level.toUpperCase() === 'COMPANY') || (existing && existing.level && existing.level.toUpperCase() === 'COMPANY');
    
    const finalLevel = (existing && existing.level && existing.level.toUpperCase() === 'COMPANY') ? existing.level : (level || existing?.level);
    const finalAssigneeId = isCompany ? null : (assignee_id !== undefined ? assignee_id : null);

    await run(
      `UPDATE Objectives SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        level = COALESCE($3, level),
        timeline_id = COALESCE($4, timeline_id),
        assignee_id = $5,
        metric_id = COALESCE($6, metric_id),
        category = COALESCE($7, category),
        start_value = COALESCE($8, start_value),
        expected_value = COALESCE($9, expected_value),
        progress = COALESCE($10, progress),
        space_id = COALESCE($11, space_id)
       WHERE objective_id = $12`,
      [title, description, finalLevel, timeline_id, finalAssigneeId, metric_id, category, start_value, expected_value, progress, space_id, id]
    );
    res.json({ success: true, message: 'Updated successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3. Key Results Endpoint
app.get('/api/key-results', async (req, res) => {
  try {
    const krs = await all(`
      SELECT kr.*, 
             o.title as objective_title, 
             o.level as objective_level,
             o.timeline_id,
             COALESCE(e.full_name, kr.assignee_id) as assignee_name, 
             e.display_code as assignee_code, 
             COALESCE(t.name, e_team.name) as team_name,
             COALESCE(t.id, e.team_id) as team_id,
             COALESCE(mr.flow_code, mr_p.flow_code) as flow_code,
             COALESCE(mr.sla_value, mr_p.sla_value) as sla_value,
             COALESCE(mr.threshold_percent, mr_p.threshold_percent) as threshold_percent
      FROM KeyResults kr 
      JOIN Objectives o ON kr.objective_id = o.objective_id
      LEFT JOIN Employees e ON kr.assignee_id = e.employee_id
      LEFT JOIN Teams e_team ON e.team_id = e_team.id
      LEFT JOIN Teams t ON (kr.assignee_id = t.id OR kr.assignee_id = t.code)
      LEFT JOIN MeasurementRules mr ON kr.kr_id = mr.kr_id
      LEFT JOIN MeasurementRules mr_p ON kr.parent_kr_id = mr_p.kr_id
    `);
    
    // Calculate progress for each KR
    const formattedKrs = krs.map(kr => {
      let progress = 0;
      if (kr.direction === 'increase') {
        progress = ((kr.current_value - kr.start_value) / (kr.expected_value - kr.start_value)) * 100;
      } else {
        progress = ((kr.start_value - kr.current_value) / (kr.start_value - kr.expected_value)) * 100;
      }
      progress = Math.min(100, Math.max(0, parseFloat(progress.toFixed(1))));
      return {
        ...kr,
        progress
      };
    });

    res.json(formattedKrs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.1. Single Key Result Detail Endpoint (For Drawer / Right Bar)
app.get('/api/key-results/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const kr = await get('SELECT * FROM KeyResults WHERE kr_id = ?', [id]);
    if (!kr) {
      return res.status(404).json({ error: 'Key Result not found' });
    }

    const obj = await get('SELECT * FROM Objectives WHERE objective_id = ?', [kr.objective_id]);
    const rule = await get('SELECT * FROM MeasurementRules WHERE kr_id = ? OR kr_id = ?', [kr.kr_id, kr.parent_kr_id || kr.kr_id]);
    const emp = kr.assignee_id ? await get('SELECT * FROM Employees WHERE employee_id = ? OR gitlab_user_id = ? OR full_name = ?', [kr.assignee_id, kr.assignee_id, kr.assignee_id]) : null;
    const team = kr.assignee_id ? await get('SELECT * FROM Teams WHERE id = ? OR code = ? OR name = ?', [kr.assignee_id, kr.assignee_id, kr.assignee_id]) : null;

    // Build ancestors hierarchy breadcrumb
    const ancestors = [];
    if (obj) {
      if (obj.parent_id) {
        const grandParent = await get('SELECT * FROM Objectives WHERE objective_id = ?', [obj.parent_id]);
        if (grandParent) {
          ancestors.push({
            id: grandParent.objective_id,
            title: grandParent.title,
            type: 'company_obj',
            icon: 'fa-building'
          });
        }
      }
      ancestors.push({
        id: obj.objective_id,
        title: obj.title,
        type: obj.level === 'COMPANY' ? 'company_obj' : 'team_obj',
        icon: 'fa-building'
      });
    }

    if (kr.parent_kr_id) {
      const parentKr = await get('SELECT * FROM KeyResults WHERE kr_id = ?', [kr.parent_kr_id]);
      if (parentKr) {
        ancestors.push({
          id: parentKr.kr_id,
          title: parentKr.title,
          type: 'team_kr',
          icon: 'fa-bullseye'
        });
      }
    }

    ancestors.push({
      id: kr.kr_id,
      title: kr.title,
      type: kr.parent_kr_id ? 'ind_kr' : 'team_kr',
      icon: kr.parent_kr_id ? 'fa-user' : 'fa-bullseye'
    });

    let progress = 0;
    if (kr.direction === 'increase') {
      const span = kr.expected_value - kr.start_value;
      progress = span !== 0 ? ((kr.current_value - kr.start_value) / span) * 100 : 100;
    } else {
      const span = kr.start_value - kr.expected_value;
      progress = span !== 0 ? ((kr.start_value - kr.current_value) / span) * 100 : 100;
    }
    progress = Math.min(100, Math.max(0, parseFloat(progress.toFixed(1))));

    let assignTo = 'Team dev';
    let assignToAvatar = undefined;
    if (emp) {
      assignTo = emp.full_name;
      assignToAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.full_name)}&background=3157D5&color=fff`;
    } else if (team) {
      assignTo = team.name;
    } else if (kr.assignee_id) {
      assignTo = kr.assignee_id;
    }

    res.json({
      ...kr,
      progress,
      assignTo,
      assignToAvatar,
      objective: obj,
      rule,
      ancestors,
      description: rule ? `Quy tắc đo lường SLA: ${rule.event_type} <= ${rule.sla_value}h. ${rule.formula}` : 'Chỉ số đo lường hiệu năng kỹ thuật tự động qua GitLab Activepieces Flow.'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.2. Key Result Check-in History Endpoint
app.get('/api/key-results/:id/checkins', async (req, res) => {
  try {
    const { id } = req.params;
    const checkins = await all('SELECT * FROM MetricResults WHERE kr_id = ? ORDER BY calculated_at DESC LIMIT 50', [id]);
    res.json(checkins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 3.3. Key Result Audit Log / History Endpoint (Field Change Audit Log - Matches format in image)
app.get('/api/key-results/:id/history', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch from AuditLogs (Real user/activepieces actions only)
    const history = await all(`
      SELECT log_id, kr_id, objective_id, author, author_avatar, field_name, old_value, new_value, new_value_avatar, created_at
      FROM AuditLogs
      WHERE kr_id = ?
      ORDER BY created_at DESC
      LIMIT 50
    `, [id]);

    res.json(history || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 4. MEASUREMENT RULES, WORKING CALENDAR & ACTIVEPIECES SYNC
// ==========================================

// Helper: Recalculate OKR progress from KR up to Company Objective
async function recalculateOkrProgress(krId, newCurrentValue, options = {}) {
  const kr = await get('SELECT * FROM KeyResults WHERE kr_id = ?', [krId]);
  if (!kr) throw new Error(`KeyResult with id ${krId} not found`);

  const oldVal = kr.current_value;
  const val = parseFloat(newCurrentValue);
  let progress = 0;
  if (kr.direction === 'increase') {
    progress = ((val - kr.start_value) / (kr.expected_value - kr.start_value)) * 100;
  } else {
    progress = ((kr.start_value - val) / (kr.start_value - kr.expected_value)) * 100;
  }
  const clampedProgress = Math.min(100, Math.max(0, parseFloat(progress.toFixed(1))));

  // Update KeyResult
  await run('UPDATE KeyResults SET current_value = ? WHERE kr_id = ?', [val, krId]);

  // Record AuditLog for system change to Current value
  if (oldVal !== undefined && oldVal !== null && Number(oldVal) !== Number(val)) {
    let auditAuthor = options.author;
    const isWf = options.source === 'activepieces' || options.actor_id || (!auditAuthor) || (auditAuthor && (auditAuthor.toLowerCase().includes('syrix') || auditAuthor.toLowerCase().includes('activepieces') || auditAuthor.toLowerCase() === 'bot'));
    if (isWf) {
      auditAuthor = 'bot';
    } else if (!auditAuthor) {
      auditAuthor = 'Huyền Nguyễn Như';
    }
    const auditAvatar = (auditAuthor.includes('Huyen') || auditAuthor.includes('Huyền'))
      ? 'https://ui-avatars.com/api/?name=Huyen+Nguyen&background=3157D5&color=fff&rounded=true'
      : (auditAuthor === 'bot')
          ? 'https://ui-avatars.com/api/?name=bot&background=6366f1&color=fff&rounded=true'
          : `https://ui-avatars.com/api/?name=${encodeURIComponent(auditAuthor)}&background=3157D5&color=fff&rounded=true`;

    let logSource = options.source;
    let logReason = options.reason;
    if (isWf) {
      logSource = logSource || (options.flow_code ? `Activepieces Flow ${options.flow_code} (${options.run_id || 'RUN_AUTO'})` : 'Activepieces Flow (Syrix Task)');
      logReason = logReason || 'Tự động tính toán và đồng bộ từ GitLab & Google Sheets';
    } else {
      logSource = logSource || 'Admin cập nhật tay';
      logReason = logReason || 'Cập nhật tiến độ chỉ số';
    }

    const targetEntity = `[${krId}] ${kr.title || 'Chỉ số then chốt'}`;
    const actorName = isWf ? 'Syrix Task' : (auditAuthor || 'Huyền Nguyễn Như');

    await run(`
      INSERT INTO AuditLogs (target_entity, kr_id, objective_id, actor, author, author_avatar, field_name, old_value, new_value, source, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      targetEntity,
      krId,
      kr.objective_id,
      actorName,
      auditAuthor,
      auditAvatar,
      'Current value',
      `${oldVal} ${kr.unit || '%'}`,
      `${val} ${kr.unit || '%'}`,
      logSource,
      logReason
    ]);
  }

  // If this KR has a parent_kr_id, recalculate parent KR
  if (kr.parent_kr_id) {
    const siblingChildKrs = await all('SELECT * FROM KeyResults WHERE parent_kr_id = ?', [kr.parent_kr_id]);
    if (siblingChildKrs.length > 0) {
      let sumCurrent = 0;
      for (const k of siblingChildKrs) {
        const cur = (k.kr_id === krId) ? val : k.current_value;
        sumCurrent += cur;
      }
      const avgCurrent = parseFloat((sumCurrent / siblingChildKrs.length).toFixed(1));
      await run('UPDATE KeyResults SET current_value = ? WHERE kr_id = ?', [avgCurrent, kr.parent_kr_id]);
    }
  }

  // Recalculate Parent Objective
  let avgObjProgress = clampedProgress;
  const parentObj = await get('SELECT * FROM Objectives WHERE objective_id = ?', [kr.objective_id]);
  if (parentObj) {
    const rootKrs = await all('SELECT * FROM KeyResults WHERE objective_id = ? AND parent_kr_id IS NULL', [kr.objective_id]);
    const evalKrs = rootKrs.length > 0 ? rootKrs : await all('SELECT * FROM KeyResults WHERE objective_id = ?', [kr.objective_id]);
    if (evalKrs.length > 0) {
      let totalP = 0;
      for (const k of evalKrs) {
        const cur = (k.kr_id === krId) ? val : k.current_value;
        let p = 0;
        if (k.direction === 'increase') {
          const span = k.expected_value - k.start_value;
          p = span !== 0 ? ((cur - k.start_value) / span) * 100 : 100;
        } else {
          const span = k.start_value - k.expected_value;
          p = span !== 0 ? ((k.start_value - cur) / span) * 100 : 100;
        }
        totalP += Math.min(100, Math.max(0, p));
      }
      avgObjProgress = parseFloat((totalP / evalKrs.length).toFixed(1));
    }
    await run(
      'UPDATE Objectives SET progress = ? WHERE objective_id = ?',
      [avgObjProgress, kr.objective_id]
    );
  }

  // Recalculate Grandparent Objective (Company Objective)
  let avgCompanyProgress = null;
  let companyObjId = null;
  if (parentObj && parentObj.parent_id) {
    companyObjId = parentObj.parent_id;
    const siblingObjectives = await all('SELECT * FROM Objectives WHERE parent_id = ?', [companyObjId]);
    if (siblingObjectives.length > 0) {
      let totalObjP = 0;
      for (const obj of siblingObjectives) {
        const p = (obj.objective_id === kr.objective_id) ? avgObjProgress : (obj.progress || 0);
        totalObjP += Math.min(100, Math.max(0, p));
      }
      avgCompanyProgress = parseFloat((totalObjP / siblingObjectives.length).toFixed(1));
      await run(
        'UPDATE Objectives SET progress = ? WHERE objective_id = ?',
        [avgCompanyProgress, companyObjId]
      );
    }
  }

  // Record MetricResults history
  const period = options.period || 'Q3-2026';
  const numerator = options.numerator !== undefined ? options.numerator : Math.round(val);
  const denominator = options.denominator !== undefined ? options.denominator : 100;
  let author = options.author;
  const isWfMetric = options.source === 'activepieces' || options.actor_id || (!author) || (author && (author.toLowerCase().includes('syrix') || author.toLowerCase().includes('activepieces') || author.toLowerCase() === 'bot'));
  if (isWfMetric) {
    author = 'bot';
  } else if (!author) {
    author = 'Bạn (Quản trị viên)';
  }
  const targetField = options.target_field || 'Current';
  const note = options.note !== undefined ? options.note : (options.comment || options.reason || null);
  const runId = options.run_id || null;
  const flowCode = options.flow_code || null;

  await run(
    `INSERT INTO MetricResults (kr_id, period, numerator, denominator, current_value, progress, status, author, target_field, note, run_id, flow_code, calculated_at)
     VALUES (?, ?, ?, ?, ?, ?, 'activepieces_synced', ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
    [krId, period, numerator, denominator, val, clampedProgress, author, targetField, note, runId, flowCode]
  );

  // Traceability: Log event assignment if event_key is provided
  if (options.event_key) {
    const rawActor = options.actor_id || 'activepieces.bot';
    let employeeId = rawActor;
    const emp = await get('SELECT employee_id FROM Employees WHERE employee_id = ? OR gitlab_user_id = ? OR gitlab_user_id LIKE ?', [rawActor, rawActor, `%${rawActor}%`]);
    if (emp) {
      employeeId = emp.employee_id;
    }

    const reason = options.reason || `Giá trị đo lường cập nhật tự động từ Activepieces Flow: ${val}${kr.unit || '%'}`;
    const duration = options.duration_minutes || 60;
    const onTime = options.on_time !== undefined ? (options.on_time ? 1 : 0) : 1;

    const evt = await get('SELECT * FROM GitLabEvents WHERE event_key = ?', [options.event_key]);
    if (!evt) {
      await run(`
        INSERT INTO GitLabEvents (event_key, project_code, object_kind, object_id, action, actor_id, event_time, payload_hash, raw_payload, processing_status)
        VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?, ?, ?)
      `, [
        options.event_key,
        options.project_code || 'gitlab/core-engine',
        'merge_request',
        Math.floor(Math.random() * 900000) + 100000,
        'approved',
        rawActor,
        'ap_sync_hash',
        JSON.stringify(options),
        'success'
      ]);
    }

    await run(`
      INSERT INTO EventAssignments (event_key, kr_id, employee_id, included, reason, duration_minutes, on_time)
      VALUES (?, ?, ?, 1, ?, ?, ?)
    `, [options.event_key, krId, employeeId, reason, duration, onTime]);
  }

  // Record comment/check-in note into Comments table if provided
  const commentText = options.comment || options.note;
  if (commentText && typeof commentText === 'string' && commentText.trim()) {
    let rawActor = options.author || options.actor_id;
    const isWfComment = options.source === 'activepieces' || options.actor_id || (!rawActor) || (rawActor && (rawActor.toLowerCase().includes('syrix') || rawActor.toLowerCase().includes('activepieces') || rawActor.toLowerCase() === 'bot'));
    if (isWfComment) {
      rawActor = 'bot';
    }
    let authorName = rawActor;
    let authorAvatar = 'https://ui-avatars.com/api/?name=Activepieces&background=6366f1&color=fff';
    const emp = await get('SELECT full_name FROM Employees WHERE employee_id = ? OR gitlab_user_id = ? OR gitlab_user_id LIKE ?', [rawActor, rawActor, `%${rawActor}%`]);
    if (emp) {
      authorName = emp.full_name;
      authorAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.full_name)}&background=3157D5&color=fff`;
    }
    await run(`
      INSERT INTO Comments (objective_id, kr_id, author, author_id, author_avatar, content, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `, [
      kr.objective_id,
      krId,
      authorName,
      options.author_id || options.actor_id || rawActor,
      authorAvatar,
      commentText.trim(),
      options.source || 'activepieces'
    ]);
  }

  return {
    key_result: {
      kr_id: krId,
      title: kr.title,
      previous_value: kr.current_value,
      new_current_value: val,
      unit: kr.unit,
      progress: clampedProgress
    },
    parent_objective: {
      objective_id: kr.objective_id,
      title: parentObj ? parentObj.title : null,
      progress: avgObjProgress
    },
    company_objective: companyObjId ? {
      objective_id: companyObjId,
      progress: avgCompanyProgress
    } : null
  };
}

// 4.1. Measurement Rules Endpoints
app.get(['/api/measurement-rules', '/api/rules'], async (req, res) => {
  try {
    const { objective_id, kr_id } = req.query;
    let query = `
      SELECT r.*, 
             kr.title as kr_title, kr.start_value, kr.expected_value, kr.current_value as kr_current_value, kr.unit as kr_unit, kr.direction as kr_direction,
             o.title as objective_title, o.level as objective_level, o.progress as objective_progress, o.space_id as objective_space_id
      FROM MeasurementRules r
      LEFT JOIN KeyResults kr ON r.kr_id = kr.kr_id
      LEFT JOIN Objectives o ON (r.objective_id = o.objective_id OR kr.objective_id = o.objective_id)
      WHERE 1=1
    `;
    const params = [];
    if (objective_id) {
      query += ` AND (r.objective_id = ? OR kr.objective_id = ?)`;
      params.push(objective_id, objective_id);
    }
    if (kr_id) {
      query += ` AND r.kr_id = ?`;
      params.push(kr_id);
    }
    query += ` ORDER BY r.rule_id ASC`;

    const rules = await all(query, params);
    const mapped = rules.map(r => ({
      rule_id: r.rule_id,
      kr_id: r.kr_id,
      krId: r.kr_id,
      objective_id: r.objective_id,
      objectiveId: r.objective_id,
      flow_code: r.flow_code || `FLOW-${r.objective_id || r.kr_id}`,
      flowCode: r.flow_code || `FLOW-${r.objective_id || r.kr_id}`,
      flow_name: r.flow_name || `GitLab SLA Webhook Flow - ${r.objective_title || r.kr_title || ''}`,
      flowName: r.flow_name || `GitLab SLA Webhook Flow - ${r.objective_title || r.kr_title || ''}`,
      flow_url: r.flow_url || `https://cloud.activepieces.com/flows/${(r.flow_code || r.objective_id || '').toLowerCase()}`,
      flowUrl: r.flow_url || `https://cloud.activepieces.com/flows/${(r.flow_code || r.objective_id || '').toLowerCase()}`,
      event_type: r.event_type,
      start_event: r.start_event,
      startTrigger: r.start_event,
      end_event: r.end_event,
      endTrigger: r.end_event,
      sla_value: r.sla_value,
      slaHours: r.sla_value,
      threshold_percent: r.threshold_percent || 90,
      thresholdPercent: r.threshold_percent || 90,
      formula: r.formula,
      businessLogicNote: r.formula,
      filters: r.filters,
      filterCriteria: r.filters,
      overtime_handling: r.overtime_handling,
      overtimeHandling: r.overtime_handling,
      lunch_break_rule: r.lunch_break_rule,
      lunchBreakRule: r.lunch_break_rule,
      weekend_holiday_rule: r.weekend_holiday_rule,
      weekendHolidayRule: r.weekend_holiday_rule,
      version: r.version,
      updated_at: r.updated_at,
      kr_title: r.kr_title,
      objective_title: r.objective_title,
      objective_progress: r.objective_progress,
      kr_current_value: r.kr_current_value,
      kr_unit: r.kr_unit
    }));
    res.json(mapped);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get(['/api/measurement-rules/:id', '/api/rules/:id'], async (req, res) => {
  try {
    const id = req.params.id;
    const rule = await get(`
      SELECT r.*, 
             kr.title as kr_title, kr.start_value, kr.expected_value, kr.current_value as kr_current_value, kr.unit as kr_unit, kr.direction as kr_direction,
             o.title as objective_title, o.level as objective_level, o.progress as objective_progress
      FROM MeasurementRules r
      LEFT JOIN KeyResults kr ON r.kr_id = kr.kr_id
      LEFT JOIN Objectives o ON (r.objective_id = o.objective_id OR kr.objective_id = o.objective_id)
      WHERE r.rule_id = ? OR r.objective_id = ? OR r.kr_id = ?
      LIMIT 1
    `, [id, id, id]);

    if (!rule) {
      return res.status(404).json({ error: `Measurement rule not found for id ${id}` });
    }

    res.json({
      rule_id: rule.rule_id,
      kr_id: rule.kr_id,
      krId: rule.kr_id,
      objective_id: rule.objective_id,
      objectiveId: rule.objective_id,
      flow_code: rule.flow_code,
      flowCode: rule.flow_code,
      flow_name: rule.flow_name,
      flowName: rule.flow_name,
      flow_url: rule.flow_url,
      flowUrl: rule.flow_url,
      event_type: rule.event_type,
      start_event: rule.start_event,
      startTrigger: rule.start_event,
      end_event: rule.end_event,
      endTrigger: rule.end_event,
      sla_value: rule.sla_value,
      slaHours: rule.sla_value,
      threshold_percent: rule.threshold_percent || 90,
      thresholdPercent: rule.threshold_percent || 90,
      formula: rule.formula,
      businessLogicNote: rule.formula,
      filters: rule.filters,
      filterCriteria: rule.filters,
      overtime_handling: rule.overtime_handling,
      overtimeHandling: rule.overtime_handling,
      lunch_break_rule: rule.lunch_break_rule,
      lunchBreakRule: rule.lunch_break_rule,
      weekend_holiday_rule: rule.weekend_holiday_rule,
      weekendHolidayRule: rule.weekend_holiday_rule,
      version: rule.version,
      updated_at: rule.updated_at,
      kr_title: rule.kr_title,
      objective_title: rule.objective_title,
      objective_progress: rule.objective_progress,
      kr_current_value: rule.kr_current_value,
      kr_unit: rule.kr_unit
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

const saveMeasurementRuleHandler = async (req, res) => {
  try {
    const body = req.body;
    const paramId = req.params.id;

    // Resolve existing rule by rule_id or kr_id to ensure updates target the correct row
    let existingRule = null;
    if (body.rule_id || body.ruleId) {
      existingRule = await get('SELECT * FROM MeasurementRules WHERE rule_id = ?', [body.rule_id || body.ruleId]);
    }
    if (!existingRule && (body.kr_id || body.krId)) {
      existingRule = await get('SELECT * FROM MeasurementRules WHERE kr_id = ?', [body.kr_id || body.krId]);
    }
    if (!existingRule && paramId) {
      existingRule = await get('SELECT * FROM MeasurementRules WHERE rule_id = ? OR kr_id = ? OR objective_id = ?', [paramId, paramId, paramId]);
    }

    const kr_id = body.kr_id || body.krId || (existingRule ? existingRule.kr_id : 'KR-MR-SLA');
    const rule_id = existingRule ? existingRule.rule_id : (body.rule_id || body.ruleId || (paramId && paramId.startsWith('RULE-') ? paramId : `RULE-${kr_id}`));
    const objective_id = body.objective_id || body.objectiveId || (existingRule ? existingRule.objective_id : null);
    const flow_code = body.flow_code || body.flowCode || (existingRule ? existingRule.flow_code : `FLOW-${kr_id}`);
    const flow_name = body.flow_name || body.flowName || (existingRule ? existingRule.flow_name : `Activepieces Flow (${kr_id})`);
    const flow_url = body.flow_url || body.flowUrl || (existingRule ? existingRule.flow_url : `https://cloud.activepieces.com/flows/${flow_code.toLowerCase()}`);
    const event_type = body.event_type || body.type || (existingRule ? existingRule.event_type : 'merge_request');
    const filters = typeof body.filters === 'string' ? body.filters : (body.filterCriteria ? body.filterCriteria : JSON.stringify(body.filters || (existingRule ? existingRule.filters : {})));
    const start_event = body.start_event || body.startTrigger || (existingRule ? existingRule.start_event : 'reviewer_assigned');
    const end_event = body.end_event || body.endTrigger || (existingRule ? existingRule.end_event : 'approved');
    const sla_value = parseFloat(body.sla_value !== undefined ? body.sla_value : (body.slaHours !== undefined ? body.slaHours : (existingRule ? existingRule.sla_value : 4.0)));
    const formula = body.formula || body.businessLogicNote || (existingRule ? existingRule.formula : 'Số MR approved <= SLA / Tổng MR * 100%');
    const threshold_percent = parseFloat(body.threshold_percent !== undefined ? body.threshold_percent : (body.thresholdPercent !== undefined ? body.thresholdPercent : (existingRule ? existingRule.threshold_percent : 90)));
    const overtime_handling = body.overtime_handling || body.overtimeHandling || (existingRule ? existingRule.overtime_handling : '');
    const lunch_break_rule = body.lunch_break_rule || body.lunchBreakRule || (existingRule ? existingRule.lunch_break_rule : '');
    const weekend_holiday_rule = body.weekend_holiday_rule || body.weekendHolidayRule || (existingRule ? existingRule.weekend_holiday_rule : '');
    const version = body.version || (existingRule ? existingRule.version : 'v1.0');

    await run(`
      INSERT INTO MeasurementRules (
        rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version,
        objective_id, flow_code, flow_name, flow_url, threshold_percent,
        overtime_handling, lunch_break_rule, weekend_holiday_rule, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (rule_id) DO UPDATE SET
        kr_id = EXCLUDED.kr_id,
        objective_id = EXCLUDED.objective_id,
        flow_code = EXCLUDED.flow_code,
        flow_name = EXCLUDED.flow_name,
        flow_url = EXCLUDED.flow_url,
        event_type = EXCLUDED.event_type,
        filters = EXCLUDED.filters,
        start_event = EXCLUDED.start_event,
        end_event = EXCLUDED.end_event,
        sla_value = EXCLUDED.sla_value,
        threshold_percent = EXCLUDED.threshold_percent,
        formula = EXCLUDED.formula,
        overtime_handling = EXCLUDED.overtime_handling,
        lunch_break_rule = EXCLUDED.lunch_break_rule,
        weekend_holiday_rule = EXCLUDED.weekend_holiday_rule,
        version = EXCLUDED.version,
        updated_at = CURRENT_TIMESTAMP
    `, [
      rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version,
      objective_id, flow_code, flow_name, flow_url, threshold_percent,
      overtime_handling, lunch_break_rule, weekend_holiday_rule
    ]);

    // Record system change to AuditLogs
    try {
      const targetEntity = kr_id ? `[${kr_id}] Cấu hình quy tắc đo lường` : `[${flow_code}] Cấu hình quy tắc đo lường`;
      await run(`
        INSERT INTO AuditLogs (target_entity, kr_id, objective_id, actor, author, author_avatar, field_name, old_value, new_value, source, reason, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      `, [
        targetEntity,
        kr_id,
        objective_id,
        'Huyền Nguyễn Như',
        'Huyền Nguyễn Như',
        'https://ui-avatars.com/api/?name=Huyen+Nguyen&background=3157D5&color=fff&rounded=true',
        'Measurement Rule',
        'Quy tắc hiện tại',
        `Cập nhật [${flow_code}]: SLA ${sla_value}h, Ngưỡng ${threshold_percent}%`,
        'Admin cập nhật tay',
        'Cấu hình quy tắc đo lường & luật xử lý thời gian ngoài giờ'
      ]);
    } catch (e) {}

    res.json({
      success: true,
      message: `Quy tắc đo lường cho [${flow_code}] đã được lưu thành công vào cơ sở dữ liệu.`,
      rule_id: rule_id
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

app.post(['/api/measurement-rules', '/api/rules'], saveMeasurementRuleHandler);
app.put(['/api/measurement-rules/:id', '/api/rules/:id'], saveMeasurementRuleHandler);

app.delete(['/api/measurement-rules/:id', '/api/rules/:id'], async (req, res) => {
  try {
    await run('DELETE FROM MeasurementRules WHERE rule_id = ?', [req.params.id]);
    res.json({ success: true, message: 'Measurement rule deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// 4.2. Working Calendar, Working Hours & Holidays Endpoints
app.get('/api/working-calendar', async (req, res) => {
  try {
    const wh = await get('SELECT * FROM WorkingHours WHERE id = ?', ['DEFAULT']) || {};
    const holidays = await all('SELECT * FROM Holidays ORDER BY start_date ASC');
    
    let weekDays = [];
    if (wh.week_days_json) {
      try { weekDays = JSON.parse(wh.week_days_json); } catch (e) {}
    }
    if (!weekDays || weekDays.length === 0) {
      weekDays = [
        { key: 'mon', code: 'T2', name: 'Thứ 2', label: 'Thứ 2', isWork: true },
        { key: 'tue', code: 'T3', name: 'Thứ 3', label: 'Thứ 3', isWork: true },
        { key: 'wed', code: 'T4', name: 'Thứ 4', label: 'Thứ 4', isWork: true },
        { key: 'thu', code: 'T5', name: 'Thứ 5', label: 'Thứ 5', isWork: true },
        { key: 'fri', code: 'T6', name: 'Thứ 6', label: 'Thứ 6', isWork: true },
        { key: 'sat', code: 'T7', name: 'Thứ 7', label: 'Thứ 7', isWork: false },
        { key: 'sun', code: 'CN', name: 'Chủ Nhật', label: 'Chủ Nhật', isWork: false }
      ];
    }

    const formattedHolidays = holidays.map(h => ({
      id: h.id,
      name: h.name,
      startDate: h.start_date,
      endDate: h.end_date,
      start_date: h.start_date,
      end_date: h.end_date,
      daysCount: h.days_count,
      days_count: h.days_count,
      isActive: !!h.is_active,
      is_active: !!h.is_active,
      note: h.note
    }));

    res.json({
      workCalendar: {
        zone: 'Asia/Ho_Chi_Minh',
        morningStart: wh.morning_start || '08:00',
        morningEnd: wh.morning_end || '12:00',
        afternoonStart: wh.afternoon_start || '13:30',
        afternoonEnd: wh.afternoon_end || '17:30',
        working_days: wh.working_days ? JSON.parse(wh.working_days) : ['T2', 'T3', 'T4', 'T5', 'T6']
      },
      weekDays: weekDays,
      holidays: formattedHolidays
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get(['/api/working-time', '/api/working-hours'], async (req, res) => {
  try {
    const wh = await get('SELECT * FROM WorkingHours WHERE id = ?', ['DEFAULT']) || {};
    let weekDays = [];
    if (wh.week_days_json) {
      try { weekDays = JSON.parse(wh.week_days_json); } catch (e) {}
    }
    if (!weekDays || weekDays.length === 0) {
      weekDays = [
        { key: 'mon', code: 'T2', name: 'Thứ 2', label: 'Thứ 2', isWork: true },
        { key: 'tue', code: 'T3', name: 'Thứ 3', label: 'Thứ 3', isWork: true },
        { key: 'wed', code: 'T4', name: 'Thứ 4', label: 'Thứ 4', isWork: true },
        { key: 'thu', code: 'T5', name: 'Thứ 5', label: 'Thứ 5', isWork: true },
        { key: 'fri', code: 'T6', name: 'Thứ 6', label: 'Thứ 6', isWork: true },
        { key: 'sat', code: 'T7', name: 'Thứ 7', label: 'Thứ 7', isWork: false },
        { key: 'sun', code: 'CN', name: 'Chủ Nhật', label: 'Chủ Nhật', isWork: false }
      ];
    }
    res.json({
      workCalendar: {
        zone: 'Asia/Ho_Chi_Minh',
        morningStart: wh.morning_start || '08:00',
        morningEnd: wh.morning_end || '12:00',
        afternoonStart: wh.afternoon_start || '13:30',
        afternoonEnd: wh.afternoon_end || '17:30'
      },
      weekDays: weekDays
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put(['/api/working-time', '/api/working-hours'], async (req, res) => {
  try {
    const { workCalendar, weekDays, morningStart, morningEnd, afternoonStart, afternoonEnd } = req.body;
    const mStart = (workCalendar && workCalendar.morningStart) || morningStart || '08:00';
    const mEnd = (workCalendar && workCalendar.morningEnd) || morningEnd || '12:00';
    const aStart = (workCalendar && workCalendar.afternoonStart) || afternoonStart || '13:30';
    const aEnd = (workCalendar && workCalendar.afternoonEnd) || afternoonEnd || '17:30';
    const wDays = weekDays || [];
    const activeDayCodes = wDays.filter(d => d.isWork).map(d => d.key || d.code || d.label);

    await run(`
      INSERT INTO WorkingHours (id, space_id, morning_start, morning_end, afternoon_start, afternoon_end, working_days, week_days_json, updated_at)
      VALUES ('DEFAULT', 'SPC-1793153879989', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (id) DO UPDATE SET
        morning_start = EXCLUDED.morning_start,
        morning_end = EXCLUDED.morning_end,
        afternoon_start = EXCLUDED.afternoon_start,
        afternoon_end = EXCLUDED.afternoon_end,
        working_days = EXCLUDED.working_days,
        week_days_json = EXCLUDED.week_days_json,
        updated_at = CURRENT_TIMESTAMP
    `, [mStart, mEnd, aStart, aEnd, JSON.stringify(activeDayCodes), JSON.stringify(wDays)]);

    res.json({ success: true, message: 'Cấu hình thời gian làm việc đã được lưu vào cơ sở dữ liệu.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/holidays', async (req, res) => {
  try {
    const holidays = await all('SELECT * FROM Holidays ORDER BY start_date ASC');
    res.json(holidays.map(h => ({
      id: h.id,
      name: h.name,
      startDate: h.start_date,
      endDate: h.end_date,
      start_date: h.start_date,
      end_date: h.end_date,
      daysCount: h.days_count,
      days_count: h.days_count,
      isActive: !!h.is_active,
      is_active: !!h.is_active,
      note: h.note
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/holidays', async (req, res) => {
  try {
    const { holidays } = req.body;
    if (Array.isArray(holidays)) {
      for (const h of holidays) {
        const id = h.id || `HL-${Date.now()}`;
        const startDate = h.startDate || h.start_date;
        const endDate = h.endDate || h.end_date;
        const daysCount = h.daysCount || h.days_count || 1;
        const isActive = h.isActive !== undefined ? (h.isActive ? true : false) : (h.is_active ? true : false);
        await run(`
          INSERT INTO Holidays (id, space_id, name, start_date, end_date, days_count, is_active, note, updated_at)
          VALUES (?, 'SPC-1793153879989', ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            start_date = EXCLUDED.start_date,
            end_date = EXCLUDED.end_date,
            days_count = EXCLUDED.days_count,
            is_active = EXCLUDED.is_active,
            note = EXCLUDED.note,
            updated_at = CURRENT_TIMESTAMP
        `, [id, h.name, startDate, endDate, daysCount, isActive, h.note || '']);
      }
    }
    res.json({ success: true, message: 'Danh sách ngày nghỉ lễ đã được cập nhật vào cơ sở dữ liệu.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.put('/api/holidays/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const { name, startDate, endDate, start_date, end_date, daysCount, days_count, isActive, is_active, note } = req.body;
    const sDate = startDate || start_date;
    const eDate = endDate || end_date;
    const dCount = daysCount !== undefined ? daysCount : days_count;
    const active = isActive !== undefined ? (isActive ? true : false) : (is_active !== undefined ? (is_active ? true : false) : null);

    await run(`
      UPDATE Holidays SET
        name = COALESCE(?, name),
        start_date = COALESCE(?, start_date),
        end_date = COALESCE(?, end_date),
        days_count = COALESCE(?, days_count),
        is_active = COALESCE(?, is_active),
        note = COALESCE(?, note),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `, [name, sDate, eDate, dCount, active, note, id]);

    res.json({ success: true, message: `Ngày nghỉ lễ [${id}] đã được cập nhật.` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4.3. Activepieces Key Result Metric Update / Overwrite Endpoint
const handleKrMetricUpdate = async (req, res) => {
  try {
    const krId = req.params.id;
    const { current_value, currentValue, period, event_key, actor_id, reason, source, numerator, denominator, on_time, duration_minutes, comment, note, author, run_id, flow_code } = req.body;
    
    const targetValue = current_value !== undefined ? current_value : currentValue;
    if (targetValue === undefined || targetValue === null || isNaN(parseFloat(targetValue))) {
      return res.status(400).json({ error: 'Missing or invalid numeric field current_value' });
    }

    const result = await recalculateOkrProgress(krId, parseFloat(targetValue), {
      period,
      event_key,
      actor_id,
      reason,
      source,
      numerator,
      denominator,
      on_time,
      duration_minutes,
      comment,
      note,
      author,
      run_id,
      flow_code
    });

    res.json({
      success: true,
      message: `Đã cập nhật giá trị current_value = ${targetValue} cho KeyResult [${krId}] và đồng bộ tiến độ toàn bộ cây OKR.`,
      data: result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

app.patch('/api/key-results/:id/current-value', handleKrMetricUpdate);
app.put('/api/key-results/:id/current-value', handleKrMetricUpdate);
app.post('/api/key-results/:id/metric-update', handleKrMetricUpdate);

// ==========================================
// 4.4. Comments APIs (Bình luận / Ghi chú Check-in)
// ==========================================
app.get('/api/comments', async (req, res) => {
  try {
    const { objective_id, kr_id } = req.query;
    let query = 'SELECT * FROM Comments';
    const params = [];
    const conditions = [];

    if (objective_id) {
      conditions.push('(objective_id = ? OR kr_id IN (SELECT kr_id FROM KeyResults WHERE objective_id = ?))');
      params.push(objective_id, objective_id);
    }
    if (kr_id) {
      conditions.push('kr_id = ?');
      params.push(kr_id);
    }

    if (conditions.length > 0) {
      query += ` WHERE ${conditions.join(' AND ')}`;
    }
    query += ' ORDER BY created_at DESC';

    const comments = await all(query, params);
    res.json(comments);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/comments', async (req, res) => {
  try {
    const { objective_id, kr_id, content, author, author_id, author_avatar, source } = req.body;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Nội dung bình luận không được để trống' });
    }

    let finalAuthor = author || 'Người dùng';
    let finalAvatar = author_avatar;
    if (author_id) {
      const emp = await get('SELECT full_name FROM Employees WHERE employee_id = ?', [author_id]);
      if (emp) {
        finalAuthor = emp.full_name;
        if (!finalAvatar) {
          finalAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(emp.full_name)}&background=3157D5&color=fff`;
        }
      }
    }

    let targetObjId = objective_id;
    if (!targetObjId && kr_id) {
      const kr = await get('SELECT objective_id FROM KeyResults WHERE kr_id = ?', [kr_id]);
      if (kr) targetObjId = kr.objective_id;
    }

    const result = await run(`
      INSERT INTO Comments (objective_id, kr_id, author, author_id, author_avatar, content, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      RETURNING *
    `, [
      targetObjId || null,
      kr_id || null,
      finalAuthor,
      author_id || null,
      finalAvatar || null,
      content.trim(),
      source || 'web_user'
    ]);

    const created = result.rows && result.rows.length > 0 ? result.rows[0] : null;
    res.status(201).json({
      success: true,
      message: 'Đã lưu bình luận thành công',
      comment: created
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/comments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await run('DELETE FROM Comments WHERE comment_id = ?', [id]);
    res.json({ success: true, message: 'Đã xóa bình luận' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 5. Employees Endpoint
app.get('/api/employees', async (req, res) => {
  try {
    const employees = await all('SELECT * FROM Employees');
    res.json(employees);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 6. GitLab Events Endpoint (Page 4: GitLab Data)
app.get('/api/gitlab-events', async (req, res) => {
  try {
    const events = await all('SELECT * FROM GitLabEvents ORDER BY event_time DESC');
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 7. Audit Logs Endpoint (Page 5: AuditLog)
app.get('/api/audit-logs', async (req, res) => {
  try {
    const logs = await all(`
      SELECT 
        ea.assignment_id,
        ea.event_key,
        ea.kr_id,
        kr.title as kr_title,
        ea.employee_id,
        e.full_name as employee_name,
        e.gitlab_user_id,
        ea.included,
        ea.reason,
        ea.duration_minutes,
        ea.on_time,
        ea.created_at,
        ge.project_code,
        ge.object_kind,
        ge.action,
        ge.event_time
      FROM EventAssignments ea
      LEFT JOIN KeyResults kr ON ea.kr_id = kr.kr_id
      LEFT JOIN Employees e ON ea.employee_id = e.employee_id
      LEFT JOIN GitLabEvents ge ON ea.event_key = ge.event_key
      ORDER BY ea.created_at DESC
    `);
    
    const processingLogs = await all('SELECT * FROM ProcessingLogs ORDER BY start_time DESC LIMIT 50');

    // Fetch system changes from AuditLogs (Ghi lại sự thay đổi của hệ thống: Giá trị C, Target, Tên, Luật đo lường)
    const systemChanges = await all(`
      SELECT 
        al.log_id,
        COALESCE(al.target_entity, CASE WHEN al.kr_id IS NOT NULL THEN '[' || al.kr_id || '] ' || COALESCE(kr.title, '') ELSE COALESCE(obj.title, '') END) as target_entity,
        al.kr_id,
        kr.title as kr_title,
        al.objective_id,
        obj.title as objective_title,
        COALESCE(al.actor, CASE WHEN al.author = 'bot' THEN 'Syrix Task' ELSE al.author END) as actor,
        al.author,
        al.author_avatar,
        al.field_name,
        al.old_value,
        al.new_value,
        al.new_value_avatar,
        al.source,
        al.reason,
        al.created_at
      FROM AuditLogs al
      LEFT JOIN KeyResults kr ON al.kr_id = kr.kr_id
      LEFT JOIN Objectives obj ON al.objective_id = obj.objective_id
      ORDER BY al.created_at DESC
      LIMIT 100
    `);

    res.json({
      system_changes: systemChanges || [],
      assignments: logs,
      processing_logs: processingLogs
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Get Flow Runs & Flow Summaries
app.get('/api/flow-runs', async (req, res) => {
  try {
    const { flow_code } = req.query;
    
    // 1. Dynamically fetch Flow Specs from MeasurementRules joined with KeyResults (Team level KRs)
    const teamKrs = await all(`
      SELECT 
        k.kr_id,
        k.title as kr_title,
        k.objective_id,
        o.title as objective_title,
        r.rule_id,
        COALESCE(r.flow_code, 'FLOW-' || k.kr_id) as flow_code,
        COALESCE(r.flow_name, 'Activepieces Flow (' || k.kr_id || ')') as flow_name,
        COALESCE(r.flow_url, 'https://cloud.activepieces.com/flows/' || LOWER(COALESCE(r.flow_code, k.kr_id))) as flow_url,
        COALESCE(r.event_type, 'GitLab Event') as event_type,
        r.sla_value,
        r.formula
      FROM KeyResults k
      JOIN Objectives o ON k.objective_id = o.objective_id
      LEFT JOIN MeasurementRules r ON (r.kr_id = k.kr_id)
      WHERE k.parent_kr_id IS NULL AND (UPPER(o.level) = 'TEAM' OR o.level IS NULL)
      ORDER BY k.kr_id ASC
    `);

    // Target the core team KRs (KR-A1, KR-B1, KR-C1)
    const activeTeamKrs = teamKrs.filter(tk => tk.kr_id === 'KR-A1' || tk.kr_id === 'KR-B1' || tk.kr_id === 'KR-C1');
    const targetSpecs = activeTeamKrs.length > 0 ? activeTeamKrs : teamKrs.slice(0, 3);

    const flowSpecs = targetSpecs.map(tk => {
      let triggerType = 'Schedule (09:00 hàng ngày T2-T6)';
      if (tk.kr_id === 'KR-B1') triggerType = 'GitLab Webhook (MR Assigned/Approved)';
      if (tk.kr_id === 'KR-C1') triggerType = 'GitLab Webhook (Issue Bug Closed)';

      // Normalize flow_code to match FlowRuns table (e.g. FLOW-KR-A1)
      let canonicalFlowCode = tk.flow_code;
      if (canonicalFlowCode.includes('-M10')) canonicalFlowCode = canonicalFlowCode.replace('-M10', '');
      if (canonicalFlowCode.includes('-M11')) canonicalFlowCode = canonicalFlowCode.replace('-M11', '');
      if (canonicalFlowCode.includes('-M12')) canonicalFlowCode = canonicalFlowCode.replace('-M12', '');

      return {
        flow_code: canonicalFlowCode,
        flow_name: tk.flow_name,
        kr_id: tk.kr_id,
        kr_title: tk.kr_title,
        trigger_type: triggerType,
        description: tk.formula || `Quy tắc đo lường tự động qua Activepieces cho ${tk.kr_id}`
      };
    });

    // 2. Fetch all runs
    const allRunsRaw = await all('SELECT * FROM FlowRuns ORDER BY start_time DESC');
    const allRuns = allRunsRaw.map(r => {
      if (!r.payload_json) {
        return {
          ...r,
          payload_json: JSON.stringify({
            session_info: {
              run_id: r.run_id,
              flow_code: r.flow_code,
              flow_name: r.flow_name,
              scan_time: r.start_time,
              trigger_type: r.trigger_type,
              execution_status: r.status
            },
            summary_metrics: {
              impact: r.data_created || 'Đồng bộ kết quả đo lường tự động vào Key Results.',
              input_count: r.input_count,
              output_count: r.output_count
            }
          }, null, 2)
        };
      }
      return r;
    });
    
    // 3. Compute summaries per flow
    const flows = flowSpecs.map(spec => {
      const specRuns = allRuns.filter(r => r.flow_code === spec.flow_code || r.flow_code.startsWith(spec.flow_code));
      const totalRuns = specRuns.length;
      const successRuns = specRuns.filter(r => r.status === 'SUCCESS').length;
      const successRate = totalRuns > 0 ? parseFloat(((successRuns / totalRuns) * 100).toFixed(1)) : 100;
      const lastRun = specRuns.length > 0 ? specRuns[0] : null;

      return {
        ...spec,
        status: 'active',
        total_runs: totalRuns,
        success_runs: successRuns,
        success_rate: successRate,
        last_run_time: lastRun ? lastRun.start_time : 'Chưa có',
        last_status: lastRun ? lastRun.status : 'NONE',
        last_impact: lastRun ? lastRun.data_created : 'Chưa chạy lần nào'
      };
    });

    // Filter runs if flow_code specified
    let filteredRuns = allRuns;
    if (flow_code && flow_code !== 'all') {
      filteredRuns = allRuns.filter(r => r.flow_code === flow_code || r.flow_code.startsWith(flow_code));
    }

    res.json({
      flows,
      runs: filteredRuns
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Record a Flow Run (Dành cho Activepieces Flow hoặc hệ thống tự động ghi nhật ký lần chạy)
app.post('/api/flow-runs', async (req, res) => {
  try {
    const {
      run_id,
      flow_code,
      flow_name,
      trigger_type,
      start_time,
      end_time,
      duration_ms,
      status,
      input_count,
      output_count,
      data_created,
      payload_json,
      error_message
    } = req.body;

    const id = run_id || `RUN-${Date.now()}`;
    const nowIso = new Date().toISOString().replace('T', ' ').substring(0, 19);

    let finalPayloadJson = typeof payload_json === 'object' ? JSON.stringify(payload_json, null, 2) : (payload_json || null);
    if (!finalPayloadJson) {
      finalPayloadJson = JSON.stringify({
        session_info: {
          run_id: id,
          flow_code: flow_code || 'FLOW-CUSTOM',
          flow_name: flow_name || 'Activepieces Automation Flow',
          scan_time: start_time || nowIso,
          trigger_type: trigger_type || 'Schedule',
          execution_status: status || 'SUCCESS'
        },
        summary_metrics: {
          impact: data_created || 'Dữ liệu đo lường đã được đồng bộ tự động vào Key Results.',
          input_count: input_count || 0,
          output_count: output_count || 0
        }
      }, null, 2);
    }

    await run(`
      INSERT INTO FlowRuns (
        run_id, flow_code, flow_name, trigger_type, start_time, end_time,
        duration_ms, status, input_count, output_count, data_created, payload_json, error_message, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (run_id) DO UPDATE SET
        status = EXCLUDED.status,
        end_time = EXCLUDED.end_time,
        duration_ms = EXCLUDED.duration_ms,
        input_count = EXCLUDED.input_count,
        output_count = EXCLUDED.output_count,
        data_created = EXCLUDED.data_created,
        payload_json = COALESCE(EXCLUDED.payload_json, FlowRuns.payload_json),
        error_message = EXCLUDED.error_message
    `, [
      id,
      flow_code || 'FLOW-CUSTOM',
      flow_name || 'Activepieces Automation Flow',
      trigger_type || 'Schedule',
      start_time || nowIso,
      end_time || nowIso,
      duration_ms || 0,
      status || 'SUCCESS',
      input_count || 0,
      output_count || 0,
      data_created || null,
      finalPayloadJson,
      error_message || null
    ]);

    const created = await get('SELECT * FROM FlowRuns WHERE run_id = ?', [id]);
    res.status(201).json({ success: true, run: created });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Simulate Trigger a Flow Run
app.post('/api/flow-runs/simulate', async (req, res) => {
  try {
    const { flow_code } = req.body;
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const timeStr = `${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
    const runId = `RUN-${timeStr}`;

    const startTime = now.toISOString().replace('T', ' ').substring(0, 19);
    const endTime = new Date(now.getTime() + 1850).toISOString().replace('T', ' ').substring(0, 19);

    let flowName = 'Activepieces Automation Flow';
    // Dynamic flow_name from MeasurementRules
    const targetRule = await get('SELECT flow_name FROM MeasurementRules WHERE flow_code = ? OR flow_code LIKE ? OR kr_id = ?', [flow_code, `${flow_code}%`, flow_code.replace('FLOW-', '')]);
    if (targetRule && targetRule.flow_name) {
      flowName = targetRule.flow_name;
    }

    let triggerType = 'Schedule';
    let inputCount = 10;
    let outputCount = 5;
    let dataCreated = '';
    let payload = {};

    if (flow_code === 'FLOW-KR-A1') {
      flowName = 'Activepieces SLA Issue Tracker (KR-A1)';
      triggerType = 'Schedule';
      inputCount = 15;
      outputCount = 5;
      
      const krA1 = await get("SELECT * FROM KeyResults WHERE kr_id = 'KR-A1'");
      let newVal = krA1 ? Math.min(98, parseFloat((krA1.current_value + (Math.random() > 0.5 ? 0.3 : -0.2)).toFixed(1))) : 92.0;

      dataCreated = `Quét 15 issues GitLab, tính tỷ lệ hoàn thành đúng hạn của 5 thành viên (Ni/Di). Cập nhật Team KR-A1 đạt ${newVal}%.`;

      // Update Team KR-A1
      await recalculateOkrProgress('KR-A1', newVal, {
        author: 'bot',
        source: 'activepieces',
        run_id: runId,
        flow_code: flow_code,
        note: dataCreated
      });

      // Update 5 child personal KRs under KR-A1
      const childKrsA1 = await all("SELECT * FROM KeyResults WHERE parent_kr_id = 'KR-A1'");
      const memberResults = [];
      for (const ckr of childKrsA1) {
        let childVal = Math.min(98, Math.max(85, parseFloat((ckr.current_value + (Math.random() > 0.5 ? 0.3 : -0.2)).toFixed(1))));
        const empName = ckr.title.includes(' - ') ? ckr.title.split(' - ').pop().trim() : ckr.assignee_id;
        const memberNote = `Kịch bản ${flow_code} quét Issue GitLab: Thành viên ${empName} đạt tỷ lệ đúng hạn ${childVal}%.`;
        await recalculateOkrProgress(ckr.kr_id, childVal, {
          author: 'bot',
          source: 'activepieces',
          run_id: runId,
          flow_code: flow_code,
          note: memberNote
        });
        memberResults.push({
          kr_id: ckr.kr_id,
          employee: empName,
          assignee_id: ckr.assignee_id,
          Ni: Math.floor(childVal * 0.25),
          Di: 25,
          IC_i: childVal,
          status: 'ON_TIME'
        });
      }

      payload = {
        session_info: {
          run_id: runId,
          flow_code: flow_code,
          flow_name: flowName,
          scan_time: startTime,
          trigger_type: triggerType,
          execution_status: 'SUCCESS'
        },
        config_snapshot: {
          working_calendar: {
            timezone: 'Asia/Ho_Chi_Minh',
            working_hours: '08:00 - 12:00, 13:30 - 17:30',
            lunch_break_minutes: 90,
            freeze_weekends: true
          },
          sla_criteria: {
            target_branches: ['main', 'develop'],
            valid_issue_types: ['Story', 'Task', 'Improvement'],
            due_date_baseline: 'APPROVED_REVISED',
            weight_method: 'Story Point',
            sla_target_threshold_percent: 90
          }
        },
        summary_metrics: {
          total_gitlab_issues_scanned: 15,
          total_issues_due_in_period: 15,
          total_story_points_due: 38,
          ontime_issues_count: 14,
          ontime_story_points: 35,
          late_issues_count: 1,
          late_story_points: 3,
          team_sla_score_percent: newVal,
          sla_evaluation: newVal >= 90 ? 'ĐẠT CHUẨN (PASS)' : 'CẦN CẢI THIỆN',
          individual_breakdown: memberResults.map(m => ({
            emp_id: m.assignee_id || 'DEV',
            name: m.employee,
            due_issues: m.Di || 25,
            due_sp: 10,
            ontime_issues: m.Ni || 23,
            ontime_sp: 9,
            late_issues: Math.max(0, (m.Di || 25) - (m.Ni || 23)),
            late_sp: 1,
            ic_percent: m.IC_i || m.new_value,
            status: m.status || 'PASS'
          }))
        },
        source_records: [
          { issue_iid: 101, title: 'Phát triển module xác thực OAuth2', assignee: 'huyennn23406', story_point: 5, due_date: startTime.substring(0, 10), resolved_at: startTime, duration_hours: 6.5, sla_status: 'ON_TIME' },
          { issue_iid: 102, title: 'Tối ưu hóa truy vấn Cây OKR', assignee: 'AlexanderNguyen26', story_point: 5, due_date: startTime.substring(0, 10), resolved_at: startTime, duration_hours: 7.2, sla_status: 'ON_TIME' },
          { issue_iid: 103, title: 'Sửa lỗi giao diện CSS trên mobile', assignee: 'LeThaiAn', story_point: 2, due_date: startTime.substring(0, 10), resolved_at: startTime, duration_hours: 8.5, sla_status: 'ON_TIME' }
        ],
        member_results: memberResults
      };
    } else if (flow_code === 'FLOW-KR-B1') {
      flowName = 'Activepieces MR Review SLA Tracker (KR-B1)';
      triggerType = 'Webhook';
      inputCount = 1;
      outputCount = 1;

      const krB1 = await get("SELECT * FROM KeyResults WHERE kr_id = 'KR-B1'");
      let newVal = krB1 ? Math.min(99, parseFloat((krB1.current_value + (Math.random() > 0.5 ? 0.2 : -0.1)).toFixed(1))) : 94.5;
      const mrNum = Math.floor(Math.random() * 40) + 50;

      const childKrsB1 = await all("SELECT * FROM KeyResults WHERE parent_kr_id = 'KR-B1'");
      const memberResults = [];
      let reviewerName = 'Huyền Nguyễn Như';

      if (childKrsB1.length > 0) {
        for (const ckr of childKrsB1) {
          let childVal = Math.min(99, Math.max(88, parseFloat((ckr.current_value + (Math.random() > 0.5 ? 0.2 : -0.1)).toFixed(1))));
          const empName = ckr.title.includes(' - ') ? ckr.title.split(' - ').pop().trim() : ckr.assignee_id;
          const memberNote = `Kịch bản ${flow_code}: Rà soát MR !${mrNum} phản hồi sau 2.2h làm việc (Đạt SLA 4h). Tỷ lệ phản hồi đúng hạn của ${empName} đạt ${childVal}%.`;
          await recalculateOkrProgress(ckr.kr_id, childVal, {
            author: 'bot',
            source: 'activepieces',
            run_id: runId,
            flow_code: flow_code,
            note: memberNote
          });
          memberResults.push({
            kr_id: ckr.kr_id,
            employee: empName,
            working_hours_spent: 2.2,
            sla_limit_hours: 4.0,
            new_value: childVal,
            status: 'ON_TIME'
          });
        }
        reviewerName = memberResults[0].employee;
      }

      dataCreated = `Xử lý MR !${mrNum} do ${reviewerName} phản hồi sau 2.2h làm việc (Đạt SLA 4h). Ghi nhận EventAssignment. Cập nhật KR-B1 đạt ${newVal}%.`;

      await recalculateOkrProgress('KR-B1', newVal, {
        author: 'bot',
        source: 'activepieces',
        run_id: runId,
        flow_code: flow_code,
        note: dataCreated
      });

      payload = {
        session_info: {
          run_id: runId,
          flow_code: flow_code,
          flow_name: flowName,
          scan_time: startTime,
          trigger_type: triggerType,
          execution_status: 'SUCCESS'
        },
        config_snapshot: {
          working_calendar: {
            timezone: 'Asia/Ho_Chi_Minh',
            working_hours: '08:00 - 12:00, 13:30 - 17:30',
            lunch_break_minutes: 90,
            freeze_weekends: true
          },
          sla_criteria: {
            event_trigger: 'reviewer_assigned',
            event_target: 'approved',
            sla_limit_hours: 4.0,
            sla_target_threshold_percent: 90
          }
        },
        summary_metrics: {
          total_merge_requests_reviewed: 1,
          ontime_reviews_count: 1,
          late_reviews_count: 0,
          team_review_sla_percent: newVal,
          sla_evaluation: newVal >= 90 ? 'ĐẠT CHUẨN (PASS)' : 'CẦN CẢI THIỆN',
          individual_breakdown: memberResults.map(m => ({
            emp_id: m.kr_id,
            name: m.employee,
            reviews: 1,
            ontime: 1,
            late: 0,
            avg_response_hours: m.working_hours_spent || 2.2,
            status: m.status || 'PASS'
          }))
        },
        source_records: [
          { mr_iid: `!${mrNum}`, title: `Code Review MR !${mrNum}`, reviewer: reviewerName, response_hours: 2.2, sla_hours: 4.0, on_time: true }
        ],
        member_results: memberResults
      };
    } else {
      flowName = 'Activepieces MTTR Bug Resolution Tracker (KR-C1)';
      triggerType = 'Webhook';
      inputCount = 1;
      outputCount = 1;

      const krC1 = await get("SELECT * FROM KeyResults WHERE kr_id = 'KR-C1'");
      let newVal = krC1 ? Math.max(4.0, parseFloat((krC1.current_value + (Math.random() > 0.5 ? -0.1 : 0.1)).toFixed(1))) : 6.2;
      const bugNum = Math.floor(Math.random() * 50) + 100;

      const childKrsC1 = await all("SELECT * FROM KeyResults WHERE parent_kr_id = 'KR-C1'");
      const memberResults = [];
      let devName = 'Tran Than';

      if (childKrsC1.length > 0) {
        for (const ckr of childKrsC1) {
          let childVal = Math.max(3.8, parseFloat((ckr.current_value + (Math.random() > 0.5 ? -0.1 : 0.1)).toFixed(1)));
          const empName = ckr.title.includes(' - ') ? ckr.title.split(' - ').pop().trim() : ckr.assignee_id;
          const memberNote = `Kịch bản ${flow_code}: Khắc phục sự cố Bug #${bugNum} trong 5.5h làm việc (Đạt SLA 8.0h). MTTR của ${empName} đạt ${childVal} giờ.`;
          await recalculateOkrProgress(ckr.kr_id, childVal, {
            author: 'bot',
            source: 'activepieces',
            run_id: runId,
            flow_code: flow_code,
            note: memberNote
          });
          memberResults.push({
            kr_id: ckr.kr_id,
            employee: empName,
            resolve_time_hours: 5.5,
            sla_hours: 8.0,
            new_value: childVal,
            status: 'ON_TIME'
          });
        }
        devName = memberResults[0].employee;
      }

      dataCreated = `Khắc phục Bug P2 #${bugNum} do ${devName} xử lý trong 5.5h làm việc (Đạt SLA 8.0h). Cập nhật MTTR KR-C1 đạt ${newVal} giờ.`;

      await recalculateOkrProgress('KR-C1', newVal, {
        author: 'bot',
        source: 'activepieces',
        run_id: runId,
        flow_code: flow_code,
        note: dataCreated
      });

      payload = {
        session_info: {
          run_id: runId,
          flow_code: flow_code,
          flow_name: flowName,
          scan_time: startTime,
          trigger_type: triggerType,
          execution_status: 'SUCCESS'
        },
        config_snapshot: {
          working_calendar: {
            timezone: 'Asia/Ho_Chi_Minh',
            working_hours: '08:00 - 12:00, 13:30 - 17:30',
            lunch_break_minutes: 90,
            freeze_weekends: true
          },
          sla_criteria: {
            severity_levels: ['P1', 'P2', 'P3', 'P4'],
            sla_hours_p1: 4.0,
            sla_hours_p2_p3: 8.0,
            target_mttr_hours: 8.0
          }
        },
        summary_metrics: {
          total_bugs_resolved: 1,
          avg_mttr_hours: newVal,
          target_mttr_hours: 8.0,
          sla_evaluation: newVal <= 8.0 ? 'ĐẠT CHUẨN (PASS)' : 'VƯỢT NGƯỠNG SLA',
          individual_breakdown: memberResults.map(m => ({
            emp_id: m.kr_id,
            name: m.employee,
            bugs_fixed: 1,
            mttr_hours: m.resolve_time_hours || 5.5,
            sla_status: m.status || 'PASS'
          }))
        },
        source_records: [
          { issue_iid: `#${bugNum}`, title: `Khắc phục sự cố Bug #${bugNum}`, developer: devName, severity: 'P2', resolve_time_hours: 5.5, sla_limit_hours: 8.0, on_time: true }
        ],
        member_results: memberResults
      };
    }

    await run(`
      INSERT INTO FlowRuns (run_id, flow_code, flow_name, trigger_type, start_time, end_time, duration_ms, status, input_count, output_count, data_created, payload_json)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'SUCCESS', ?, ?, ?, ?)
    `, [runId, flow_code || 'FLOW-KR-A1', flowName, triggerType, startTime, endTime, 1850, inputCount, outputCount, dataCreated, JSON.stringify(payload, null, 2)]);

    const createdRun = await get('SELECT * FROM FlowRuns WHERE run_id = ?', [runId]);
    res.json({ success: true, run: createdRun });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Endpoint: Delete a Flow Run
app.delete('/api/flow-runs/:runId', async (req, res) => {
  try {
    const { runId } = req.params;
    await run('DELETE FROM FlowRuns WHERE run_id = ?', [runId]);
    res.json({ success: true, message: `Đã xóa lần chạy ${runId}` });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 8. Simulate Payload Endpoint (For quick testing without Activepieces running)
app.post('/api/simulate-event', async (req, res) => {
  try {
    const { object_kind, action, title, actor, duration_hours, is_bug } = req.body;
    
    const eventId = Math.floor(Math.random() * 900) + 100;
    const now = new Date();
    const createdTime = new Date(now.getTime() - (duration_hours || 2) * 3600 * 1000).toISOString();

    const mockPayload = {
      project_code: 'PROJ-CORE',
      object_kind: object_kind || 'merge_request',
      object_id: eventId,
      action: action || (object_kind === 'issue' ? 'close' : 'approval'),
      actor_id: actor || 'sarah.reviewer',
      event_time: now.toISOString(),
      created_at: createdTime,
      labels: is_bug ? ['bug'] : ['feature'],
      title: title || `Test ${object_kind} event #${eventId}`
    };

    const result = await processGitLabEvent(mockPayload);
    res.json({ success: true, payload: mockPayload, result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 9. Reset / Seed Endpoint
app.post('/api/seed', async (req, res) => {
  try {
    await run('DELETE FROM EventAssignments');
    await run('DELETE FROM GitLabEvents');
    await run('DELETE FROM MetricResults');
    await run('DELETE FROM ProcessingLogs');
    await run('DELETE FROM KeyResults');
    await run('DELETE FROM MeasurementRules');
    await run('DELETE FROM Objectives');
    await run('DELETE FROM Employees');
    
    await seedInitialData();
    res.json({ success: true, message: 'Dữ liệu thử nghiệm đã được khởi tạo lại từ đầu.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// SETTINGS API ENDPOINTS
// ==========================================

// Spaces
app.get('/api/settings/spaces', async (req, res) => {
  try {
    const data = await all('SELECT * FROM Spaces ORDER BY created_at DESC');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/settings/spaces', async (req, res) => {
  try {
    const { id, name, space_key, manager_id } = req.body;
    const newId = id || 'SPC-' + Date.now();
    await run('INSERT INTO Spaces (id, name, space_key, manager_id) VALUES (?, ?, ?, ?)', [newId, name, space_key, manager_id || null]);
    res.json({ success: true, id: newId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Timelines
app.get('/api/settings/timelines', async (req, res) => {
  try {
    const data = await all('SELECT * FROM Timelines ORDER BY start_date ASC, id ASC');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/settings/timelines', async (req, res) => {
  try {
    if (req.body.items && Array.isArray(req.body.items)) {
      for (const item of req.body.items) {
        const { id, title, start_date, end_date, workspace_id, timeline_category, parent_id, level } = item;
        const newId = id || 'TL-' + Date.now();
        const existing = await get('SELECT id FROM Timelines WHERE id = ?', [newId]);
        if (existing) {
          await run('UPDATE Timelines SET title = ?, start_date = ?, end_date = ?, workspace_id = ?, timeline_category = ?, parent_id = ?, level = ? WHERE id = ?',
            [title, start_date, end_date, workspace_id, timeline_category || 'tree', parent_id || null, level || null, newId]);
        } else {
          await run('INSERT INTO Timelines (id, title, start_date, end_date, workspace_id, timeline_category, parent_id, level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
            [newId, title, start_date, end_date, workspace_id, timeline_category || 'tree', parent_id || null, level || null]);
        }
      }
      return res.json({ success: true, count: req.body.items.length });
    }

    const { id, title, start_date, end_date, workspace_id, timeline_category, parent_id, level } = req.body;
    const newId = id || 'TL-' + Date.now();
    await run('INSERT INTO Timelines (id, title, start_date, end_date, workspace_id, timeline_category, parent_id, level) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', 
      [newId, title, start_date, end_date, workspace_id, timeline_category || 'tree', parent_id || null, level || null]);
    res.json({ success: true, id: newId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Metrics
app.get('/api/metrics', async (req, res) => {
  try {
    const data = await all('SELECT * FROM Metrics ORDER BY id ASC');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/timelines', async (req, res) => {
  try {
    const data = await all('SELECT * FROM Timelines');
    const extractNum = (str) => {
      if (!str) return 0;
      const q = str.match(/q(?:uarter)?\s*(\d+)/i);
      if (q) return parseInt(q[1], 10);
      const m = str.match(/(?:m|month|tháng)\s*(\d+)/i);
      if (m) return parseInt(m[1], 10);
      const w = str.match(/(?:w|week|tuần)\s*(\d+)/i);
      if (w) return parseInt(w[1], 10);
      const gen = str.match(/(\d+)/);
      return gen ? parseInt(gen[1], 10) : 0;
    };
    data.sort((a, b) => {
      const timeA = a.start_date ? new Date(a.start_date).getTime() : NaN;
      const timeB = b.start_date ? new Date(b.start_date).getTime() : NaN;
      if (!isNaN(timeA) && !isNaN(timeB) && timeA !== timeB) return timeA - timeB;
      const numA = extractNum(a.title || a.id);
      const numB = extractNum(b.title || b.id);
      if (numA !== numB) return numA - numB;
      return (a.title || '').localeCompare(b.title || '', undefined, { numeric: true });
    });
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/settings/metrics', async (req, res) => {
  try {
    const data = await all('SELECT * FROM Metrics');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/settings/metrics', async (req, res) => {
  try {
    const { id, name, unit, metric_key, is_percent, description } = req.body;
    const newId = id || 'MET-' + Date.now();
    await run('INSERT INTO Metrics (id, name, unit, metric_key, is_percent, description) VALUES (?, ?, ?, ?, ?, ?)', 
      [newId, name, unit, metric_key, is_percent ? 1 : 0, description || null]);
    res.json({ success: true, id: newId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Space Members
app.get('/api/settings/space-members', async (req, res) => {
  try {
    const data = await all('SELECT * FROM SpaceMembers');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/settings/space-members', async (req, res) => {
  try {
    const { id, space_id, user_name, email, role, team_name } = req.body;
    const newId = id || 'SM-' + Date.now();
    await run('INSERT INTO SpaceMembers (id, space_id, user_name, email, role, team_name) VALUES (?, ?, ?, ?, ?, ?)', [newId, space_id, user_name, email || null, role, team_name || null]);
    res.json({ success: true, id: newId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Metric Conversions
app.get('/api/settings/conversions', async (req, res) => {
  try {
    const data = await all('SELECT * FROM MetricConversions');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/settings/conversions', async (req, res) => {
  try {
    const { id, source_metric_id, target_metric_id, conversion_ratio } = req.body;
    const newId = id || 'CNV-' + Date.now();
    await run('INSERT INTO MetricConversions (id, source_metric_id, target_metric_id, conversion_ratio) VALUES (?, ?, ?, ?)', 
      [newId, source_metric_id, target_metric_id, conversion_ratio]);
    res.json({ success: true, id: newId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Templates (Progress & Aggregation)
app.get('/api/settings/templates/:type', async (req, res) => {
  try {
    const type = req.params.type.toUpperCase(); // 'PROGRESS' or 'AGGREGATION'
    const data = await all('SELECT * FROM Templates WHERE template_type = ?', [type]);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/settings/templates', async (req, res) => {
  try {
    const { id, name, formula, template_type } = req.body;
    const newId = id || 'TPL-' + Date.now();
    await run('INSERT INTO Templates (id, name, formula, template_type) VALUES (?, ?, ?, ?)', 
      [newId, name, formula, template_type.toUpperCase()]);
    res.json({ success: true, id: newId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// --- EDIT & DELETE ENDPOINTS ---
// Space Edit & Delete
app.put('/api/settings/spaces/:id', async (req, res) => {
  try {
    const { name, space_key, manager_id } = req.body;
    await run('UPDATE Spaces SET name = ?, space_key = ?, manager_id = ? WHERE id = ?', [name, space_key, manager_id || null, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/settings/spaces/:id', async (req, res) => {
  try {
    const spaceId = req.params.id;
    await run('DELETE FROM SpaceMembers WHERE space_id = ?', [spaceId]);
    await run('DELETE FROM Timelines WHERE workspace_id = ?', [spaceId]);
    await run('DELETE FROM KeyResults WHERE space_id = ?', [spaceId]);
    await run('DELETE FROM Objectives WHERE space_id = ?', [spaceId]);
    await run('DELETE FROM Spaces WHERE id = ?', [spaceId]);
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting space:', err);
    res.status(500).json({ error: err.message });
  }
});

// Timeline Edit & Delete
app.put('/api/settings/timelines/:id', async (req, res) => {
  try {
    const { title, start_date, end_date, workspace_id, timeline_category, parent_id, level } = req.body;
    await run('UPDATE Timelines SET title = ?, start_date = ?, end_date = ?, workspace_id = ?, timeline_category = ?, parent_id = ?, level = ? WHERE id = ?',
      [title, start_date, end_date, workspace_id, timeline_category, parent_id || null, level || null, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/settings/timelines/:id', async (req, res) => {
  try {
    await run('DELETE FROM Timelines WHERE parent_id = ?', [req.params.id]);
    await run('DELETE FROM Timelines WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Metric Edit & Delete
app.put('/api/settings/metrics/:id', async (req, res) => {
  try {
    const { name, unit, metric_key, is_percent, description } = req.body;
    await run('UPDATE Metrics SET name = ?, unit = ?, metric_key = ?, is_percent = ?, description = ? WHERE id = ?',
      [name, unit, metric_key, is_percent ? 1 : 0, description || null, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/settings/metrics/:id', async (req, res) => {
  try {
    await run('DELETE FROM Metrics WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Space Member Delete
app.delete('/api/settings/space-members/:id', async (req, res) => {
  try {
    await run('DELETE FROM SpaceMembers WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Conversion Delete
app.delete('/api/settings/conversions/:id', async (req, res) => {
  try {
    await run('DELETE FROM MetricConversions WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Template Edit & Delete
app.put('/api/settings/templates/:id', async (req, res) => {
  try {
    const { name, formula, template_type } = req.body;
    await run('UPDATE Templates SET name = ?, formula = ?, template_type = ? WHERE id = ?',
      [name, formula, template_type.toUpperCase(), req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/settings/templates/:id', async (req, res) => {
  try {
    await run('DELETE FROM Templates WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Teams CRUD
app.get('/api/teams', async (req, res) => {
  try {
    const data = await all('SELECT * FROM Teams ORDER BY created_at DESC');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/teams', async (req, res) => {
  try {
    const { id, name, code } = req.body;
    const newId = id || 'TEAM-' + Date.now();
    const teamCode = code || name.toUpperCase().replace(/\s+/g, '-');
    await run('INSERT INTO Teams (id, name, code, created_at, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', [newId, name, teamCode]);
    res.json({ success: true, id: newId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/teams/:id', async (req, res) => {
  try {
    const { name, code } = req.body;
    const teamCode = code || req.params.id;
    await run('UPDATE Teams SET name = ?, code = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', [name, teamCode, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/teams/:id', async (req, res) => {
  try {
    await run('DELETE FROM Teams WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Roles CRUD
app.get('/api/roles', async (req, res) => {
  try {
    const data = await all(`
      SELECT r.*, t.name as team_name, t.code as team_code 
      FROM Roles r 
      LEFT JOIN Teams t ON r.team_id = t.id OR r.team_id = t.code 
      ORDER BY r.created_at ASC
    `);
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/roles', async (req, res) => {
  try {
    const { id, name, code, description, team_id } = req.body;
    const newId = id || 'ROLE-' + Date.now();
    const roleCode = (code || name.toUpperCase().replace(/\s+/g, '_')).trim();
    await run('INSERT INTO Roles (id, name, code, description, team_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', 
      [newId, name, roleCode, description || '', team_id || null]);
    res.json({ success: true, id: newId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/roles/:id', async (req, res) => {
  try {
    const { name, code, description, team_id } = req.body;
    const roleCode = (code || req.params.id).trim();
    await run('UPDATE Roles SET name = ?, code = ?, description = ?, team_id = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [name, roleCode, description || '', team_id || null, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/roles/:id', async (req, res) => {
  try {
    await run('DELETE FROM Roles WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Employee Edit & Delete
app.put('/api/employees/:id', async (req, res) => {
  try {
    const { full_name, team_id, gitlab_user_id, display_code, status, email, role } = req.body;
    await run('UPDATE Employees SET full_name = ?, team_id = ?, gitlab_user_id = ?, display_code = ?, email = ?, role = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?',
      [full_name, team_id, gitlab_user_id, display_code || role, email, role, status || 'active', req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/employees/:id', async (req, res) => {
  try {
    await run('DELETE FROM Employees WHERE employee_id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Key Results Create, Update & Delete
app.post('/api/key-results', async (req, res) => {
  try {
    const { kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit } = req.body;
    const newId = kr_id || `KR-${Date.now()}`;
    await run(
      `INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [newId, objective_id, metric_id || 'METRIC-01', title, start_value || 0, expected_value || 100, current_value || 0, direction || 'increase', unit || '%']
    );
    res.json({ success: true, kr_id: newId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.put('/api/key-results/:id', async (req, res) => {
  try {
    const { title, start_value, expected_value, current_value, direction, unit, metric_id, description } = req.body;
    const oldKr = await get('SELECT * FROM KeyResults WHERE kr_id = ?', [req.params.id]);

    await run(
      `UPDATE KeyResults SET 
        title = COALESCE(?, title),
        start_value = COALESCE(?, start_value),
        expected_value = COALESCE(?, expected_value),
        current_value = COALESCE(?, current_value),
        direction = COALESCE(?, direction),
        unit = COALESCE(?, unit),
        metric_id = COALESCE(?, metric_id),
        description = COALESCE(?, description)
       WHERE kr_id = ?`,
      [title, start_value, expected_value, current_value, direction, unit, metric_id, description, req.params.id]
    );

    // Record audit log if title, expected_value, or description changed
    if (oldKr) {
      const targetEntity = `[${req.params.id}] ${oldKr.title}`;
      if (title && oldKr.title !== title) {
        await run(`
          INSERT INTO AuditLogs (target_entity, kr_id, actor, author, author_avatar, field_name, old_value, new_value, source, reason, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [targetEntity, req.params.id, 'Huyền Nguyễn Như', 'Huyền Nguyễn Như', 'https://ui-avatars.com/api/?name=Huyen+Nguyen&background=3157D5&color=fff&rounded=true', 'Task Name', oldKr.title, title, 'Admin cập nhật tay', 'Đổi tên Key Result']);
      }
      if (expected_value !== undefined && expected_value !== null && Number(oldKr.expected_value) !== Number(expected_value)) {
        await run(`
          INSERT INTO AuditLogs (target_entity, kr_id, actor, author, author_avatar, field_name, old_value, new_value, source, reason, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [targetEntity, req.params.id, 'Huyền Nguyễn Như', 'Huyền Nguyễn Như', 'https://ui-avatars.com/api/?name=Huyen+Nguyen&background=3157D5&color=fff&rounded=true', 'Expected value', `${oldKr.expected_value} ${oldKr.unit || '%'}`, `${expected_value} ${oldKr.unit || '%'}`, 'Admin cập nhật tay', 'Cập nhật mục tiêu chỉ số (Target)']);
      }
      if (description !== undefined && description !== null && oldKr.description !== description) {
        await run(`
          INSERT INTO AuditLogs (target_entity, kr_id, actor, author, author_avatar, field_name, old_value, new_value, source, reason, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `, [targetEntity, req.params.id, 'Huyền Nguyễn Như', 'Huyền Nguyễn Như', 'https://ui-avatars.com/api/?name=Huyen+Nguyen&background=3157D5&color=fff&rounded=true', 'Description', oldKr.description || 'None', description, 'Admin cập nhật tay', 'Cập nhật mô tả chỉ số']);
      }
    }

    if (current_value !== undefined && current_value !== null && !isNaN(parseFloat(current_value))) {
      await recalculateOkrProgress(req.params.id, parseFloat(current_value));
    }

    res.json({ success: true, message: 'Key Result updated successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/key-results/:id', async (req, res) => {
  try {
    const id = req.params.id;
    await run('DELETE FROM EventAssignments WHERE kr_id = ?', [id]);
    await run('DELETE FROM MetricResults WHERE kr_id = ?', [id]);
    await run('DELETE FROM MeasurementRules WHERE kr_id = ?', [id]);
    await run('DELETE FROM KeyResults WHERE kr_id = ?', [id]);
    res.json({ success: true, message: 'Key Result deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Objective Delete (with full cascade cleanup of dependent KRs and logs)
app.delete('/api/objectives/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const childKrs = await all('SELECT kr_id FROM KeyResults WHERE objective_id = ?', [id]);
    for (const kr of childKrs) {
      await run('DELETE FROM EventAssignments WHERE kr_id = ?', [kr.kr_id]);
      await run('DELETE FROM MetricResults WHERE kr_id = ?', [kr.kr_id]);
      await run('DELETE FROM MeasurementRules WHERE kr_id = ?', [kr.kr_id]);
    }
    await run('DELETE FROM KeyResults WHERE objective_id = ?', [id]);
    await run('UPDATE Objectives SET parent_id = NULL WHERE parent_id = ?', [id]);
    await run('DELETE FROM Objectives WHERE objective_id = ?', [id]);
    res.json({ success: true, message: 'Objective deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// GitLab Event Delete
app.delete('/api/gitlab-events/:key', async (req, res) => {
  try {
    const key = req.params.key;
    await run('DELETE FROM EventAssignments WHERE event_key = ?', [key]);
    await run('DELETE FROM GitLabEvents WHERE event_key = ?', [key]);
    res.json({ success: true, message: 'GitLab Event deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Backend Server listening at http://localhost:${PORT}`);
    console.log(`Activepieces Webhook URL: http://localhost:${PORT}/api/webhooks/activepieces`);
  });
}

module.exports = app;
