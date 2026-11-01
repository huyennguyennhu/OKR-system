import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OkrService } from '../../services/okr.service';

export interface WeekDay {
  key: string;
  label: string;
  isWork: boolean;
}

@Component({
  selector: 'app-working-time',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="working-time-page">
      <!-- Toast Notification -->
      <div class="alert alert-success toast-floating" *ngIf="toastMessage">
        <i class="fa-solid fa-circle-check me-2"></i> {{ toastMessage }}
      </div>

      <!-- Header -->
      <div class="page-top-bar d-flex align-items-center justify-content-between mb-4">
        <div>
          <h3 class="card-title mb-1" style="font-size: 16px; font-weight: 700;">Working Time</h3>
          <p class="subtitle mb-0" style="font-size: 13px; color: #64748b;">
            Cấu hình thời gian làm việc ca sáng, ca chiều và các ngày làm việc trong tuần để tự động tính toán SLA.
          </p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary btn-sm" (click)="saveSettings()">
            <i class="fa-solid fa-check me-1"></i> Lưu cấu hình
          </button>
        </div>
      </div>

      <div class="working-time-container">
        <!-- Khối Khung Giờ Làm Việc Chuẩn -->
        <div class="card p-4 shadow-sm mb-4 working-time-card">
          <div class="d-flex align-items-center justify-content-between pb-3 mb-4 border-bottom">
            <div class="d-flex align-items-center gap-2">
              <i class="fa-solid fa-business-time text-primary" style="font-size: 18px;"></i>
              <h4 class="card-title mb-0" style="font-size: 15px; font-weight: 700; color: #1e293b;">Khung Giờ Làm Việc Chuẩn</h4>
            </div>
            <span class="badge badge-info fw-semibold">{{ getTotalWorkHours() }} giờ/ngày</span>
          </div>

          <!-- Grid 2 ca: Ca sáng và Ca chiều nằm cạnh nhau trên 1 hàng -->
          <div class="shifts-row-grid mb-3">
            <!-- Ca sáng -->
            <div class="rule-mini-box p-3 border rounded bg-light">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="fw-semibold text-dark d-flex align-items-center gap-2" style="font-size: 13px;">
                  <i class="fa-regular fa-sun text-warning" style="font-size: 15px;"></i> Ca sáng
                </span>
                <span class="text-muted" style="font-size: 12px; font-weight: 500;">{{ getMorningHours() }} giờ hiệu dụng</span>
              </div>
              <!-- Bắt đầu & Kết thúc nằm trên 1 hàng -->
              <div class="shift-inputs-row">
                <div class="time-field">
                  <label class="time-label">Bắt đầu</label>
                  <div class="time-input-group">
                    <input type="text" class="form-control time-input" [(ngModel)]="workCalendar.morningStart" placeholder="08:00">
                    <span class="time-unit">VN</span>
                  </div>
                </div>
                <div class="time-field">
                  <label class="time-label">Kết thúc</label>
                  <div class="time-input-group">
                    <input type="text" class="form-control time-input" [(ngModel)]="workCalendar.morningEnd" placeholder="12:00">
                    <span class="time-unit">VN</span>
                  </div>
                </div>
              </div>

            </div>

            <!-- Ca chiều -->
            <div class="rule-mini-box p-3 border rounded bg-light">
              <div class="d-flex justify-content-between align-items-center mb-3">
                <span class="fw-semibold text-dark d-flex align-items-center gap-2" style="font-size: 13px;">
                  <i class="fa-solid fa-cloud-sun text-primary" style="font-size: 15px;"></i> Ca chiều
                </span>
                <span class="text-muted" style="font-size: 12px; font-weight: 500;">{{ getAfternoonHours() }} giờ hiệu dụng</span>
              </div>
              <!-- Bắt đầu & Kết thúc nằm trên 1 hàng -->
              <div class="shift-inputs-row">
                <div class="time-field">
                  <label class="time-label">Bắt đầu</label>
                  <div class="time-input-group">
                    <input type="text" class="form-control time-input" [(ngModel)]="workCalendar.afternoonStart" placeholder="13:30">
                    <span class="time-unit">VN</span>
                  </div>
                </div>
                <div class="time-field">
                  <label class="time-label">Kết thúc</label>
                  <div class="time-input-group">
                    <input type="text" class="form-control time-input" [(ngModel)]="workCalendar.afternoonEnd" placeholder="17:30">
                    <span class="time-unit">VN</span>
                  </div>
                </div>
              </div>

            </div>
          </div>

          <!-- Khối Các ngày làm việc trong tuần -->
          <div class="rule-mini-box p-3 border rounded bg-light">
            <div class="d-flex justify-content-between align-items-center mb-2">
              <span class="fw-semibold text-dark d-flex align-items-center gap-2" style="font-size: 13.5px;">
                <i class="fa-solid fa-calendar-check text-success" style="font-size: 15px;"></i> Các ngày làm việc trong tuần
              </span>
              <span class="badge badge-primary fw-semibold">{{ getWorkingDaysCount() }} ngày đi làm / tuần</span>
            </div>
            <p class="text-muted mb-3" style="font-size: 12px; line-height: 1.4;">
              Chọn các ngày có đi làm để hệ thống tính thời gian SLA. Ngày không chọn (bỏ tick) sẽ tự động được xem là ngày nghỉ.
            </p>
            
            <!-- Tất cả 7 khối thứ nằm trên 1 HÀNG -->
            <div class="days-row-grid">
              <div class="day-card-box" 
                   *ngFor="let day of weekDays"
                   [class.selected]="day.isWork"
                   (click)="toggleDay(day)">
                <div class="form-check d-flex justify-content-center m-0 mb-1" style="pointer-events: none;">
                  <input class="form-check-input" type="checkbox" [checked]="day.isWork" tabindex="-1">
                </div>
                <div class="day-title" [class.text-primary]="day.isWork">{{ day.label }}</div>
                <span class="day-badge" [ngClass]="day.isWork ? 'badge-work' : 'badge-off'">
                  {{ day.isWork ? 'Đi làm' : 'Nghỉ' }}
                </span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `,
  styles: [`
    .working-time-page {
      padding: 0;
    }
    .working-time-container {
      max-width: 960px;
      width: 100%;
    }
    .working-time-card {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      padding: 24px;
    }
    .toast-floating {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 280px;
    }

    /* Grid cho Ca sáng và Ca chiều cạnh nhau trên 1 hàng */
    .shifts-row-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
    }
    @media (max-width: 768px) {
      .shifts-row-grid {
        grid-template-columns: 1fr;
      }
    }

    /* Grid cho Bắt đầu và Kết thúc trên 1 hàng trong mỗi ca */
    .shift-inputs-row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
    }
    .time-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .time-label {
      font-size: 12px;
      font-weight: 500;
      color: #64748b;
      margin-bottom: 2px;
    }
    .time-input-group {
      display: flex;
      align-items: stretch;
      height: 32px;
      width: 100%;
    }
    .time-input-group .time-input {
      flex: 1;
      height: 32px;
      font-size: 13px;
      font-weight: 500;
      border: 1px solid #cbd5e1;
      border-top-left-radius: 6px;
      border-bottom-left-radius: 6px;
      border-top-right-radius: 0;
      border-bottom-right-radius: 0;
      padding: 0 10px;
      outline: none;
      color: #1e293b;
      background: #ffffff;
      transition: all 0.15s ease;
    }
    .time-input-group .time-input:focus {
      border-color: #3157D5;
      box-shadow: 0 0 0 2px rgba(49, 87, 213, 0.15);
    }
    .time-input-group .time-unit {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 0 10px;
      background-color: #f8fafc;
      border: 1px solid #cbd5e1;
      border-left: none;
      border-top-right-radius: 6px;
      border-bottom-right-radius: 6px;
      font-size: 11.5px;
      font-weight: 600;
      color: #64748b;
      user-select: none;
    }

    /* Grid cho 7 ngày trong tuần trên 1 hàng */
    .days-row-grid {
      display: grid;
      grid-template-columns: repeat(7, 1fr);
      gap: 10px;
    }
    @media (max-width: 768px) {
      .days-row-grid {
        grid-template-columns: repeat(4, 1fr);
      }
    }
    @media (max-width: 480px) {
      .days-row-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .day-card-box {
      cursor: pointer;
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 4px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      transition: all 0.2s ease;
      user-select: none;
      min-height: 82px;
    }
    .day-card-box:hover {
      border-color: #3157D5 !important;
      background: #f8fafc;
      transform: translateY(-1px);
    }
    .day-card-box.selected {
      border-color: #3157D5 !important;
      background: #EEF1FC;
    }
    .day-card-box .form-check-input {
      width: 15px;
      height: 15px;
      cursor: pointer;
      pointer-events: none;
      margin: 0;
    }
    .day-card-box .day-title {
      font-size: 13px;
      font-weight: 700;
      color: #334155;
      margin-bottom: 2px;
    }
    .day-card-box.selected .day-title {
      color: #3157D5;
    }
    .day-badge {
      font-size: 10.5px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 10px;
      display: inline-block;
      line-height: 1.2;
    }
    .badge-work {
      background-color: #d1fae5;
      color: #047857;
      border: 1px solid #a7f3d0;
    }
    .badge-off {
      background-color: #f1f5f9;
      color: #64748b;
      border: 1px solid #cbd5e1;
    }
  `]
})
export class WorkingTimeComponent implements OnInit {
  toastMessage: string | null = null;

  constructor(private okrService: OkrService) {}

  workCalendar = {
    zone: 'Asia/Ho_Chi_Minh',
    morningStart: '08:00',
    morningEnd: '12:00',
    afternoonStart: '13:30',
    afternoonEnd: '17:30'
  };

  weekDays: WeekDay[] = [
    { key: 'mon', label: 'Thứ 2', isWork: true },
    { key: 'tue', label: 'Thứ 3', isWork: true },
    { key: 'wed', label: 'Thứ 4', isWork: true },
    { key: 'thu', label: 'Thứ 5', isWork: true },
    { key: 'fri', label: 'Thứ 6', isWork: true },
    { key: 'sat', label: 'Thứ 7', isWork: false },
    { key: 'sun', label: 'Chủ Nhật', isWork: false },
  ];

  ngOnInit(): void {
    // 1. Fetch from Database
    this.okrService.getWorkingHours().subscribe({
      next: (data: any) => {
        if (data && data.workCalendar) {
          this.workCalendar = {
            ...this.workCalendar,
            ...data.workCalendar,
            morningStart: data.workCalendar.morningStart || '08:00',
            morningEnd: data.workCalendar.morningEnd || '12:00',
            afternoonStart: data.workCalendar.afternoonStart || '13:30',
            afternoonEnd: data.workCalendar.afternoonEnd || '17:30'
          };
        }
        if (data && data.weekDays && Array.isArray(data.weekDays) && data.weekDays.length > 0) {
          this.weekDays = data.weekDays.map((d: any) => ({
            key: d.key || d.code || 'day',
            label: d.label || d.name || 'Ngày',
            isWork: d.isWork !== undefined ? !!d.isWork : true
          }));
        }
      },
      error: (err) => {
        console.warn('Could not load working hours from API, fallback to localStorage', err);
        const saved = localStorage.getItem('okr_working_calendar');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.workCalendar) {
              this.workCalendar = {
                ...this.workCalendar,
                ...parsed.workCalendar,
                morningStart: parsed.workCalendar.morningStart || parsed.workCalendar.workStart || '08:00',
                morningEnd: parsed.workCalendar.morningEnd || parsed.workCalendar.lunchStart || '12:00',
                afternoonStart: parsed.workCalendar.afternoonStart || parsed.workCalendar.lunchEnd || '13:30',
                afternoonEnd: parsed.workCalendar.afternoonEnd || parsed.workCalendar.workEnd || '17:30'
              };
            }
            if (parsed.weekDays && Array.isArray(parsed.weekDays)) {
              this.weekDays = parsed.weekDays;
            }
          } catch (e) {}
        }
      }
    });
  }

  toggleDay(day: WeekDay): void {
    day.isWork = !day.isWork;
  }

  getWorkingDaysCount(): number {
    return this.weekDays.filter(d => d.isWork).length;
  }

  private parseTimeToMinutes(t: string): number {
    if (!t) return 0;
    const parts = t.split(':');
    return parseInt(parts[0], 10) * 60 + parseInt(parts[1] || '0', 10);
  }

  getMorningHours(): number {
    const start = this.parseTimeToMinutes(this.workCalendar.morningStart);
    const end = this.parseTimeToMinutes(this.workCalendar.morningEnd);
    if (end <= start) return 0;
    return Math.round(((end - start) / 60) * 10) / 10;
  }

  getAfternoonHours(): number {
    const start = this.parseTimeToMinutes(this.workCalendar.afternoonStart);
    const end = this.parseTimeToMinutes(this.workCalendar.afternoonEnd);
    if (end <= start) return 0;
    return Math.round(((end - start) / 60) * 10) / 10;
  }

  getTotalWorkHours(): number {
    return Math.round((this.getMorningHours() + this.getAfternoonHours()) * 10) / 10;
  }

  saveSettings(): void {
    this.okrService.saveWorkingHours({
      workCalendar: this.workCalendar,
      weekDays: this.weekDays
    }).subscribe({
      next: () => {
        let savedData: any = {};
        const saved = localStorage.getItem('okr_working_calendar');
        if (saved) {
          try { savedData = JSON.parse(saved); } catch (e) {}
        }
        savedData.workCalendar = this.workCalendar;
        savedData.weekDays = this.weekDays;
        localStorage.setItem('okr_working_calendar', JSON.stringify(savedData));
        this.toastMessage = 'Đã lưu cấu hình Lịch làm việc vào cơ sở dữ liệu thành công!';
        setTimeout(() => this.toastMessage = null, 3000);
      },
      error: (err) => {
        console.warn('API error saving working hours:', err);
        let savedData: any = {};
        const saved = localStorage.getItem('okr_working_calendar');
        if (saved) {
          try { savedData = JSON.parse(saved); } catch (e) {}
        }
        savedData.workCalendar = this.workCalendar;
        savedData.weekDays = this.weekDays;
        localStorage.setItem('okr_working_calendar', JSON.stringify(savedData));
        this.toastMessage = 'Đã lưu cấu hình Lịch làm việc thành công!';
        setTimeout(() => this.toastMessage = null, 3000);
      }
    });
  }
}
