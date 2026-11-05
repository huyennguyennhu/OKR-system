import { Routes } from '@angular/router';
import { OkrBoardComponent } from './pages/okr-board/okr-board.component';
import { OkrTreeComponent } from './pages/okr-tree/okr-tree.component';
import { OkrSettingsComponent } from './pages/okr-settings/okr-settings.component';
import { MeasurementRulesComponent } from './pages/measurement-rules/measurement-rules.component';
import { WorkingTimeComponent } from './pages/working-time/working-time.component';
import { CalendarComponent } from './pages/calendar/calendar.component';
import { GitLabDataComponent } from './pages/gitlab-data/gitlab-data.component';
import { FlowRunsComponent } from './pages/flow-runs/flow-runs.component';
import { AuditLogComponent } from './pages/audit-log/audit-log.component';
import { AccountSettingsComponent } from './pages/account-settings/account-settings.component';
import { TeamsComponent } from './pages/teams/teams.component';
import { RolesComponent } from './pages/roles/roles.component';
import { ObjectivesListComponent } from './pages/objectives-list/objectives-list.component';
import { ObjectiveDetailComponent } from './pages/objective-detail/objective-detail.component';

export const routes: Routes = [
  { path: '', redirectTo: 'okr-board', pathMatch: 'full' },
  // Group OKR
  { path: 'okr-board', component: OkrBoardComponent, title: 'OKR Board - Tổng quan Tiến độ' },
  { path: 'okr-tree', component: OkrTreeComponent, title: 'OKR Tree - Sơ đồ Cây Phân cấp' },
  { path: 'objectives', component: ObjectivesListComponent, title: 'Objectives - Quản lý Mục tiêu' },
  { path: 'objectives/:id', component: ObjectiveDetailComponent, title: 'Objective Detail - Chi tiết Mục tiêu' },
  { path: 'okr-settings', component: OkrSettingsComponent, title: 'OKR Setting - Cấu hình' },
  { path: 'measurement-rules', component: MeasurementRulesComponent, title: 'Measurement Rule - Quy tắc Đo lường' },
  { path: 'audit-log', component: AuditLogComponent, title: 'Audit Log - Nhật ký & Truy vết SLA' },
  { path: 'flow-runs', component: FlowRunsComponent, title: 'Flow Runs - Danh sách Activepieces Flows' },
  { path: 'flow-runs/:flowCode', component: FlowRunsComponent, title: 'Flow Runs - Chi tiết Lần chạy' },
  
  // Group Calendar
  { path: 'working-time', component: WorkingTimeComponent, title: 'Working Time - Lịch Làm Việc Chuẩn' },
  { path: 'calendar', component: CalendarComponent, title: 'Calendar - Lịch Nghỉ Lễ & Tết Việt Nam' },
  
  // Group Nhân sự
  { path: 'teams', component: TeamsComponent, title: 'Team - Quản lý Đội nhóm Kỹ thuật' },
  { path: 'roles', component: RolesComponent, title: 'Role - Quản lý Chức danh' },
  { path: 'account-settings', component: AccountSettingsComponent, title: 'Nhân viên - Quản lý Nhân sự & GitLab' },
  
  // GitLab Data Integration (chuyển hướng sang Flow Runs)
  { path: 'gitlab-data', redirectTo: 'flow-runs', pathMatch: 'full' },

  { path: '**', redirectTo: 'okr-board' }
];
