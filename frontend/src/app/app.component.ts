import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs/operators';
import { OkrService } from './services/okr.service';
import { ConfirmDialogComponent } from './components/confirm-dialog/confirm-dialog.component';
import { ConfirmDialogService } from './services/confirm-dialog.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterModule, ConfirmDialogComponent],
  template: `
    <div class="app-container">
      <!-- Sidebar Navigation -->
      <aside class="sidebar" [class.collapsed]="isSidebarCollapsed">
        <button class="sidebar-toggle" (click)="toggleSidebar()" type="button" aria-label="Toggle Sidebar">
          <i class="fa-solid" [ngClass]="isSidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'"></i>
        </button>
        <div class="sidebar-header">
          <i class="fa-solid fa-layer-group"></i>
          <h2>OKR System</h2>
        </div>

        <nav class="sidebar-nav">
          <!-- NHÓM 1: OKR -->
          <div class="sidebar-group">
            <div class="sidebar-section-title" [class.active-parent]="isGroupActive('okr')" (click)="toggleGroup('okr')" title="Thu gọn / Mở rộng nhóm OKR">
              <div class="section-title-content">
                <i class="fa-solid fa-bullseye fa-fw"></i>
                <span>OKR</span>
              </div>
              <i class="fa-solid fa-chevron-right section-chevron" [class.rotated]="groupOpenState['okr']"></i>
            </div>
            <div class="group-items" *ngIf="isSidebarCollapsed || groupOpenState['okr']">
              <a routerLink="/okr-board" routerLinkActive="active" class="nav-item" title="OKR Board (Dashboard KPI tổng quan)">
                <i class="fa-solid fa-chart-pie fa-fw"></i>
                <span>OKR Board</span>
              </a>
              <a routerLink="/okr-tree" routerLinkActive="active" class="nav-item" title="OKR Tree (Cây mục tiêu đa tầng & Tiến độ phân cấp)">
                <i class="fa-solid fa-sitemap fa-fw"></i>
                <span>OKR Tree</span>
              </a>
              <a routerLink="/okr-settings" routerLinkActive="active" class="nav-item" title="OKR Setting (Cấu hình: Không gian | Chu kỳ | Thành viên | Thước đo | Mục tiêu)">
                <i class="fa-solid fa-sliders fa-fw"></i>
                <span>OKR Setting</span>
              </a>
              <a routerLink="/measurement-rules" routerLinkActive="active" class="nav-item" title="Measurement Rule (Quy tắc đo lường tự động đồng bộ theo từng Objective cấp Team)">
                <i class="fa-solid fa-ruler-combined fa-fw"></i>
                <span>Measurement Rule</span>
              </a>
              <a routerLink="/audit-log" routerLinkActive="active" class="nav-item" title="Audit Log (Nhật ký giải trình & Truy vết SLA 1 bảng duy nhất)">
                <i class="fa-solid fa-shield-halved fa-fw"></i>
                <span>Audit Log</span>
              </a>
              <a routerLink="/flow-runs" routerLinkActive="active" class="nav-item" title="Flow Runs (Nhật ký thực thi & Kết quả tự động hóa Activepieces)">
                <i class="fa-solid fa-play fa-fw"></i>
                <span>Flow Runs</span>
              </a>
            </div>
          </div>

          <!-- NHÓM 2: CALENDAR -->
          <div class="sidebar-group">
            <div class="sidebar-section-title" [class.active-parent]="isGroupActive('calendar')" (click)="toggleGroup('calendar')" title="Thu gọn / Mở rộng nhóm Calendar">
              <div class="section-title-content">
                <i class="fa-solid fa-calendar-days fa-fw"></i>
                <span>CALENDAR</span>
              </div>
              <i class="fa-solid fa-chevron-right section-chevron" [class.rotated]="groupOpenState['calendar']"></i>
            </div>
            <div class="group-items" *ngIf="isSidebarCollapsed || groupOpenState['calendar']">
              <a routerLink="/working-time" routerLinkActive="active" class="nav-item" title="Working Time (Khung giờ làm việc chuẩn & Giờ nghỉ trưa)">
                <i class="fa-regular fa-clock fa-fw"></i>
                <span>Working Time</span>
              </a>
              <a routerLink="/calendar" routerLinkActive="active" class="nav-item" title="Calendar (Lịch Nghỉ Lễ & Tết Việt Nam)">
                <i class="fa-solid fa-calendar-days fa-fw"></i>
                <span>Calendar</span>
              </a>
            </div>
          </div>

          <!-- NHÓM 3: NHÂN SỰ -->
          <div class="sidebar-group">
            <div class="sidebar-section-title" [class.active-parent]="isGroupActive('hr')" (click)="toggleGroup('hr')" title="Thu gọn / Mở rộng nhóm Nhân sự">
              <div class="section-title-content">
                <i class="fa-solid fa-users fa-fw"></i>
                <span>NHÂN SỰ</span>
              </div>
              <i class="fa-solid fa-chevron-right section-chevron" [class.rotated]="groupOpenState['hr']"></i>
            </div>
            <div class="group-items" *ngIf="isSidebarCollapsed || groupOpenState['hr']">
              <a routerLink="/teams" routerLinkActive="active" class="nav-item" title="Team (Quản lý Đội nhóm Kỹ thuật)">
                <i class="fa-solid fa-people-group fa-fw"></i>
                <span>Team</span>
              </a>
              <a routerLink="/roles" routerLinkActive="active" class="nav-item" title="Role (Quản lý Chức danh: Lead, FE, BE, QA)">
                <i class="fa-solid fa-user-tag fa-fw"></i>
                <span>Role</span>
              </a>
              <a routerLink="/account-settings" routerLinkActive="active" class="nav-item" title="Nhân viên (5 Lập trình viên & Mapping GitLab User ID)">
                <i class="fa-solid fa-users fa-fw"></i>
                <span>Nhân viên</span>
              </a>
            </div>
          </div>
        </nav>

      </aside>

      <!-- Main Layout -->
      <div class="main-wrapper">
        <main class="content-body">
          <router-outlet></router-outlet>
        </main>
      </div>

      <!-- Popup Modal Xác nhận dùng chung toàn hệ thống -->
      <app-confirm-dialog></app-confirm-dialog>
    </div>
  `,
  styles: [`
    .mt-1 { margin-top: 0.25rem; }
    .cursor-pointer { cursor: pointer; }
  `]
})
export class AppComponent implements OnInit {
  isSidebarCollapsed = false;

