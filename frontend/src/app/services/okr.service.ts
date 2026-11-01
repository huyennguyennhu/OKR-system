import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';


export interface Team {
  id?: string;
  name: string;
  code: string;
  created_at?: string;
  updated_at?: string;
}

export interface Role {
  id?: string;
  name: string;
  code: string;
  description?: string;
  team_id?: string;
  team_name?: string;
  team_code?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Employee {
  employee_id: string;
  display_code: string;
  full_name: string;
  team_id: string;
  gitlab_user_id: string;
  status?: string;
  created_at?: string;
  updated_at?: string;
}

export interface Objective {
  objective_id: string;
  parent_id?: string;
  level: 'PERSONAL' | 'TEAM' | 'COMPANY';
  title: string;
  timeline_id: string;
  progress: number;
  description?: string;
  assignee_id?: string;
  metric_id?: number;
  category?: string;
  start_value?: number;
  expected_value?: number;
  space_id?: string;
  assignee_name?: string;
  team_name?: string;
  key_results?: KeyResult[];
}

export interface Space { id: string; name: string; space_key: string; manager_id: string; created_at?: string; }
export interface Timeline { id: string; title: string; start_date: string; end_date: string; workspace_id: string; timeline_category: string; parent_id?: string | null; level?: string; children?: Timeline[]; }
export interface Metric { id: string; name: string; unit: string; metric_key: string; is_percent: boolean | number; description: string; }
export interface SpaceMember { id: string; space_id: string; user_name: string; email: string; role: string; team_name?: string; }
export interface MetricConversion { id: string; source_metric_id: string; target_metric_id: string; conversion_ratio: number; }
export interface Template { id: string; name: string; formula: string; template_type: string; }

export interface KeyResult {
  kr_id: string;
  objective_id: string;
  metric_id: string;
  title: string;
  start_value: number;
  expected_value: number;
  current_value: number;
  direction: 'increase' | 'decrease';
  unit: string;
  assignee_id?: string;
  progress?: number;
  objective_title?: string;
}

export interface MeasurementRule {
  rule_id: string;
  kr_id: string;
  event_type: string;
  filters: string;
  start_event: string;
  end_event: string;
  sla_value: number;
  formula: string;
  version: string;
  kr_title?: string;
}

export interface GitLabEvent {
  event_key: string;
  project_code: string;
  object_kind: string;
  object_id: number;
  action: string;
  actor_id: string;
  event_time: string;
  payload_hash: string;
  raw_payload: string;
  processing_status: string;
}

export interface FlowSummary {
  flow_code: string;
  flow_name: string;
  kr_id: string;
  kr_title: string;
  trigger_type: string;
  description: string;
  status: string;
  total_runs: number;
  success_runs: number;
  success_rate: number;
  last_run_time: string;
  last_status: string;
  last_impact: string;
}

export interface FlowRun {
  run_id: string;
  flow_code: string;
  flow_name: string;
  trigger_type: string;
  start_time: string;
  end_time: string;
  duration_ms: number;
  status: string;
  input_count: number;
  output_count: number;
  data_created: string;
  payload_json?: string;
  error_message?: string;
  created_at?: string;
}

export interface FlowRunsResponse {
  flows: FlowSummary[];
  runs: FlowRun[];
}

export interface AuditAssignment {
  assignment_id: number;
  event_key: string;
  kr_id: string;
  kr_title: string;
  employee_id: string;
  employee_name: string;
  gitlab_user_id: string;
  included: number;
  reason: string;
  duration_minutes: number;
  on_time: number;
  created_at: string;
  project_code: string;
  object_kind: string;
  action: string;
  event_time: string;
}

export interface AuditLogData {
  assignments: AuditAssignment[];
  processing_logs: any[];
}

@Injectable({
  providedIn: 'root'
})
export class OkrService {
  private get apiUrl(): string {
    if (typeof window !== 'undefined' && window.location && window.location.hostname) {
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        return 'http://localhost:3000/api';
      }
      return '/api';
    }
    return 'http://localhost:3000/api';
  }

  constructor(private http: HttpClient) {}

  getObjectives(spaceId?: string, timelineId?: string): Observable<Objective[]> {
    const params = new URLSearchParams();
    if (spaceId && spaceId !== 'all') params.append('space_id', spaceId);
    if (timelineId && timelineId !== 'all') params.append('timeline_id', timelineId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<Objective[]>(`${this.apiUrl}/objectives${queryString}`);
  }

  getOkrTree(spaceId?: string, timelineId?: string): Observable<any[]> {
    const params = new URLSearchParams();
    if (spaceId && spaceId !== 'all') params.append('space_id', spaceId);
    if (timelineId && timelineId !== 'all') params.append('timeline_id', timelineId);
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return this.http.get<any[]>(`${this.apiUrl}/okr-tree${queryString}`);
  }

  getObjectiveById(id: string): Observable<Objective> {
    return this.http.get<Objective>(`${this.apiUrl}/objectives/${id}`);
  }

  createObjective(objective: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/objectives`, objective);
  }

  updateObjective(id: string, objective: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/objectives/${id}`, objective);
  }

