import { Routes } from '@angular/router';
import { OkrBoardComponent } from './pages/okr-board/okr-board.component';
import { OkrTreeComponent } from './pages/okr-tree/okr-tree.component';
import { OkrSettingsComponent } from './pages/okr-settings/okr-settings.component';
import { GitLabDataComponent } from './pages/gitlab-data/gitlab-data.component';
import { AuditLogComponent } from './pages/audit-log/audit-log.component';
import { AccountSettingsComponent } from './pages/account-settings/account-settings.component';
import { TeamsComponent } from './pages/teams/teams.component';
import { RolesComponent } from './pages/roles/roles.component';
import { ObjectivesListComponent } from './pages/objectives-list/objectives-list.component';
import { ObjectiveDetailComponent } from './pages/objective-detail/objective-detail.component';
import { ObjectiveCreateComponent } from './pages/objective-create/objective-create.component';

export const routes: Routes = [
  { path: '', redirectTo: 'okr-board', pathMatch: 'full' },
  { path: 'okr-board', component: OkrBoardComponent, title: 'OKR Board - Tổng quan Tiến độ' },
  { path: 'okr-tree', component: OkrTreeComponent, title: 'OKR Tree - Sơ đồ Cây Phân cấp' },
  { path: 'objectives', component: ObjectivesListComponent, title: 'Objectives - Quản lý Mục tiêu' },
  { path: 'objectives/:id', component: ObjectiveDetailComponent, title: 'Objective Detail - Chi tiết Mục tiêu' },
  { path: 'okr-settings', component: OkrSettingsComponent, title: 'OKR Settings - Cấu hình Quy tắc & Ánh xạ' },
  { path: 'gitlab-data', component: GitLabDataComponent, title: 'GitLab Data - Dữ liệu Sự kiện từ Activepieces' },
  { path: 'audit-log', component: AuditLogComponent, title: 'AuditLog - Nhật ký & Truy vết Nguồn gốc' },
  { path: 'account-settings', component: AccountSettingsComponent, title: 'Account Settings - Quản lý Tài khoản' },
  { path: 'teams', component: TeamsComponent, title: 'Teams - Quản lý Team' },
  { path: 'roles', component: RolesComponent, title: 'Roles - Quản lý Role' },
  { path: '**', redirectTo: 'okr-board' }
];
