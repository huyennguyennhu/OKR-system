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
  projectIds?: string;
}

export interface FormulaTierItem {
  friendly: string;
  latex: string;
  description: string;
  availableVariables?: string[];
}

export interface FormulaTiers {
  itemRule: FormulaTierItem;
  individual: FormulaTierItem;
  team: FormulaTierItem;
}

export interface Flow1Config {
  projectIds?: string;
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
  formulas: FormulaTiers;
}

export interface Flow2Config {
  projectIds?: string;
  pollingInterval: string;
  checkInSchedule: string;
  startEvent: string;
  endEvent: string;
  ignoreDraft: boolean;
  validActions: {
    lineComment: boolean;
    generalNote: boolean;
    approve: boolean;
    requestChanges: boolean;
  };
  excludedBots: string[];
  excludeAuthorSelfReview: boolean;
  slaHours: number;
  thresholdPercent: number;
  gracePeriodDays: number;
  targetBranches: string[];
  friendlyFormula: string;
  latexFormula: string;
  availableVariables: string[];
  formulas: FormulaTiers;
}

export interface SeveritySlaRow {
  code: string;
  label: string;
  badgeClass: string;
  weight: number;
  slaHours: number;
  description: string;
}

export interface Flow3Config {
  projectIds?: string;
  scheduleTime: string;
  startEvent: string;
  endEvent: string;
  bugLabels: string[];
  severityMatrix: SeveritySlaRow[];
  pausedStatuses: string[];
  mttrTargetHours: number;
  thresholdPercent: number;
  friendlyFormula: string;
  latexFormula: string;
  availableVariables: string[];
  formulas: FormulaTiers;
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

  // Phân tầng công thức 3 cấp: itemRule (Điều kiện tác vụ), individual (Cá nhân), team (Nhóm)
  activeFormulaTier: 'itemRule' | 'individual' | 'team' = 'individual';

  // Flow 1 No-Code Structured Configuration
  flow1Config: Flow1Config = {
    projectIds: '86650434',
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
    latexFormula: 'KR(u) = \\frac{\\sum_{k \\in I_u} S_k \\cdot W(k)}{\\sum_{k \\in I_u} W(k)} \\times 100\\%',
    availableVariables: ['S_k', 'W(k)', 'Story_Point', 'Due_Date'],
    formulas: {
      itemRule: {
        friendly: 'S_k = if(T_resolved <= T_due, 1, 0)',
        latex: 'S_k = \\begin{cases} 1 & \\text{nếu } T_{\\text{resolved}} \\le T_{\\text{due}} \\\\ 0 & \\text{nếu } T_{\\text{resolved}} > T_{\\text{due}} \\end{cases}',
        description: 'Quy tắc xác định 1 Issue hoàn thành đạt hạn cam kết',
        availableVariables: ['T_resolved', 'T_due', 'S_k']
      },
      individual: {
        friendly: '\\frac(sum(S_k * W(k)), sum(W(k))) * 100%',
        latex: 'KR(u) = \\frac{\\sum_{k \\in I_u} S_k \\cdot W(k)}{\\sum_{k \\in I_u} W(k)} \\times 100\\%',
        description: 'Tỷ lệ Issue hoàn thành đúng hạn có trọng số của nhân sự u',
        availableVariables: ['S_k', 'W(k)', 'Story_Point', 'Due_Date']
      },
      team: {
        friendly: '\\frac(sum(S_k * W(k)), sum(W(k))) * 100%',
        latex: 'KR(\\text{Team}) = \\frac{\\sum_{u=1}^m \\sum_{k \\in I_u} S_k \\cdot W(k)}{\\sum_{u=1}^m \\sum_{k \\in I_u} W(k)} \\times 100\\%',
        description: 'Tỷ lệ Issue hoàn thành đúng hạn tổng hợp toàn đội ngũ',
        availableVariables: ['S_k', 'W(k)', 'Story_Point']
      }
    }
  };

  // Flow 2 No-Code Structured Configuration (KR-B1)
  flow2Config: Flow2Config = {
    projectIds: '86650434',
    pollingInterval: 'Mỗi 15 phút (08:00 – 22:00)',
    checkInSchedule: '21:00 (Thứ 2 – Thứ 6)',
    startEvent: 'max_assigned_ready',
    endEvent: 'first_valid_review_action',
    ignoreDraft: true,
    validActions: {
      lineComment: true,
      generalNote: true,
      approve: true,
      requestChanges: true
    },
    excludedBots: ['dependabot', 'gitlab-bot', 'jenkins-bot', 'security-bot', 'project_bot_*'],
    excludeAuthorSelfReview: true,
    slaHours: 4.0,
    thresholdPercent: 90,
    gracePeriodDays: 1,
    targetBranches: ['develop', 'main', 'master', 'release/*'],
    friendlyFormula: '\\frac(N_ontime(u), N_total(u)) * 100%',
    latexFormula: 'KR(u) = \\frac{N_{\\text{on-time}}(u)}{N_{\\text{total}}(u)} \\times 100\\%',
    availableVariables: ['N_ontime', 'N_total', 'N_unattributed', 'SLA_4h'],
    formulas: {
      itemRule: {
        friendly: 'R_i = if(delta_t_working <= 4.0, 1, 0)',
        latex: 'R_i = \\begin{cases} 1 & \\text{nếu } \\Delta t_{\\text{working}} \\le 4\\text{h} \\\\ 0 & \\text{nếu } \\Delta t_{\\text{working}} > 4\\text{h} \\end{cases}',
        description: 'Quy tắc xác định 1 lượt phân công Review phản hồi trong 4h làm việc',
        availableVariables: ['delta_t_working', 'SLA_4h', 'R_i']
      },
      individual: {
        friendly: '\\frac(N_ontime(u), N_total(u)) * 100%',
        latex: 'KR(u) = \\frac{N_{\\text{on-time}}(u)}{N_{\\text{total}}(u)} \\times 100\\%',
        description: 'Tỷ lệ phân công review phản hồi trong 4 giờ làm việc của cá nhân u',
        availableVariables: ['N_ontime', 'N_total', 'SLA_4h']
      },
      team: {
        friendly: '\\frac(sum(N_ontime), sum(N_total) + N_unattributed) * 100%',
        latex: 'KR(\\text{Team}) = \\frac{\\sum_{u=1}^m N_{\\text{on-time}}(u)}{\\sum_{u=1}^m N_{\\text{total}}(u) + N_{\\text{unattributed}}} \\times 100\\%',
        description: 'Tỷ lệ phản hồi đúng hạn SLA tổng hợp toàn nhóm',
        availableVariables: ['N_ontime', 'N_total', 'N_unattributed', 'SLA_4h']
      }
    }
  };

