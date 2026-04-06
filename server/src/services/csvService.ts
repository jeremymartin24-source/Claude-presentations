import Papa from 'papaparse';

export interface ParsedQuestion {
  type: string;
  question: string;
  options?: string;
  answer: string;
  hint?: string;
  points: number;
  time_limit: number;
  category?: string;
  difficulty: string;
}

export interface ParseResult {
  valid: ParsedQuestion[];
  errors: string[];
}

const VALID_TYPES = ['mc', 'tf', 'short', 'order', 'bingo_term'];
const VALID_DIFFICULTIES = ['easy', 'medium', 'hard'];

/**
 * Parse CSV content (string) into validated question objects.
 * Expected headers: type, question, options, answer, hint, points, time_limit, category, difficulty
 */
export function parseCsvQuestions(csvContent: string): ParseResult {
  const valid: ParsedQuestion[] = [];
  const errors: string[] = [];

  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/\s+/g, '_'),
  });

  if (result.errors.length > 0) {
    for (const e of result.errors) {
      errors.push(`CSV parse error at row ${e.row}: ${e.message}`);
    }
  }

  result.data.forEach((row, idx) => {
    const rowNum = idx + 2; // 1-indexed + header row
    const rowErrors: string[] = [];

    // Required fields
    const question = (row['question'] || '').trim();
    const answer   = (row['answer']   || '').trim();
    const type     = (row['type']     || '').trim().toLowerCase();

    if (!question) rowErrors.push(`Row ${rowNum}: "question" is required`);
    if (!answer)   rowErrors.push(`Row ${rowNum}: "answer" is required`);
    if (!type)     rowErrors.push(`Row ${rowNum}: "type" is required`);
    else if (!VALID_TYPES.includes(type)) {
      rowErrors.push(`Row ${rowNum}: invalid type "${type}" (must be one of: ${VALID_TYPES.join(', ')})`);
    }

    const difficulty = (row['difficulty'] || 'medium').trim().toLowerCase();
    if (!VALID_DIFFICULTIES.includes(difficulty)) {
      rowErrors.push(`Row ${rowNum}: invalid difficulty "${difficulty}"`);
    }

    const pointsRaw     = parseInt(row['points']     || '100', 10);
    const timeLimitRaw  = parseInt(row['time_limit'] || '30',  10);

    if (isNaN(pointsRaw))    rowErrors.push(`Row ${rowNum}: "points" must be a number`);
    if (isNaN(timeLimitRaw)) rowErrors.push(`Row ${rowNum}: "time_limit" must be a number`);

    if (rowErrors.length > 0) {
      errors.push(...rowErrors);
      return;
    }

    // Parse options — accept JSON array or pipe-delimited string
    let optionsParsed: string | undefined;
    const rawOptions = (row['options'] || '').trim();
    if (rawOptions) {
      try {
        JSON.parse(rawOptions); // validate it's valid JSON
        optionsParsed = rawOptions;
      } catch {
        // treat as pipe-delimited
        const parts = rawOptions.split('|').map((s) => s.trim()).filter(Boolean);
        optionsParsed = JSON.stringify(parts);
      }
    }

    valid.push({
      type,
      question,
      options:    optionsParsed,
      answer,
      hint:       (row['hint']     || '').trim() || undefined,
      category:   (row['category'] || '').trim() || undefined,
      difficulty,
      points:     isNaN(pointsRaw)    ? 100 : pointsRaw,
      time_limit: isNaN(timeLimitRaw) ? 30  : timeLimitRaw,
    });
  });

  return { valid, errors };
}

/** CSV template header line for the /import/template endpoint */
export const CSV_TEMPLATE_HEADERS =
  'type,question,options,answer,hint,points,time_limit,category,difficulty\n' +
  'mc,"What does OSI stand for?","[""Open Systems Interconnection"",""Open Source Interface"",""Operating System Interface"",""Open Software Integration""]","Open Systems Interconnection","Think about networking",100,30,Networking,medium\n' +
  'tf,"TCP is a connection-oriented protocol.","[""True"",""False""]","True",,100,20,Protocols,easy\n';
