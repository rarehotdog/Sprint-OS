import type { Difficulty, Section } from "@/lib/types";

type ParsedProblemDraft = {
  row_number: number;
  section: Section;
  sub_type: string;
  stem: string;
  choices: string[];
  answer_index?: number;
  explanation?: string;
  tags: string[];
  difficulty?: Difficulty;
};

export interface ProblemBatchParseError {
  row_number: number;
  message: string;
}

function parseSection(value: string, rowNumber: number): Section {
  const normalized = value.trim().toLowerCase();
  if (normalized === "verbal" || normalized === "quant" || normalized === "di") {
    return normalized;
  }

  throw new Error(`Row ${rowNumber}: section must be verbal, quant, or di`);
}

function parseDifficulty(value: string | undefined): Difficulty | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === "easy" || normalized === "medium" || normalized === "hard") {
    return normalized;
  }

  return undefined;
}

function parseTags(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAnswerIndex(value: string | undefined, choiceCount: number): number | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim().toUpperCase();
  if (!normalized) {
    return undefined;
  }

  if (/^[A-E]$/.test(normalized)) {
    const index = normalized.charCodeAt(0) - 65;
    return index < choiceCount ? index : undefined;
  }

  const numeric = Number.parseInt(normalized, 10);
  if (Number.isInteger(numeric) && numeric >= 0 && numeric < choiceCount) {
    return numeric;
  }
  if (Number.isInteger(numeric) && numeric > 0 && numeric <= choiceCount) {
    return numeric - 1;
  }

  return undefined;
}

function parseDelimitedChoices(value: string | undefined): string[] {
  if (!value) {
    return [];
  }

  const delimiter = value.includes("||") ? "||" : "|";
  return value
    .split(delimiter)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (char === "\"") {
      const next = line[index + 1];
      if (inQuotes && next === "\"") {
        current += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      cells.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  cells.push(current.trim());
  return cells;
}

export function parseCsvProblemBatch(rawPayload: string): {
  drafts: ParsedProblemDraft[];
  errors: ProblemBatchParseError[];
} {
  const lines = rawPayload
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length < 2) {
    return {
      drafts: [],
      errors: [{ row_number: 1, message: "CSV requires a header row and at least one data row." }],
    };
  }

  const headers = parseCsvLine(lines[0]).map((header) => header.toLowerCase());
  const drafts: ParsedProblemDraft[] = [];
  const errors: ProblemBatchParseError[] = [];

  for (let index = 1; index < lines.length; index += 1) {
    const rowNumber = index + 1;

    try {
      const values = parseCsvLine(lines[index]);
      const record = Object.fromEntries(headers.map((header, cellIndex) => [header, values[cellIndex] ?? ""]));

      const delimitedChoices = parseDelimitedChoices(record.choices);
      const choices =
        delimitedChoices.length > 0
          ? delimitedChoices
          : [record.choice_a, record.choice_b, record.choice_c, record.choice_d, record.choice_e]
              .map((item) => item?.trim())
              .filter(Boolean) as string[];

      if (!record.section || !record.sub_type || !record.stem || choices.length < 2) {
        throw new Error(`Row ${rowNumber}: section, sub_type, stem, and at least 2 choices are required`);
      }

      drafts.push({
        row_number: rowNumber,
        section: parseSection(record.section, rowNumber),
        sub_type: record.sub_type.trim(),
        stem: record.stem.trim(),
        choices,
        answer_index: parseAnswerIndex(record.answer, choices.length),
        explanation: record.explanation?.trim() || undefined,
        tags: parseTags(record.tags),
        difficulty: parseDifficulty(record.difficulty),
      });
    } catch (error) {
      errors.push({
        row_number: rowNumber,
        message: error instanceof Error ? error.message : "Invalid CSV row",
      });
    }
  }

  return { drafts, errors };
}

export function parseTextProblemBatch(rawPayload: string): {
  drafts: ParsedProblemDraft[];
  errors: ProblemBatchParseError[];
} {
  const blocks = rawPayload
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  const drafts: ParsedProblemDraft[] = [];
  const errors: ProblemBatchParseError[] = [];

  blocks.forEach((block, index) => {
    const rowNumber = index + 1;

    try {
      const lines = block
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

      const fields = new Map<string, string>();
      const choices: string[] = [];

      for (const line of lines) {
        if (/^[A-E]:/i.test(line)) {
          choices.push(line.slice(2).trim());
          continue;
        }

        const delimiterIndex = line.indexOf(":");
        if (delimiterIndex === -1) {
          continue;
        }

        const key = line.slice(0, delimiterIndex).trim().toLowerCase();
        const value = line.slice(delimiterIndex + 1).trim();
        fields.set(key, value);
      }

      const section = fields.get("section");
      const subType = fields.get("subtype") ?? fields.get("sub_type");
      const stem = fields.get("stem");

      if (!section || !subType || !stem || choices.length < 2) {
        throw new Error(
          `Block ${rowNumber}: Section, Subtype, Stem, and choices A-E are required`,
        );
      }

      drafts.push({
        row_number: rowNumber,
        section: parseSection(section, rowNumber),
        sub_type: subType,
        stem,
        choices,
        answer_index: parseAnswerIndex(fields.get("answer"), choices.length),
        explanation: fields.get("explanation") || undefined,
        tags: parseTags(fields.get("tags")),
        difficulty: parseDifficulty(fields.get("difficulty")),
      });
    } catch (error) {
      errors.push({
        row_number: rowNumber,
        message: error instanceof Error ? error.message : "Invalid text block",
      });
    }
  });

  return { drafts, errors };
}