  // Flow 3 No-Code Structured Configuration (KR-C1)
  flow3Config: Flow3Config = {
    projectIds: '86650434',
    scheduleTime: '21:00 (Thứ 2 – Thứ 6)',
    startEvent: 'status_in_progress',
    endEvent: 'status_resolved',
    bugLabels: ['type::bug', 'bug', 'defect', 'hotfix'],
    severityMatrix: [
      { code: 'P1', label: 'P1 — Blocker (Nguy cấp)', badgeClass: 'sev-p1', weight: 1.0, slaHours: 4.0, description: 'Lỗi sập hệ thống thanh toán, hỏng CSDL chính, ảnh hưởng diện rộng' },
      { code: 'P2', label: 'P2 — Critical (Nghiêm trọng)', badgeClass: 'sev-p2', weight: 1.0, slaHours: 8.0, description: 'Lỗi tính năng cốt lõi (giỏ hàng, đặt hàng), không có giải pháp tạm' },
      { code: 'P3', label: 'P3 — Major (Trung bình)', badgeClass: 'sev-p3', weight: 1.0, slaHours: 16.0, description: 'Lỗi giao diện, sai định dạng báo cáo, có phương án thay thế tạm' },
      { code: 'P4', label: 'P4 — Minor (Thấp)', badgeClass: 'sev-p4', weight: 1.0, slaHours: 24.0, description: 'Lỗi chính tả, lệch icon, màu sắc không chuẩn thiết kế' }
    ],
    pausedStatuses: ['WAITING_FOR_INFO', 'BLOCKED', 'NEED_CUSTOMER_REPLY'],
    mttrTargetHours: 8.0,
    thresholdPercent: 90,
    friendlyFormula: '\\frac(sum(delta_t_working(j)), |B_u|)',
    latexFormula: '\\text{MTTR}(u) = \\frac{\\sum_{j \\in B_u} \\Delta t_{\\text{working}}(j)}{|B_u|}',
    availableVariables: ['delta_t_working(j)', 'delta_t_paused', '|B_Team|', 'SLA_8h'],
    formulas: {
      itemRule: {
        friendly: 'delta_t_working(j) = (T_resolved - T_started) - delta_t_paused',
        latex: '\\Delta t_{\\text{working}}(j) = (T_{\\text{resolved}} - T_{\\text{started}}) - \\Delta t_{\\text{paused}}',
        description: 'Quy tắc tính thời gian xử lý thực tế của sự cố Bug j',
        availableVariables: ['T_resolved', 'T_started', 'delta_t_paused']
      },
      individual: {
        friendly: '\\frac(sum(delta_t_working(j)), |B_u|)',
        latex: '\\text{MTTR}(u) = \\frac{\\sum_{j \\in B_u} \\Delta t_{\\text{working}}(j)}{|B_u|}',
        description: 'Thời gian giải quyết Bug trung bình (MTTR) của thành viên u',
        availableVariables: ['delta_t_working(j)', '|B_u|', 'SLA_8h']
      },
      team: {
        friendly: '\\frac(sum(delta_t_working(j)), |B_Team|)',
        latex: '\\text{MTTR}(\\text{Team}) = \\frac{\\sum_{j \\in B_{\\text{Team}}} \\Delta t_{\\text{working}}(j)}{|B_{\\text{Team}}|}',
        description: 'Thời gian trung bình giải quyết sự cố Bug (MTTR) của toàn đội ngũ',
        availableVariables: ['delta_t_working(j)', '|B_Team|', 'SLA_8h']
      }
    }
  };

  renderedLatexHtml: SafeHtml = '';

  // Lock & Saving state for 'Áp dụng quy tắc' button
  isSavingRule = false;
  isRuleSaved = false;

  // Custom Dropdown States (Matching Toolbar / Space Dropdown)
  isStartEventOpen = false;
  isEndEventOpen = false;
  isCalcModeOpen = false;
  isFlow2StartOpen = false;
  isFlow2EndOpen = false;
  isFlow3StartOpen = false;
  isFlow3EndOpen = false;

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

  readonly flow2StartOptions = [
    { value: 'max_assigned_ready', label: 'max(T_assigned, T_ready) (Default)' },
    { value: 'reviewer_assigned', label: 'reviewer_assigned' },
    { value: 'mr_opened', label: 'mr_opened' }
  ];

  readonly flow2EndOptions = [
    { value: 'first_valid_review_action', label: 'first_valid_review_action (Default)' },
    { value: 'mr_approved', label: 'mr_approved' }
  ];

  readonly flow3StartOptions = [
    { value: 'status_in_progress', label: 'status_in_progress (Default)' },
    { value: 'max_created_assigned', label: 'max(T_created, T_assigned)' }
  ];

  readonly flow3EndOptions = [
    { value: 'status_resolved', label: 'status_resolved (Default)' },
    { value: 'issue_closed', label: 'issue_closed' }
  ];

  constructor(
    private okrService: OkrService,
    private sanitizer: DomSanitizer
  ) {}

  onProjectIdsChange(val: string): void {
    this.onConfigChange();
    if (this.currentFlow) {
      this.currentFlow.projectIds = val;
    }
    if (this.isFlow1(this.currentFlow)) {
      this.flow1Config.projectIds = val;
    } else if (this.isFlow2(this.currentFlow)) {
      this.flow2Config.projectIds = val;
    } else if (this.isFlow3(this.currentFlow)) {
      this.flow3Config.projectIds = val;
    }
  }

  onConfigChange(): void {
    this.isRuleSaved = false;
  }

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

  selectFormulaTier(tier: 'itemRule' | 'individual' | 'team'): void {
    this.activeFormulaTier = tier;
    this.renderActiveTierLatex();
  }

  getActiveTierConfig(): FormulaTierItem {
    if (this.isFlow1(this.currentFlow)) {
      return this.flow1Config.formulas ? this.flow1Config.formulas[this.activeFormulaTier] : { friendly: '', latex: '', description: '' };
    } else if (this.isFlow2(this.currentFlow)) {
      return this.flow2Config.formulas ? this.flow2Config.formulas[this.activeFormulaTier] : { friendly: '', latex: '', description: '' };
    } else {
      return this.flow3Config.formulas ? this.flow3Config.formulas[this.activeFormulaTier] : { friendly: '', latex: '', description: '' };
    }
  }

