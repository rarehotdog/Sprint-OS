export type UUID = string;
export type ISODateTime = string;

export type Section = "verbal" | "quant" | "di";

export type Difficulty = "easy" | "medium" | "hard";

export type SessionType =
  | "sprint_verbal"
  | "sprint_quant"
  | "sprint_di"
  | "mock_full"
  | "mock_section"
  | "review"
  | "drill";

export type Confidence = "sure" | "unsure" | "guessed";

export type FailureStage =
  | "reading"
  | "strategy"
  | "calculation"
  | "verification"
  | "time_pressure";

export type ReportMode = "quick" | "deep";

export interface Problem {
  id: UUID;
  section: Section;
  sub_type: string;
  difficulty: Difficulty | null;
  content: Record<string, unknown>;
  tags: string[];
  source: string | null;
  created_at: ISODateTime;
}

export interface Session {
  id: UUID;
  session_type: SessionType;
  recipe: string | null;
  duration_planned_min: number;
  duration_actual_min: number | null;
  started_at: ISODateTime;
  completed_at: ISODateTime | null;
  meta: Record<string, unknown>;
}

export interface CRPreThink {
  conclusion: string;
  premise: string;
  assumption: string;
  gap: string;
}

export interface RCPreThink {
  paragraph_tags: string[];
}

export interface QRPreThink {
  constraints: string;
  approach: string;
}

export interface DIPreThink {
  question_label: string;
  unit: string;
  axis: string;
  legend: string;
}

export interface DSPreThink {
  question_reframed: string;
  stmt1_alone: string;
  stmt2_alone: string;
}

export type PreThinkPayload =
  | CRPreThink
  | RCPreThink
  | QRPreThink
  | DIPreThink
  | DSPreThink
  | null;

export interface Attempt {
  id: UUID;
  problem_id: UUID;
  session_id: UUID;
  user_answer: number | null;
  is_correct: boolean;
  time_spent_sec: number;
  exceeded_cutoff: boolean;
  confidence: Confidence | null;
  pre_think: PreThinkPayload;
  attempted_at: ISODateTime;
}

export interface CRSubReport {
  conclusion_restated: string;
  gap_identified: string;
  which_choice_attacked_c: string;
}

export interface RCSubReport {
  paragraph_function_error: string;
  index_paraphrase_check: string;
}

export interface DSSubReport {
  question_reframed_as: string;
  sufficiency_pivot: string;
}

export type QRPercentRelationshipType = "ratio" | "multiple" | "distance";

export interface QRPercentSubReport {
  base_value_identified: string;
  relationship_type: QRPercentRelationshipType;
}

export type ErrorSubReport = {
  cr?: CRSubReport;
  rc?: RCSubReport;
  ds?: DSSubReport;
  qr_percent?: QRPercentSubReport;
};

export interface ErrorReport {
  id: UUID;
  attempt_id: UUID;
  review_queue_id: UUID | null;
  report_mode: ReportMode;
  my_frame: string;
  correct_mechanism: string;
  next_tool: string;
  mechanism_english: string | null;
  logic_comparison: string | null;
  sub_report: ErrorSubReport | null;
  failure_stage: FailureStage | null;
  error_type: string | null;
  ai_wrong_choices: string | null;
  ai_core_principle: string | null;
  ai_emotional_diary: string | null;
  ai_visual_concept: string | null;
  created_at: ISODateTime;
  deepened_at: ISODateTime | null;
}

export interface Rule {
  id: UUID;
  content: string;
  section: Section | null;
  source_report_id: UUID | null;
  is_top20: boolean;
  created_at: ISODateTime;
}

export interface ReviewQueueItem {
  id: UUID;
  problem_id: UUID;
  next_review_at: ISODateTime;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  priority_score: number;
  created_at: ISODateTime;
}

export interface DailyLog {
  id: UUID;
  log_date: string;
  verbal_sprint_done: boolean;
  quant_di_sprint_done: boolean;
  error_reports_count: number;
  deep_reports_count: number;
  rule_of_day: string | null;
  top_error_cause: string | null;
  tomorrow_problems: UUID[];
  notes: string | null;
  created_at: ISODateTime;
}

export interface CalendarDay {
  id: UUID;
  cal_date: string;
  week_number: number;
  intensity_level: number | null;
  planned_verbal: string | null;
  planned_main: string | null;
  is_mock_day: boolean;
  is_rest_day: boolean;
  completed: boolean;
  actual_notes: string | null;
}

export interface SectionStatsRow {
  section: Section;
  sub_type: string;
  total_attempts: number;
  accuracy: number;
  avg_time_sec: number;
  cutoff_exceeded_count: number;
}

export interface TagWeaknessRow {
  tag: string;
  section: Section;
  total: number;
  accuracy: number;
  error_count: number;
}

export interface ErrorDistributionRow {
  failure_stage: FailureStage;
  error_type: string;
  section: Section;
  count: number;
  ratio: number;
}

export interface CreateQuickReportRequest {
  attempt_id: UUID;
  my_frame: string;
  correct_mechanism: string;
  next_tool: string;
  failure_stage: FailureStage;
  error_type: string;
  report_mode?: "quick";
}

export interface DeepenReportRequest {
  report_id: UUID;
  mechanism_english: string;
  logic_comparison: string;
  sub_report?: ErrorSubReport | null;
  generate_ai?: boolean;
}

export interface AnalyzeReportRequest {
  problem_content?: Record<string, unknown>;
  user_answer?: number | null;
  pre_think?: PreThinkPayload;
  my_frame: string;
  correct_mechanism: string;
  next_tool: string;
  mechanism_english?: string | null;
  logic_comparison?: string | null;
  sub_report?: ErrorSubReport | null;
}

export interface AnalyzeReportResponse {
  wrong_choices: string;
  core_principle: string;
  emotional_diary: string;
  visual_concept: string;
}

export interface DeepenReportResponse {
  report: ErrorReport;
  ai_analysis: AnalyzeReportResponse | null;
}

export type SelfTestRecall = "complete_recall" | "uncertain" | "no_recall";

export interface Sm2UpdateRequest {
  review_queue_id: UUID;
  recall: SelfTestRecall;
  reviewed_at?: ISODateTime;
}

export interface Sm2UpdateResponse {
  review_queue_id: UUID;
  next_review_at: ISODateTime;
  interval_days: number;
  ease_factor: number;
  repetitions: number;
  priority_score: number;
}
