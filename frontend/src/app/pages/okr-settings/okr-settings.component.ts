import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OkrService, MeasurementRule, Space, Timeline, Metric, SpaceMember, MetricConversion, Template } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

import { ObjectivesListComponent } from '../objectives-list/objectives-list.component';

@Component({
  selector: 'app-okr-settings',
  standalone: true,
  imports: [CommonModule, FormsModule, ObjectivesListComponent],
  templateUrl: './okr-settings.component.html',
  styleUrls: ['./okr-settings.component.css']
})
export class OkrSettingsComponent implements OnInit {
  tabs = [
    'Không gian', 'Thành viên', 'Chu kỳ', 'Thước đo', 'Mục tiêu'
  ];
  activeTab = 'Không gian';

  // Data arrays
  spaces: Space[] = [];
  timelines: Timeline[] = [];
  metrics: Metric[] = [];
  spaceMembers: SpaceMember[] = [];
  conversions: MetricConversion[] = [];
  progressTemplates: Template[] = [];
  aggregationTemplates: Template[] = [];
  rules: MeasurementRule[] = [];
  employees: any[] = [];

  // Action Dropdown state
  activeDropdownId: string | null = null;

  // Modals state
  showSpaceModal = false;
  isEditingSpace = false;
  showTimelineModal = false;
  isEditingTimeline = false;
  showMetricModal = false;
  isEditingMetric = false;
  showMemberModal = false;
  showConversionModal = false;
  showTemplateModal = false;
  isEditingTemplate = false;
  showRuleModal = false;

  // New / Edit Items
  newSpace: Partial<Space> = {};
  isSavingSpace = false;
  newTimeline: Partial<Timeline> = {};
  isSavingTimeline = false;
  newMetric: Partial<Metric> = {};
  isSavingMetric = false;
  newMember: Partial<SpaceMember> = {};
  isSavingMember = false;
  newConversion: Partial<MetricConversion> = {};
  isSavingConversion = false;
  newTemplate: Partial<Template> = {};
  isSavingTemplate = false;
  newRule: Partial<MeasurementRule> = {};

  // Dropdown states
  showSpaceDropdown = false;
  spaceSearchText = '';
  showEmployeeDropdown = false;
  employeeSearchText = '';

  // Space filter for Member tab
  selectedMemberSpaceId: string = 'all';
  isSpaceFilterDropdownOpen: boolean = false;

  loading = false;
  isDropup = false;

  constructor(private okrService: OkrService, private confirmService: ConfirmDialogService) {}

  ngOnInit(): void {
    this.loadAllData();
  }

