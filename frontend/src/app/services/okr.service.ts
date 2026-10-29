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
  key_results?: KeyResult[];
}

export interface Space { id: string; name: string; space_key: string; manager_id: string; created_at?: string; }
export interface Timeline { id: string; title: string; start_date: string; end_date: string; workspace_id: string; timeline_category: string; }
export interface Metric { id: string; name: string; unit: string; metric_key: string; is_percent: boolean | number; description: string; }
export interface SpaceMember { id: string; space_id: string; user_name: string; email: string; role: string; }
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
      return `http://${window.location.hostname}:3000/api`;
    }
    return 'http://localhost:3000/api';
  }

  constructor(private http: HttpClient) {}

  getObjectives(): Observable<Objective[]> {
    return this.http.get<Objective[]>(`${this.apiUrl}/objectives`);
  }

  getOkrTree(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/okr-tree`);
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

  cloneObjective(id: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/objectives/${encodeURIComponent(id)}/clone`, {});
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

}
