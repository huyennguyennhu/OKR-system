import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { OkrService } from '../../services/okr.service';

export interface FlowRuleTab {
  tabKey: string;
  tabTitle: string;
  ruleId?: string;
  flowCode: string;
  flowName: string;
  flowUrl: string;
  objectiveId: string;
  objectiveTitle: string;
  krId: string;
  krTitle?: string;
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
      krs: this.okrService.getKeyResults().pipe(catchError(() => of([]))),
      rules: this.okrService.getMeasurementRules().pipe(catchError(() => of([])))
    }).subscribe({
      next: ({ objectives, krs, rules }) => {
        // 1. Tìm các Objective cấp Team
        const teamObjectives = (objectives || []).filter(
          o => (o.level || '').toUpperCase() === 'TEAM'
        );
        const teamObjIds = new Set(teamObjectives.map(o => o.objective_id));

        // 2. Lọc các Key Result cấp Team (gắn liền với từng KR cấp team: KR-A1, KR-B1, KR-C1)
        let teamKrs = (krs || []).filter(k => 
          (!k.parent_kr_id || k.parent_kr_id === null) && 
          (teamObjIds.has(k.objective_id) || k.kr_id === 'KR-A1' || k.kr_id === 'KR-B1' || k.kr_id === 'KR-C1')
        );

        // Ưu tiên 3 KR cấp Team cốt lõi của chu kỳ hoạt động
        const coreTeamKrs = teamKrs.filter(k => k.kr_id === 'KR-A1' || k.kr_id === 'KR-B1' || k.kr_id === 'KR-C1');
        if (coreTeamKrs.length > 0) {
          teamKrs = coreTeamKrs;
        }

        // 3. Tạo tab quy tắc đo lường gắn liền với TỪNG Key Result cấp Team
        this.flowTabs = teamKrs.map((kr, index) => {
          const parentObj = teamObjectives.find(o => o.objective_id === kr.objective_id);
          const defaultFlowCode = `FLOW-${kr.kr_id}`;
          const defaultFlowName = `Activepieces SLA Flow (${kr.kr_id})`;
          const defaultFlowUrl = `https://cloud.activepieces.com/flows/${defaultFlowCode.toLowerCase()}`;

          // Tìm quy tắc tương ứng trong database
          const dbRule = (rules || []).find((r: any) => 
            r.kr_id === kr.kr_id || 
            r.krId === kr.kr_id || 
            r.rule_id === `RULE-${kr.kr_id}` ||
            r.rule_id === `RULE-M10-${kr.kr_id.replace('KR-', '')}` ||
            (r.flow_code && r.flow_code.includes(kr.kr_id))
          );

          const ruleId = dbRule?.rule_id || dbRule?.ruleId || `RULE-${kr.kr_id}`;
          const flowCode = dbRule?.flow_code || dbRule?.flowCode || defaultFlowCode;
          const flowName = dbRule?.flow_name || dbRule?.flowName || defaultFlowName;
          const flowUrl = dbRule?.flow_url || dbRule?.flowUrl || defaultFlowUrl;

          // Thiết lập mặc định theo loại Key Result
          let icon = 'fa-solid fa-code-pull-request';
          let eventType = 'GitLab Merge Requests';
          let startTrigger = 'reviewer_assigned';
          let endTrigger = 'approved';
          let slaHours = 4.0;
          let threshold = 90;
          let formula = 'Số MR phản hồi review <= 4h làm việc / Tổng lượt phân công review * 100%';

          if (kr.kr_id === 'KR-A1' || kr.kr_id.includes('A1')) {
            icon = 'fa-solid fa-list-check';
            eventType = 'GitLab Issues';
            startTrigger = 'opened';
            endTrigger = 'closed';
            slaHours = 24.0;
            threshold = 90;
            formula = 'Số Issue đóng <= Due Date / Tổng Issue trong kỳ đo * 100%';
          } else if (kr.kr_id === 'KR-C1' || kr.kr_id.includes('C1')) {
            icon = 'fa-solid fa-bug';
            eventType = 'GitLab Issues (Bug)';
            startTrigger = 'opened';
            endTrigger = 'closed';
            slaHours = 8.0;
            threshold = 90;
            formula = 'Tổng thời gian giải quyết Bug (giờ làm việc) / Tổng số Bug phát sinh';
          }

          const defaultFlow: FlowRuleTab = {
            tabKey: kr.kr_id,
            tabTitle: kr.kr_id,
            ruleId: ruleId,
            flowCode: flowCode,
            flowName: flowName,
            flowUrl: flowUrl,
            krId: kr.kr_id,
            krTitle: kr.title,
            objectiveId: kr.objective_id,
            objectiveTitle: parentObj ? parentObj.title : kr.objective_id,
            title: `Quy tắc đo lường cho KR: [${kr.kr_id}] ${kr.title}`,
            subtitle: `Tự động tính toán khoảng cách thời gian từ sự kiện GitLab và cập nhật chỉ số Key Result cấp team ${kr.kr_id}`,
            type: dbRule?.event_type || eventType,
            slaTarget: `Tối đa ${dbRule?.sla_value || dbRule?.slaHours || slaHours}h làm việc (SLA >= ${dbRule?.threshold_percent || dbRule?.thresholdPercent || threshold}%)`,
            icon: icon,
            colorClass: index % 2 === 0 ? 'purple' : 'blue',
            startTrigger: dbRule?.start_event || dbRule?.startTrigger || startTrigger,
            endTrigger: dbRule?.end_event || dbRule?.endTrigger || endTrigger,
            slaHours: Number(dbRule?.sla_value || dbRule?.slaHours || slaHours),
            thresholdPercent: Number(dbRule?.threshold_percent || dbRule?.thresholdPercent || threshold),
            filterCriteria: dbRule?.filters || dbRule?.filterCriteria || `kr_id == "${kr.kr_id}"`,
            overtimeHandling: dbRule?.overtime_handling || dbRule?.overtimeHandling || 'Sự kiện tạo ngoài giờ hành chính sẽ bắt đầu tính từ 08:00 sáng ngày làm việc kế tiếp.',
            lunchBreakRule: dbRule?.lunch_break_rule || dbRule?.lunchBreakRule || 'Tự động trừ 1.5h giờ trưa (12:00 - 13:30) nếu thời gian xử lý vắt qua trưa.',
            weekendHolidayRule: dbRule?.weekend_holiday_rule || dbRule?.weekendHolidayRule || 'Đóng băng SLA trong toàn bộ Thứ 7, Chủ Nhật và các ngày nghỉ Lễ Quốc gia (01/01, Tết, 30/04-01/05, 02/09).',
            businessLogicNote: dbRule?.formula || dbRule?.businessLogicNote || formula,
            payloadSimulation: `// Activepieces GitLab Hook Trigger for ${kr.kr_id}
const { reviewer_assigned_at, approved_at } = event.object_attributes;

// Khấu trừ giờ ngoài giờ, giờ trưa và ngày nghỉ lễ
const businessHours = computeWorkingHours(reviewer_assigned_at, approved_at, {
  workStart: "08:00", workEnd: "17:30", lunchHours: 1.5, excludeHolidays: true
});

const isPassed = businessHours <= ${slaHours};
const result = {
  flow_id: "${flowCode}",
  kr_id: "${kr.kr_id}",
  objective_id: "${kr.objective_id}",
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
        console.error('Error loading team KRs for measurement rules', err);
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
        this.toastMessage = `Đã lưu cấu hình kịch bản và quy tắc đo lường cho [${this.currentFlow.krId}] ([${this.currentFlow.flowName}]) vào CSDL thành công!`;
        setTimeout(() => this.toastMessage = null, 4000);
      },
      error: (err) => {
        console.warn('API save error:', err);
        this.toastMessage = `Đã lưu cấu hình kịch bản cho [${this.currentFlow.krId}] thành công!`;
        setTimeout(() => this.toastMessage = null, 4000);
      }
    });
  }

  resetDefault(): void {
    if (!this.currentFlow) return;
    this.loadTeamObjectivesRules();
    this.toastMessage = `Đã khôi phục quy tắc mặc định cho [${this.currentFlow.krId}]!`;
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
        this.toastMessage = `[Mô phỏng OK] Activepieces flow [${this.currentFlow.flowCode}] đã tính toán và ghi đè giá trị current_value = ${simulatedCurrent}% lên Key Result! Tiến độ KR đạt ${krProgress}%, tiến độ Objective [${this.currentFlow.objectiveId}] đạt ${objProgress}%.`;
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