  @HostListener('document:click')
  onDocumentClick(): void {
    this.activeDropdownId = null;
    this.isSpaceFilterDropdownOpen = false;
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

  loadAllData(): void {
    this.loading = true;
    forkJoin({
      spaces: this.okrService.getSpaces().pipe(catchError(() => of([]))),
      timelines: this.okrService.getTimelines().pipe(catchError(() => of([]))),
      metrics: this.okrService.getMetrics().pipe(catchError(() => of([]))),
      spaceMembers: this.okrService.getSpaceMembers().pipe(catchError(() => of([]))),
      conversions: this.okrService.getConversions().pipe(catchError(() => of([]))),
      progressTemplates: this.okrService.getTemplates('PROGRESS').pipe(catchError(() => of([]))),
      aggregationTemplates: this.okrService.getTemplates('AGGREGATION').pipe(catchError(() => of([]))),
      rules: this.okrService.getRules().pipe(catchError(() => of([]))),
      employees: this.okrService.getEmployees().pipe(catchError(() => of([])))
    }).subscribe({
      next: (res) => {
        this.spaces = res.spaces || [];
        this.timelines = res.timelines || [];
        this.metrics = res.metrics || [];
        this.spaceMembers = res.spaceMembers || [];
        this.conversions = res.conversions || [];
        this.progressTemplates = res.progressTemplates || [];
        this.aggregationTemplates = res.aggregationTemplates || [];
        this.rules = res.rules || [];
        this.employees = res.employees || [];
        this.loading = false;
      },
      error: () => {
        this.loading = false;
      }
    });
  }

  switchTab(tab: string) {
    this.activeTab = tab;
    this.activeDropdownId = null;
    this.isSpaceFilterDropdownOpen = false;
  }

  // --- SPACE FILTER FOR MEMBER TAB ---
  toggleSpaceFilterDropdown(event: MouseEvent): void {
    event.stopPropagation();
    this.isSpaceFilterDropdownOpen = !this.isSpaceFilterDropdownOpen;
  }

  selectMemberSpace(spaceId: string): void {
    this.selectedMemberSpaceId = spaceId;
    this.isSpaceFilterDropdownOpen = false;
  }

  getSelectedSpaceFilterLabel(): string {
    if (!this.selectedMemberSpaceId || this.selectedMemberSpaceId === 'all') {
      return 'Tất cả Không gian';
    }
    const found = this.spaces.find(s => s.id === this.selectedMemberSpaceId);
    return found ? `${found.name} (${found.space_key})` : this.selectedMemberSpaceId;
  }

  get filteredSpaceMembers(): SpaceMember[] {
    if (!this.selectedMemberSpaceId || this.selectedMemberSpaceId === 'all') {
      return this.spaceMembers;
    }
    return this.spaceMembers.filter(m => m.space_id === this.selectedMemberSpaceId);
  }

  getSpaceName(spaceId: string): string {
    const s = this.spaces.find(sp => sp.id === spaceId);
    return s ? `${s.name} (${s.space_key})` : (spaceId || '—');
  }

  openCreateMemberModal(): void {
    this.newMember = { role: 'Member' };
    if (this.selectedMemberSpaceId && this.selectedMemberSpaceId !== 'all') {
      const sp = this.spaces.find(s => s.id === this.selectedMemberSpaceId);
      if (sp) {
        this.newMember.space_id = sp.id;
        this.spaceSearchText = sp.name;
      }
    } else {
      this.spaceSearchText = '';
    }
    this.employeeSearchText = '';
    this.showMemberModal = true;
  }

  getTabIcon(tab: string): string {
    switch (tab) {
      case 'Không gian': return 'fa-solid fa-layer-group';
      case 'Thành viên': return 'fa-solid fa-users';
      case 'Chu kỳ': return 'fa-solid fa-calendar-days';
      case 'Thước đo': return 'fa-solid fa-ruler-combined';
      case 'Mục tiêu': return 'fa-solid fa-bullseye';
      default: return 'fa-solid fa-folder';
    }
  }

  // --- SPACE MODAL & CRUD ---
  openCreateSpaceModal() {
    this.newSpace = {};
    this.isEditingSpace = false;
    this.isSavingSpace = false;
    this.showSpaceModal = true;
  }

  editSpace(space: Space) {
    this.newSpace = { ...space };
    this.isEditingSpace = true;
    this.isSavingSpace = false;
    this.showSpaceModal = true;
  }

  async deleteSpace(space: Space): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Không gian',
      message: `Bạn có chắc chắn muốn xóa Không gian "${space.name}" (${space.space_key}) không? Thao tác này sẽ xóa vĩnh viễn khỏi hệ thống.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteSpace(space.id).subscribe({
      next: () => {
        this.spaces = this.spaces.filter(s => s.id !== space.id);
      },
      error: (err) => alert('Xóa không gian thất bại: ' + (err.error?.error || err.message))
    });
  }

  closeSpaceModal() {
    if (this.isSavingSpace) return;
    this.showSpaceModal = false;
  }

  saveSpace() {
    if (this.isSavingSpace) return;
    if (!this.newSpace.name || !this.newSpace.space_key) {
      return;
    }
    this.isSavingSpace = true;
    if (this.isEditingSpace && this.newSpace.id) {
      this.okrService.updateSpace(this.newSpace.id, this.newSpace).subscribe({
        next: () => {
          this.showSpaceModal = false;
          this.newSpace = {};
          this.isSavingSpace = false;
          this.isEditingSpace = false;
          this.okrService.getSpaces().subscribe(d => this.spaces = d);
        },
        error: (err) => {
          this.isSavingSpace = false;
          alert('Cập nhật không gian thất bại: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.okrService.createSpace(this.newSpace).subscribe({
        next: () => {
          this.showSpaceModal = false;
          this.newSpace = {};
          this.isSavingSpace = false;
          this.okrService.getSpaces().subscribe(d => this.spaces = d);
        },
        error: (err) => {
          this.isSavingSpace = false;
          alert('Lưu không gian thất bại: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  // --- TIMELINE MODAL & CRUD ---
  editTimeline(tl: Timeline) {
    this.newTimeline = { ...tl };
    this.isEditingTimeline = true;
    this.isSavingTimeline = false;
    this.showTimelineModal = true;
  }

  async deleteTimeline(tl: Timeline): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Chu kỳ',
      message: `Bạn có chắc chắn muốn xóa Chu kỳ "${tl.title}" không? Thao tác này sẽ xóa vĩnh viễn khỏi hệ thống.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteTimeline(tl.id).subscribe({
      next: () => {
        this.timelines = this.timelines.filter(t => t.id !== tl.id);
      },
      error: (err) => alert('Xóa chu kỳ thất bại: ' + (err.error?.error || err.message))
    });
  }

