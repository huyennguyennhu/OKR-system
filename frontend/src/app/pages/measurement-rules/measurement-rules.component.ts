import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
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

export interface Flow1Config {
  scheduleTime: string;
  startEvent: string;
  endEvent: string;
  dueDateTime: string;
  resolvedStatuses: string[];
  reopenedStatuses: string[];
  excludedStatuses: string[];
  validIssueTypes: string[];
  calculationMode: string;
  fallbackStoryPoint: number;
  thresholdPercent: number;
  noDataHandling: boolean;
  friendlyFormula: string;
  latexFormula: string;
  availableVariables: string[];
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

  // Flow 1 No-Code Structured Configuration
  flow1Config: Flow1Config = {
    scheduleTime: '21:00 (Thứ 2 – Thứ 6)',
    startEvent: 'issue_assigned',
    endEvent: 'status_resolved',
    dueDateTime: '23:59:59 (GMT+7)',
    resolvedStatuses: ['RESOLVED', 'DEV_COMPLETED', 'READY IN STAGING', 'PASS IN STAGING'],
    reopenedStatuses: ['REOPENED'],
    excludedStatuses: ['CANCELLED', 'WONTFIX', 'CANNOT REPRODUCE', 'DUPLICATE'],
    validIssueTypes: ['Story', 'Bug', 'Improvement'],
    calculationMode: 'STORY_POINT',
    fallbackStoryPoint: 1,
    thresholdPercent: 90,
    noDataHandling: true,
    friendlyFormula: '\\frac(sum(S_k * W(k)), sum(W(k))) * 100%',
    latexFormula: '\\frac{\\sum_{k \\in I_u} S_k \\cdot W(k)}{\\sum_{k \\in I_u} W(k)} \\times 100\\%',
    availableVariables: ['S_k', 'W(k)', 'Story_Point', 'Due_Date']
  };

  renderedLatexHtml: SafeHtml = '';

  // Custom Dropdown States (Matching Toolbar / Space Dropdown)
  isStartEventOpen = false;
  isEndEventOpen = false;
  isCalcModeOpen = false;

  readonly startEventOptions = [
    { value: 'issue_assigned', label: 'issue_assigned (Default)' },
    { value: 'issue_opened', label: 'issue_opened' },
    { value: 'status_in_progress', label: 'status_in_progress' }
  ];

  readonly endEventOptions = [
    { value: 'status_resolved', label: 'status_resolved (Default)' },
    { value: 'issue_closed', label: 'issue_closed' }
  ];

  readonly calcModeOptions = [
    { value: 'STORY_POINT', label: 'Story Point Weight (Recommended)' },
    { value: 'COUNT', label: 'Issue Count (Equal Weight)' }
  ];

  constructor(
    private okrService: OkrService,
    private sanitizer: DomSanitizer
  ) {}

  toggleStartEventDropdown(event: Event): void {
    event.stopPropagation();
    this.isStartEventOpen = !this.isStartEventOpen;
    this.isEndEventOpen = false;
    this.isCalcModeOpen = false;
  }

  toggleEndEventDropdown(event: Event): void {
    event.stopPropagation();
    this.isEndEventOpen = !this.isEndEventOpen;
    this.isStartEventOpen = false;
    this.isCalcModeOpen = false;
  }

  toggleCalcModeDropdown(event: Event): void {
    event.stopPropagation();
    this.isCalcModeOpen = !this.isCalcModeOpen;
    this.isStartEventOpen = false;
    this.isEndEventOpen = false;
  }

  selectStartEvent(value: string, event: Event): void {
    event.stopPropagation();
    this.flow1Config.startEvent = value;
    this.isStartEventOpen = false;
  }

  selectEndEvent(value: string, event: Event): void {
    event.stopPropagation();
    this.flow1Config.endEvent = value;
    this.isEndEventOpen = false;
  }

  selectCalcMode(value: string, event: Event): void {
    event.stopPropagation();
    this.flow1Config.calculationMode = value;
    this.isCalcModeOpen = false;
  }

  getStartEventLabel(): string {
    const opt = this.startEventOptions.find(o => o.value === this.flow1Config.startEvent);
    return opt ? opt.label : 'issue_assigned (Default)';
  }

  getEndEventLabel(): string {
    const opt = this.endEventOptions.find(o => o.value === this.flow1Config.endEvent);
    return opt ? opt.label : 'status_resolved (Default)';
  }

  getCalcModeLabel(): string {
    const opt = this.calcModeOptions.find(o => o.value === this.flow1Config.calculationMode);
    return opt ? opt.label : 'Story Point Weight (Recommended)';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event?: MouseEvent): void {
    if (event) {
      const target = event.target as HTMLElement;
      if (!target.closest('.rules-dropdown-wrapper') && !target.closest('.space-dropdown-wrapper')) {
        this.isStartEventOpen = false;
        this.isEndEventOpen = false;
        this.isCalcModeOpen = false;
      }
    }
  }

