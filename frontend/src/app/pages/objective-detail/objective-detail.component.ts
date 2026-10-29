import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { OkrService, Objective, Employee, Metric, Timeline, KeyResult } from '../../services/okr.service';
import { ConfirmDialogService } from '../../services/confirm-dialog.service';

@Component({
  selector: 'app-objective-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './objective-detail.component.html',
  styleUrls: ['./objective-detail.component.css']
})
export class ObjectiveDetailComponent implements OnInit {
  isNew = false;
  loading = true;
  saving = false;
  
  objective: any = {
    objective_id: '',
    level: 'PERSONAL',
    progress: 0,
    start_value: 0,
    expected_value: 100,
    current_value: 0,
    category: 'Objective',
    title: '',
    description: '',
    parent: null,
    child_objectives: [],
    key_results: []
  };

  employees: Employee[] = [];
  metrics: Metric[] = [];
  timelines: Timeline[] = [];
  
  activeTab = 'comments';

  comments: Array<{ author: string, time: string, content: string }> = [
    {
      author: 'alex.dev (Dev Lead)',
      time: '28/10/2026 14:30',
      content: 'Chỉ số SLA đo lường được tổng hợp tự động từ GitLab Events qua Activepieces. Đạt chỉ tiêu cam kết chất lượng.'
    }
  ];
  newComment = '';

  showAddKrModal = false;
  isSavingKr = false;
  newKr: any = {
    title: '',
    metric_id: 'METRIC-01',
    start_value: 0,
    expected_value: 100,
    unit: '%'
  };

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private okrService: OkrService,
    private confirmService: ConfirmDialogService
  ) {}

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const id = params.get('id');
      if (id === 'new') {
        this.isNew = true;
        this.loading = false;
        this.objective = {
          objective_id: `OBJ-${Math.floor(Math.random() * 900000 + 100000)}`,
          level: 'PERSONAL',
          progress: 0,
          start_value: 0,
          expected_value: 100,
          current_value: 0,
          category: 'Objective',
          title: '',
          description: '',
          parent: null,
          child_objectives: [],
          key_results: []
        };
      } else if (id) {
        this.isNew = false;
        this.loadObjective(id);
      }
    });
    this.loadMetadata();
  }

  loadObjective(id: string): void {
    this.loading = true;
    this.okrService.getObjectiveById(id).subscribe({
      next: (data: any) => {
        this.objective = data || {};
        if (this.objective.start_value === undefined || this.objective.start_value === null) {
          this.objective.start_value = 0;
        }
        if (this.objective.expected_value === undefined || this.objective.expected_value === null) {
          this.objective.expected_value = 100;
        }
        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading objective', err);
        this.loading = false;
      }
    });
  }

  loadMetadata(): void {
    this.okrService.getEmployees().subscribe({
      next: data => this.employees = data || [],
      error: err => console.error(err)
    });
    this.okrService.getMetrics().subscribe({
      next: data => this.metrics = data || [],
      error: err => console.error(err)
    });
    this.okrService.getTimelines().subscribe({
      next: data => this.timelines = data || [],
      error: err => console.error(err)
    });
  }

  saveObjective(): void {
    if (!this.objective.title?.trim()) {
      alert('Vui lòng nhập Tên Mục tiêu');
      return;
    }
    this.saving = true;
    if (this.isNew) {
      this.okrService.createObjective(this.objective).subscribe({
        next: () => {
          this.saving = false;
          this.router.navigate(['/okr-tree']);
        },
        error: (err) => {
          console.error(err);
          this.saving = false;
          alert('Lỗi khi tạo Objective: ' + (err.error?.error || err.message));
        }
      });
    } else {
      this.okrService.updateObjective(this.objective.objective_id, this.objective).subscribe({
        next: () => {
          this.saving = false;
          this.router.navigate(['/okr-tree']);
        },
        error: (err) => {
          console.error(err);
          this.saving = false;
          alert('Lỗi khi cập nhật Objective: ' + (err.error?.error || err.message));
        }
      });
    }
  }

  cancel(): void {
    this.router.navigate(['/okr-tree']);
  }

  viewParentObjective(id: string): void {
    this.router.navigate(['/objectives', id]);
  }

  viewChildObjective(id: string): void {
    this.router.navigate(['/objectives', id]);
  }

  openAddKrModal(): void {
    this.newKr = {
      title: '',
      metric_id: this.metrics.length > 0 ? this.metrics[0].id : 'METRIC-01',
      start_value: 0,
      expected_value: 100,
      unit: '%'
    };
    this.showAddKrModal = true;
  }

  saveNewKr(): void {
    if (!this.newKr.title?.trim()) {
      alert('Vui lòng nhập tên Kết quả then chốt (Key Result)');
      return;
    }
    this.isSavingKr = true;
    this.okrService.createKeyResult({
      ...this.newKr,
      objective_id: this.objective.objective_id,
      start_value: Number(this.newKr.start_value) || 0,
      expected_value: Number(this.newKr.expected_value) || 100,
      current_value: 0
    }).subscribe({
      next: () => {
        this.isSavingKr = false;
        this.showAddKrModal = false;
        this.loadObjective(this.objective.objective_id);
      },
      error: (err) => {
        this.isSavingKr = false;
        console.error(err);
        alert('Lỗi khi thêm Key Result: ' + (err.error?.error || err.message));
      }
    });
  }

  getProgressColor(progress: number): string {
    if (progress >= 70) return '#10b981';
    if (progress >= 40) return '#f59e0b';
    return '#ef4444';
  }

  getStatusLabel(progress: number): string {
    if (progress >= 100) return 'HOÀN THÀNH (100%)';
    if (progress >= 70) return 'ĐẠT TIẾN ĐỘ (ON TRACK)';
    if (progress >= 40) return 'CẦN CHÚ Ý (NEEDS ATTENTION)';
    return 'NGUY CƠ CHẬM (AT RISK)';
  }

  getStatusBadgeClass(progress: number): string {
    if (progress >= 70) return 'badge-success';
    if (progress >= 40) return 'badge-warning';
    return 'badge-danger';
  }

  addComment(): void {
    if (!this.newComment.trim()) return;
    this.comments.unshift({
      author: 'Bạn (Quản trị viên)',
      time: 'Vừa xong',
      content: this.newComment.trim()
    });
    this.newComment = '';
  }

  goToAuditLog(): void {
    this.router.navigate(['/audit-log']);
  }
}
