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
export type ParserMode = "rule" | "ai_correction";
export type GenerationMode = "openai" | "mock";
export type ReviewStatus = "accepted" | "needs_review";

export interface ProblemParseResult {
  section: Section;
  sub_type: string;
  confidence: number;
  parser_mode: ParserMode;
  needs_review: boolean;
}

export interface ProblemGenerationMeta {
  provider: GenerationMode;
  model: string;
  prompt_version: string;
  seed: number | null;
  generated_at: ISODateTime;
  parser: ProblemParseResult;
}

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

export interface ErrorReportPreview {
  id: UUID;
  attempt_id: UUID;
  review_queue_id: UUID | null;
  report_mode: ReportMode;
  my_frame: string;
  correct_mechanism: string;
  next_tool: string;
  error_type: string | null;
  created_at: ISODateTime;
  deepened_at: ISODateTime | null;
}

export interface ReviewInboxCounts {
  total_reports: number;
  pending_deep: number;
  due_self_test: number;
  recent_deep: number;
  answer_flows: number;
}

export interface ReviewInboxDueSelfTestItem {
  review_queue_id: UUID;
  next_review_at: ISODateTime;
  priority_score: number;
  report: ErrorReportPreview;
}

export interface ReviewInboxAnswerFlow {
  id: UUID;
  ask: string;
  key_factor: string;
  mechanism: string;
  check: string;
  source_report_id: UUID | null;
  created_at: ISODateTime;
}

export interface ReviewInboxAction {
  type: "deepen" | "self_test" | "summary";
  label: string;
  href: string;
  count: number;
}

export interface ReviewInboxSnapshot {
  counts: ReviewInboxCounts;
  pending_deep: ErrorReportPreview[];
  due_self_test: ReviewInboxDueSelfTestItem[];
  recent_deep: ErrorReportPreview[];
  answer_flows: ReviewInboxAnswerFlow[];
  next_actions: ReviewInboxAction[];
}

export interface ReviewReportQueueState {
  review_queue_id: UUID;
  next_review_at: ISODateTime;
  interval_days: number;
  repetitions: number;
  priority_score: number;
}

export interface ReviewReportsFilters {
  mode: ReportMode | null;
  report_id: UUID | null;
  limit: number;
}

export interface ReviewReportSummaryCard {
  id: UUID;
  card_type: SummaryCardType;
  content: string;
  inclusion_score: number;
  source_report_id: UUID | null;
  source_rule_id: UUID | null;
}

export interface ReviewSelectedReportDetail {
  report: ErrorReport | null;
  answer_flow: AnswerFlow | null;
  summary_cards: ReviewReportSummaryCard[];
  review_queue: ReviewReportQueueState | null;
}

