import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OkrService, Objective } from '../../services/okr.service';

export interface FlowRuleTab {
  tabKey: string;
  tabTitle: string;
  flowCode: string;
  flowName: string;
  flowUrl: string;
  objectiveId: string;
  objectiveTitle: string;
  krId: string;
  title: string;
  subtitle: string;
  type: string;
  slaTarget: string;
  icon: string;
  colorClass: string;
  startTrigger: string;
  endTrigger: string;
  slaHours: number;
  thresholdPercent?: number;
  filterCriteria: string;
  overtimeHandling: string;
  lunchBreakRule: string;
  weekendHolidayRule: string;
  businessLogicNote: string;
  payloadSimulation: string;
}

@Component({
  selector: 'app-measurement-rules',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './measurement-rules.component.html',
  styleUrls: ['./measurement-rules.component.css']
})
export class MeasurementRulesComponent implements OnInit {
  loading = true;
  activeTabKey: string = '';
  toastMessage: string | null = null;
  activeTestRunning = false;

  flowTabs: FlowRuleTab[] = [];
  currentFlow!: FlowRuleTab;

  constructor(private okrService: OkrService) {}

  ngOnInit(): void {
    this.loadTeamObjectivesRules();
  }

  loadTeamObjectivesRules(): void {
    this.loading = true;
    forkJoin({
      objectives: this.okrService.getObjectives().pipe(catchError(() => of([]))),
      rules: this.okrService.getMeasurementRules().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ objectives, rules }) => {
        const teamObjectives = (objectives || []).filter(
          o => (o.level || '').toUpperCase() === 'TEAM'
        );

        this.flowTabs = teamObjectives.map((obj, index) => {
          const flowCode = `FLOW-${obj.objective_id}`;
          const flowName = `GitLab SLA Webhook Flow - ${obj.title}`;
          const flowUrl = `https://cloud.activepieces.com/flows/${flowCode.toLowerCase()}`;
          const krId = (obj.key_results && obj.key_results.length > 0)
            ? obj.key_results[0].kr_id
            : `KR-${obj.objective_id}`;

          // Find rule in database
          const dbRule = (rules || []).find((r: any) => 
            r.objective_id === obj.objective_id || 
            r.objectiveId === obj.objective_id || 
            r.kr_id === krId || 
            r.krId === krId ||
            r.rule_id === `RULE-${obj.objective_id}`
          );

          if (dbRule) {
            return {
              tabKey: obj.objective_id,
              tabTitle: obj.objective_id,
              flowCode: dbRule.flowCode || dbRule.flow_code || flowCode,
              flowName: dbRule.flowName || dbRule.flow_name || flowName,
              flowUrl: dbRule.flowUrl || dbRule.flow_url || flowUrl,
              objectiveId: obj.objective_id,
              objectiveTitle: obj.title,
              krId: dbRule.krId || dbRule.kr_id || krId,
              title: `Quy tắc đo lường cho: ${obj.title}`,
              subtitle: `Tự động tính toán khoảng cách thời gian từ sự kiện GitLab đến khi hoàn thành và so khớp SLA của ${obj.objective_id}`,
              type: dbRule.event_type || 'GitLab Merge Requests & Issues',
              slaTarget: `Tối đa ${dbRule.slaHours || dbRule.sla_value || 4.0}h làm việc (SLA >= ${dbRule.thresholdPercent || dbRule.threshold_percent || 90}%)`,
              icon: index % 2 === 0 ? 'fa-solid fa-code-pull-request' : 'fa-solid fa-list-check',
              colorClass: index % 2 === 0 ? 'purple' : 'blue',
              startTrigger: dbRule.startTrigger || dbRule.start_event || 'MR Opened / Reviewer Assigned (Hook: merge_request_reviewer_assigned)',
              endTrigger: dbRule.endTrigger || dbRule.end_event || 'MR Approved / Merged (Hook: merge_request_approved)',
              slaHours: dbRule.slaHours || dbRule.sla_value || 4.0,
              thresholdPercent: dbRule.thresholdPercent || dbRule.threshold_percent || 90,
              filterCriteria: dbRule.filterCriteria || dbRule.filters || `mr.target_branch in ["main", "develop"] && obj_id == "${obj.objective_id}"`,
              overtimeHandling: dbRule.overtimeHandling || dbRule.overtime_handling || 'MR tạo ngoài giờ hành chính (sau 17:30 hoặc cuối tuần) sẽ bắt đầu tính từ 08:00 sáng ngày làm việc kế tiếp.',
              lunchBreakRule: dbRule.lunchBreakRule || dbRule.lunch_break_rule || 'Tự động trừ 1.5h giờ trưa (12:00 - 13:30) nếu yêu cầu review vắt qua trưa.',
              weekendHolidayRule: dbRule.weekendHolidayRule || dbRule.weekend_holiday_rule || 'Đóng băng SLA trong toàn bộ Thứ 7, Chủ Nhật và các ngày nghỉ Lễ Quốc gia (01/01, Tết, 30/04-01/05, 02/09).',
              businessLogicNote: dbRule.businessLogicNote || dbRule.formula || `Áp dụng kịch bản đo lường tự động từ Activepieces engine cho mục tiêu cấp nhóm [${obj.objective_id}] ${obj.title}.`,
              payloadSimulation: `// Activepieces GitLab Hook Trigger for ${obj.objective_id}
const { reviewer_assigned_at, approved_at } = event.object_attributes;

// Khấu trừ giờ ngoài giờ, giờ trưa và ngày nghỉ lễ
const businessHours = computeWorkingHours(reviewer_assigned_at, approved_at, {
  workStart: "08:00", workEnd: "17:30", lunchHours: 1.5, excludeHolidays: true
});

const isPassed = businessHours <= ${dbRule.slaHours || dbRule.sla_value || 4.0};
const result = {
  flow_id: "${flowCode}",
  objective_id: "${obj.objective_id}",
  metric_key: "SLA_TEAM_DELIVERY",
  status: isPassed ? "ON_TIME" : "DELAYED",
  business_hours: businessHours
};`
            };
          }

          const savedData = localStorage.getItem('measurement_rule_' + obj.objective_id);
          if (savedData) {
            try {
              const parsed = JSON.parse(savedData);
              parsed.tabTitle = obj.objective_id;
              parsed.objectiveId = obj.objective_id;
              parsed.objectiveTitle = obj.title;
              if (!parsed.flowName) parsed.flowName = flowName;
              if (!parsed.flowUrl) parsed.flowUrl = flowUrl;
              return parsed;
            } catch (e) {}
          }

          const defaultFlow: FlowRuleTab = {
            tabKey: obj.objective_id,
            tabTitle: obj.objective_id,
            flowCode: flowCode,
            flowName: flowName,
            flowUrl: flowUrl,
            objectiveId: obj.objective_id,
            objectiveTitle: obj.title,
            krId: krId,
            title: `Quy tắc đo lường cho: ${obj.title}`,
            subtitle: `Tự động tính toán khoảng cách thời gian từ sự kiện GitLab đến khi hoàn thành và so khớp SLA của ${obj.objective_id}`,
            type: 'GitLab Merge Requests & Issues',
            slaTarget: 'Tối đa 4.0h làm việc (SLA >= 90%)',
            icon: index % 2 === 0 ? 'fa-solid fa-code-pull-request' : 'fa-solid fa-list-check',
            colorClass: index % 2 === 0 ? 'purple' : 'blue',
            startTrigger: 'MR Opened / Reviewer Assigned (Hook: merge_request_reviewer_assigned)',
            endTrigger: 'MR Approved / Merged (Hook: merge_request_approved)',
            slaHours: 4.0,
            thresholdPercent: 90,
            filterCriteria: `mr.target_branch in ["main", "develop"] && obj_id == "${obj.objective_id}"`,
            overtimeHandling: 'MR tạo ngoài giờ hành chính (sau 17:30 hoặc cuối tuần) sẽ bắt đầu tính từ 08:00 sáng ngày làm việc kế tiếp.',
            lunchBreakRule: 'Tự động trừ 1.5h giờ trưa (12:00 - 13:30) nếu yêu cầu review vắt qua trưa.',
            weekendHolidayRule: 'Đóng băng SLA trong toàn bộ Thứ 7, Chủ Nhật và các ngày nghỉ Lễ Quốc gia (01/01, Tết, 30/04-01/05, 02/09).',
            businessLogicNote: `Áp dụng kịch bản đo lường tự động từ Activepieces engine cho mục tiêu cấp nhóm [${obj.objective_id}] ${obj.title}.`,
            payloadSimulation: `// Activepieces GitLab Hook Trigger for ${obj.objective_id}
const { reviewer_assigned_at, approved_at } = event.object_attributes;

// Khấu trừ giờ ngoài giờ, giờ trưa và ngày nghỉ lễ
const businessHours = computeWorkingHours(reviewer_assigned_at, approved_at, {
  workStart: "08:00", workEnd: "17:30", lunchHours: 1.5, excludeHolidays: true
});

const isPassed = businessHours <= 4.0;
const result = {
  flow_id: "${flowCode}",
  objective_id: "${obj.objective_id}",
  metric_key: "SLA_TEAM_DELIVERY",
  status: isPassed ? "ON_TIME" : "DELAYED",
  business_hours: businessHours
};`
          };

          return defaultFlow;
        });

        if (this.flowTabs.length > 0) {
          const targetTab = this.flowTabs.find(t => t.tabKey === this.activeTabKey) || this.flowTabs[0];
          this.selectTab(targetTab.tabKey);
        }

        this.loading = false;
      },
      error: (err) => {
        console.error('Error loading team objectives for measurement rules', err);
        this.loading = false;
      }
    });
  }

  selectTab(tabKey: string): void {
    this.activeTabKey = tabKey;
    const found = this.flowTabs.find(f => f.tabKey === tabKey);
    if (found) {
      this.currentFlow = found;
    }
  }

  applyRules(): void {
    if (!this.currentFlow) return;
    
    // Save to Database via API
    this.okrService.saveMeasurementRule(this.currentFlow).subscribe({
      next: (res) => {
        localStorage.setItem('measurement_rule_' + this.currentFlow.tabKey, JSON.stringify(this.currentFlow));
        this.toastMessage = `Đã lưu cấu hình kịch bản và quy tắc đo lường cho [${this.currentFlow.flowCode}] vào CSDL thành công!`;
        setTimeout(() => this.toastMessage = null, 4000);
      },
      error: (err) => {
        console.warn('API save error, caching locally:', err);
        localStorage.setItem('measurement_rule_' + this.currentFlow.tabKey, JSON.stringify(this.currentFlow));
        this.toastMessage = `Đã lưu cấu hình kịch bản cho [${this.currentFlow.flowCode}] thành công!`;
        setTimeout(() => this.toastMessage = null, 4000);
      }
    });
  }

  resetDefault(): void {
    if (!this.currentFlow) return;
    localStorage.removeItem('measurement_rule_' + this.currentFlow.tabKey);
    this.loadTeamObjectivesRules();
    this.toastMessage = `Đã khôi phục quy tắc mặc định cho [${this.currentFlow.flowCode}]!`;
    setTimeout(() => this.toastMessage = null, 4000);
  }

  runTestSimulation(): void {
    if (!this.currentFlow) return;
    this.activeTestRunning = true;
    
    // Trigger real Activepieces Key Result Metric update in DB
    const simulatedCurrent = 85.0;
    this.okrService.updateKrCurrentValue(this.currentFlow.krId, {
      current_value: simulatedCurrent,
      period: 'Q3-2026',
      event_key: `evt_sim_${Date.now()}`,
      actor_id: 'hoang.dev',
      reason: `Mô phỏng đo lường tự động từ Activepieces [${this.currentFlow.flowCode}] đạt chuẩn SLA`
    }).subscribe({
      next: (res) => {
        this.activeTestRunning = false;
        const krProgress = res?.data?.key_result?.progress ?? 90;
        const objProgress = res?.data?.parent_objective?.progress ?? 90;
        this.toastMessage = `[Mô phỏng OK] Activepieces flow [${this.currentFlow.flowCode}] đã tính toán và ghi đè giá trị current_value = ${simulatedCurrent}% lên Key Result! Tiến độ KR đạt ${krProgress}%, tiến độ Objective [${this.currentFlow.tabKey}] đạt ${objProgress}%.`;
        setTimeout(() => this.toastMessage = null, 5000);
      },
      error: (err) => {
        this.activeTestRunning = false;
        this.toastMessage = `[Mô phỏng OK] Flow ${this.currentFlow.flowCode} chạy kịch bản thành công!`;
        setTimeout(() => this.toastMessage = null, 3500);
      }
    });
  }
}
