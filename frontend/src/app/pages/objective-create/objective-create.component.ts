import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { OkrService, Objective, Employee, Metric, Timeline } from '../../services/okr.service';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-objective-create',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './objective-create.component.html',
  styleUrls: ['./objective-create.component.css']
})
export class ObjectiveCreateComponent implements OnInit {
  saving = false;
  
  objective: Partial<Objective> = {
    level: 'COMPANY',
    progress: 0,
    start_value: 0,
    expected_value: 100,
    category: 'Objective'
  };

  employees: Employee[] = [];
  metrics: Metric[] = [];
  timelines: Timeline[] = [];

  constructor(
    private router: Router,
    private okrService: OkrService
  ) {}

  ngOnInit(): void {
    this.loadMetadata();
  }

  loadMetadata(): void {
    this.okrService.getEmployees().subscribe(data => this.employees = data);
    this.okrService.getMetrics().subscribe(data => this.metrics = data);
    this.okrService.getTimelines().subscribe(data => this.timelines = data);
  }

  saveObjective(): void {
    if (!this.objective.title) return alert('Vui lòng nhập Tên Mục tiêu');
    this.saving = true;
    this.okrService.createObjective(this.objective).subscribe({
      next: () => {
        this.router.navigate(['/okr-settings']);
      },
      error: (err) => {
        console.error(err);
        this.saving = false;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/okr-settings']);
  }
}
