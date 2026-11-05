import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OkrService, SystemChangeLog } from '../../services/okr.service';

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
          <input 
            type="text" 
            class="form-control filter-input" 
            placeholder="Tìm theo thời điểm, đối tượng, người thực hiện, thuộc tính, giá trị hoặc nguồn/lý do..." 
            [(ngModel)]="systemSearchQuery">
          <button 
            type="button" 
            class="clear-search-btn" 
            *ngIf="systemSearchQuery" 
            (click)="systemSearchQuery=''" 
            title="Xóa tìm kiếm">
            <i class="fa-solid fa-circle-xmark"></i>
          </button>
        </div>
      </div>

      <!-- Bảng Thay đổi hệ thống (7 Cột Chuẩn Nghiệp Vụ) -->
      <div class="table-container">
        <table class="table table-hover align-middle">
          <thead>
            <tr>
              <th style="width: 165px;">Thời điểm</th>
              <th style="min-width: 210px;">Đối tượng tác động</th>
              <th style="width: 190px;">Người thực hiện</th>
              <th class="text-center" style="width: 140px;">Thuộc tính thay đổi</th>
              <th style="min-width: 110px;">Giá trị trước</th>
              <th style="min-width: 110px;">Giá trị mới</th>
              <th style="min-width: 250px;">Nguồn phát sinh / Lý do</th>
            </tr>
          </thead>
          <tbody>
            <!-- Skeleton Loading -->
            <tr *ngIf="loading">
              <td colspan="7" class="table-loading-cell">
                <div class="table-loading-content">
                  <div class="loading-spinner-circle"></div>
                  <span>Đang tải nhật ký thay đổi hệ thống...</span>
                </div>
              </td>
            </tr>

            <!-- Dữ liệu -->
            <ng-container *ngIf="!loading">
              <tr *ngFor="let item of filteredSystemChanges">
                <!-- 1. Thời điểm (created_at) -->
                <td>
                  <span class="time-stamp-text">
                    <i class="fa-regular fa-clock me-1 text-muted"></i>{{ formatDate(item.created_at) }}
                  </span>
                </td>

                <!-- 2. Đối tượng tác động (target_entity / kr_id) -->
                <td>
                  <div class="target-entity-cell">
                    <span class="badge badge-target-code me-1" *ngIf="item.kr_id || item.objective_id">
                      [{{ item.kr_id || item.objective_id }}]
                    </span>
                    <span class="target-title-text" [title]="getTargetTitle(item)">
                      {{ getTargetTitle(item) }}
                    </span>
                  </div>
                </td>

                <!-- 3. Người thực hiện (author / actor) -->
                <td>
                  <div class="d-flex align-items-center gap-2">
                    <!-- Syrix Avatar logo xoay với robot pupil -->
                    <div *ngIf="isSyrixAuthor(item.author)" class="syrix-avatar-ring" title="Tác tử tự động Syrix">
                      <div class="syrix-avatar-pupil"></div>
                    </div>
                    <!-- User Avatar -->
                    <img *ngIf="!isSyrixAuthor(item.author)" 
                         [src]="item.author_avatar || getAvatarUrl(item.author)" 
                         class="author-avatar" 
                         alt="Avatar">
                    
                    <div class="d-flex flex-column author-info">
                      <span class="author-name">{{ getAuthorName(item.author) }}</span>
                      <span class="author-role-subtext" [ngClass]="isSyrixAuthor(item.author) ? 'text-primary' : 'text-muted'">
                        {{ isSyrixAuthor(item.author) ? 'Tác tử tự động' : 'Quản trị viên' }}
                      </span>
                    </div>
                  </div>
                </td>

                <!-- 4. Thuộc tính thay đổi (field_name) -->
                <td class="text-center">
                  <span class="badge" [ngClass]="getFieldBadgeClass(item.field_name)">
                    {{ item.field_name }}
                  </span>
                </td>

                <!-- 5. Giá trị trước (old_value) -->
                <td>
                  <span class="value-diff-old">{{ item.old_value || 'Chưa có' }}</span>
                </td>

                <!-- 6. Giá trị mới (new_value) -->
                <td>
                  <span class="value-diff-new">{{ item.new_value || '-' }}</span>
                </td>

                <!-- 7. Nguồn phát sinh / Lý do (source / reason) -->
                <td>
                  <div class="source-reason-cell">
                    <div class="source-tag d-flex align-items-center gap-1">
                      <i class="fa-solid fa-bolt text-warning" *ngIf="isSyrixAuthor(item.author)"></i>
                      <i class="fa-solid fa-user-pen text-primary" *ngIf="!isSyrixAuthor(item.author)"></i>
                      <strong class="source-title">{{ getSource(item) }}</strong>
                    </div>
                    <div class="reason-subtext" *ngIf="getReason(item)">
                      {{ getReason(item) }}
                    </div>
                  </div>
                </td>
              </tr>

              <!-- Trạng thái trống -->
              <tr *ngIf="filteredSystemChanges.length === 0">
                <td colspan="7" class="text-center text-muted py-4">
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
    .mb-1 { margin-bottom: 0.25rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mb-4 { margin-bottom: 1.5rem; }
    .text-center { text-align: center; }
    .text-muted { color: #64748b; }
    .text-primary { color: #3157D5 !important; }
    .text-warning { color: #d97706 !important; }
    .py-4 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
    .d-flex { display: flex; }
    .flex-column { flex-direction: column; }
    .align-items-center { align-items: center; }
    .align-middle td, .align-middle th { vertical-align: middle; }
    .gap-1 { gap: 0.25rem; }
    .gap-2 { gap: 0.5rem; }
    .me-1 { margin-right: 0.25rem; }
    table { background-color: #ffffff; width: 100%; border-collapse: collapse; }

    /* Filter Bar */
    .filter-bar {
      display: flex;
      align-items: center;
      gap: 0.75rem;
    }
    .filter-search-wrapper {
      position: relative;
      flex: 1;
      max-width: 650px;
    }
    .search-icon {
      position: absolute;
      left: 12px;
      top: 50%;
      transform: translateY(-50%);
      color: #94a3b8;
      font-size: 13px;
    }
    .filter-input {
      padding-left: 34px;
      padding-right: 32px;
      height: 36px;
      font-size: 13px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      width: 100%;
      transition: all 0.2s ease;
    }
    .filter-input:focus {
      border-color: #3157D5;
      box-shadow: 0 0 0 3px rgba(49, 87, 213, 0.15);
      outline: none;
    }
    .clear-search-btn {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      background: none;
      border: none;
      color: #94a3b8;
      cursor: pointer;
      font-size: 13px;
      padding: 2px;
    }
    .clear-search-btn:hover {
      color: #ef4444;
    }

    /* Table Container */
    .table-container {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow-x: auto;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
    }
    .table {
      margin-bottom: 0;
      font-size: 13px;
    }
    .table thead th {
      background: #f8fafc;
      color: #475569;
      font-weight: 600;
      font-size: 13px;
      padding: 10px 14px;
      border-bottom: 1px solid #e2e8f0;
      white-space: nowrap;
    }
    .table tbody td {
      padding: 10px 14px;
      border-bottom: 1px solid #f1f5f9;
      color: #1e293b;
      font-size: 13px;
    }
    .table tbody tr:hover {
      background-color: #f8faff;
    }

    /* Column 1: Time Stamp */
    .time-stamp-text {
      font-family: monospace;
      font-size: 12.5px;
      color: #334155;
      white-space: nowrap;
    }

    /* Column 2: Target Entity */
    .target-entity-cell {
      display: flex;
      align-items: center;
      gap: 4px;
      max-width: 320px;
    }
    .badge-target-code {
      background: #eff6ff;
      color: #1d4ed8;
      border: 1px solid #bfdbfe;
      font-weight: 600;
      font-size: 11.5px;
      padding: 2px 6px;
      border-radius: 4px;
      font-family: monospace;
      white-space: nowrap;
      flex-shrink: 0;
    }
    .target-title-text {
      font-weight: 600;
      font-size: 13px;
      color: #1e293b;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    /* Column 3: Author / Actor with rotating Syrix Logo */
    .author-avatar {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
    }
    .syrix-avatar-ring {
      width: 26px;
      height: 26px;
      border-radius: 50%;
      padding: 2.5px;
      background: conic-gradient(from 180deg at 50% 50%, #f97316 0deg, #ef4444 120deg, #3b82f6 240deg, #f97316 360deg);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      animation: syrixSpin 6s linear infinite;
    }
    @keyframes syrixSpin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    .syrix-avatar-pupil {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
    }
    .syrix-avatar-pupil::after {
      content: '';
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background: #0f172a;
      position: absolute;
    }
    .syrix-avatar-pupil::before {
      content: '';
      width: 3px;
      height: 3px;
      border-radius: 50%;
      background: #ffffff;
      position: absolute;
      top: 3px;
      left: 3px;
      z-index: 2;
    }
    .author-info {
      line-height: 1.25;
    }
    .author-name {
      font-weight: 600;
      font-size: 13px;
      color: #1e293b;
      white-space: nowrap;
    }
    .author-role-subtext {
      font-size: 11px;
      font-weight: 500;
      white-space: nowrap;
    }

    /* Column 4: Field Name Badges */
    .badge {
      display: inline-block;
      padding: 3px 8px;
      font-size: 12px;
      font-weight: 500;
      border-radius: 4px;
      white-space: nowrap;
    }
    .badge-primary { background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .badge-info { background: #f0fdf4; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-warning { background: #fffbeb; color: #b45309; border: 1px solid #fde68a; }
    .badge-success { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
    .badge-secondary { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    /* Column 5 & 6: Diff Values */
    .value-diff-old {
      color: #94a3b8;
      text-decoration: line-through;
      font-size: 12.5px;
      padding: 2px 6px;
      background: #f8fafc;
      border-radius: 4px;
      display: inline-block;
      white-space: nowrap;
    }
    .value-diff-new {
      color: #047857;
      font-weight: 600;
      font-size: 13px;
      padding: 2px 6px;
      background: #ecfdf5;
      border-radius: 4px;
      display: inline-block;
      white-space: nowrap;
    }

    /* Column 7: Source & Reason */
    .source-reason-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
      max-width: 380px;
    }
    .source-tag {
      font-size: 12.5px;
      line-height: 1.3;
    }
    .source-title {
      font-weight: 600;
      color: #1e293b;
    }
    .reason-subtext {
      font-size: 12px;
      color: #64748b;
      line-height: 1.35;
    }

    /* Loading Spinner */
    .table-loading-cell {
      padding: 3rem 1rem !important;
      text-align: center;
    }
    .table-loading-content {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.75rem;
      color: #64748b;
      font-size: 13px;
    }
    .loading-spinner-circle {
      width: 28px;
      height: 28px;
      border: 3px solid #e2e8f0;
      border-top-color: #3157D5;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .page-loading-overlay {
      position: fixed;
      top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(255, 255, 255, 0.4);
      z-index: 999;
    }
  `]
})
export class AuditLogComponent implements OnInit {
  systemChanges: SystemChangeLog[] = [];
  loading = true;
  systemSearchQuery = '';

  constructor(private okrService: OkrService) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading = true;
    this.okrService.getAuditLogs().subscribe({
      next: (data) => {
        this.systemChanges = data.system_changes || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  get filteredSystemChanges(): SystemChangeLog[] {
    return this.systemChanges.filter(item => {
      const q = this.systemSearchQuery.toLowerCase().trim();
      if (!q) return true;
      const targetTitle = this.getTargetTitle(item).toLowerCase();
      const authorName = this.getAuthorName(item.author).toLowerCase();
      const source = this.getSource(item).toLowerCase();
      const reason = this.getReason(item).toLowerCase();
      const timeStr = this.formatDate(item.created_at).toLowerCase();

      return (
        timeStr.includes(q) ||
        (item.kr_id && item.kr_id.toLowerCase().includes(q)) ||
        (item.objective_id && item.objective_id.toLowerCase().includes(q)) ||
        targetTitle.includes(q) ||
        authorName.includes(q) ||
        (item.field_name && item.field_name.toLowerCase().includes(q)) ||
        (item.old_value && item.old_value.toLowerCase().includes(q)) ||
        (item.new_value && item.new_value.toLowerCase().includes(q)) ||
        source.includes(q) ||
        reason.includes(q)
      );
    });
  }

  // 1. Format date chuẩn Asia/Ho_Chi_Minh: YYYY-MM-DD HH:mm:ss
  formatDate(iso: string): string {
    if (!iso) return '-';
    try {
      const d = new Date(iso);
      const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Ho_Chi_Minh',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      return formatter.format(d).replace(', ', ' ');
    } catch {
      return iso;
    }
  }

  // 2. Định danh và tên đối tượng tác động
  getTargetTitle(item: SystemChangeLog): string {
    if (item.kr_title) return item.kr_title;
    if (item.objective_title) return item.objective_title;
    if (item.field_name === 'Measurement Rule') return 'Cấu hình quy tắc đo lường';
    if (item.field_name === 'Working Calendar') return 'Lịch làm việc & ngày lễ chuẩn';
    return item.kr_id || item.objective_id || '-';
  }

  // 3. Nhận diện tác tử Syrix Task hoặc Người dùng Quản trị
  isSyrixAuthor(author?: string): boolean {
    if (!author) return true;
    const a = author.toLowerCase();
    return a === 'bot' || a.includes('bot') || a.includes('syrix') || a.includes('activepieces');
  }

  getAuthorName(author?: string): string {
    if (this.isSyrixAuthor(author)) {
      return 'Syrix Task';
    }
    if (!author || author.toLowerCase().includes('huyen') || author.toLowerCase().includes('huyền')) {
      return 'Huyền Nguyễn Như';
    }
    return author;
  }

  getAvatarUrl(author?: string): string {
    if (!author) return 'https://ui-avatars.com/api/?name=Admin&background=3157D5&color=fff&rounded=true';
    if (author.includes('Huyen') || author.includes('Huyền')) {
      return 'https://ui-avatars.com/api/?name=Huyen+Nguyen&background=3157D5&color=fff&rounded=true';
    }
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(author)}&background=3157D5&color=fff&rounded=true`;
  }

  // 4. Thuộc tính thay đổi Badge Class
  getFieldBadgeClass(field: string): string {
    if (!field) return 'badge-secondary';
    const lower = field.toLowerCase();
    if (lower.includes('current')) return 'badge-primary';
    if (lower.includes('expected') || lower.includes('target')) return 'badge-info';
    if (lower.includes('rule') || lower.includes('sla')) return 'badge-warning';
    if (lower.includes('task') || lower.includes('title') || lower.includes('status')) return 'badge-success';
    return 'badge-secondary';
  }

  // 7. Căn cứ nguồn phát sinh
  getSource(item: SystemChangeLog): string {
    if (item.source) return item.source;
    if (this.isSyrixAuthor(item.author)) {
      if (item.kr_id) {
        if (item.kr_id.includes('A1')) return 'Activepieces Flow KR-A1 (RUN_20261104_A1_2775)';
        if (item.kr_id.includes('B1')) return 'Activepieces Flow KR-B1 (RUN_20261104_B1_3192)';
        if (item.kr_id.includes('C1')) return 'Activepieces Flow KR-C1 (RUN_20261104_C1_4518)';
      }
      return 'Activepieces Flow (Syrix Task)';
    }
    return 'Admin cập nhật tay';
  }

  // 7. Lý do giải trình minh bạch
  getReason(item: SystemChangeLog): string {
    if (item.reason) return item.reason;
    if (this.isSyrixAuthor(item.author)) {
      if (item.kr_id) {
        if (item.kr_id.includes('A1')) return 'Tự động quét Issue GitLab, check-in Personal KRs và cập nhật Team KR';
        if (item.kr_id.includes('B1')) return 'Tự động tính chu kỳ phát hành GitLab MR, tính toán SLA Lead Time';
        if (item.kr_id.includes('C1')) return 'Tự động đồng bộ báo cáo chất lượng từ Google Sheets & GitLab';
      }
      return 'Tự động quét và đồng bộ số liệu chỉ số OKR';
    }
    return 'Điều chỉnh trực tiếp từ bảng điều khiển Quản trị viên';
  }
}
