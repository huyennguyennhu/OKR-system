const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const db = require('./database.js');

async function main() {
  console.log('=== REAL DATABASE INSPECTION ===');
  
  // 1. Table list
  const tables = await db.all(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name;
  `);
  console.log('Tables:', tables.map(t => t.table_name));

  // 2. Counts and sample data
  const checkTables = [
    'GitLabEvents', 
    'EventAssignments', 
    'MetricResults', 
    'FlowRuns', 
    'ProcessingLogs', 
    'MeasurementRules', 
    'KeyResults', 
    'Objectives', 
    'AuditLogs'
  ];

  for (const t of checkTables) {
    try {
      const c = await db.get(`SELECT count(*) as count FROM "${t}"`);
      console.log(`\nTable [${t}]: count = ${c?.count}`);
      const rows = await db.all(`SELECT * FROM "${t}" ORDER BY 1 DESC LIMIT 3`);
      if (rows && rows.length > 0) {
        console.log(`Sample [${t}] (first 2):`, JSON.stringify(rows.slice(0, 2), null, 2));
      }
    } catch (e) {
      console.log(`Table [${t}] error:`, e.message);
    }
  }

  // 3. Check for any specific mock or real issue keys (#101, !201, #301)
  try {
    const events = await db.all(`SELECT event_key, object_id, object_kind, action, event_time FROM "GitLabEvents" LIMIT 20`);
    console.log('\nGitLabEvents sample keys:', events);
  } catch (e) {
    console.log('GitLabEvents query error:', e.message);
  }

  try {
    const runs = await db.all(`SELECT run_id, flow_id, status, triggered_at FROM "FlowRuns" LIMIT 10`);
    console.log('\nFlowRuns sample:', runs);
  } catch (e) {
    console.log('FlowRuns query error:', e.message);
  }
}

main().then(() => process.exit(0)).catch(e => {
  console.error('Fatal error:', e);
  process.exit(1);
});
