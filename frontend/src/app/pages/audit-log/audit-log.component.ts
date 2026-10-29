import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OkrService, AuditAssignment } from '../../services/okr.service';

@Component({
  selector: 'app-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Lớp phủ khóa trang trong suốt (không làm mờ, chặn tương tác khi đang tải) -->
    <div class="page-loading-overlay" *ngIf="loading"></div>

    <div class="audit-log-page">
      <!-- Tên trang + Subtitle -->
      <div class="page-top-bar mb-4">
        <h3 class="card-title mb-1" style="font-size: 18px; font-weight: 700;">
          AuditLog
        </h3>
        <p class="subtitle mb-0">
          Giải trình minh bạch lý do mỗi sự kiện GitLab được tính hoặc loại khỏi chỉ số Key Results (RQ1 & RQ4).
        </p>
      </div>

      <!-- Nav Tabs: Gộp hiển thị 1 form bảng duy nhất qua tab chuyển đổi -->
      <nav class="nav-tabs mb-4">
        <a class="nav-link" [class.active]="activeTab === 'events'" (click)="switchTab('events')" href="javascript:void(0)">
          <i class="fa-solid fa-timeline"></i>
          <span>Nhật ký Phân bổ & Đánh giá SLA Sự kiện</span>
        </a>
        <a class="nav-link" [class.active]="activeTab === 'pipeline'" (click)="switchTab('pipeline')" href="javascript:void(0)">
          <i class="fa-solid fa-list-check"></i>
          <span>Nhật ký Hoạt động Workflow Pipeline</span>
        </a>
      </nav>

      <!-- TAB 1: BẢNG SỰ KIỆN SLA -->
      <div *ngIf="activeTab === 'events'">
        <!-- Thanh lọc: Tìm kiếm + Dropdown Trạng thái -->
        <div class="filter-bar mb-3">
          <div class="filter-search-wrapper">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input type="text" class="form-control filter-input" placeholder="Tìm theo event_key, kr_id, nhân viên, lý do..." [(ngModel)]="searchQuery">
            <button type="button" class="clear-search-btn" *ngIf="searchQuery" (click)="searchQuery=''" title="Xóa tìm kiếm">
              <i class="fa-solid fa-circle-xmark"></i>
            </button>
          </div>

          <div class="custom-select-wrapper">
            <button type="button" class="custom-select-trigger" (click)="toggleStatusDropdown($event)" [class.active]="isStatusDropdownOpen">
              <span class="d-flex align-items-center gap-2">
                <i class="fa-solid fa-filter text-indigo" style="width: 16px; text-align: center;"></i>
                <span>{{ getSelectedStatusLabel() }}</span>
              </span>
              <i class="fa-solid fa-chevron-down chevron-icon" [class.rotate]="isStatusDropdownOpen"></i>
            </button>
            <div class="custom-select-menu" *ngIf="isStatusDropdownOpen">
              <div class="custom-select-option" [class.selected]="selectedStatus === 'all'" (click)="selectStatus('all')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-layer-group text-muted" style="width: 16px; text-align: center;"></i>
                  <span>Tất cả sự kiện</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedStatus === 'all'"></i>
              </div>
              <div class="custom-select-option" [class.selected]="selectedStatus === 'on_time'" (click)="selectStatus('on_time')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-circle-check text-emerald" style="width: 16px; text-align: center;"></i>
                  <span>Đạt SLA (On Time)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedStatus === 'on_time'"></i>
              </div>
              <div class="custom-select-option" [class.selected]="selectedStatus === 'late'" (click)="selectStatus('late')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-triangle-exclamation text-warning" style="width: 16px; text-align: center;"></i>
                  <span>Trễ SLA (Over SLA)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedStatus === 'late'"></i>
              </div>
              <div class="custom-select-option" [class.selected]="selectedStatus === 'excluded'" (click)="selectStatus('excluded')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-ban text-danger" style="width: 16px; text-align: center;"></i>
                  <span>Bị loại trừ (Excluded)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedStatus === 'excluded'"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- Bảng dữ liệu: Truy vết sự kiện -->
        <div class="table-container">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>Khóa Sự kiện (event_key)</th>
                <th>Áp dụng cho KR</th>
                <th>Nhân viên (actor_id)</th>
                <th class="text-center">Tính vào mẫu số?</th>
                <th class="text-center">Thời gian xử lý</th>
                <th class="text-center">Đạt SLA?</th>
                <th>Lý do ghi nhận / Loại trừ (Reason Audit)</th>
                <th>Thời điểm xử lý</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="loading">
                <td colspan="8" class="table-loading-cell">
                  <div class="table-loading-content">
                    <div class="loading-spinner-circle"></div>
                    <span>Đang tải dữ liệu nhật ký...</span>
                  </div>
                </td>
              </tr>
              <ng-container *ngIf="!loading">
                <tr *ngFor="let item of filteredAssignments" (click)="selectItem(item)" class="clickable-row">
                  <td><code class="event-key">{{ item.event_key }}</code></td>
                  <td><span class="badge badge-info">{{ item.kr_id }}</span></td>
                  <td><strong>{{ item.employee_name || item.gitlab_user_id }}</strong></td>
                  <td class="text-center">
                    <span class="badge" [ngClass]="item.included ? 'badge-success' : 'badge-danger'">
                      {{ item.included ? 'Có (Included)' : 'Bỏ qua (Excluded)' }}
                    </span>
                  </td>
                  <td class="text-center"><strong>{{ item.duration_minutes }} phút</strong></td>
                  <td class="text-center">
                    <span class="badge" [ngClass]="item.on_time ? 'badge-success' : 'badge-warning'">
                      {{ item.on_time ? 'Đạt SLA' : 'Trễ SLA' }}
                    </span>
                  </td>
                  <td><span class="reason-text">{{ item.reason }}</span></td>
                  <td>{{ formatDate(item.created_at) }}</td>
                </tr>
                <tr *ngIf="filteredAssignments.length === 0">
                  <td colspan="8" class="text-center text-muted py-4">
                    {{ searchQuery || selectedStatus !== 'all' ? 'Không tìm thấy nhật ký truy vết nào phù hợp bộ lọc.' : 'Chưa có nhật ký truy vết nào.' }}
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>
      </div>

      <!-- TAB 2: BẢNG PIPELINE ENGINE -->
      <div *ngIf="activeTab === 'pipeline'">
        <!-- Thanh lọc: Tìm kiếm + Dropdown Trạng thái Pipeline -->
        <div class="filter-bar mb-3">
          <div class="filter-search-wrapper">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input type="text" class="form-control filter-input" placeholder="Tìm theo mã lần chạy (run_id), lỗi..." [(ngModel)]="pipelineSearchQuery">
            <button type="button" class="clear-search-btn" *ngIf="pipelineSearchQuery" (click)="pipelineSearchQuery=''" title="Xóa tìm kiếm">
              <i class="fa-solid fa-circle-xmark"></i>
            </button>
          </div>

          <div class="custom-select-wrapper">
            <button type="button" class="custom-select-trigger" (click)="togglePipelineStatusDropdown($event)" [class.active]="isPipelineStatusDropdownOpen">
              <span class="d-flex align-items-center gap-2">
                <i class="fa-solid fa-filter text-emerald" style="width: 16px; text-align: center;"></i>
                <span>{{ getSelectedPipelineStatusLabel() }}</span>
              </span>
              <i class="fa-solid fa-chevron-down chevron-icon" [class.rotate]="isPipelineStatusDropdownOpen"></i>
            </button>
            <div class="custom-select-menu" *ngIf="isPipelineStatusDropdownOpen">
              <div class="custom-select-option" [class.selected]="selectedPipelineStatus === 'all'" (click)="selectPipelineStatus('all')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-layer-group text-muted" style="width: 16px; text-align: center;"></i>
                  <span>Tất cả trạng thái</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedPipelineStatus === 'all'"></i>
              </div>
              <div class="custom-select-option" [class.selected]="selectedPipelineStatus === 'SUCCESS'" (click)="selectPipelineStatus('SUCCESS')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-circle-check text-emerald" style="width: 16px; text-align: center;"></i>
                  <span>SUCCESS (Thành công)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedPipelineStatus === 'SUCCESS'"></i>
              </div>
              <div class="custom-select-option" [class.selected]="selectedPipelineStatus === 'DUPLICATE'" (click)="selectPipelineStatus('DUPLICATE')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-copy text-warning" style="width: 16px; text-align: center;"></i>
                  <span>DUPLICATE (Trùng lặp)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedPipelineStatus === 'DUPLICATE'"></i>
              </div>
              <div class="custom-select-option" [class.selected]="selectedPipelineStatus === 'EXCLUDED'" (click)="selectPipelineStatus('EXCLUDED')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-ban text-muted" style="width: 16px; text-align: center;"></i>
                  <span>EXCLUDED (Loại trừ)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedPipelineStatus === 'EXCLUDED'"></i>
              </div>
              <div class="custom-select-option" [class.selected]="selectedPipelineStatus === 'FAILED'" (click)="selectPipelineStatus('FAILED')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-circle-xmark text-danger" style="width: 16px; text-align: center;"></i>
                  <span>FAILED (Thất bại)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedPipelineStatus === 'FAILED'"></i>
              </div>
            </div>
          </div>
        </div>

        <!-- Bảng dữ liệu: Processing Runs Log -->
        <div class="table-container">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>Mã Lần Chạy (run_id)</th>
                <th>Thời điểm Bắt đầu</th>
                <th>Thời điểm Kết thúc</th>
                <th class="text-center">Trạng thái</th>
                <th class="text-center">Số Input</th>
                <th class="text-center">Số Output</th>
                <th>Chi tiết / Thông báo lỗi</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="loading">
                <td colspan="7" class="table-loading-cell">
                  <div class="table-loading-content">
                    <div class="loading-spinner-circle"></div>
                    <span>Đang tải nhật ký pipeline...</span>
                  </div>
                </td>
              </tr>
              <ng-container *ngIf="!loading">
                <tr *ngFor="let log of filteredProcessingLogs">
                  <td><code>{{ log.run_id }}</code></td>
                  <td>{{ formatDate(log.start_time) }}</td>
                  <td>{{ formatDate(log.end_time) }}</td>
                  <td class="text-center">
                    <span class="badge" [ngClass]="log.status === 'SUCCESS' ? 'badge-success' : 'badge-warning'">
                      {{ log.status }}
                    </span>
                  </td>
                  <td class="text-center">{{ log.input_count }}</td>
                  <td class="text-center">{{ log.output_count }}</td>
                  <td><span class="error-msg">{{ log.error_message || 'Xử lý thành công không lỗi' }}</span></td>
                </tr>
                <tr *ngIf="filteredProcessingLogs.length === 0">
                  <td colspan="7" class="text-center text-muted py-4">
                    {{ pipelineSearchQuery || selectedPipelineStatus !== 'all' ? 'Không tìm thấy nhật ký pipeline nào phù hợp bộ lọc.' : 'Chưa có nhật ký pipeline nào.' }}
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Detail Modal -->
      <div class="modal-overlay" *ngIf="selectedAssignment">
        <div class="modal-content">
          <div class="card-header mb-3">
            <h3 class="card-title">Bằng chứng Nguồn & Chi tiết Truy vết</h3>
            <button class="close-btn" (click)="selectedAssignment = null" type="button" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <div class="detail-grid">
            <div class="detail-item"><strong>Event Key:</strong> <code>{{ selectedAssignment.event_key }}</code></div>
            <div class="detail-item"><strong>Key Result:</strong> {{ selectedAssignment.kr_id }} - {{ selectedAssignment.kr_title }}</div>
            <div class="detail-item"><strong>Nhân viên:</strong> {{ selectedAssignment.employee_name }} ({{ selectedAssignment.gitlab_user_id }})</div>
            <div class="detail-item"><strong>Dự án:</strong> {{ selectedAssignment.project_code }} (Kind: {{ selectedAssignment.object_kind }})</div>
            <div class="detail-item"><strong>Thời gian xử lý:</strong> {{ selectedAssignment.duration_minutes }} phút</div>
            <div class="detail-item"><strong>Lý do giải trình:</strong> <p class="reason-quote">{{ selectedAssignment.reason }}</p></div>
          </div>
          <div class="d-flex justify-end mt-4">
            <button class="btn btn-secondary" (click)="selectedAssignment = null">Đóng</button>
          </div>
        </div>
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
  `]
})
export class AuditLogComponent implements OnInit {
  activeTab: 'events' | 'pipeline' = 'events';

  assignments: AuditAssignment[] = [];
  processingLogs: any[] = [];
  selectedAssignment: AuditAssignment | null = null;
  loading = false;

  // Filter cho Tab Sự kiện SLA
  searchQuery = '';
  selectedStatus = 'all';
  isStatusDropdownOpen = false;

  // Filter cho Tab Pipeline Engine
  pipelineSearchQuery = '';
  selectedPipelineStatus = 'all';
  isPipelineStatusDropdownOpen = false;

  switchTab(tab: 'events' | 'pipeline'): void {
    this.activeTab = tab;
    this.isStatusDropdownOpen = false;
    this.isPipelineStatusDropdownOpen = false;
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

  get filteredProcessingLogs(): any[] {
    return this.processingLogs.filter(log => {
      const q = this.pipelineSearchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (log.run_id && log.run_id.toLowerCase().includes(q)) ||
        (log.status && log.status.toLowerCase().includes(q)) ||
        (log.error_message && log.error_message.toLowerCase().includes(q));

      const matchStatus = this.selectedPipelineStatus === 'all' ||
        (log.status && log.status.toUpperCase() === this.selectedPipelineStatus.toUpperCase());

      return matchSearch && matchStatus;
    });
  }

  constructor(private okrService: OkrService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.isStatusDropdownOpen = false;
    this.isPipelineStatusDropdownOpen = false;
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
      case 'on_time': return 'Đạt SLA (On Time)';
      case 'late': return 'Trễ SLA (Over SLA)';
      case 'excluded': return 'Bị loại trừ (Excluded)';
      default: return 'Tất cả trạng thái';
    }
  }

  togglePipelineStatusDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isPipelineStatusDropdownOpen = !this.isPipelineStatusDropdownOpen;
  }

  selectPipelineStatus(status: string): void {
    this.selectedPipelineStatus = status;
    this.isPipelineStatusDropdownOpen = false;
  }

  getSelectedPipelineStatusLabel(): string {
    switch (this.selectedPipelineStatus) {
      case 'SUCCESS': return 'SUCCESS (Thành công)';
      case 'DUPLICATE': return 'DUPLICATE (Trùng lặp)';
      case 'EXCLUDED': return 'EXCLUDED (Loại trừ)';
      case 'FAILED': return 'FAILED (Thất bại)';
      default: return 'Tất cả trạng thái';
    }
  }

  loadLogs(): void {
    this.loading = true;
    this.okrService.getAuditLogs().subscribe({
      next: (data) => {
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