  saveTimeline() {
    if (this.isSavingTimeline) return;
    if (!this.newTimeline.title || !this.newTimeline.timeline_category) return;
    this.isSavingTimeline = true;
    if (this.isEditingTimeline && this.newTimeline.id) {
      this.okrService.updateTimeline(this.newTimeline.id, this.newTimeline).subscribe({
        next: () => {
          this.showTimelineModal = false;
          this.newTimeline = {};
          this.isSavingTimeline = false;
          this.isEditingTimeline = false;
          this.okrService.getTimelines().subscribe(d => this.timelines = d);
        },
        error: (err) => {
          this.isSavingTimeline = false;
          alert('Cập nhật chu kỳ thất bại: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.okrService.createTimeline(this.newTimeline).subscribe({
        next: () => {
          this.showTimelineModal = false;
          this.newTimeline = {};
          this.isSavingTimeline = false;
          this.okrService.getTimelines().subscribe(d => this.timelines = d);
        },
        error: (err) => {
          this.isSavingTimeline = false;
          alert('Lưu chu kỳ thất bại: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  // --- METRIC MODAL & CRUD ---
  editMetric(m: Metric) {
    this.newMetric = { ...m };
    this.isEditingMetric = true;
    this.isSavingMetric = false;
    this.showMetricModal = true;
  }

  async deleteMetric(m: Metric): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Thước đo',
      message: `Bạn có chắc chắn muốn xóa Thước đo "${m.name}" (${m.metric_key || m.unit}) không? Thao tác này sẽ xóa vĩnh viễn khỏi hệ thống.`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteMetric(m.id).subscribe({
      next: () => {
        this.metrics = this.metrics.filter(item => item.id !== m.id);
      },
      error: (err) => alert('Xóa thước đo thất bại: ' + (err.error?.error || err.message))
    });
  }

  saveMetric() {
    if (this.isSavingMetric) return;
    if (!this.newMetric.name) return;
    this.isSavingMetric = true;
    if (this.isEditingMetric && this.newMetric.id) {
      this.okrService.updateMetric(this.newMetric.id, this.newMetric).subscribe({
        next: () => {
          this.showMetricModal = false;
          this.newMetric = {};
          this.isSavingMetric = false;
          this.isEditingMetric = false;
          this.okrService.getMetrics().subscribe(d => this.metrics = d);
        },
        error: (err) => {
          this.isSavingMetric = false;
          alert('Cập nhật thước đo thất bại: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.okrService.createMetric(this.newMetric).subscribe({
        next: () => {
          this.showMetricModal = false;
          this.newMetric = {};
          this.isSavingMetric = false;
          this.okrService.getMetrics().subscribe(d => this.metrics = d);
        },
        error: (err) => {
          this.isSavingMetric = false;
          alert('Lưu thước đo thất bại: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  // --- SPACE MEMBER CRUD ---
  async deleteSpaceMember(sm: SpaceMember): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Thành viên',
      message: `Bạn có chắc chắn muốn xóa thành viên "${sm.user_name}" khỏi không gian không?`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteSpaceMember(sm.id).subscribe({
      next: () => {
        this.spaceMembers = this.spaceMembers.filter(m => m.id !== sm.id);
      },
      error: (err) => alert('Xóa thành viên thất bại: ' + (err.error?.error || err.message))
    });
  }

  saveMember() {
    if (this.isSavingMember) return;
    if (!this.newMember.space_id || !this.newMember.user_name || !this.newMember.role) return;
    this.isSavingMember = true;
    this.okrService.createSpaceMember(this.newMember).subscribe({
      next: () => {
        this.showMemberModal = false;
        this.newMember = {};
        this.spaceSearchText = '';
        this.employeeSearchText = '';
        this.isSavingMember = false;
        this.okrService.getSpaceMembers().subscribe(d => this.spaceMembers = d);
      },
      error: (err) => {
        this.isSavingMember = false;
        alert('Lưu thành viên thất bại: ' + (err.error?.error || err.message));
      }
    });
  }

  // --- CONVERSION CRUD ---
  async deleteConversion(cv: MetricConversion): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Quy đổi Thước đo',
      message: 'Bạn có chắc chắn muốn xóa quy đổi thước đo này không?',
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteConversion(cv.id).subscribe({
      next: () => {
        this.conversions = this.conversions.filter(c => c.id !== cv.id);
      },
      error: (err) => alert('Xóa quy đổi thất bại: ' + (err.error?.error || err.message))
    });
  }

  saveConversion() {
    if (this.isSavingConversion) return;
    if (!this.newConversion.source_metric_id || !this.newConversion.target_metric_id || !this.newConversion.conversion_ratio) return;
    this.isSavingConversion = true;
    this.okrService.createConversion(this.newConversion).subscribe({
      next: () => {
        this.showConversionModal = false;
        this.newConversion = {};
        this.isSavingConversion = false;
        this.okrService.getConversions().subscribe(d => this.conversions = d);
      },
      error: (err) => {
        this.isSavingConversion = false;
        alert('Lưu quy đổi thất bại: ' + (err.error?.error || err.message));
      }
    });
  }

  // --- TEMPLATES CRUD ---
  editTemplate(t: Template) {
    this.newTemplate = { ...t };
    this.isEditingTemplate = true;
    this.isSavingTemplate = false;
    this.showTemplateModal = true;
  }

  async deleteTemplate(t: Template): Promise<void> {
    const ok = await this.confirmService.confirm({
      title: 'Xác nhận xóa Mẫu công thức',
      message: `Bạn có chắc chắn muốn xóa Mẫu công thức "${t.name}" không?`,
      confirmText: 'Xác nhận xóa',
      type: 'danger'
    });
    if (!ok) return;

    this.okrService.deleteTemplate(t.id).subscribe({
      next: () => {
        this.progressTemplates = this.progressTemplates.filter(item => item.id !== t.id);
        this.aggregationTemplates = this.aggregationTemplates.filter(item => item.id !== t.id);
      },
      error: (err) => alert('Xóa mẫu công thức thất bại: ' + (err.error?.error || err.message))
    });
  }

  saveTemplate() {
    if (this.isSavingTemplate) return;
    if (!this.newTemplate.name || !this.newTemplate.formula) return;
    this.isSavingTemplate = true;
    const type = this.activeTab === 'Công thức Tiến độ' ? 'PROGRESS' : 'AGGREGATION';
    this.newTemplate.template_type = type;

    if (this.isEditingTemplate && this.newTemplate.id) {
      this.okrService.updateTemplate(this.newTemplate.id, this.newTemplate).subscribe({
        next: () => {
          this.showTemplateModal = false;
          this.newTemplate = {};
          this.isSavingTemplate = false;
          this.isEditingTemplate = false;
          if (type === 'PROGRESS') {
            this.okrService.getTemplates('PROGRESS').subscribe(d => this.progressTemplates = d);
          } else {
            this.okrService.getTemplates('AGGREGATION').subscribe(d => this.aggregationTemplates = d);
          }
        },
        error: (err) => {
          this.isSavingTemplate = false;
          alert('Cập nhật công thức thất bại: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.okrService.createTemplate(this.newTemplate).subscribe({
        next: () => {
          this.showTemplateModal = false;
          this.newTemplate = {};
          this.isSavingTemplate = false;
          if (type === 'PROGRESS') {
            this.okrService.getTemplates('PROGRESS').subscribe(d => this.progressTemplates = d);
          } else {
            this.okrService.getTemplates('AGGREGATION').subscribe(d => this.aggregationTemplates = d);
          }
        },
        error: (err) => {
          this.isSavingTemplate = false;
          alert('Lưu công thức thất bại: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  saveRule(): void {
    this.okrService.saveRule(this.newRule).subscribe(() => {
      this.showRuleModal = false;
      this.newRule = {};
      this.okrService.getRules().subscribe(r => this.rules = r);
    });
  }

  // --- DROPDOWN LOGIC ---
  get filteredSpaces() {
    return this.spaces.filter(s => s.name.toLowerCase().includes(this.spaceSearchText.toLowerCase()));
  }

  get filteredEmployees() {
    return this.employees.filter(e => e.name.toLowerCase().includes(this.employeeSearchText.toLowerCase()));
  }

  selectSpace(space: Space) {
    this.newMember.space_id = space.id;
    this.spaceSearchText = space.name;
    this.showSpaceDropdown = false;
  }

  hideSpaceDropdown() {
    setTimeout(() => this.showSpaceDropdown = false, 200);
  }

  selectEmployee(emp: any) {
    this.newMember.user_name = emp.name;
    this.employeeSearchText = emp.name;
    this.showEmployeeDropdown = false;
  }

  hideEmployeeDropdown() {
    setTimeout(() => this.showEmployeeDropdown = false, 200);
  }

  openCreateSpace() {
    this.showSpaceDropdown = false;
    this.showMemberModal = false;
    this.openCreateSpaceModal();
  }

  // --- AUTO GENERATE KEY ---
  generateKey(name: string | undefined): string {
    if (!name) return '';
    return name
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // Bỏ dấu tiếng Việt
      .replace(/đ/g, 'd').replace(/Đ/g, 'D')
      .replace(/[^a-zA-Z0-9\s]/g, '') // Bỏ ký tự đặc biệt
      .trim()
      .replace(/\s+/g, '_') // Thay khoảng trắng bằng dấu gạch dưới
      .toUpperCase();
  }

  onSpaceNameChange(name: string) {
    this.newSpace.space_key = this.generateKey(name);
  }

  onMetricNameChange(name: string) {
    this.newMetric.metric_key = this.generateKey(name);
  }
}
