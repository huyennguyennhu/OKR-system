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
    const { employee_id, display_code, full_name, team_id, gitlab_user_id } = req.body;
    if (!employee_id || !display_code || !full_name || !team_id || !gitlab_user_id) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    await run(
      'INSERT INTO Employees (employee_id, display_code, full_name, team_id, gitlab_user_id, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)',
      [employee_id, display_code, full_name, team_id, gitlab_user_id, 'active']
    );
    res.status(201).json({ message: 'Employee created successfully' });
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

// 2. Objectives Endpoint (with progress calculation)
app.get('/api/objectives', async (req, res) => {
  try {
    const objectives = await all('SELECT * FROM Objectives');
    const keyResults = await all('SELECT * FROM KeyResults');
    
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

// Endpoint: OKR Tree Structure for TreeTable
app.get('/api/okr-tree', async (req, res) => {
  try {
    const objectives = await all('SELECT * FROM Objectives');
    const keyResults = await all('SELECT * FROM KeyResults');
    const employees = await all('SELECT * FROM Employees');
    const rules = await all('SELECT * FROM MeasurementRules');

    // Transform KeyResult to TreeNode
    const mapKrToNode = (kr, parentLevel) => {
      let progress = 0;
      if (kr.direction === 'increase') {
        progress = ((kr.current_value - kr.start_value) / (kr.expected_value - kr.start_value)) * 100;
      } else {
        progress = ((kr.start_value - kr.current_value) / (kr.start_value - kr.expected_value)) * 100;
      }
      progress = Math.min(100, Math.max(0, parseFloat(progress.toFixed(1))));

      const rule = rules.find(r => r.kr_id === kr.kr_id);
      const isInd = parentLevel === 'individual' || parentLevel === 'PERSONAL';
      const type = isInd ? 'ind_kr' : 'team_kr';

      let assignTo = 'Nhóm Kỹ Thuật';
      let assignToAvatar = undefined;
      if (kr.kr_id === 'KR-MR-SLA') {
        assignTo = 'Trần Thị Bình (sarah.reviewer)';
        assignToAvatar = 'https://ui-avatars.com/api/?name=Tran+Thi+Binh&background=3157D5&color=fff';
      } else if (kr.kr_id === 'KR-ISSUE-SLA') {
        assignTo = 'Lê Hoàng Cường (john.coder)';
        assignToAvatar = 'https://ui-avatars.com/api/?name=Le+Hoang+Cuong&background=10b981&color=fff';
      } else if (kr.kr_id === 'KR-BUG-SLA') {
        assignTo = 'Nguyễn Văn Anh (alex.dev)';
        assignToAvatar = 'https://ui-avatars.com/api/?name=Nguyen+Van+Anh&background=f59e0b&color=fff';
      }

      const risk = progress < 50 ? 'danger' : (progress < 75 ? 'warning' : 'none');

      return {
        id: kr.kr_id,
        title: kr.title,
        type,
        progress,
        expanded: false,
        assignTo,
        assignToAvatar,
        metricName: kr.metric_id || 'GitLab SLA',
        metricSub: rule ? `${rule.event_type} <= ${rule.sla_value}h` : (kr.unit || '%'),
        aggType: 'AVG',
        resultS: String(kr.start_value),
        resultC: String(kr.current_value),
        resultE: String(kr.expected_value),
        risk,
        tl: 'Q3-2026',
        children: []
      };
    };

    // Transform Objective to TreeNode
    const mapObjToNode = (obj) => {
      const isCompany = obj.level === 'company' || obj.level === 'COMPANY';
      const isTeam = obj.level === 'team' || obj.level === 'TEAM';
      const type = isCompany ? 'company_obj' : 'team_obj';

      const progress = parseFloat((obj.progress || 0).toFixed(1));
      const risk = progress < 50 ? 'danger' : (progress < 75 ? 'warning' : 'none');

      // Direct child KRs
      const myKrs = keyResults.filter(kr => kr.objective_id === obj.objective_id);
      const krNodes = myKrs.map(kr => mapKrToNode(kr, obj.level));

      // Direct child Objectives
      const childObjs = objectives.filter(o => o.parent_id === obj.objective_id);
      const childObjNodes = childObjs.map(mapObjToNode);

      let assignTo = 'Toàn Công Ty';
      if (isTeam) assignTo = 'BE-Team';
      else if (!isCompany) assignTo = 'Cá nhân';

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
    const objective = await get('SELECT * FROM Objectives WHERE objective_id = $1', [id]);
    if (!objective) {
      return res.status(404).json({ error: 'Objective not found' });
    }

    // Parent Objective
    if (objective.parent_id) {
      const parentObj = await get(`
        SELECT o.*, e.full_name as assignee_name 
        FROM Objectives o 
        LEFT JOIN Employees e ON o.assignee_id = e.employee_id 
        WHERE o.objective_id = $1
      `, [objective.parent_id]);
      objective.parent = parentObj || null;
    } else {
      objective.parent = null;
    }

    // Child Objectives
    const childObjectives = await all(`
      SELECT o.*, e.full_name as assignee_name 
      FROM Objectives o 
      LEFT JOIN Employees e ON o.assignee_id = e.employee_id 
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
    if (objective.assignee_id) {
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
    const { objective_id, parent_id, level, title, timeline_id, progress, description, assignee_id, metric_id, category, start_value, expected_value } = req.body;
    await run(
      `INSERT INTO Objectives 
       (objective_id, parent_id, level, title, timeline_id, progress, description, assignee_id, metric_id, category, start_value, expected_value) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
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
        expected_value || 100
      ]
    );
    res.status(201).json({ success: true, message: 'Created successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Clone Objective or KeyResult
app.post('/api/objectives/:id/clone', async (req, res) => {
  try {
    const { id } = req.params;

    // Check if it's an Objective
    const objective = await get('SELECT * FROM Objectives WHERE objective_id = ?', [id]);
    if (objective) {
      const newObjId = `OBJ-${Date.now().toString().slice(-6)}`;
      const newTitle = `${objective.title} (Bản sao)`;
      await run(
        `INSERT INTO Objectives (objective_id, parent_id, level, title, timeline_id, progress, description, assignee_id, metric_id, category, start_value, expected_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newObjId,
          objective.parent_id,
          objective.level,
          newTitle,
          objective.timeline_id,
          0,
          objective.description,
          objective.assignee_id,
          objective.metric_id,
          objective.category,
          objective.start_value,
          objective.expected_value
        ]
      );

      // Clone child KeyResults if any
      const krs = await all('SELECT * FROM KeyResults WHERE objective_id = ?', [id]);
      for (let i = 0; i < krs.length; i++) {
        const kr = krs[i];
        const newKrId = `KR-${Date.now().toString().slice(-5)}-${i + 1}`;
        await run(
          `INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            newKrId,
            newObjId,
            kr.metric_id,
            `${kr.title} (Bản sao)`,
            kr.start_value,
            kr.expected_value,
            kr.start_value,
            kr.direction,
            kr.unit
          ]
        );
      }

      return res.json({ success: true, new_id: newObjId, message: 'Nhân bản Mục tiêu thành công!' });
    }

    // Check if it's a KeyResult
    const kr = await get('SELECT * FROM KeyResults WHERE kr_id = ?', [id]);
    if (kr) {
      const newKrId = `KR-${Date.now().toString().slice(-6)}`;
      const newTitle = `${kr.title} (Bản sao)`;
      await run(
        `INSERT INTO KeyResults (kr_id, objective_id, metric_id, title, start_value, expected_value, current_value, direction, unit)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          newKrId,
          kr.objective_id,
          kr.metric_id,
          newTitle,
          kr.start_value,
          kr.expected_value,
          kr.start_value,
          kr.direction,
          kr.unit
        ]
      );
      return res.json({ success: true, new_id: newKrId, message: 'Nhân bản Key Result thành công!' });
    }

    return res.status(404).json({ error: 'Không tìm thấy mục tiêu hoặc kết quả then chốt để nhân bản' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put('/api/objectives/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, level, timeline_id, assignee_id, metric_id, category, start_value, expected_value, progress } = req.body;
    await run(
      `UPDATE Objectives SET 
        title = COALESCE($1, title),
        description = COALESCE($2, description),
        level = COALESCE($3, level),
        timeline_id = COALESCE($4, timeline_id),
        assignee_id = COALESCE($5, assignee_id),
        metric_id = COALESCE($6, metric_id),
        category = COALESCE($7, category),
        start_value = COALESCE($8, start_value),
        expected_value = COALESCE($9, expected_value),
        progress = COALESCE($10, progress)
       WHERE objective_id = $11`,
      [title, description, level, timeline_id, assignee_id, metric_id, category, start_value, expected_value, progress, id]
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
      SELECT kr.*, o.title as objective_title, o.level as objective_level 
      FROM KeyResults kr 
      JOIN Objectives o ON kr.objective_id = o.objective_id
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

// 4. Measurement Rules Endpoint
app.get('/api/rules', async (req, res) => {
  try {
    const rules = await all(`
      SELECT r.*, kr.title as kr_title 
      FROM MeasurementRules r 
      JOIN KeyResults kr ON r.kr_id = kr.kr_id
    `);
    res.json(rules);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/rules', async (req, res) => {
  try {
    const { rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version } = req.body;
    await run(`
      INSERT INTO MeasurementRules 
        (rule_id, kr_id, event_type, filters, start_event, end_event, sla_value, formula, version)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT (rule_id) DO UPDATE SET
        kr_id = EXCLUDED.kr_id,
        event_type = EXCLUDED.event_type,
        filters = EXCLUDED.filters,
        start_event = EXCLUDED.start_event,
        end_event = EXCLUDED.end_event,
        sla_value = EXCLUDED.sla_value,
        formula = EXCLUDED.formula,
        version = EXCLUDED.version
    `,
      [rule_id, kr_id, event_type, typeof filters === 'string' ? filters : JSON.stringify(filters || {}), start_event, end_event, sla_value, formula, version || 'v1.0']
    );
    res.json({ success: true, message: 'Quy tắc đo lường đã được lưu.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete('/api/rules/:id', async (req, res) => {
  try {
    await run('DELETE FROM MeasurementRules WHERE rule_id = ?', [req.params.id]);
    res.json({ success: true, message: 'Measurement rule deleted successfully' });
  } catch (err) { res.status(500).json({ error: err.message }); }
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

    res.json({
      assignments: logs,
      processing_logs: processingLogs
    });
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
    const data = await all('SELECT * FROM Timelines');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/settings/timelines', async (req, res) => {
  try {
    const { id, title, start_date, end_date, workspace_id, timeline_category } = req.body;
    const newId = id || 'TL-' + Date.now();
    await run('INSERT INTO Timelines (id, title, start_date, end_date, workspace_id, timeline_category) VALUES (?, ?, ?, ?, ?, ?)', 
      [newId, title, start_date, end_date, workspace_id, timeline_category]);
    res.json({ success: true, id: newId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Metrics
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
    const { id, space_id, user_name, email, role } = req.body;
    const newId = id || 'SM-' + Date.now();
    await run('INSERT INTO SpaceMembers (id, space_id, user_name, email, role) VALUES (?, ?, ?, ?, ?)', 
      [newId, space_id, user_name, email || null, role]);
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
    await run('DELETE FROM Spaces WHERE id = ?', [req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// Timeline Edit & Delete
app.put('/api/settings/timelines/:id', async (req, res) => {
  try {
    const { title, start_date, end_date, workspace_id, timeline_category } = req.body;
    await run('UPDATE Timelines SET title = ?, start_date = ?, end_date = ?, workspace_id = ?, timeline_category = ? WHERE id = ?',
      [title, start_date, end_date, workspace_id, timeline_category, req.params.id]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.delete('/api/settings/timelines/:id', async (req, res) => {
  try {
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
    const data = await all('SELECT * FROM Roles ORDER BY created_at ASC');
    res.json(data);
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.post('/api/roles', async (req, res) => {
  try {
    const { id, name, code, description } = req.body;
    const newId = id || 'ROLE-' + Date.now();
    const roleCode = (code || name.toUpperCase().replace(/\s+/g, '_')).trim();
    await run('INSERT INTO Roles (id, name, code, description, created_at, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)', 
      [newId, name, roleCode, description || '']);
    res.json({ success: true, id: newId });
  } catch (err) { res.status(500).json({ error: err.message }); }
});
app.put('/api/roles/:id', async (req, res) => {
  try {
    const { name, code, description } = req.body;
    const roleCode = (code || req.params.id).trim();
    await run('UPDATE Roles SET name = ?, code = ?, description = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?', 
      [name, roleCode, description || '', req.params.id]);
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
    const { full_name, team_id, gitlab_user_id, display_code, status } = req.body;
    await run('UPDATE Employees SET full_name = ?, team_id = ?, gitlab_user_id = ?, display_code = ?, status = ?, updated_at = CURRENT_TIMESTAMP WHERE employee_id = ?',
      [full_name, team_id, gitlab_user_id, display_code, status || 'active', req.params.id]);
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
    const { title, start_value, expected_value, current_value, direction, unit, metric_id } = req.body;
    await run(
      `UPDATE KeyResults SET 
        title = COALESCE(?, title),
        start_value = COALESCE(?, start_value),
        expected_value = COALESCE(?, expected_value),
        current_value = COALESCE(?, current_value),
        direction = COALESCE(?, direction),
        unit = COALESCE(?, unit),
        metric_id = COALESCE(?, metric_id)
       WHERE kr_id = ?`,
      [title, start_value, expected_value, current_value, direction, unit, metric_id, req.params.id]
    );
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

app.listen(PORT, () => {
  console.log(`Backend Server listening at http://localhost:${PORT}`);
  console.log(`Activepieces Webhook URL: http://localhost:${PORT}/api/webhooks/activepieces`);
});