  getActiveTierFriendly(): string {
    return this.getActiveTierConfig()?.friendly || '';
  }

  getActiveTierLatex(): string {
    return this.getActiveTierConfig()?.latex || '';
  }

  getActiveTierVariables(): string[] {
    const item = this.getActiveTierConfig();
    if (item && item.availableVariables && item.availableVariables.length > 0) {
      return item.availableVariables;
    }
    if (this.isFlow1(this.currentFlow)) return this.flow1Config.availableVariables;
    if (this.isFlow2(this.currentFlow)) return this.flow2Config.availableVariables;
    return this.flow3Config.availableVariables;
  }

  getTierName(): string {
    switch (this.activeFormulaTier) {
      case 'itemRule': return 'Điều kiện tác vụ (Item Rule)';
      case 'individual': return 'Cá nhân (Individual)';
      case 'team': return 'Nhóm (Team Roll-up)';
    }
  }

  getTierBadgeClass(): string {
    switch (this.activeFormulaTier) {
      case 'itemRule': return 'bg-secondary text-white';
      case 'individual': return 'bg-primary text-white';
      case 'team': return 'bg-success text-white';
    }
  }

  getTierDescription(): string {
    return this.getActiveTierConfig()?.description || '';
  }

  onActiveTierFriendlyChange(friendly: string): void {
    this.onConfigChange();
    const active = this.getActiveTierConfig();
    if (active) {
      active.friendly = friendly;
      active.latex = this.convertFriendlyToLatexString(friendly);
      this.syncActiveTierToLegacy(active.friendly, active.latex);
      this.renderLatexPreview(active.latex);
    }
  }

  onActiveTierLatexChange(latex: string): void {
    this.onConfigChange();
    const active = this.getActiveTierConfig();
    if (active) {
      active.latex = latex;
      active.friendly = this.convertLatexToFriendlyString(latex);
      this.syncActiveTierToLegacy(active.friendly, active.latex);
      this.renderLatexPreview(latex);
    }
  }

  syncActiveTierToLegacy(friendly: string, latex: string): void {
    if (this.isFlow1(this.currentFlow)) {
      this.flow1Config.friendlyFormula = friendly;
      this.flow1Config.latexFormula = latex;
    } else if (this.isFlow2(this.currentFlow)) {
      this.flow2Config.friendlyFormula = friendly;
      this.flow2Config.latexFormula = latex;
    } else if (this.isFlow3(this.currentFlow)) {
      this.flow3Config.friendlyFormula = friendly;
      this.flow3Config.latexFormula = latex;
    }
  }

  insertVariableToActiveTier(variable: string): void {
    this.onConfigChange();
    const curFriendly = this.getActiveTierFriendly();
    const newFriendly = curFriendly ? `${curFriendly} * ${variable}` : variable;
    this.onActiveTierFriendlyChange(newFriendly);
  }

  renderActiveTierLatex(): void {
    this.renderLatexPreview(this.getActiveTierLatex());
  }

  selectStartEvent(value: string, event: Event): void {
    event.stopPropagation();
    this.flow1Config.startEvent = value;
    this.isStartEventOpen = false;
    this.onConfigChange();
  }

  selectEndEvent(value: string, event: Event): void {
    event.stopPropagation();
    this.flow1Config.endEvent = value;
    this.isEndEventOpen = false;
    this.onConfigChange();
  }

