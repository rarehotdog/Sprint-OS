# GMAT 805 - Product & Technical Spec v3.0 FINAL

## 1. 제품 개요

### 한 줄 정의
GMAT Focus Edition 805점을 위한 인출형 사고 훈련 + AI 오답 분석 PWA.

### 핵심 철학
- GMAT은 "공부"가 아니라 "관문 통과 공정"이다.
- 점수는 실수 제거 + 인출 자동화다.
- Accuracy -> Speed 순서로 훈련한다.
- 오답 리포트는 사고 프로세스 교정 도구다.
- Quick(세션 중 3문장) + Deep(복기 확장) 하이브리드 구조를 채택한다.
- 핵심 메커니즘은 영어로도 작성한다.

### 기술 스택
- Frontend: Next.js App Router + TypeScript + Tailwind CSS + PWA
- Backend: Supabase (PostgreSQL + Auth + Edge Functions)
- AI: Claude API (Sonnet 계열)
- State: Zustand + React Query
- Charts: Recharts
- Deploy: Vercel

## 2. GMAT Focus Edition 스펙
- 총 시험: 2시간 15분, 64문항
- 섹션: VR 23, QR 21, DI 20 (각 45분)
- 컷오프: VR 2:00, QR 2:10, DI 2:30
- 총점: 205-805(5 단위), 섹션 60-90
- 기본 순서: V -> Q -> DI

## 3. 데이터 모델 (핵심 요약)
- `problems`: 섹션/유형/난이도/콘텐츠/태그
- `sessions`: 세션 유형/계획 시간/실제 시간
- `attempts`: 답안/정오/소요시간/컷오프/확신도/pre_think
- `error_reports`: Quick/Deep 하이브리드 핵심 테이블
  - Quick required: `my_frame`, `correct_mechanism`, `next_tool`
  - Deep optional: `mechanism_english`, `logic_comparison`, `sub_report`
  - AI fields: `ai_wrong_choices`, `ai_core_principle`, `ai_emotional_diary`, `ai_visual_concept`
- `rules`: Rule 카드
- `review_queue`: SR(SM-2) 큐
- `daily_logs`: 일일 기록
- `calendar`: 3주 캘린더
- View: `section_stats`, `tag_weakness`, `error_distribution`
- 인덱스: attempts/reports/review_queue 중심으로 구성

## 4. 핵심 기능

### 4.1 문제 풀이
- 미니멀 UI: 지문 + 선지 + 타이머 중심
- Pre-Think 강제: 선지 보기 전 사고 입력
- Level 1: 타이머 숨김(정확도 우선)
- Level 2/3: 타이머 표시 및 실전 제약 강화

### 4.2 오답 리포트 v3.0
- Quick: 3문장 + 실패 단계/에러 유형 + 1분 내 완료
- Deep: Quick 확장 + 영어 메커니즘 + 논리 비교 + 유형별 서브 필드
- Deep 완료 시 AI 4필드 자동 생성
- Quick만 저장한 항목은 `pending_deep` 큐로 관리

### 4.3 셀프 테스트 모드
- 단계별 필드 가림 복습 (Quick-only/Deep-full 분기)
- 자가평가 3단계: 완전 기억 / 애매 / 못 떠올림
- 결과로 SM-2 업데이트

### 4.4 AI 시스템
- `/api/ai/analyze-report`: Deep 완료 시 리포트 단위 생성
- `/api/ai/weakness-analysis`: 주간 취약점 분석
- `/api/ai/daily-summary`: 일일 피드백
- 원칙: 사용자 입력 먼저, AI는 확장만 수행

## 5. 세션 운영
- 평일 3시간: V 60 + Q/DI 90 + Consolidation 30
- 일일 목표: Quick 5세트 + Deep 3세트
- "오늘 승리" 기준: V Sprint + Q/DI Sprint + Quick 5 + Deep 3

## 6. 페이지 구조
`src/app` 기준:
- `page.tsx` 홈(오늘의 허브)
- `solve/`, `review/`, `dashboard/`, `problems/`, `settings/`
- `solve/[sessionId]/review`에서 Quick/Deep 통합 운영

## 7. 컴포넌트 구조
`src/components` 기준:
- solve: `PreThinkZone`, `Timer`, `ChoiceSelector` 등
- report: `QuickReportForm`, `DeepReportForm`, `AIAnalysisDisplay`, `SelfTestMode`, `PendingDeepList`
- dashboard: `DailyWinStatus`, `AccuracyChart`, `ErrorDistChart` 등

## 8. API Routes
`src/app/api` 기준:
- `sessions`, `attempts`, `reports`, `rules`, `calendar`, `problems`
- `reports/deepen`: Quick -> Deep 전환
- `ai/analyze-report`, `ai/weakness-analysis`, `ai/daily-summary`, `ai/review-queue`

## 9. 개발 태스크 (실행 순서)
1. TASK 1: 프로젝트 초기화
2. TASK 2: `src/lib/types.ts` 타입 정의
3. TASK 3: `supabase/migrations/001_initial.sql`
4. TASK 4: Zustand 스토어
5. TASK 5: 문제 풀이 UI
6. TASK 6: Quick 리포트
7. TASK 7: Deep 리포트 + AI (핵심)
8. TASK 8: 셀프 테스트
9. TASK 9: 대시보드 + 캘린더
10. TASK 10: 모의고사 + 홈 + 임포트

## 10. Cursor Rules 핵심
- `SPEC.md`를 단일 진실원본(SSOT)으로 참조
- 풀이 UI는 미니멀 유지
- Pre-Think 강제
- Quick는 세션 흐름을 끊지 않아야 함
- Deep는 복기에서 확장 + AI 자동 생성
- 셀프 테스트는 단계별 가림 인출 훈련

## 11. 환경 변수
```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
```

## 부록 A. Quick/Deep 필드 계약

### Quick Required
- `my_frame`
- `correct_mechanism`
- `next_tool`
- `failure_stage`
- `error_type`

### Deep Optional
- `mechanism_english`
- `logic_comparison`
- `sub_report` (CR/RC/DS/QR%)

### AI Auto Fields
- `ai_wrong_choices`
- `ai_core_principle`
- `ai_emotional_diary`
- `ai_visual_concept`

## 부록 B. Pre-Think 계약
- CR: C / P / A / Gap
- RC: 문단 기능 태깅
- QR: 제약조건 / 접근법
- DI: question label / unit / axis / legend
- DS: 질문 Yes/No 재표현 / S1 / S2 sufficiency
