import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OkrService, AuditAssignment, SystemChangeLog } from '../../services/okr.service';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Lớp phủ khóa trang trong suốt -->
    <div class="page-loading-overlay" *ngIf="loading"></div>

    <div class="audit-log-page">
      <!-- Tên trang + Subtitle -->
      <div class="page-top-bar mb-4">
        <h3 class="card-title mb-1" style="font-size: 16px; font-weight: 700;">
          Audit Log
        </h3>
        <p class="subtitle mb-0">
          Ghi lại minh bạch toàn bộ sự thay đổi của hệ thống.
        </p>
      </div>

      <!-- Filter Bar -->
      <div class="filter-bar mb-3">
        <div class="filter-search-wrapper">
          <i class="fa-solid fa-magnifying-glass search-icon"></i>
          <input type="text" class="form-control filter-input" placeholder="Tìm theo KR, người cập nhật, thuộc tính, giá trị..." [(ngModel)]="systemSearchQuery">
          <button type="button" class="clear-search-btn" *ngIf="systemSearchQuery" (click)="systemSearchQuery=''" title="Xóa tìm kiếm">
            <i class="fa-solid fa-circle-xmark"></i>
          </button>
        </div>
      </div>

      <!-- Bảng Thay đổi hệ thống -->
      <div class="table-container">
        <table class="table table-hover">
          <thead>
            <tr>
              <th style="width: 170px;">Thời điểm</th>
              <th>Chỉ số / Đối tượng</th>
              <th>Người thực hiện</th>
              <th class="text-center" style="width: 140px;">Thuộc tính</th>
              <th>Giá trị trước</th>
              <th>Giá trị mới</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngIf="loading">
              <td colspan="6" class="table-loading-cell">
                <div class="table-loading-content">
                  <div class="loading-spinner-circle"></div>
                  <span>Đang tải nhật ký thay đổi hệ thống...</span>
                </div>
              </td>
            </tr>
            <ng-container *ngIf="!loading">
              <tr *ngFor="let item of filteredSystemChanges">
                <td>
                  <span class="text-muted" style="font-size: 12.5px;">{{ formatDate(item.created_at) }}</span>
                </td>
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <span class="badge badge-info" *ngIf="item.kr_id">{{ item.kr_id }}</span>
                    <strong style="font-size: 13px;">{{ item.kr_title || item.objective_title || item.objective_id || '-' }}</strong>
                  </div>
                </td>
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <img [src]="item.author_avatar || getAvatarUrl(item.author)" class="author-avatar" alt="Avatar">
                    <span style="font-weight: 500; font-size: 13px;">{{ item.author }}</span>
                  </div>
                </td>
                <td class="text-center">
                  <span class="badge" [ngClass]="getFieldBadgeClass(item.field_name)">
                    {{ item.field_name }}
                  </span>
                </td>
                <td>
                  <span class="value-diff-old">{{ item.old_value || 'Chưa có' }}</span>
                </td>
                <td>
                  <span class="value-diff-new">{{ item.new_value }}</span>
                </td>
              </tr>
              <tr *ngIf="filteredSystemChanges.length === 0">
                <td colspan="6" class="text-center text-muted py-4">
                  {{ systemSearchQuery ? 'Không tìm thấy thay đổi nào phù hợp bộ lọc.' : 'Chưa có nhật ký thay đổi hệ thống nào.' }}
                </td>
              </tr>
            </ng-container>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .subtitle { color: #64748b; font-size: 13px; }
    .event-key { font-size: 13px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    .reason-text { font-size: 13px; color: #334155; }
    .clickable-row { cursor: pointer; transition: background 0.15s ease; }
    .clickable-row:hover { background-color: #e0e7ff !important; }
    .error-msg { font-size: 13px; color: #64748b; }
    .detail-grid { display: flex; flex-direction: column; gap: 0.75rem; font-size: 13px; }
    .reason-quote { background: #f8fafc; border-left: 4px solid #6366f1; padding: 0.5rem 0.75rem; border-radius: 4px; margin-top: 0.25rem; font-style: italic; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1.5rem; }
    .mt-4 { margin-top: 1rem; }
    .text-center { text-align: center; }
    .text-indigo { color: #4f46e5; }
    .text-emerald { color: #10b981; }
    .text-warning { color: #f59e0b; }
    .text-danger { color: #ef4444; }
    .text-muted { color: #64748b; }
    .py-4 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
    .d-flex { display: flex; }
    .align-items-center { align-items: center; }
    .justify-end { justify-content: flex-end; }
    .gap-2 { gap: 0.5rem; }
    table { background-color: #ffffff; }

    /* Audit Tab Navigation */
    .audit-tab-nav {
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 8px;
    }
    .audit-tab-btn {
      padding: 8px 16px;
      font-size: 13.5px;
      font-weight: 600;
      color: #64748b;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
    }
    .audit-tab-btn:hover {
      background: #f1f5f9;
      color: #1e293b;
    }
    .audit-tab-btn.active {
      background: #4f46e5;
      color: #ffffff;
      border-color: #4f46e5;
      box-shadow: 0 1px 3px rgba(79, 70, 229, 0.25);
    }

    /* Author Avatar */
    .author-avatar {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }

    /* Diff Styling */
    .value-diff-old {
      color: #94a3b8;
      text-decoration: line-through;
      font-size: 12.5px;
      padding: 2px 6px;
      background: #f8fafc;
      border-radius: 4px;
      display: inline-block;
    }
    .value-diff-new {
      color: #047857;
      font-weight: 600;
      font-size: 13px;
      padding: 2px 6px;
      background: #ecfdf5;
      border-radius: 4px;
      display: inline-block;
    }
  `]
})
export class AuditLogComponent implements OnInit {
  activeTab: 'system' | 'events' = 'system';

  systemChanges: SystemChangeLog[] = [];
  assignments: AuditAssignment[] = [];
  processingLogs: any[] = [];
  selectedAssignment: AuditAssignment | null = null;
  loading = true;

  // Search cho Tab Thay đổi hệ thống
  systemSearchQuery = '';

  // Filter cho Tab Sự kiện SLA
  searchQuery = '';
  selectedStatus = 'all';
  isStatusDropdownOpen = false;

  constructor(private okrService: OkrService) {}

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.custom-select-wrapper')) {
      this.isStatusDropdownOpen = false;
    }
  }

  ngOnInit(): void {
    this.loadLogs();
  }

  switchTab(tab: 'system' | 'events'): void {
    this.activeTab = tab;
    this.isStatusDropdownOpen = false;
  }

  get filteredSystemChanges(): SystemChangeLog[] {
    return this.systemChanges.filter(item => {
      const q = this.systemSearchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        (item.kr_id && item.kr_id.toLowerCase().includes(q)) ||
        (item.kr_title && item.kr_title.toLowerCase().includes(q)) ||
        (item.objective_title && item.objective_title.toLowerCase().includes(q)) ||
        (item.author && item.author.toLowerCase().includes(q)) ||
        (item.field_name && item.field_name.toLowerCase().includes(q)) ||
        (item.old_value && item.old_value.toLowerCase().includes(q)) ||
        (item.new_value && item.new_value.toLowerCase().includes(q))
      );
    });
  }

  get filteredAssignments(): AuditAssignment[] {
    return this.assignments.filter(item => {
      const q = this.searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (item.event_key && item.event_key.toLowerCase().includes(q)) ||
        (item.kr_id && item.kr_id.toLowerCase().includes(q)) ||
        (item.employee_name && item.employee_name.toLowerCase().includes(q)) ||
        (item.gitlab_user_id && item.gitlab_user_id.toLowerCase().includes(q)) ||
        (item.reason && item.reason.toLowerCase().includes(q));

      let matchStatus = true;
      if (this.selectedStatus === 'on_time') {
        matchStatus = Boolean(item.included && item.on_time);
      } else if (this.selectedStatus === 'late') {
        matchStatus = Boolean(item.included && !item.on_time);
      } else if (this.selectedStatus === 'excluded') {
        matchStatus = !item.included;
      }
      return matchSearch && matchStatus;
    });
  }

  toggleStatusDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isStatusDropdownOpen = !this.isStatusDropdownOpen;
  }

  selectStatus(status: string): void {
    this.selectedStatus = status;
    this.isStatusDropdownOpen = false;
  }

  getSelectedStatusLabel(): string {
    switch (this.selectedStatus) {
      case 'on_time': return 'Đạt SLA';
      case 'late': return 'Trễ SLA';
      case 'excluded': return 'Bị loại trừ';
      default: return 'Tất cả trạng thái';
    }
  }

  getFieldBadgeClass(field: string): string {
    if (!field) return 'badge-secondary';
    const lower = field.toLowerCase();
    if (lower.includes('current')) return 'badge-primary';
    if (lower.includes('expected')) return 'badge-info';
    if (lower.includes('rule')) return 'badge-warning';
    if (lower.includes('task') || lower.includes('title')) return 'badge-success';
    return 'badge-secondary';
  }

  getAvatarUrl(author: string): string {
    if (!author) return 'https://ui-avatars.com/api/?name=User&background=3157D5&color=fff&rounded=true';
    if (author.includes('Huyen') || author.includes('Huyền')) {
      return 'https://ui-avatars.com/api/?name=Huyen+Nguyen&background=3157D5&color=fff&rounded=true';
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=3157D5&color=fff&rounded=true`;
  }

  loadLogs(): void {
    this.loading = true;
    this.okrService.getAuditLogs().subscribe({
      next: (data) => {
        this.systemChanges = data.system_changes || [];
        this.assignments = data.assignments || [];
        this.processingLogs = data.processing_logs || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  selectItem(item: AuditAssignment): void {
    this.selectedAssignment = item;
  }

  formatDate(iso: string): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('vi-VN');
  }
}