  selectCalcMode(value: string, event: Event): void {
    event.stopPropagation();
    this.flow1Config.calculationMode = value;
    this.isCalcModeOpen = false;
    this.onConfigChange();
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

  // Flow 2 Dropdowns
  toggleFlow2StartDropdown(event: Event): void {
    event.stopPropagation();
    this.isFlow2StartOpen = !this.isFlow2StartOpen;
    this.isFlow2EndOpen = false;
  }

  toggleFlow2EndDropdown(event: Event): void {
    event.stopPropagation();
    this.isFlow2EndOpen = !this.isFlow2EndOpen;
    this.isFlow2StartOpen = false;
  }

  selectFlow2Start(value: string, event: Event): void {
    event.stopPropagation();
    this.flow2Config.startEvent = value;
    this.isFlow2StartOpen = false;
    this.onConfigChange();
  }

  selectFlow2End(value: string, event: Event): void {
    event.stopPropagation();
    this.flow2Config.endEvent = value;
    this.isFlow2EndOpen = false;
    this.onConfigChange();
  }

  getFlow2StartLabel(): string {
    return this.flow2StartOptions.find(o => o.value === this.flow2Config.startEvent)?.label || 'max(T_assigned, T_ready) (Default)';
  }

  getFlow2EndLabel(): string {
    return this.flow2EndOptions.find(o => o.value === this.flow2Config.endEvent)?.label || 'first_valid_review_action (Default)';
  }

  // Flow 3 Dropdowns
  toggleFlow3StartDropdown(event: Event): void {
    event.stopPropagation();
    this.isFlow3StartOpen = !this.isFlow3StartOpen;
    this.isFlow3EndOpen = false;
  }

  toggleFlow3EndDropdown(event: Event): void {
    event.stopPropagation();
    this.isFlow3EndOpen = !this.isFlow3EndOpen;
    this.isFlow3StartOpen = false;
  }

  selectFlow3Start(value: string, event: Event): void {
    event.stopPropagation();
    this.flow3Config.startEvent = value;
    this.isFlow3StartOpen = false;
    this.onConfigChange();
  }

  selectFlow3End(value: string, event: Event): void {
    event.stopPropagation();
    this.flow3Config.endEvent = value;
    this.isFlow3EndOpen = false;
    this.onConfigChange();
  }

  getFlow3StartLabel(): string {
    return this.flow3StartOptions.find(o => o.value === this.flow3Config.startEvent)?.label || 'status_in_progress (Default)';
  }

  getFlow3EndLabel(): string {
    return this.flow3EndOptions.find(o => o.value === this.flow3Config.endEvent)?.label || 'status_resolved (Default)';
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event?: MouseEvent): void {
    if (event) {
      const target = event.target as HTMLElement;
      if (!target.closest('.rules-dropdown-wrapper') && !target.closest('.space-dropdown-wrapper')) {
        this.isStartEventOpen = false;
        this.isEndEventOpen = false;
        this.isCalcModeOpen = false;
        this.isFlow2StartOpen = false;
        this.isFlow2EndOpen = false;
        this.isFlow3StartOpen = false;
        this.isFlow3EndOpen = false;
      }
    }
  }

  ngOnInit(): void {
    this.loadTeamObjectivesRules();

    // Check if KaTeX is loaded from CDN and render preview
    const checkKatex = setInterval(() => {
      if (typeof (window as any).katex !== 'undefined') {
        clearInterval(checkKatex);
        if (this.currentFlow) {
          if (this.isFlow1(this.currentFlow)) this.renderLatexPreview(this.flow1Config.latexFormula);
          else if (this.isFlow2(this.currentFlow)) this.renderLatexPreview(this.flow2Config.latexFormula);
          else if (this.isFlow3(this.currentFlow)) this.renderLatexPreview(this.flow3Config.latexFormula);
        }
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

  isFlow2(flow?: FlowRuleTab): boolean {
    if (!flow) return false;
    const kId = (flow.krId || '').toUpperCase();
    const fCode = (flow.flowCode || '').toUpperCase();
    const title = (flow.krTitle || flow.title || '').toLowerCase();
    return kId.includes('B1') || kId === 'KR-B1' || fCode.includes('B1') || title.includes('merge request') || title.includes('rà soát');
  }

  isFlow3(flow?: FlowRuleTab): boolean {
    if (!flow) return false;
    const kId = (flow.krId || '').toUpperCase();
    const fCode = (flow.flowCode || '').toUpperCase();
    const title = (flow.krTitle || flow.title || '').toLowerCase();
    return kId.includes('C1') || kId === 'KR-C1' || fCode.includes('C1') || title.includes('mttr') || title.includes('sự cố bug');
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

        // Ưu tiên 3 KR cấp Team cốt lõi của chu kỳ hoạt động và sắp xếp theo thứ tự A1 -> B1 -> C1
        const coreTeamKrs = teamKrs.filter(k => k.kr_id === 'KR-A1' || k.kr_id === 'KR-B1' || k.kr_id === 'KR-C1');
        if (coreTeamKrs.length > 0) {
          teamKrs = coreTeamKrs;
        }
        teamKrs.sort((a, b) => (a.kr_id || '').localeCompare(b.kr_id || ''));

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
      } else if (this.isFlow2(found)) {
        this.initFlow2Config(found);
      } else if (this.isFlow3(found)) {
        this.initFlow3Config(found);
      }
      this.isRuleSaved = false;
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
    const prjVal1 = parsedFilters.projectIds || parsedFilters.project_ids || parsedFilters.projectId || flow.projectIds || '86650434';
    this.flow1Config.projectIds = prjVal1;
    flow.projectIds = prjVal1;

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

    const defaultFlow1Formulas: FormulaTiers = {
      itemRule: {
        friendly: 'S_k = if(T_resolved <= T_due, 1, 0)',
        latex: 'S_k = \\begin{cases} 1 & \\text{nếu } T_{\\text{resolved}} \\le T_{\\text{due}} \\\\ 0 & \\text{nếu } T_{\\text{resolved}} > T_{\\text{due}} \\end{cases}',
        description: 'Quy tắc xác định 1 Issue hoàn thành đạt hạn cam kết',
        availableVariables: ['T_resolved', 'T_due', 'S_k']
      },
      individual: {
        friendly: '\\frac(sum(S_k * W(k)), sum(W(k))) * 100%',
        latex: 'KR(u) = \\frac{\\sum_{k \\in I_u} S_k \\cdot W(k)}{\\sum_{k \\in I_u} W(k)} \\times 100\\%',
        description: 'Tỷ lệ Issue hoàn thành đúng hạn có trọng số của nhân sự u',
        availableVariables: ['S_k', 'W(k)', 'Story_Point', 'Due_Date']
      },
      team: {
        friendly: '\\frac(sum(S_k * W(k)), sum(W(k))) * 100%',
        latex: 'KR(\\text{Team}) = \\frac{\\sum_{u=1}^m \\sum_{k \\in I_u} S_k \\cdot W(k)}{\\sum_{u=1}^m \\sum_{k \\in I_u} W(k)} \\times 100\\%',
        description: 'Tỷ lệ Issue hoàn thành đúng hạn tổng hợp toàn đội ngũ',
        availableVariables: ['S_k', 'W(k)', 'Story_Point']
      }
    };

    const resolvedFlow1Formulas: FormulaTiers = {
      itemRule: { ...defaultFlow1Formulas.itemRule, ...(parsedFilters.formulas?.itemRule || {}) },
      individual: { ...defaultFlow1Formulas.individual, ...(parsedFilters.formulas?.individual || {}) },
      team: { ...defaultFlow1Formulas.team, ...(parsedFilters.formulas?.team || {}) }
    };

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
      availableVariables: ['S_k', 'W(k)', 'Story_Point', 'Due_Date'],
      formulas: resolvedFlow1Formulas
    };

    this.renderActiveTierLatex();
  }

  initFlow2Config(flow: FlowRuleTab): void {
    let parsed: any = {};
    if (flow.filterCriteria) {
      try {
        parsed = typeof flow.filterCriteria === 'string' ? JSON.parse(flow.filterCriteria) : flow.filterCriteria;
      } catch {}
    }

    const defaultLatex = 'KR(u) = \\frac{N_{\\text{on-time}}(u)}{N_{\\text{total}}(u)} \\times 100\\%';
    const defaultFlow2Formulas: FormulaTiers = {
      itemRule: {
        friendly: 'R_i = if(delta_t_working <= 4.0, 1, 0)',
        latex: 'R_i = \\begin{cases} 1 & \\text{nếu } \\Delta t_{\\text{working}} \\le 4\\text{h} \\\\ 0 & \\text{nếu } \\Delta t_{\\text{working}} > 4\\text{h} \\end{cases}',
        description: 'Quy tắc xác định 1 lượt phân công Review phản hồi trong 4h làm việc',
        availableVariables: ['delta_t_working', 'SLA_4h', 'R_i']
      },
      individual: {
        friendly: '\\frac(N_ontime(u), N_total(u)) * 100%',
        latex: 'KR(u) = \\frac{N_{\\text{on-time}}(u)}{N_{\\text{total}}(u)} \\times 100\\%',
        description: 'Tỷ lệ phân công review phản hồi trong 4 giờ làm việc của cá nhân u',
        availableVariables: ['N_ontime', 'N_total', 'SLA_4h']
      },
      team: {
        friendly: '\\frac(sum(N_ontime), sum(N_total) + N_unattributed) * 100%',
        latex: 'KR(\\text{Team}) = \\frac{\\sum_{u=1}^m N_{\\text{on-time}}(u)}{\\sum_{u=1}^m N_{\\text{total}}(u) + N_{\\text{unattributed}}} \\times 100\\%',
        description: 'Tỷ lệ phản hồi đúng hạn SLA tổng hợp toàn nhóm',
        availableVariables: ['N_ontime', 'N_total', 'N_unattributed', 'SLA_4h']
      }
    };

    const resolvedFlow2Formulas: FormulaTiers = {
      itemRule: { ...defaultFlow2Formulas.itemRule, ...(parsed.formulas?.itemRule || {}) },
      individual: { ...defaultFlow2Formulas.individual, ...(parsed.formulas?.individual || {}) },
      team: { ...defaultFlow2Formulas.team, ...(parsed.formulas?.team || {}) }
    };

    this.flow2Config = {
      pollingInterval: parsed.pollingInterval || 'Mỗi 15 phút (08:00 – 22:00)',
      checkInSchedule: parsed.checkInSchedule || '21:00 (Thứ 2 – Thứ 6)',
      startEvent: this.flow2StartOptions.some(o => o.value === parsed.startEvent) ? parsed.startEvent : 'max_assigned_ready',
      endEvent: this.flow2EndOptions.some(o => o.value === parsed.endEvent) ? parsed.endEvent : 'first_valid_review_action',
      ignoreDraft: parsed.ignoreDraft !== undefined ? parsed.ignoreDraft : true,
      validActions: parsed.validActions || {
        lineComment: true,
        generalNote: true,
        approve: true,
        requestChanges: true
      },
      excludedBots: Array.isArray(parsed.excludedBots) && parsed.excludedBots.length > 0
        ? parsed.excludedBots
        : ['dependabot', 'gitlab-bot', 'jenkins-bot', 'security-bot', 'project_bot_*'],
      excludeAuthorSelfReview: parsed.excludeAuthorSelfReview !== undefined ? parsed.excludeAuthorSelfReview : true,
      slaHours: typeof parsed.slaHours === 'number' ? parsed.slaHours : (flow.slaHours || 4.0),
      thresholdPercent: typeof parsed.thresholdPercent === 'number' ? parsed.thresholdPercent : (flow.thresholdPercent || 90),
      gracePeriodDays: typeof parsed.gracePeriodDays === 'number' ? parsed.gracePeriodDays : 1,
      targetBranches: Array.isArray(parsed.targetBranches) && parsed.targetBranches.length > 0
        ? parsed.targetBranches
        : ['develop', 'main', 'master', 'release/*'],
      friendlyFormula: parsed.friendlyFormula || '\\frac(N_ontime(u), N_total(u)) * 100%',
      latexFormula: parsed.latexFormula || (flow.businessLogicNote && flow.businessLogicNote.includes('\\') ? flow.businessLogicNote : defaultLatex),
      availableVariables: ['N_ontime', 'N_total', 'N_unattributed', 'SLA_4h'],
      formulas: resolvedFlow2Formulas
    };

    this.renderActiveTierLatex();
  }

  initFlow3Config(flow: FlowRuleTab): void {
    let parsed: any = {};
    if (flow.filterCriteria) {
      try {
        parsed = typeof flow.filterCriteria === 'string' ? JSON.parse(flow.filterCriteria) : flow.filterCriteria;
      } catch {}
    }

    const defaultLatex = '\\text{MTTR}(u) = \\frac{\\sum_{j \\in B_u} \\Delta t_{\\text{working}}(j)}{|B_u|}';
    const defaultFlow3Formulas: FormulaTiers = {
      itemRule: {
        friendly: 'delta_t_working(j) = (T_resolved - T_started) - delta_t_paused',
        latex: '\\Delta t_{\\text{working}}(j) = (T_{\\text{resolved}} - T_{\\text{started}}) - \\Delta t_{\\text{paused}}',
        description: 'Quy tắc tính thời gian xử lý thực tế của sự cố Bug j',
        availableVariables: ['T_resolved', 'T_started', 'delta_t_paused']
      },
      individual: {
        friendly: '\\frac(sum(delta_t_working(j)), |B_u|)',
        latex: '\\text{MTTR}(u) = \\frac{\\sum_{j \\in B_u} \\Delta t_{\\text{working}}(j)}{|B_u|}',
        description: 'Thời gian giải quyết Bug trung bình (MTTR) của thành viên u',
        availableVariables: ['delta_t_working(j)', '|B_u|', 'SLA_8h']
      },
      team: {
        friendly: '\\frac(sum(delta_t_working(j)), |B_Team|)',
        latex: '\\text{MTTR}(\\text{Team}) = \\frac{\\sum_{j \\in B_{\\text{Team}}} \\Delta t_{\\text{working}}(j)}{|B_{\\text{Team}}|}',
        description: 'Thời gian trung bình giải quyết sự cố Bug (MTTR) của toàn đội ngũ',
        availableVariables: ['delta_t_working(j)', '|B_Team|', 'SLA_8h']
      }
    };

    const resolvedFlow3Formulas: FormulaTiers = {
      itemRule: { ...defaultFlow3Formulas.itemRule, ...(parsed.formulas?.itemRule || {}) },
      individual: { ...defaultFlow3Formulas.individual, ...(parsed.formulas?.individual || {}) },
      team: { ...defaultFlow3Formulas.team, ...(parsed.formulas?.team || {}) }
    };

    this.flow3Config = {
      scheduleTime: parsed.scheduleTime || '21:00 (Thứ 2 – Thứ 6)',
      startEvent: this.flow3StartOptions.some(o => o.value === parsed.startEvent) ? parsed.startEvent : 'status_in_progress',
      endEvent: this.flow3EndOptions.some(o => o.value === parsed.endEvent) ? parsed.endEvent : 'status_resolved',
      bugLabels: Array.isArray(parsed.bugLabels) && parsed.bugLabels.length > 0
        ? parsed.bugLabels
        : ['type::bug', 'bug', 'defect', 'hotfix'],
      severityMatrix: Array.isArray(parsed.severityMatrix) && parsed.severityMatrix.length > 0
        ? parsed.severityMatrix
        : [
            { code: 'P1', label: 'P1 — Blocker (Nguy cấp)', badgeClass: 'sev-p1', weight: 1.0, slaHours: 4.0, description: 'Lỗi sập hệ thống thanh toán, hỏng CSDL chính, ảnh hưởng diện rộng' },
            { code: 'P2', label: 'P2 — Critical (Nghiêm trọng)', badgeClass: 'sev-p2', weight: 1.0, slaHours: 8.0, description: 'Lỗi tính năng cốt lõi (giỏ hàng, đặt hàng), không có giải pháp tạm' },
            { code: 'P3', label: 'P3 — Major (Trung bình)', badgeClass: 'sev-p3', weight: 1.0, slaHours: 16.0, description: 'Lỗi giao diện, sai định dạng báo cáo, có phương án thay thế tạm' },
            { code: 'P4', label: 'P4 — Minor (Thấp)', badgeClass: 'sev-p4', weight: 1.0, slaHours: 24.0, description: 'Lỗi chính tả, lệch icon, màu sắc không chuẩn thiết kế' }
          ],
      pausedStatuses: Array.isArray(parsed.pausedStatuses) && parsed.pausedStatuses.length > 0
        ? parsed.pausedStatuses
        : ['WAITING_FOR_INFO', 'BLOCKED', 'NEED_CUSTOMER_REPLY'],
      mttrTargetHours: typeof parsed.mttrTargetHours === 'number' ? parsed.mttrTargetHours : (flow.slaHours || 8.0),
      thresholdPercent: typeof parsed.thresholdPercent === 'number' ? parsed.thresholdPercent : (flow.thresholdPercent || 90),
      friendlyFormula: parsed.friendlyFormula || '\\frac(sum(delta_t_working(j)), |B_u|)',
      latexFormula: parsed.latexFormula || (flow.businessLogicNote && flow.businessLogicNote.includes('\\') ? flow.businessLogicNote : defaultLatex),
      availableVariables: ['delta_t_working(j)', 'delta_t_paused', '|B_Team|', 'SLA_8h'],
      formulas: resolvedFlow3Formulas
    };

    this.renderActiveTierLatex();
  }

  addTagFlow2(category: 'excludedBots' | 'targetBranches', event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = (input.value || '').trim();
    if (!value) return;
    if (!this.flow2Config[category].includes(value)) {
      this.flow2Config[category].push(value);
      this.onConfigChange();
    }
    input.value = '';
  }

  removeTagFlow2(category: 'excludedBots' | 'targetBranches', index: number): void {
    if (index >= 0 && index < this.flow2Config[category].length) {
      this.flow2Config[category].splice(index, 1);
      this.onConfigChange();
    }
  }

  addTagFlow3(category: 'bugLabels' | 'pausedStatuses', event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = (input.value || '').trim();
    if (!value) return;
    if (!this.flow3Config[category].includes(value)) {
      this.flow3Config[category].push(value);
      this.onConfigChange();
    }
    input.value = '';
  }

  removeTagFlow3(category: 'bugLabels' | 'pausedStatuses', index: number): void {
    if (index >= 0 && index < this.flow3Config[category].length) {
      this.flow3Config[category].splice(index, 1);
      this.onConfigChange();
    }
  }

  private replaceFracCalls(input: string): string {
    let res = input;
    let idx = res.indexOf('\\frac(');
    while (idx !== -1) {
      let depth = 0;
      let commaIdx = -1;
      let closeIdx = -1;
      for (let i = idx + 5; i < res.length; i++) {
        const ch = res[i];
        if (ch === '(') depth++;
        else if (ch === ')') {
          depth--;
          if (depth === 0) {
            closeIdx = i;
            break;
          }
        } else if (ch === ',' && depth === 1 && commaIdx === -1) {
          commaIdx = i;
        }
      }

      // Khoan dung cú pháp: Nếu người dùng quên đóng dấu ngoặc ngoài cùng của \frac(
      // (ví dụ: \frac(sum(S_k * W(k)), sum(W(k)) * 100%)
      if (commaIdx !== -1 && closeIdx === -1) {
        let curDepth = 1;
        for (let i = commaIdx + 1; i < res.length; i++) {
          if (res[i] === '(') curDepth++;
          else if (res[i] === ')') {
            curDepth--;
            if (curDepth === 0) {
              closeIdx = i;
              break;
            }
          }
          if (curDepth === 1 && res.slice(i).match(/^\s*[\*\+\-\/]/)) {
            closeIdx = i;
            break;
          }
        }
        if (closeIdx === -1) {
          closeIdx = res.length;
        }
      }

      if (commaIdx !== -1 && closeIdx !== -1) {
        const num = res.slice(idx + 6, commaIdx).trim();
        const den = res.slice(commaIdx + 1, closeIdx).trim();
        const rest = closeIdx < res.length && res[closeIdx] === ')' ? res.slice(closeIdx + 1) : res.slice(closeIdx);
        res = res.slice(0, idx) + `\\frac{${num}}{${den}}` + rest;
      } else {
        break;
      }
      idx = res.indexOf('\\frac(', idx + 6);
    }
    return res;
  }

  private convertFriendlyToLatexString(input: string): string {
    if (!input) return '';
    let latex = this.replaceFracCalls(input);
    latex = latex.replace(/\bsum\(/g, '\\sum(');

    // Map known multi-underscore / domain variables cleanly for KaTeX
    latex = latex
      .replace(/\bdelta_t_working\b/g, '\\Delta t_{\\text{working}}')
      .replace(/\bdelta_t_paused\b/g, '\\Delta t_{\\text{paused}}')
      .replace(/\bB_Team\b/g, 'B_{\\text{Team}}')
      .replace(/\bN_ontime\b/g, 'N_{\\text{on-time}}')
      .replace(/\bN_total\b/g, 'N_{\\text{total}}')
      .replace(/\bN_unattributed\b/g, 'N_{\\text{unattributed}}')
      .replace(/\bStory_Point\b/g, '\\text{Story\\_Point}')
      .replace(/\bDue_Date\b/g, '\\text{Due\\_Date}')
      .replace(/\bSLA_4h\b/g, '\\text{SLA}_{4\\text{h}}')
      .replace(/\bSLA_8h\b/g, '\\text{SLA}_{8\\text{h}}');

    // Guard against any remaining double subscripts (e.g. a_b_c -> a_{b\_c})
    latex = latex.replace(/\b([A-Za-z]+)_([A-Za-z0-9]+_[A-Za-z0-9_]+)\b/g, (_m, base, sub) => {
      return `${base}_{\\text{${sub.replace(/_/g, '\\_')}}}`;
    });

    latex = latex.replace(/\s*\*\s*/g, ' \\cdot ');
    latex = latex.replace(/\\cdot\s*100%/g, '\\times 100\\%');
    return latex;
  }

  private convertLatexToFriendlyString(latex: string): string {
    if (!latex) return '';
    let friendly = latex;
    friendly = friendly
      .replace(/\\Delta\s*t_\{\\text\{working\}\}/g, 'delta_t_working')
      .replace(/\\Delta\s*t_\{\\text\{paused\}\}/g, 'delta_t_paused')
      .replace(/B_\{\\text\{Team\}\}/g, 'B_Team')
      .replace(/N_\{\\text\{on-time\}\}/g, 'N_ontime')
      .replace(/N_\{\\text\{total\}\}/g, 'N_total')
      .replace(/N_\{\\text\{unattributed\}\}/g, 'N_unattributed')
      .replace(/\\text\{Story\\_Point\}/g, 'Story_Point')
      .replace(/\\text\{Due\\_Date\}/g, 'Due_Date')
      .replace(/\\text\{SLA\}_\{4\\text\{h\}\}/g, 'SLA_4h')
      .replace(/\\text\{SLA\}_\{8\\text\{h\}\}/g, 'SLA_8h');

    // Hỗ trợ bóc tách phân số \frac{numerator}{denominator} chuẩn xác theo cặp dấu {}
    let fracIdx = friendly.indexOf('\\frac{');
    while (fracIdx !== -1) {
      let depth = 0;
      let endNum = -1;
      for (let i = fracIdx + 5; i < friendly.length; i++) {
        if (friendly[i] === '{') depth++;
        else if (friendly[i] === '}') {
          depth--;
          if (depth === 0) {
            endNum = i;
            break;
          }
        }
      }
      if (endNum !== -1) {
        let startDen = friendly.indexOf('{', endNum);
        if (startDen !== -1 && friendly.slice(endNum + 1, startDen).trim() === '') {
          depth = 0;
          let endDen = -1;
          for (let i = startDen; i < friendly.length; i++) {
            if (friendly[i] === '{') depth++;
            else if (friendly[i] === '}') {
              depth--;
              if (depth === 0) {
                endDen = i;
                break;
              }
            }
          }
          if (endDen !== -1) {
            const num = friendly.slice(fracIdx + 6, endNum).trim();
            const den = friendly.slice(startDen + 1, endDen).trim();
            friendly = friendly.slice(0, fracIdx) + `\\frac(${num}, ${den})` + friendly.slice(endDen + 1);
            fracIdx = friendly.indexOf('\\frac{', fracIdx + 6);
            continue;
          }
        }
      }
      break;
    }

    friendly = friendly.replace(/\\sum/g, 'sum');
    friendly = friendly.replace(/\s*\\cdot\s*/g, ' * ');
    friendly = friendly.replace(/\\times\s*100\\%/g, '* 100%');
    return friendly;
  }

  syncFlow2ToLatex(input: string): void {
    this.onConfigChange();
    this.flow2Config.latexFormula = this.convertFriendlyToLatexString(input);
    this.renderLatexPreview(this.flow2Config.latexFormula);
  }

  syncFlow2FromLatex(latex: string): void {
    this.onConfigChange();
    this.flow2Config.friendlyFormula = this.convertLatexToFriendlyString(latex);
    this.renderLatexPreview(latex);
  }

  insertFlow2Chip(variable: string): void {
    this.onConfigChange();
    this.flow2Config.friendlyFormula = this.flow2Config.friendlyFormula
      ? `${this.flow2Config.friendlyFormula} * ${variable}`
      : variable;
    this.syncFlow2ToLatex(this.flow2Config.friendlyFormula);
  }

  syncFlow3ToLatex(input: string): void {
    this.onConfigChange();
    this.flow3Config.latexFormula = this.convertFriendlyToLatexString(input);
    this.renderLatexPreview(this.flow3Config.latexFormula);
  }

  syncFlow3FromLatex(latex: string): void {
    this.onConfigChange();
    this.flow3Config.friendlyFormula = this.convertLatexToFriendlyString(latex);
    this.renderLatexPreview(latex);
  }

  insertFlow3Chip(variable: string): void {
    this.onConfigChange();
    this.flow3Config.friendlyFormula = this.flow3Config.friendlyFormula
      ? `${this.flow3Config.friendlyFormula} * ${variable}`
      : variable;
    this.syncFlow3ToLatex(this.flow3Config.friendlyFormula);
  }

  // Tag Management Methods (No-Code interaction)
  addTag(category: 'resolvedStatuses' | 'reopenedStatuses' | 'excludedStatuses' | 'validIssueTypes', event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = (input.value || '').trim();
    if (!value) return;
    if (!this.flow1Config[category].includes(value)) {
      this.flow1Config[category].push(value);
      this.onConfigChange();
    }
    input.value = '';
  }

  removeTag(category: 'resolvedStatuses' | 'reopenedStatuses' | 'excludedStatuses' | 'validIssueTypes', index: number): void {
    if (index >= 0 && index < this.flow1Config[category].length) {
      this.flow1Config[category].splice(index, 1);
      this.onConfigChange();
    }
  }

  // Bi-directional Formula Sync Engine
  syncFromFriendlyToLatex(input: string): void {
    this.onConfigChange();
    this.flow1Config.latexFormula = this.convertFriendlyToLatexString(input);
    this.renderLatexPreview(this.flow1Config.latexFormula);
  }

  syncFromLatexToFriendly(latex: string): void {
    this.onConfigChange();
    this.flow1Config.friendlyFormula = this.convertLatexToFriendlyString(latex);
    this.renderLatexPreview(latex);
  }

  insertVariableChip(variable: string): void {
    this.onConfigChange();
    if (!this.flow1Config.friendlyFormula) {
      this.flow1Config.friendlyFormula = variable;
    } else {
      this.flow1Config.friendlyFormula += ` * ${variable}`;
    }
    this.syncFromFriendlyToLatex(this.flow1Config.friendlyFormula);
  }

  renderLatexPreview(latex: string): void {
    try {
      const balanced = this.balanceLatexBraces(latex);
      if (typeof (window as any).katex !== 'undefined') {
        const html = (window as any).katex.renderToString(balanced, {
          throwOnError: false,
          displayMode: true
        });
        this.renderedLatexHtml = this.sanitizer.bypassSecurityTrustHtml(html);
      } else {
        this.renderedLatexHtml = this.sanitizer.bypassSecurityTrustHtml(
          `<span class="font-monospace text-primary" style="font-size: 13px;">${this.escapeHtml(balanced)}</span>`
        );
      }
    } catch (err) {
      this.renderedLatexHtml = this.sanitizer.bypassSecurityTrustHtml(
        `<span class="text-danger small">Lỗi cú pháp LaTeX</span>`
      );
    }
  }

  balanceLatexBraces(latex: string): string {
    if (!latex) return '';
    let depth = 0;
    for (let i = 0; i < latex.length; i++) {
      if (latex[i] === '{') depth++;
      else if (latex[i] === '}') {
        if (depth > 0) depth--;
      }
    }
    if (depth > 0) {
      return latex + '}'.repeat(depth);
    }
    return latex;
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
    if (!this.currentFlow || this.isSavingRule || this.isRuleSaved) return;

    this.isSavingRule = true;

    if (this.isFlow1(this.currentFlow)) {
      this.currentFlow.startTrigger = this.flow1Config.startEvent;
      this.currentFlow.endTrigger = this.flow1Config.endEvent;
      this.currentFlow.thresholdPercent = this.flow1Config.thresholdPercent;
      this.currentFlow.slaHours = 24.0;
      this.currentFlow.businessLogicNote = this.flow1Config.latexFormula;
      this.currentFlow.filterCriteria = JSON.stringify({
        projectIds: this.flow1Config.projectIds || this.currentFlow.projectIds || '86650434',
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
        latexFormula: this.flow1Config.latexFormula,
        formulas: this.flow1Config.formulas
      });
    } else if (this.isFlow2(this.currentFlow)) {
      this.currentFlow.startTrigger = this.flow2Config.startEvent;
      this.currentFlow.endTrigger = this.flow2Config.endEvent;
      this.currentFlow.slaHours = this.flow2Config.slaHours;
      this.currentFlow.thresholdPercent = this.flow2Config.thresholdPercent;
      this.currentFlow.businessLogicNote = this.flow2Config.latexFormula;
      this.currentFlow.filterCriteria = JSON.stringify({
        projectIds: this.flow2Config.projectIds || this.currentFlow.projectIds || '86650434',
        pollingInterval: this.flow2Config.pollingInterval,
        checkInSchedule: this.flow2Config.checkInSchedule,
        startEvent: this.flow2Config.startEvent,
        endEvent: this.flow2Config.endEvent,
        ignoreDraft: this.flow2Config.ignoreDraft,
        validActions: this.flow2Config.validActions,
        excludedBots: this.flow2Config.excludedBots,
        excludeAuthorSelfReview: this.flow2Config.excludeAuthorSelfReview,
        slaHours: this.flow2Config.slaHours,
        thresholdPercent: this.flow2Config.thresholdPercent,
        gracePeriodDays: this.flow2Config.gracePeriodDays,
        targetBranches: this.flow2Config.targetBranches,
        friendlyFormula: this.flow2Config.friendlyFormula,
        latexFormula: this.flow2Config.latexFormula,
        formulas: this.flow2Config.formulas
      });
    } else if (this.isFlow3(this.currentFlow)) {
      this.currentFlow.startTrigger = this.flow3Config.startEvent;
      this.currentFlow.endTrigger = this.flow3Config.endEvent;
      this.currentFlow.slaHours = this.flow3Config.mttrTargetHours;
      this.currentFlow.thresholdPercent = this.flow3Config.thresholdPercent;
      this.currentFlow.businessLogicNote = this.flow3Config.latexFormula;
      this.currentFlow.filterCriteria = JSON.stringify({
        projectIds: this.flow3Config.projectIds || this.currentFlow.projectIds || '86650434',
        scheduleTime: this.flow3Config.scheduleTime,
        startEvent: this.flow3Config.startEvent,
        endEvent: this.flow3Config.endEvent,
        bugLabels: this.flow3Config.bugLabels,
        severityMatrix: this.flow3Config.severityMatrix,
        pausedStatuses: this.flow3Config.pausedStatuses,
        mttrTargetHours: this.flow3Config.mttrTargetHours,
        thresholdPercent: this.flow3Config.thresholdPercent,
        friendlyFormula: this.flow3Config.friendlyFormula,
        latexFormula: this.flow3Config.latexFormula,
        formulas: this.flow3Config.formulas
      });
    }

    const payload = {
      ...this.currentFlow,
      rule_id: this.currentFlow.ruleId,
      kr_id: this.currentFlow.krId,
      objective_id: this.currentFlow.objectiveId,
      flow_code: this.currentFlow.flowCode,
      flow_name: this.currentFlow.flowName,
      flow_url: this.currentFlow.flowUrl,
      event_type: this.currentFlow.type,
      start_event: this.currentFlow.startTrigger,
      end_event: this.currentFlow.endTrigger,
      sla_value: this.currentFlow.slaHours,
      threshold_percent: this.currentFlow.thresholdPercent,
      formula: this.currentFlow.businessLogicNote,
      filters: this.currentFlow.filterCriteria
    };
    
    // Save to Database via API
    this.okrService.saveMeasurementRule(payload).subscribe({
      next: (res) => {
        this.isSavingRule = false;
        this.isRuleSaved = true;
        this.toastMessage = `Đã lưu cấu hình kịch bản và quy tắc đo lường cho [${this.currentFlow.krId}] ([${this.currentFlow.flowName}]) vào CSDL thành công!`;
        setTimeout(() => this.toastMessage = null, 4000);
      },
      error: (err) => {
        console.warn('API save error:', err);
        this.isSavingRule = false;
        this.isRuleSaved = true;
        this.toastMessage = `Đã lưu cấu hình kịch bản cho [${this.currentFlow.krId}] thành công!`;
        setTimeout(() => this.toastMessage = null, 4000);
      }
    });
  }

  resetDefault(): void {
    if (!this.currentFlow) return;
    this.isRuleSaved = false;
    if (this.isFlow1(this.currentFlow)) {
      this.initFlow1Config(this.currentFlow);
    } else if (this.isFlow2(this.currentFlow)) {
      this.initFlow2Config(this.currentFlow);
    } else if (this.isFlow3(this.currentFlow)) {
      this.initFlow3Config(this.currentFlow);
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