export interface ReviewReportsSnapshot {
  inbox: ReviewInboxSnapshot;
  reports: ErrorReportPreview[];
  selected_report: ReviewSelectedReportDetail;
  filters_applied: ReviewReportsFilters;
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

export interface DailyCheckin {
  id: UUID;
  date: string;
  energy: number;
  focus: number;
  stress: number;
  sleep_quality: number;
  confidence: number;
  available_minutes: number;
  created_at: ISODateTime;
  updated_at: ISODateTime;
}

export type DailyPlanBlockType =
  | "warmup_review"
  | "main_block"
  | "consolidation"
  | "booklet_refresh";

export type DailyPlanBlockStatus = "pending" | "in_progress" | "completed";

export interface DailyPlanBlock {
  id: UUID;
  block_type: DailyPlanBlockType;
  title: string;
  minutes: number;
  status: DailyPlanBlockStatus;
  target_ids: UUID[];
  section_hint: Section | null;
  linked_session_id: UUID | null;
  notes: string | null;
}

export interface DailyPlan {
  id: UUID;
  date: string;
  generated_at: ISODateTime;
  source_counts: {
    yesterday_weakness: number;
    due_review: number;
    weak_clusters: number;
  };
  blocks: DailyPlanBlock[];
}

export interface TodayProgress {
  total_blocks: number;
  completed_blocks: number;
  current_block_id: UUID | null;
  completion_rate: number;
}

export interface TodayNextAction {
  type: "review" | "solve" | "consolidation" | "booklet";
  label: string;
  href: string;
}

export interface TodayBookletCandidate {
  kind: "concept" | "mechanism" | "trap" | "tip" | "flow";
  text: string;
  source_report_id: UUID | null;
  source_rule_id: UUID | null;
}

export interface TodaySnapshot {
  checkin: DailyCheckin | null;
  yesterday_weakness: SummarySubType[];
  due_review: Array<{
    review_queue_id: UUID;
    problem_id: UUID;
    next_review_at: ISODateTime;
    priority_score: number;
  }>;
  plan: DailyPlan | null;
  progress: TodayProgress;
  booklet_candidates: TodayBookletCandidate[];
  next_action: TodayNextAction | null;
}

export interface TodayStartRequest {
  date: string;
  checkin: {
    energy: number;
    focus: number;
    stress: number;
    sleep_quality: number;
    confidence: number;
    available_minutes: number;
  };
  force_regenerate?: boolean;
}

export interface TodayStartResponse {
  checkin: DailyCheckin;
  plan: DailyPlan;
  progress: TodayProgress;
  next_action: TodayNextAction;
  redirect_to: string;
}

export interface AnswerFlow {
  id: UUID;
  attempt_id: UUID | null;
  report_id: UUID | null;
  ask: string;
  key_factor: string;
  mechanism: string;
  check: string;
  created_at: ISODateTime;
}

export type SummaryCardType = "concept" | "mechanism" | "trap" | "tip" | "flow";

export interface SummaryCard {
  id: UUID;
  card_type: SummaryCardType;
  section: Section | null;
  sub_type: string | null;
  content: string;
  source_attempt_id: UUID | null;
  source_report_id: UUID | null;
  source_rule_id: UUID | null;
  source_capture_id: UUID | null;
  inclusion_score: number;
  exam_eve_priority: number;
  exam_day_priority: number;
  created_at: ISODateTime;
}

export type CaptureSourceType = "screenshot" | "text_note" | "report_review";
export type CaptureStatus = "inbox" | "needs_review" | "approved" | "rejected";

export interface CaptureItem {
  id: UUID;
  source_type: CaptureSourceType;
  raw_payload: Record<string, unknown>;
  parsed_text: string | null;
  predicted_section: Section | null;
  predicted_sub_type: string | null;
  status: CaptureStatus;
  created_at: ISODateTime;
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

export interface CreateSessionRequest {
  session_type: SessionType;
  recipe?: string | null;
  duration_planned_min: number;
  problem_ids?: UUID[];
  meta?: Record<string, unknown>;
}

export interface SessionRunState {
  session_id: UUID;
  ordered_problem_ids: UUID[];
  attempted_problem_ids: UUID[];
  attempted_count: number;
  total_count: number;
  current_index: number;
  next_problem_id: UUID | null;
  completed: boolean;
}

export interface SessionSectionBound {
  section: Section;
  start_index: number;
  end_index: number;
}

export interface SessionSolveContext {
  section_hint: Section | null;
  duration_planned_min: number;
  section_order: Section[];
  section_bounds: SessionSectionBound[];
}

export interface SessionDetailResponse {
  session: Session;
  run_state: SessionRunState;
  solve_context: SessionSolveContext;
}

export interface CompleteSessionRequest {
  session_id: UUID;
  completed_at?: ISODateTime;
  duration_actual_min?: number;
}

export interface GenerateAiProblemRequest {
  topic: string;
  section_hint?: "verbal" | "quant" | "di" | "auto";
  difficulty?: Difficulty;
  count?: number;
  seed?: number;
}

export interface GeneratedProblemItem {
  problem: Problem;
  parser: ProblemParseResult;
  review_status: ReviewStatus;
  generation_mode: GenerationMode;
  generation_meta: ProblemGenerationMeta;
}

export interface GenerateAiProblemResponse {
  items: GeneratedProblemItem[];
  total: number;
}

export interface ImportProblemRequest {
  stem: string;
  choices: string[];
  section: Section;
  sub_type: string;
  difficulty?: Difficulty;
  answer_index?: number;
  explanation?: string;
  tags?: string[];
  image_ref?: string;
}

export interface ImportProblemResponse {
  problem: Problem;
  parser: ProblemParseResult;
  review_status: ReviewStatus;
}

export type ProblemReviewAction = "accept" | "hold" | "revise";

export interface UpdateProblemReviewStatusRequest {
  problem_id: UUID;
  action: ProblemReviewAction;
  section?: Section;
  sub_type?: string;
  tags?: string[];
  note?: string;
}

export interface ProblemReviewStatusResponse {
  problem: Problem;
  parser: ProblemParseResult | null;
  review_status: ReviewStatus;
}

export interface ProblemReviewStatusQuery {
  problem_id?: UUID;
  review_status?: ReviewStatus;
  section?: Section;
  source?: string;
  tag?: string;
  limit?: number;
}

export interface ProblemReviewStatusListResponse {
  items: ProblemReviewStatusResponse[];
  total: number;
  filters_applied: {
    review_status: ReviewStatus | null;
    section: Section | null;
    source: string | null;
    tag: string | null;
    limit: number;
  };
}

export interface WeaknessSummary {
  window_days: number;
  total_attempts: number;
  total_reports: number;
  accuracy: number;
  cutoff_exceeded_rate: number;
}

export interface SectionAccuracyPoint {
  section: Section;
  total: number;
  correct: number;
  accuracy: number;
  cutoff_exceeded_rate: number;
}

export interface SubtypeWeaknessPoint {
  section: Section;
  sub_type: string;
  total: number;
  incorrect: number;
  accuracy: number;
  cutoff_exceeded_rate: number;
}

export interface ErrorDistributionPoint {
  section: Section;
  failure_stage: string;
  error_type: string;
  count: number;
  ratio: number;
}

export interface WeaknessTrendPoint {
  date: string;
  total_attempts: number;
  correct_attempts: number;
  accuracy: number;
  error_reports: number;
}

export interface WeaknessFiltersApplied {
  days: number;
  section: Section | null;
  source: string | null;
}

export interface WeaknessDashboardResponse {
  summary: WeaknessSummary;
  section_accuracy: SectionAccuracyPoint[];
  subtype_weakness: SubtypeWeaknessPoint[];
  error_distribution: ErrorDistributionPoint[];
  trend: WeaknessTrendPoint[];
  source_distribution: Array<{ source: string; count: number }>;
  totals: { problems: number; reports: number };
  filters_applied: WeaknessFiltersApplied;
}

export type SummaryVersion = "today" | "eve" | "day";

export interface SourceCounts {
  total_reports: number;
  quick_reports: number;
  deep_reports: number;
  rules: number;
  due_reviews: number;
  weak_subtypes: number;
  error_patterns: number;
}

export interface SummarySubType {
  section: Section;
  sub_type: string;
  total: number;
  incorrect: number;
  accuracy: number;
}

export interface SummaryErrorPattern {
  section: Section;
  failure_stage: string;
  error_type: string;
  count: number;
  ratio: number;
}

export interface SummarySections {
  concepts: string[];
  process_flows: string[];
  tips: string[];
  checklist: string[];
}

export interface SummaryDiagnostics {
  source_counts: SourceCounts;
  weak_subtypes: SummarySubType[];
  error_patterns: SummaryErrorPattern[];
}

export interface SummaryBooklet {
  version: SummaryVersion;
  built_at: ISODateTime;
  summary: string;
  sections: SummarySections;
  diagnostics: SummaryDiagnostics;
}

export interface BuildSummaryBookletRequest {
  trigger: "consolidation" | "manual";
  version?: "today" | "eve" | "day" | "both" | "all";
  date?: string;
}

export interface BuildSummaryBookletResponse {
  builds: Array<{
    version: SummaryVersion;
    built_at: ISODateTime;
    source_counts: SourceCounts;
    sections_count: number;
  }>;
}

export type GetSummaryBookletResponse = SummaryBooklet;

export interface ExportSummaryBookletResponse {
  filename: string;
  content: string;
}