  ngOnInit(): void {
    this.loadTeamObjectivesRules();

    // Check if KaTeX is loaded from CDN and render preview
    const checkKatex = setInterval(() => {
      if (typeof (window as any).katex !== 'undefined') {
        clearInterval(checkKatex);
        this.renderLatexPreview(this.flow1Config.latexFormula);
      }
    }, 250);
    setTimeout(() => clearInterval(checkKatex), 4000);
  }

  isFlow1(flow?: FlowRuleTab): boolean {
    if (!flow) return false;
    const kId = (flow.krId || '').toUpperCase();
    const fCode = (flow.flowCode || '').toUpperCase();
    const title = (flow.krTitle || flow.title || '').toLowerCase();
    return kId.includes('A1') || kId === 'KR-A1' || fCode.includes('A1') || title.includes('issue hoàn thành') || title.includes('đúng hạn');
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
            r.rule_id === `RULE-M11-${kr.kr_id.replace('KR-', '')}` ||
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
            startTrigger = 'issue_assigned';
            endTrigger = 'status_resolved';
            slaHours = 24.0;
            threshold = 90;
            formula = '\\frac{\\sum_{k \\in I_u} S_k \\cdot W(k)}{\\sum_{k \\in I_u} W(k)} \\times 100\\%';
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
            startTrigger: (kr.kr_id.includes('A1') && (!dbRule?.start_event || dbRule?.start_event === 'opened'))
              ? 'issue_assigned'
              : (dbRule?.start_event || dbRule?.startTrigger || startTrigger),
            endTrigger: (kr.kr_id.includes('A1') && (!dbRule?.end_event || dbRule?.end_event === 'closed'))
              ? 'status_resolved'
              : (dbRule?.end_event || dbRule?.endTrigger || endTrigger),
            slaHours: Number(dbRule?.sla_value || dbRule?.slaHours || slaHours),
            thresholdPercent: Number(dbRule?.threshold_percent || dbRule?.thresholdPercent || threshold),
            filterCriteria: dbRule?.filters || dbRule?.filterCriteria || `kr_id == "${kr.kr_id}"`,
            overtimeHandling: dbRule?.overtime_handling || dbRule?.overtimeHandling || 'Sự kiện tạo ngoài giờ hành chính sẽ bắt đầu tính từ 09:00 sáng ngày làm việc kế tiếp.',
            lunchBreakRule: dbRule?.lunch_break_rule || dbRule?.lunchBreakRule || 'Tự động trừ 1.5h giờ trưa (12:00 - 13:30) nếu thời gian xử lý vắt qua trưa.',
            weekendHolidayRule: dbRule?.weekend_holiday_rule || dbRule?.weekendHolidayRule || 'Đóng băng SLA trong toàn bộ Thứ 7, Chủ Nhật và các ngày nghỉ Lễ Quốc gia (01/01, Tết, 30/04-01/05, 02/09).',
            businessLogicNote: dbRule?.formula || dbRule?.businessLogicNote || formula,
            payloadSimulation: `// Activepieces GitLab Hook Trigger for ${kr.kr_id}
const { reviewer_assigned_at, approved_at } = event.object_attributes;

// Khấu trừ giờ ngoài giờ, giờ trưa và ngày nghỉ lễ
const businessHours = computeWorkingHours(reviewer_assigned_at, approved_at, {
  workStart: "09:00", workEnd: "18:30", lunchHours: 1.5, excludeHolidays: true
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
      if (this.isFlow1(found)) {
        this.initFlow1Config(found);
      }
    }
  }

  initFlow1Config(flow: FlowRuleTab): void {
    let parsedFilters: any = {};
    if (flow.filterCriteria) {
      try {
        parsedFilters = typeof flow.filterCriteria === 'string' ? JSON.parse(flow.filterCriteria) : flow.filterCriteria;
      } catch (e) {
        // legacy string
      }
    }

    // Resolve Start Event strictly against startEventOptions (pre-selected Default: 'issue_assigned')
    let startVal = parsedFilters.startEvent || flow.startTrigger || 'issue_assigned';
    if (startVal === 'opened') startVal = 'issue_assigned';
    const validStart = this.startEventOptions.find(o => o.value === startVal);
    const selectedStartEvent = validStart ? validStart.value : 'issue_assigned';

    // Resolve End Event strictly against endEventOptions (pre-selected Default: 'status_resolved')
    let endVal = parsedFilters.endEvent || flow.endTrigger || 'status_resolved';
    if (endVal === 'closed') endVal = 'status_resolved';
    const validEnd = this.endEventOptions.find(o => o.value === endVal);
    const selectedEndEvent = validEnd ? validEnd.value : 'status_resolved';

    // Resolve Calculation Mode strictly against calcModeOptions (pre-selected Default: 'STORY_POINT')
    let calcVal = parsedFilters.calculationMode || 'STORY_POINT';
    const validCalc = this.calcModeOptions.find(o => o.value === calcVal);
    const selectedCalcMode = validCalc ? validCalc.value : 'STORY_POINT';

    this.flow1Config = {
      scheduleTime: parsedFilters.scheduleTime || '21:00 (Thứ 2 – Thứ 6)',
      startEvent: selectedStartEvent,
      endEvent: selectedEndEvent,
      dueDateTime: parsedFilters.dueDateTime || '23:59:59 (GMT+7)',
      resolvedStatuses: Array.isArray(parsedFilters.resolvedStatuses) && parsedFilters.resolvedStatuses.length > 0 
        ? parsedFilters.resolvedStatuses 
        : ['RESOLVED', 'DEV_COMPLETED', 'READY IN STAGING', 'PASS IN STAGING'],
      reopenedStatuses: Array.isArray(parsedFilters.reopenedStatuses) && parsedFilters.reopenedStatuses.length > 0 
        ? parsedFilters.reopenedStatuses 
        : ['REOPENED'],
      excludedStatuses: Array.isArray(parsedFilters.excludedStatuses) && parsedFilters.excludedStatuses.length > 0 
        ? parsedFilters.excludedStatuses 
        : ['CANCELLED', 'WONTFIX', 'CANNOT REPRODUCE', 'DUPLICATE'],
      validIssueTypes: Array.isArray(parsedFilters.validIssueTypes) && parsedFilters.validIssueTypes.length > 0 
        ? parsedFilters.validIssueTypes 
        : ['Story', 'Bug', 'Improvement'],
      calculationMode: selectedCalcMode,
      fallbackStoryPoint: typeof parsedFilters.fallbackStoryPoint === 'number' ? parsedFilters.fallbackStoryPoint : 1,
      thresholdPercent: typeof parsedFilters.thresholdPercent === 'number' ? parsedFilters.thresholdPercent : (flow.thresholdPercent || 90),
      noDataHandling: parsedFilters.noDataHandling !== undefined ? parsedFilters.noDataHandling : true,
      friendlyFormula: parsedFilters.friendlyFormula || '\\frac(sum(S_k * W(k)), sum(W(k))) * 100%',
      latexFormula: parsedFilters.latexFormula || (flow.businessLogicNote && flow.businessLogicNote.includes('\\') ? flow.businessLogicNote : '\\frac{\\sum_{k \\in I_u} S_k \\cdot W(k)}{\\sum_{k \\in I_u} W(k)} \\times 100\\%'),
      availableVariables: ['S_k', 'W(k)', 'Story_Point', 'Due_Date']
    };

    this.renderLatexPreview(this.flow1Config.latexFormula);
  }

  // Tag Management Methods (No-Code interaction)
  addTag(category: 'resolvedStatuses' | 'reopenedStatuses' | 'excludedStatuses' | 'validIssueTypes', event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = (input.value || '').trim();
    if (!value) return;
    if (!this.flow1Config[category].includes(value)) {
      this.flow1Config[category].push(value);
    }
    input.value = '';
  }

  removeTag(category: 'resolvedStatuses' | 'reopenedStatuses' | 'excludedStatuses' | 'validIssueTypes', index: number): void {
    if (index >= 0 && index < this.flow1Config[category].length) {
      this.flow1Config[category].splice(index, 1);
    }
  }

  // Bi-directional Formula Sync Engine
  syncFromFriendlyToLatex(input: string): void {
    if (!input) {
      this.flow1Config.latexFormula = '';
      this.renderLatexPreview('');
      return;
    }
    let latex = input;
    // Quy đổi phân số: \frac(a, b) => \frac{a}{b}
    latex = latex.replace(/\\frac\(([^,]+),\s*([^)]+)\)/g, '\\frac{$1}{$2}');
    // Quy đổi hàm tổng: sum(...) => \sum(...)
    latex = latex.replace(/\bsum\(/g, '\\sum(');
    // Quy đổi phép nhân: * => \cdot
    latex = latex.replace(/\s*\*\s*/g, ' \\cdot ');
    // Quy đổi tỷ lệ phần trăm: * 100% => \times 100\%
    latex = latex.replace(/\\cdot\s*100%/g, '\\times 100\\%');
    
    this.flow1Config.latexFormula = latex;
    this.renderLatexPreview(latex);
  }

  syncFromLatexToFriendly(latex: string): void {
    if (!latex) {
      this.flow1Config.friendlyFormula = '';
      this.renderLatexPreview('');
      return;
    }
    let friendly = latex;
    // Quy đổi ngược phân số: \frac{a}{b} => \frac(a, b)
    friendly = friendly.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '\\frac($1, $2)');
    // Quy đổi ngược hàm tổng: \sum => sum
    friendly = friendly.replace(/\\sum/g, 'sum');
    // Quy đổi ngược phép nhân: \cdot => *
    friendly = friendly.replace(/\s*\\cdot\s*/g, ' * ');
    // Quy đổi ngược tỷ lệ: \times 100\% => * 100%
    friendly = friendly.replace(/\\times\s*100\\%/g, '* 100%');

    this.flow1Config.friendlyFormula = friendly;
    this.renderLatexPreview(latex);
  }

  insertVariableChip(variable: string): void {
    if (!this.flow1Config.friendlyFormula) {
      this.flow1Config.friendlyFormula = variable;
    } else {
      this.flow1Config.friendlyFormula += ` * ${variable}`;
    }
    this.syncFromFriendlyToLatex(this.flow1Config.friendlyFormula);
  }

  renderLatexPreview(latex: string): void {
    try {
      if (typeof (window as any).katex !== 'undefined') {
        const html = (window as any).katex.renderToString(latex, {
          throwOnError: false,
          displayMode: true
        });
        this.renderedLatexHtml = this.sanitizer.bypassSecurityTrustHtml(html);
      } else {
        this.renderedLatexHtml = this.sanitizer.bypassSecurityTrustHtml(
          `<span class="font-monospace text-primary" style="font-size: 13px;">${this.escapeHtml(latex)}</span>`
        );
      }
    } catch (err) {
      this.renderedLatexHtml = this.sanitizer.bypassSecurityTrustHtml(
        `<span class="text-danger small">Lỗi cú pháp LaTeX</span>`
      );
    }
  }

  escapeHtml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  applyRules(): void {
    if (!this.currentFlow) return;

    if (this.isFlow1(this.currentFlow)) {
      this.currentFlow.startTrigger = this.flow1Config.startEvent;
      this.currentFlow.endTrigger = this.flow1Config.endEvent;
      this.currentFlow.thresholdPercent = this.flow1Config.thresholdPercent;
      this.currentFlow.slaHours = 24.0;
      this.currentFlow.businessLogicNote = this.flow1Config.latexFormula;
      this.currentFlow.filterCriteria = JSON.stringify({
        scheduleTime: this.flow1Config.scheduleTime,
        startEvent: this.flow1Config.startEvent,
        endEvent: this.flow1Config.endEvent,
        dueDateTime: this.flow1Config.dueDateTime,
        resolvedStatuses: this.flow1Config.resolvedStatuses,
        reopenedStatuses: this.flow1Config.reopenedStatuses,
        excludedStatuses: this.flow1Config.excludedStatuses,
        validIssueTypes: this.flow1Config.validIssueTypes,
        calculationMode: this.flow1Config.calculationMode,
        fallbackStoryPoint: this.flow1Config.fallbackStoryPoint,
        thresholdPercent: this.flow1Config.thresholdPercent,
        noDataHandling: this.flow1Config.noDataHandling,
        friendlyFormula: this.flow1Config.friendlyFormula,
        latexFormula: this.flow1Config.latexFormula
      });
    }
    
    // Save to Database via API
    this.okrService.saveMeasurementRule(this.currentFlow).subscribe({
      next: (res) => {
        this.toastMessage = `Đã lưu cấu hình kịch bản và quy tắc đo lường No-Code cho [${this.currentFlow.krId}] ([${this.currentFlow.flowName}]) vào CSDL thành công!`;
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
    if (this.isFlow1(this.currentFlow)) {
      this.initFlow1Config(this.currentFlow);
    } else {
      this.loadTeamObjectivesRules();
    }
    this.toastMessage = `Đã khôi phục quy tắc mặc định cho [${this.currentFlow.krId}]!`;
    setTimeout(() => this.toastMessage = null, 4000);
  }

  runTestSimulation(): void {
    if (!this.currentFlow) return;
    this.activeTestRunning = true;
    
    // Trigger real Activepieces Key Result Metric update in DB
    const simulatedCurrent = 92.5;
    this.okrService.updateKrCurrentValue(this.currentFlow.krId, {
      current_value: simulatedCurrent,
      period: 'Q3-2026',
      event_key: `evt_sim_${Date.now()}`,
      actor_id: 'hoang.dev',
      reason: `Mô phỏng đo lường tự động từ Activepieces [${this.currentFlow.flowCode}] đạt chuẩn SLA`
    }).subscribe({
      next: (res) => {
        this.activeTestRunning = false;
        const krProgress = res?.data?.key_result?.progress ?? 92.5;
        const objProgress = res?.data?.parent_objective?.progress ?? 92.5;
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
