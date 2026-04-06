import Papa from 'papaparse';

export interface ParsedQuestion {
  type: string;
  question: string;
  options?: string[];
  answer: string;
  hint?: string;
  points?: number;
  time_limit?: number;
  category?: string;
  difficulty?: string;
}

export function parseQuestionsCSV(content: string): { valid: ParsedQuestion[]; errors: string[] } {
  const result = Papa.parse<Record<string, string>>(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader: h => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  const valid: ParsedQuestion[] = [];
  const errors: string[] = [];

  result.data.forEach((row, i) => {
    if (!row.question?.trim()) { errors.push(`Row ${i + 2}: missing question`); return; }
    if (!row.answer?.trim()) { errors.push(`Row ${i + 2}: missing answer`); return; }

    const options: string[] = [];
    for (const key of ['option_a', 'option_b', 'option_c', 'option_d']) {
      if (row[key]?.trim()) options.push(row[key].trim());
    }

    valid.push({
      type: row.type?.trim() || 'mc',
      question: row.question.trim(),
      options: options.length > 0 ? options : undefined,
      answer: row.answer.trim(),
      hint: row.hint?.trim() || undefined,
      points: row.points ? Number(row.points) : 100,
      time_limit: row.time_limit ? Number(row.time_limit) : 30,
      category: row.category?.trim() || undefined,
      difficulty: row.difficulty?.trim() || 'medium',
    });
  });

  if (result.errors.length > 0) {
    errors.push(...result.errors.slice(0, 5).map(e => `Parse error: ${e.message}`));
  }

  return { valid, errors };
}
