import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OkrService, GitLabEvent } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-gitlab-data',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <!-- Lớp phủ khóa trang trong suốt (không làm mờ, chặn tương tác khi đang tải) -->
    <div class="page-loading-overlay" *ngIf="loading"></div>

    <div class="gitlab-data-page">
      <div class="page-top-bar mb-4">
        <h3 class="card-title mb-1" style="font-size: 18px; font-weight: 700;">
          GitLab Data
        </h3>
        <p class="subtitle mb-0">
          Dữ liệu sự kiện thật do Activepieces lắng nghe từ GitLab và đẩy về Endpoint <code>POST /api/webhooks/activepieces</code>.
        </p>
      </div>

        <!-- Search & Custom Dropdown Filter -->
        <div class="filter-bar mb-3">
          <div class="filter-search-wrapper">
            <i class="fa-solid fa-magnifying-glass search-icon"></i>
            <input type="text" class="form-control filter-input" placeholder="Tìm kiếm theo event_key, actor, project..." [(ngModel)]="searchQuery" (input)="filterEvents()">
            <button type="button" class="clear-search-btn" *ngIf="searchQuery" (click)="searchQuery=''; filterEvents()" title="Xóa tìm kiếm">
              <i class="fa-solid fa-circle-xmark"></i>
            </button>
          </div>

          <div class="custom-select-wrapper">
            <button type="button" class="custom-select-trigger" (click)="toggleKindDropdown($event)" [class.active]="isKindDropdownOpen">
              <span class="d-flex align-items-center gap-2">
                <i class="fa-solid fa-layer-group text-muted" *ngIf="selectedKind === 'all'"></i>
                <i class="fa-solid fa-code-merge text-gitlab" *ngIf="selectedKind === 'merge_request'"></i>
                <i class="fa-solid fa-circle-dot text-success" *ngIf="selectedKind === 'issue'"></i>
                <span>{{ getSelectedKindLabel() }}</span>
              </span>
              <i class="fa-solid fa-chevron-down chevron-icon" [class.rotate]="isKindDropdownOpen"></i>
            </button>
            <div class="custom-select-menu" *ngIf="isKindDropdownOpen">
              <div class="custom-select-option" [class.selected]="selectedKind === 'all'" (click)="selectKind('all')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-layer-group text-muted" style="width: 16px;"></i>
                  <span>Tất cả loại sự kiện (All Objects)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedKind === 'all'"></i>
              </div>
              <div class="custom-select-option" [class.selected]="selectedKind === 'merge_request'" (click)="selectKind('merge_request')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-code-merge text-gitlab" style="width: 16px;"></i>
                  <span>merge_request (MR Approval)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedKind === 'merge_request'"></i>
              </div>
              <div class="custom-select-option" [class.selected]="selectedKind === 'issue'" (click)="selectKind('issue')">
                <span class="d-flex align-items-center gap-2">
                  <i class="fa-solid fa-circle-dot text-success" style="width: 16px;"></i>
                  <span>issue (Issue / Bug Close)</span>
                </span>
                <i class="fa-solid fa-check check-icon" *ngIf="selectedKind === 'issue'"></i>
              </div>
            </div>
          </div>
        </div>

        <div class="table-container">
          <table class="table table-hover">
            <thead>
              <tr>
                <th>Event Key</th>
                <th>Project</th>
                <th>Event Type</th>
                <th>Action</th>
                <th>Actor</th>
                <th>Event Time</th>
                <th class="text-center">Processing Status</th>
                <th class="text-center">Payload Details</th>
                <th style="width: 48px; text-align: center;"></th>
              </tr>
            </thead>
            <tbody>
              <tr *ngIf="loading">
                <td colspan="9" class="table-loading-cell">
                  <div class="table-loading-content">
                    <div class="loading-spinner-circle"></div>
                    <span>Đang tải dữ liệu sự kiện...</span>
                  </div>
                </td>
              </tr>
              <ng-container *ngIf="!loading">
                <tr *ngFor="let evt of filteredEvents">
                  <td><code class="event-key">{{ evt.event_key }}</code></td>
                  <td><strong>{{ evt.project_code }}</strong></td>
                  <td>
                    <span class="badge" [ngClass]="evt.object_kind === 'merge_request' ? 'badge-info' : 'badge-warning'">
                      {{ evt.object_kind }}
                    </span>
                  </td>
                  <td><code>{{ evt.action }}</code></td>
                  <td><code class="actor-tag"><i class="fa-regular fa-user"></i> {{ evt.actor_id }}</code></td>
                  <td>{{ formatDate(evt.event_time) }}</td>
                  <td class="text-center">
                    <span class="badge" [ngClass]="getStatusBadge(evt.processing_status)">
                      {{ evt.processing_status }}
                    </span>
                  </td>
                  <td class="text-center">
                    <button class="btn btn-secondary btn-sm" (click)="viewPayload(evt)">
                      <i class="fa-solid fa-code"></i> Xem JSON
                    </button>
                  </td>
                  <td class="action-cell" (click)="$event.stopPropagation()" [style.z-index]="activeDropdownId === evt.event_key ? 10000 : 'auto'">
                    <div class="action-menu-container" [style.z-index]="activeDropdownId === evt.event_key ? 10000 : 'auto'">
                      <button class="btn-action-trigger" (click)="toggleDropdown(evt.event_key, $event)" title="Thao tác" [class.active]="activeDropdownId === evt.event_key">
                        <i class="fa-solid fa-ellipsis-vertical"></i>
                      </button>
                      <div class="action-dropdown-menu" *ngIf="activeDropdownId === evt.event_key" [class.dropup]="isDropup">
                        <button class="action-dropdown-item" (click)="viewPayload(evt); closeDropdown()">
                          <i class="fa-solid fa-code"></i> Xem Payload
                        </button>
                        <button class="action-dropdown-item text-danger" (click)="deleteEvent(evt); closeDropdown()">
                          <i class="fa-solid fa-trash-can"></i> Xóa
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
                <tr *ngIf="filteredEvents.length === 0">
                  <td colspan="9" class="text-center text-muted py-4">
                    {{ searchQuery || selectedKind !== 'all' ? 'Không tìm thấy sự kiện nào phù hợp bộ lọc.' : 'Chưa có sự kiện nào. Hãy tạo mới!' }}
                  </td>
                </tr>
              </ng-container>
            </tbody>
          </table>
        </div>

      <!-- JSON Payload Viewer Modal -->
      <div class="modal-overlay" *ngIf="selectedPayload">
        <div class="modal-content">
          <div class="card-header mb-3">
            <h3 class="card-title">Payload JSON từ Activepieces Webhook</h3>
            <button class="close-btn" (click)="selectedPayload = null" type="button" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <pre><code>{{ selectedPayload }}</code></pre>
          <div class="d-flex justify-end mt-4">
            <button class="btn btn-secondary" (click)="selectedPayload = null">Đóng</button>
          </div>
        </div>
      </div>

      <!-- Simulation Modal -->
      <div class="modal-overlay" *ngIf="showSimulateModal">
        <div class="modal-content">
          <div class="card-header mb-3">
            <h3 class="card-title">Mô phỏng Gửi Webhook Payload từ Activepieces</h3>
            <button class="close-btn" (click)="!isSimulating && (showSimulateModal = false)" type="button" aria-label="Đóng"><i class="fa-solid fa-xmark"></i></button>
          </div>
          <form (ngSubmit)="submitSimulation()">
            <div class="form-group mb-2">
              <label>Loại Đối tượng (Object Kind): <span class="text-danger">*</span></label>
              <select class="form-control" [(ngModel)]="simForm.object_kind" name="object_kind" required>
                <option value="merge_request">merge_request (MR Approval)</option>
                <option value="issue">issue (Issue / Bug Close)</option>
              </select>
            </div>
            <div class="form-group mb-2">
              <label>Tên Sự kiện / Tiêu đề: <span class="text-danger">*</span></label>
              <input type="text" class="form-control" [(ngModel)]="simForm.title" name="title" required placeholder="Nhập tiêu đề sự kiện...">
            </div>
            <div class="form-group mb-2">
              <label>Tài khoản GitLab thực hiện (actor_id): <span class="text-danger">*</span></label>
              <select class="form-control" [(ngModel)]="simForm.actor" name="actor" required>
                <option value="sarah.reviewer">sarah.reviewer (Senior Dev / Reviewer)</option>
                <option value="alex.dev">alex.dev (Dev Lead)</option>
                <option value="john.coder">john.coder (Junior Dev)</option>
              </select>
            </div>
            <div class="form-group mb-2">
              <label>Thời gian xử lý thực tế (Giờ làm việc): <span class="text-danger">*</span></label>
              <input type="number" class="form-control" [(ngModel)]="simForm.duration_hours" name="duration_hours" required placeholder="Ví dụ: 2">
              <small class="help-text">Nhập 2 giờ (Đạt SLA 4h) hoặc 6 giờ (Vượt SLA 4h) để kiểm thử.</small>
            </div>
            <div class="form-group mb-3" *ngIf="simForm.object_kind === 'issue'">
              <label><input type="checkbox" [(ngModel)]="simForm.is_bug" name="is_bug"> Sự kiện này có Gắn nhãn Bug (Label: bug)?</label>
            </div>
            <div class="d-flex justify-end gap-2 mt-4">
              <button type="button" class="btn btn-secondary" (click)="showSimulateModal = false" [disabled]="isSimulating">Hủy</button>
              <button type="submit" class="btn btn-primary" [disabled]="isSimulating">
                <i class="fa-solid fa-spinner fa-spin" *ngIf="isSimulating"></i>
                {{ isSimulating ? 'Đang gửi...' : 'Gửi Webhook Payload' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .text-gitlab { color: #fc6d26; }
    .text-success { color: #10b981; }
    .text-muted { color: #64748b; }
    .subtitle { color: #64748b; font-size: 13px; }
    .event-key { font-size: 13px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; font-family: monospace; }
    .actor-tag { background: #e0f2fe; color: #0369a1; padding: 2px 6px; border-radius: 4px; font-size: 13px; }
    .help-text { color: #64748b; font-size: 13px; }
    .text-center { text-align: center; }
    .py-4 { padding-top: 1.5rem; padding-bottom: 1.5rem; }
    .mb-2 { margin-bottom: 0.5rem; }
    .mb-3 { margin-bottom: 0.75rem; }
    .mt-3 { margin-top: 0.75rem; }
    .d-flex { display: flex; }
    .align-items-center { align-items: center; }
    .justify-end { justify-content: flex-end; }
    .gap-2 { gap: 0.5rem; }
    table { background-color: #ffffff; }
  `]
})
export class GitLabDataComponent implements OnInit {
  events: GitLabEvent[] = [];
  filteredEvents: GitLabEvent[] = [];
  searchQuery = '';
  selectedKind = 'all';
  selectedPayload: string | null = null;
  showSimulateModal = false;
  activeDropdownId: string | null = null;
  isKindDropdownOpen = false;

  simForm = {
    object_kind: 'merge_request',
    title: 'MR #105: Update User Authentication SLA',
    actor: 'sarah.reviewer',
    duration_hours: 2,
    is_bug: false
  };

  loading = false;
  isDropup = false;

  constructor(private okrService: OkrService, private confirmService: ConfirmDialogService) {}

  ngOnInit(): void {
    this.loadEvents();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeDropdownId = null;
    this.isKindDropdownOpen = false;
  }

  toggleDropdown(id: string, event: MouseEvent): void {
    event.stopPropagation();
    this.isKindDropdownOpen = false;
    if (this.activeDropdownId === id) {
      this.activeDropdownId = null;
      return;
    }
    this.activeDropdownId = id;
    const trigger = event.currentTarget as HTMLElement;
    if (trigger) {
      const rect = trigger.getBoundingClientRect();
      this.isDropup = (window.innerHeight - rect.bottom) < 170;
    }
  }

  closeDropdown(): void {
    this.activeDropdownId = null;
  }

  toggleKindDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.activeDropdownId = null;
    this.isKindDropdownOpen = !this.isKindDropdownOpen;
  }

  selectKind(kind: string): void {
    this.selectedKind = kind;
    this.isKindDropdownOpen = false;
    this.filterEvents();
  }

  getSelectedKindLabel(): string {
    switch (this.selectedKind) {
      case 'merge_request': return 'merge_request (MR Approval)';
      case 'issue': return 'issue (Issue / Bug Close)';
      default: return 'Tất cả loại sự kiện (All Objects)';
    }
  }

  async deleteEvent(evt: GitLabEvent): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Sự kiện GitLab',
      message: `Bạn có chắc chắn muốn xóa sự kiện "${evt.event_key}" (${evt.object_kind}) khỏi cơ sở dữ liệu không? Bảng bằng chứng truy vết SLA liên quan cũng sẽ bị xóa.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.loading = true;
    this.okrService.deleteGitLabEvent(evt.event_key).subscribe({
      next: () => {
        this.events = this.events.filter(e => e.event_key !== evt.event_key);
        this.filterEvents();
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        console.error('Lỗi khi xóa sự kiện:', err);
        alert('Lỗi khi xóa sự kiện: ' + (err.error?.error || err.message));
      }
    });
  }

  loadEvents(): void {
    this.loading = true;
    this.okrService.getGitLabEvents().subscribe({
      next: (evts) => {
        this.events = evts || [];
        this.filterEvents();
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading events:', err);
        this.loading = false;
      }
    });
  }

  filterEvents(): void {
    this.filteredEvents = this.events.filter(e => {
      const matchQuery = !this.searchQuery || 
        e.event_key.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        e.actor_id.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        e.project_code.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      const matchKind = this.selectedKind === 'all' || e.object_kind === this.selectedKind;
      return matchQuery && matchKind;
    });
  }

  viewPayload(evt: GitLabEvent): void {
    try {
      this.selectedPayload = JSON.stringify(JSON.parse(evt.raw_payload), null, 2);
    } catch {
      this.selectedPayload = evt.raw_payload;
    }
  }

  isSimulating = false;

  openSimulateModal(): void {
    this.isSimulating = false;
    this.showSimulateModal = true;
  }

  submitSimulation(): void {
    if (this.isSimulating) return;
    this.isSimulating = true;
    this.okrService.simulateEvent(this.simForm).subscribe({
      next: () => {
        this.isSimulating = false;
        this.showSimulateModal = false;
        this.loadEvents();
      },
      error: (err) => {
        this.isSimulating = false;
        console.error('Error simulating event:', err);
        alert('Gửi mô phỏng thất bại: ' + (err.error?.error || err.message));
      }
    });
  }

  formatDate(iso: string): string {
    if (!iso) return '-';
    return new Date(iso).toLocaleString('vi-VN');
  }

  getStatusBadge(status: string): string {
    switch (status) {
      case 'success': return 'badge-success';
      case 'duplicate': return 'badge-danger';
      case 'excluded': return 'badge-warning';
      default: return 'badge-info';
    }
  }
}
