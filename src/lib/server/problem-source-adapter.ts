import type { Difficulty, Section } from "@/lib/types";

export interface ExternalProblemFeedItem {
  external_id: string;
  stem: string;
  choices: string[];
  answer_index?: number;
  explanation?: string;
  section?: Section;
  sub_type?: string;
  difficulty?: Difficulty;
  tags?: string[];
  source_label: string;
}

export interface ProblemSourceAdapter {
  provider: string;
  fetchProblems: (params: {
    limit: number;
    section?: Section;
    difficulty?: Difficulty;
  }) => Promise<ExternalProblemFeedItem[]>;
}