  getKeyResults(): Observable<KeyResult[]> {
    return this.http.get<KeyResult[]>(`${this.apiUrl}/key-results`);
  }

  getRules(): Observable<MeasurementRule[]> {
    return this.http.get<MeasurementRule[]>(`${this.apiUrl}/rules`);
  }

  saveRule(rule: Partial<MeasurementRule>): Observable<any> {
    return this.http.post(`${this.apiUrl}/rules`, rule);
  }

  getEmployees(): Observable<Employee[]> {
    return this.http.get<Employee[]>(`${this.apiUrl}/employees`);
  }

  createEmployee(employee: Partial<Employee>): Observable<any> {
    return this.http.post(`${this.apiUrl}/employees`, employee);
  }

  getGitLabEvents(): Observable<GitLabEvent[]> {
    return this.http.get<GitLabEvent[]>(`${this.apiUrl}/gitlab-events`);
  }

  getAuditLogs(): Observable<AuditLogData> {
    return this.http.get<AuditLogData>(`${this.apiUrl}/audit-logs`);
  }

  simulateEvent(eventData: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/simulate-event`, eventData);
  }

  resetSeedData(): Observable<any> {
    return this.http.post(`${this.apiUrl}/seed`, {});
  }

  // --- Settings APIs ---
  getSpaces(): Observable<Space[]> { return this.http.get<Space[]>(`${this.apiUrl}/settings/spaces`); }
  createSpace(data: Partial<Space>): Observable<any> { return this.http.post(`${this.apiUrl}/settings/spaces`, data); }
  updateSpace(id: string, data: Partial<Space>): Observable<any> { return this.http.put(`${this.apiUrl}/settings/spaces/${id}`, data); }
  deleteSpace(id: string): Observable<any> { return this.http.delete(`${this.apiUrl}/settings/spaces/${id}`); }

  getTimelines(): Observable<Timeline[]> { return this.http.get<Timeline[]>(`${this.apiUrl}/settings/timelines`); }
  createTimeline(data: Partial<Timeline>): Observable<any> { return this.http.post(`${this.apiUrl}/settings/timelines`, data); }
  updateTimeline(id: string, data: Partial<Timeline>): Observable<any> { return this.http.put(`${this.apiUrl}/settings/timelines/${id}`, data); }
  deleteTimeline(id: string): Observable<any> { return this.http.delete(`${this.apiUrl}/settings/timelines/${id}`); }

  getMetrics(): Observable<Metric[]> { return this.http.get<Metric[]>(`${this.apiUrl}/settings/metrics`); }
  createMetric(data: Partial<Metric>): Observable<any> { return this.http.post(`${this.apiUrl}/settings/metrics`, data); }
  updateMetric(id: string, data: Partial<Metric>): Observable<any> { return this.http.put(`${this.apiUrl}/settings/metrics/${id}`, data); }
  deleteMetric(id: string): Observable<any> { return this.http.delete(`${this.apiUrl}/settings/metrics/${id}`); }

  getSpaceMembers(): Observable<SpaceMember[]> { return this.http.get<SpaceMember[]>(`${this.apiUrl}/settings/space-members`); }
  createSpaceMember(data: Partial<SpaceMember>): Observable<any> { return this.http.post(`${this.apiUrl}/settings/space-members`, data); }
  deleteSpaceMember(id: string): Observable<any> { return this.http.delete(`${this.apiUrl}/settings/space-members/${id}`); }

  getConversions(): Observable<MetricConversion[]> { return this.http.get<MetricConversion[]>(`${this.apiUrl}/settings/conversions`); }
  createConversion(data: Partial<MetricConversion>): Observable<any> { return this.http.post(`${this.apiUrl}/settings/conversions`, data); }
  deleteConversion(id: string): Observable<any> { return this.http.delete(`${this.apiUrl}/settings/conversions/${id}`); }

  getTemplates(type: string): Observable<Template[]> { return this.http.get<Template[]>(`${this.apiUrl}/settings/templates/${type}`); }
  createTemplate(data: Partial<Template>): Observable<any> { return this.http.post(`${this.apiUrl}/settings/templates`, data); }
  updateTemplate(id: string, data: Partial<Template>): Observable<any> { return this.http.put(`${this.apiUrl}/settings/templates/${id}`, data); }
  deleteTemplate(id: string): Observable<any> { return this.http.delete(`${this.apiUrl}/settings/templates/${id}`); }

  getTeams(): Observable<Team[]> {
    return this.http.get<Team[]>(this.apiUrl + '/teams');
  }

  createTeam(team: Partial<Team>): Observable<any> {
    return this.http.post(this.apiUrl + '/teams', team);
  }

  updateTeam(id: string, team: Partial<Team>): Observable<any> {
    return this.http.put(`${this.apiUrl}/teams/${encodeURIComponent(id)}`, team);
  }

  deleteTeam(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/teams/${encodeURIComponent(id)}`);
  }

  getRoles(): Observable<Role[]> {
    return this.http.get<Role[]>(this.apiUrl + '/roles');
  }

  createRole(role: Partial<Role>): Observable<any> {
    return this.http.post(this.apiUrl + '/roles', role);
  }

  updateRole(id: string, role: Partial<Role>): Observable<any> {
    return this.http.put(`${this.apiUrl}/roles/${encodeURIComponent(id)}`, role);
  }

  deleteRole(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/roles/${encodeURIComponent(id)}`);
  }

  updateEmployee(id: string, employee: Partial<Employee>): Observable<any> {
    return this.http.put(`${this.apiUrl}/employees/${id}`, employee);
  }

  deleteEmployee(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/employees/${id}`);
  }

  deleteObjective(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/objectives/${id}`);
  }

  cloneObjective(id: string, payload?: { assignee_id?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/objectives/${encodeURIComponent(id)}/clone`, payload || {});
  }

  assignObjectiveToTree(id: string, payload: { assignee_id?: string; title?: string }): Observable<any> {
    return this.http.post(`${this.apiUrl}/objectives/${encodeURIComponent(id)}/assign-to-tree`, payload);
  }

  createKeyResult(kr: Partial<KeyResult>): Observable<any> {
    return this.http.post(`${this.apiUrl}/key-results`, kr);
  }

  updateKeyResult(id: string, kr: Partial<KeyResult>): Observable<any> {
    return this.http.put(`${this.apiUrl}/key-results/${encodeURIComponent(id)}`, kr);
  }

  deleteKeyResult(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/key-results/${encodeURIComponent(id)}`);
  }

  deleteRule(id: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/rules/${encodeURIComponent(id)}`);
  }

  deleteGitLabEvent(key: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/gitlab-events/${encodeURIComponent(key)}`);
  }

  // --- Measurement Rules APIs ---
  getMeasurementRules(params?: { objective_id?: string; kr_id?: string }): Observable<any[]> {
    let httpParams: any = {};
    if (params?.objective_id) httpParams.objective_id = params.objective_id;
    if (params?.kr_id) httpParams.kr_id = params.kr_id;
    return this.http.get<any[]>(`${this.apiUrl}/measurement-rules`, { params: httpParams });
  }

  getMeasurementRule(id: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/measurement-rules/${encodeURIComponent(id)}`);
  }

  saveMeasurementRule(rule: any): Observable<any> {
    const id = rule.rule_id || rule.ruleId || rule.objectiveId || rule.objective_id || 'DEFAULT';
    return this.http.put(`${this.apiUrl}/measurement-rules/${encodeURIComponent(id)}`, rule);
  }

  // --- Working Calendar, Working Hours & Holidays APIs ---
  getWorkingCalendar(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/working-calendar`);
  }

  getWorkingHours(): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/working-hours`);
  }

  saveWorkingHours(data: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/working-hours`, data);
  }

  getHolidays(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/holidays`);
  }

  saveHolidays(holidays: any[]): Observable<any> {
    return this.http.put(`${this.apiUrl}/holidays`, { holidays });
  }

  updateHoliday(id: string, holiday: any): Observable<any> {
    return this.http.put(`${this.apiUrl}/holidays/${encodeURIComponent(id)}`, holiday);
  }

  // --- KeyResult Current Value Overwrite / Activepieces Sync API ---
  updateKrCurrentValue(krId: string, payload: {
    current_value: number;
    period?: string;
    event_key?: string;
    actor_id?: string;
    reason?: string;
    source?: string;
    numerator?: number;
    denominator?: number;
  }): Observable<any> {
    return this.http.patch(`${this.apiUrl}/key-results/${encodeURIComponent(krId)}/current-value`, payload);
  }

  // --- Flow Runs APIs ---
  getFlowRuns(flowCode?: string): Observable<FlowRunsResponse> {
    let params: any = {};
    if (flowCode) params.flow_code = flowCode;
    return this.http.get<FlowRunsResponse>(`${this.apiUrl}/flow-runs`, { params });
  }

  simulateFlowRun(flowCode: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/flow-runs/simulate`, { flow_code: flowCode });
  }

  deleteFlowRun(runId: string): Observable<any> {
    return this.http.delete(`${this.apiUrl}/flow-runs/${encodeURIComponent(runId)}`);
  }
}
