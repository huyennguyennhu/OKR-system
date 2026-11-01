import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OkrService } from '../../services/okr.service';

export interface HolidayItem {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  isActive: boolean;
  note: string;
}

@Component({
  selector: 'app-calendar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="calendar-page">
      <!-- Toast Notification -->
      <div class="alert alert-success toast-floating" *ngIf="toastMessage">
        <i class="fa-solid fa-circle-check me-2"></i> {{ toastMessage }}
      </div>

      <!-- Header -->
      <div class="page-top-bar d-flex align-items-center justify-content-between mb-4">
        <div>
          <h3 class="card-title mb-1" style="font-size: 16px; font-weight: 700;">Calendar</h3>
          <p class="subtitle mb-0" style="font-size: 13px; color: #64748b;">
            Lịch nghỉ Lễ & Tết Việt Nam - Các mốc thời gian diễn ra trong kỳ nghỉ lễ sẽ tự động được đóng băng và không bị tính vi phạm SLA của đội ngũ phát triển.
          </p>
        </div>
        <div class="header-actions">
          <button class="btn btn-primary btn-sm" (click)="saveSettings()">
            <i class="fa-solid fa-check me-1"></i> Lưu cấu hình
          </button>
        </div>
      </div>

      <!-- Khối Danh sách Lịch nghỉ lễ & Tết Việt Nam -->
      <div class="card p-3 shadow-sm h-100">
        <div class="d-flex align-items-center justify-content-between pb-2 mb-3 border-bottom">
          <div class="d-flex align-items-center gap-2">
            <i class="fa-solid fa-flag text-danger" style="font-size: 16px;"></i>
            <h4 class="card-title mb-0" style="font-size: 14px; font-weight: 700;">Lịch Nghỉ Lễ & Tết Việt Nam</h4>
          </div>
          <span class="badge bg-danger">{{ getActiveHolidayCount() }} kỳ nghỉ kích hoạt</span>
        </div>

        <p class="text-muted mb-3" style="font-size: 12.5px;">
          Các mốc thời gian diễn ra trong kỳ nghỉ lễ sẽ tự động được đóng băng và không bị tính vi phạm SLA của đội ngũ phát triển.
        </p>

        <div class="holiday-list">
          <div *ngFor="let h of holidays" class="holiday-item p-3 mb-2 border rounded d-flex align-items-center justify-content-between" [class.bg-light]="!h.isActive">
            <div class="d-flex align-items-center gap-3">
              <div class="form-check form-switch mb-0">
                <input class="form-check-input" type="checkbox" [(ngModel)]="h.isActive">
              </div>
              <div>
                <div class="fw-bold text-dark" style="font-size: 13.5px;">{{ h.name }}</div>
                <div class="text-muted" style="font-size: 12px;">
                  <i class="fa-regular fa-calendar me-1"></i> {{ h.startDate }} &rarr; {{ h.endDate }} ({{ h.daysCount }} ngày)
                </div>
                <div class="text-secondary small mt-1" style="font-size: 11.5px;">{{ h.note }}</div>
              </div>
            </div>
            <span class="badge" [ngClass]="h.isActive ? 'badge-success' : 'badge-secondary'">
              {{ h.isActive ? 'Đang áp dụng' : 'Tạm tắt' }}
            </span>
          </div>
        </div>


      </div>
    </div>
  `,
  styles: [`
    .toast-floating {
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      min-width: 280px;
    }
    .holiday-item {
      transition: all 0.2s ease;
      background: #ffffff;
    }
    .holiday-item:hover {
      border-color: #94a3b8 !important;
      box-shadow: 0 2px 4px rgba(0,0,0,0.03);
    }
  `]
})
export class CalendarComponent implements OnInit {
  toastMessage: string | null = null;

  constructor(private okrService: OkrService) {}

  holidays: HolidayItem[] = [
    {
      id: 'HL-01',
      name: 'Tết Dương Lịch 2026',
      startDate: '2026-01-01',
      endDate: '2026-01-01',
      daysCount: 1,
      isActive: true,
      note: 'Nghỉ 1 ngày theo luật'
    },
    {
      id: 'HL-02',
      name: 'Tết Nguyên Đán Bính Ngọ 2026',
      startDate: '2026-02-15',
      endDate: '2026-02-23',
      daysCount: 9,
      isActive: true,
      note: 'Nghỉ 9 ngày (từ 28 tháng Chạp đến hết mùng 6 tháng Giêng)'
    },
    {
      id: 'HL-03',
      name: 'Giỗ Tổ Hùng Vương (10/03 Âm lịch)',
      startDate: '2026-04-26',
      endDate: '2026-04-26',
      daysCount: 1,
      isActive: true,
      note: 'Nghỉ lễ Quốc gia'
    },
    {
      id: 'HL-04',
      name: 'Ngày Chiến thắng 30/04 & Quốc tế Lao động 01/05',
      startDate: '2026-04-30',
      endDate: '2026-05-03',
      daysCount: 4,
      isActive: true,
      note: 'Nghỉ nối ngày cuối tuần'
    },
    {
      id: 'HL-05',
      name: 'Lễ Quốc Khánh 02/09',
      startDate: '2026-09-01',
      endDate: '2026-09-03',
      daysCount: 3,
      isActive: true,
      note: 'Nghỉ Quốc khánh 2 ngày theo quy định'
    }
  ];

  ngOnInit(): void {
    // 1. Fetch from Database
    this.okrService.getHolidays().subscribe({
      next: (data: any[]) => {
        if (data && data.length > 0) {
          this.holidays = data.map(h => ({
            id: h.id,
            name: h.name,
            startDate: h.startDate || h.start_date,
            endDate: h.endDate || h.end_date,
            daysCount: h.daysCount !== undefined ? h.daysCount : h.days_count,
            isActive: h.isActive !== undefined ? h.isActive : h.is_active,
            note: h.note || ''
          }));
        }
      },
      error: (err) => {
        console.warn('Could not load holidays from API, reading localStorage fallback', err);
        const saved = localStorage.getItem('okr_working_calendar');
        if (saved) {
          try {
            const parsed = JSON.parse(saved);
            if (parsed.holidays && Array.isArray(parsed.holidays)) {
              this.holidays = parsed.holidays;
            }
          } catch (e) {}
        }
      }
    });
  }

  getActiveHolidayCount(): number {
    return this.holidays.filter(h => h.isActive).length;
  }

  saveSettings(): void {
    this.okrService.saveHolidays(this.holidays).subscribe({
      next: () => {
        let savedData: any = {};
        const saved = localStorage.getItem('okr_working_calendar');
        if (saved) {
          try { savedData = JSON.parse(saved); } catch (e) {}
        }
        savedData.holidays = this.holidays;
        localStorage.setItem('okr_working_calendar', JSON.stringify(savedData));
        this.toastMessage = 'Đã lưu cấu hình Lịch nghỉ Lễ & Tết vào cơ sở dữ liệu thành công!';
        setTimeout(() => this.toastMessage = null, 3000);
      },
      error: (err) => {
        console.warn('API error saving holidays:', err);
        let savedData: any = {};
        const saved = localStorage.getItem('okr_working_calendar');
        if (saved) {
          try { savedData = JSON.parse(saved); } catch (e) {}
        }
        savedData.holidays = this.holidays;
        localStorage.setItem('okr_working_calendar', JSON.stringify(savedData));
        this.toastMessage = 'Đã lưu cấu hình Lịch nghỉ Lễ & Tết thành công!';
        setTimeout(() => this.toastMessage = null, 3000);
      }
    });
  }
}

