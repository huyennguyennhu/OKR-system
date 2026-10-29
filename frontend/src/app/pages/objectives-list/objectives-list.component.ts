import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OkrService, Objective, Employee, Metric, Timeline } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-objectives-list',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  templateUrl: './objectives-list.component.html',
  styleUrls: ['./objectives-list.component.css']
})
export class ObjectivesListComponent implements OnInit {
  objectives: Objective[] = [];
  loading = true;
  activeDropdownId: string | null = null;
  searchQuery = '';
  selectedLevel = 'all';
  isLevelDropdownOpen = false;
  
  showCreateModal = false;
  saving = false;
  isDropup = false;

  newObjective: Partial<Objective> = {
    level: 'COMPANY',
    progress: 0,
    start_value: 0,
    expected_value: 100,
    category: 'Objective'
  };

  employees: Employee[] = [];
  metrics: Metric[] = [];
  timelines: Timeline[] = [];

  get filteredObjectives(): Objective[] {
    return this.objectives.filter(obj => {
      const q = this.searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        (obj.objective_id && obj.objective_id.toLowerCase().includes(q)) ||
        (obj.title && obj.title.toLowerCase().includes(q));

      const matchLevel = this.selectedLevel === 'all' || 
        (obj.level && obj.level.toUpperCase() === this.selectedLevel.toUpperCase());

      return matchSearch && matchLevel;
    });
  }

  constructor(
    private okrService: OkrService, 
    private router: Router,
    private confirmService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.loadObjectives();
    this.loadMetadata();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeDropdownId = null;
    this.isLevelDropdownOpen = false;
  }

  toggleLevelDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isLevelDropdownOpen = !this.isLevelDropdownOpen;
  }

  selectLevel(level: string): void {
    this.selectedLevel = level;
    this.isLevelDropdownOpen = false;
  }

  getSelectedLevelLabel(): string {
    switch (this.selectedLevel.toUpperCase()) {
      case 'COMPANY': return 'Cấp Công ty (COMPANY)';
      case 'TEAM': return 'Cấp Nhóm (TEAM)';
      case 'PERSONAL': return 'Cấp Cá nhân (PERSONAL)';
      default: return 'Tất cả cấp độ';
    }
  }

  toggleDropdown(id: string, event: MouseEvent): void {
    event.stopPropagation();
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

  loadObjectives(): void {
    this.loading = true;
    this.okrService.getObjectives().subscribe({
      next: (data) => {
        this.objectives = data || [];
        this.loading = false;
      },
      error: (err) => {
        console.error('Error fetching objectives', err);
        this.loading = false;
      }
    });
  }

  loadMetadata(): void {
    this.okrService.getEmployees().subscribe(data => this.employees = data || []);
    this.okrService.getMetrics().subscribe(data => this.metrics = data || []);
    this.okrService.getTimelines().subscribe(data => this.timelines = data || []);
  }

  createObjective(): void {
    this.newObjective = {
      level: 'COMPANY',
      progress: 0,
      start_value: 0,
      expected_value: 100,
      category: 'Objective'
    };
    this.showCreateModal = true;
  }

  editObjective(obj: Objective): void {
    this.viewObjective(obj.objective_id);
  }

  async cloneObjective(obj: Objective): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận nhân bản Mục tiêu',
      message: `Bạn có muốn nhân bản mục tiêu "${obj.title}" kèm các Key Results liên thuộc không?`,
      confirmText: 'Nhân bản',
      type: 'info'
    });
    if (!ok) return;

    this.loading = true;
    this.okrService.cloneObjective(obj.objective_id).subscribe({
      next: () => {
        this.loadObjectives();
      },
      error: (err) => {
        this.loading = false;
        console.error('Lỗi khi nhân bản mục tiêu:', err);
        this.confirmService.confirm({
          title: 'Lỗi khi nhân bản mục tiêu',
          message: err.error?.error || 'Không thể nhân bản mục tiêu này. Vui lòng kiểm tra lại kết nối cơ sở dữ liệu.',
          confirmText: 'Đóng',
          cancelText: '',
          type: 'danger'
        });
      }
    });
  }

  async deleteObjective(obj: Objective): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Mục tiêu',
      message: `Bạn có chắc chắn muốn xóa mục tiêu "${obj.title}" (${obj.objective_id}) không? Các kết quả then chốt và dữ liệu đo lường liên quan sẽ bị xóa vĩnh viễn.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteObjective(obj.objective_id).subscribe({
      next: () => {
        this.objectives = this.objectives.filter(o => o.objective_id !== obj.objective_id);
      },
      error: (err) => alert('Lỗi khi xóa mục tiêu: ' + (err.error?.error || err.message))
    });
  }

  closeCreateModal(): void {
    if (this.saving) return;
    this.showCreateModal = false;
  }

  saveObjective(): void {
    if (this.saving) return;
    if (!this.newObjective.title) return alert('Vui lòng nhập Tên Mục tiêu');
    this.saving = true;
    this.okrService.createObjective(this.newObjective).subscribe({
      next: () => {
        this.saving = false;
        this.showCreateModal = false;
        this.loadObjectives();
      },
      error: (err) => {
        console.error(err);
        this.saving = false;
        alert('Lưu mục tiêu thất bại: ' + (err.error?.error || err.message));
      }
    });
  }

  viewObjective(id: string): void {
    this.router.navigate(['/objectives', id]);
  }
}