  // Mặc định đóng tất cả các khối trên sidebar khi mới vào
  groupOpenState: { [key: string]: boolean } = {
    'okr': false,
    'calendar': false,
    'hr': false
  };

  constructor(
    private okrService: OkrService, 
    private router: Router,
    private confirmService: ConfirmDialogService
  ) {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      this.autoExpandActiveGroup(event.urlAfterRedirects || event.url || '');
    });
  }

  ngOnInit(): void {
    const currentUrl = typeof window !== 'undefined' ? window.location.pathname : this.router.url;
    this.autoExpandActiveGroup(currentUrl || '');
  }

  toggleGroup(groupKey: string): void {
    this.groupOpenState[groupKey] = !this.groupOpenState[groupKey];
  }

  isGroupActive(groupKey: string, urlPath?: string): boolean {
    const url = urlPath !== undefined ? urlPath : (this.router.url || (typeof window !== 'undefined' ? window.location.pathname : ''));
    if (groupKey === 'okr') {
      return url === '' ||
             url === '/' ||
             url.includes('/okr-board') || 
             url.includes('/okr-tree') || 
             url.includes('/okr-settings') || 
             url.includes('/measurement-rules') || 
             url.includes('/audit-log') || 
             url.includes('/flow-runs') || 
             url.includes('/gitlab-data') || 
             url.includes('/objectives');
    }
    if (groupKey === 'calendar') {
      return url.includes('/working-time') || url.includes('/calendar');
    }
    if (groupKey === 'hr') {
      return url.includes('/teams') || 
             url.includes('/roles') || 
             url.includes('/account-settings');
    }
    return false;
  }

  autoExpandActiveGroup(url: string): void {
    // Đóng tất cả các khối
    this.groupOpenState['okr'] = false;
    this.groupOpenState['calendar'] = false;
    this.groupOpenState['hr'] = false;

    // Chỉ mở duy nhất khối nào có tab con đang được chọn
    if (this.isGroupActive('okr', url)) {
      this.groupOpenState['okr'] = true;
    } else if (this.isGroupActive('calendar', url)) {
      this.groupOpenState['calendar'] = true;
    } else if (this.isGroupActive('hr', url)) {
      this.groupOpenState['hr'] = true;
    }
  }

  toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
  }

  async resetData(): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Khởi tạo lại dữ liệu mẫu',
      message: 'Bạn có chắc chắn muốn khởi tạo lại toàn bộ dữ liệu mẫu ban đầu? Tất cả các dữ liệu thay đổi sẽ bị xóa.',
      confirmText: 'Khởi tạo lại',
      type: 'warning'
    });
    if (ok) {
      this.okrService.resetSeedData().subscribe(() => {
        window.location.reload();
      });
    }
  }
}
