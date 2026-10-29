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
        <button class="sidebar-toggle" (click)="toggleSidebar()">
          <i class="fa-solid" [ngClass]="isSidebarCollapsed ? 'fa-chevron-right' : 'fa-chevron-left'"></i>
        </button>
        <div class="sidebar-header">
          <i class="fa-solid fa-layer-group"></i>
          <h2>OKR System</h2>
        </div>

        <nav class="sidebar-nav">
          <a routerLink="/okr-board" routerLinkActive="active" class="nav-item">
            <i class="fa-solid fa-chart-pie fa-fw"></i>
            <span>OKR Board</span>
          </a>
          <a routerLink="/okr-tree" routerLinkActive="active" class="nav-item">
            <i class="fa-solid fa-sitemap fa-fw"></i>
            <span>OKR Tree</span>
          </a>
          <a routerLink="/okr-settings" routerLinkActive="active" class="nav-item">
            <i class="fa-solid fa-sliders fa-fw"></i>
            <span>OKR Settings</span>
          </a>
          <a routerLink="/gitlab-data" routerLinkActive="active" class="nav-item">
            <i class="fa-brands fa-gitlab fa-fw"></i>
            <span>GitLab Data</span>
          </a>
          <a routerLink="/audit-log" routerLinkActive="active" class="nav-item">
            <i class="fa-solid fa-clipboard-check fa-fw"></i>
            <span>AuditLog</span>
          </a>
          <div class="nav-item-group">
            <a class="nav-item cursor-pointer" (click)="toggleHR()" [class.active]="showHR">
              <i class="fa-solid fa-users fa-fw"></i>
              <span>Nhân sự</span>
              <i class="fa-solid fa-chevron-right nav-chevron" [class.rotated]="showHR"></i>
            </a>
            <div class="sub-nav" *ngIf="showHR">
              <a routerLink="/teams" routerLinkActive="active" class="sub-item">
                <span class="sub-dot">•</span>
                <span>Team</span>
              </a>
              <a routerLink="/roles" routerLinkActive="active" class="sub-item">
                <span class="sub-dot">•</span>
                <span>Role</span>
              </a>
              <a routerLink="/account-settings" routerLinkActive="active" class="sub-item">
                <span class="sub-dot">•</span>
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
  showHR = false;

  constructor(
    private okrService: OkrService, 
    private router: Router,
    private confirmService: ConfirmDialogService
  ) {
    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const url = event.urlAfterRedirects || event.url || '';
      if (url.includes('/teams') || url.includes('/roles') || url.includes('/account-settings')) {
        this.showHR = true;
      }
    });
  }

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const path = window.location.pathname;
      if (path.includes('/teams') || path.includes('/roles') || path.includes('/account-settings')) {
        this.showHR = true;
      }
    }
  }

  toggleHR(): void {
    this.showHR = !this.showHR;
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
