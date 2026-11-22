import {
  SarifReportSchema,
  type SarifReport,
  type Finding,
  type FindingSeverity,
  type FindingSuggestion,
} from '../types/reports.js';
import { normalizeFilePath } from './coverage.js';

interface SarifRule {
  id: string;
  name?: string;
  shortDescription?: { text?: string };
  fullDescription?: { text?: string };
  helpUri?: string;
  properties?: {
    category?: string;
    'security-severity'?: string | number;
    tags?: string[];
  };
}

interface SarifReplacement {
  deletedRegion?: {
    startLine?: number;
    endLine?: number;
  };
  insertedContent?: {
    text?: string;
  };
}

interface SarifFix {
  description?: { text?: string };
  artifactChanges?: Array<{
    artifactLocation?: { uri?: string };
    replacements?: SarifReplacement[];
  }>;
}

interface SarifResult {
  ruleId?: string;
  ruleIndex?: number;
  level?: string;
  message?: { text?: string };
  locations?: Array<{
    physicalLocation?: {
      artifactLocation?: { uri?: string };
      region?: {
        startLine?: number;
        endLine?: number;
        startColumn?: number;
        endColumn?: number;
      };
    };
  }>;
  fixes?: SarifFix[];
}

interface SarifRun {
  tool?: {
    driver?: {
      name?: string;
      rules?: SarifRule[];
    };
  };
  results?: SarifResult[];
}

interface SarifLog {
  version?: string;
  runs?: SarifRun[];
}

interface RdjsonDiagnostic {
  message?: string;
  location?: {
    path?: string;
    range?: {
      start?: { line?: number; column?: number };
      end?: { line?: number; column?: number };
    };
  };
  severity?: string;
  code?: { value?: string; url?: string };
}

interface RdjsonLog {
  source?: { name?: string; url?: string };
  diagnostics?: RdjsonDiagnostic[];
}

export function parseSarifOrRdjson(jsonContent: string): SarifReport {
  const trimmed = jsonContent.trim();
  if (!trimmed) {
    return {
      counts: { critical: 0, error: 0, warning: 0, info: 0, total: 0 },
      findings: [],
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(trimmed);
  } catch (err) {
    throw new Error(`Failed to parse SARIF/RDJSON JSON payload: ${String(err)}`);
  }

  if (typeof data !== 'object' || data === null) {
    return {
      counts: { critical: 0, error: 0, warning: 0, info: 0, total: 0 },
      findings: [],
    };
  }

  const obj = data as Record<string, unknown>;

  // Check if Reviewdog RDJSON
  if (Array.isArray(obj['diagnostics'])) {
    return parseRdjson(obj as unknown as RdjsonLog);
  }

  // SARIF v2.1
  return parseSarif(obj as unknown as SarifLog);
}

function parseSarif(log: SarifLog): SarifReport {
  const findings: Finding[] = [];
  const runs = log.runs || [];

  for (const run of runs) {
    const toolName = run.tool?.driver?.name || 'Static Analysis';
    const rulesList = run.tool?.driver?.rules || [];
    const rulesMap = new Map<string, SarifRule>();

    rulesList.forEach((rule, idx) => {
      if (rule.id) {
        rulesMap.set(rule.id, rule);
      }
      rulesMap.set(String(idx), rule);
    });

    const results = run.results || [];
    for (const res of results) {
      const ruleKey = res.ruleId || (res.ruleIndex !== undefined ? String(res.ruleIndex) : '');
      const ruleObj = rulesMap.get(ruleKey);

      const ruleId = res.ruleId || ruleObj?.id || 'UnknownRule';
      const ruleName = ruleObj?.name || ruleObj?.shortDescription?.text;
      const helpUri = ruleObj?.helpUri || '';
      const rawLevel = res.level || 'warning';

      const secSeverity = ruleObj?.properties?.['security-severity'];
      const tags = ruleObj?.properties?.tags || [];
      const isSecurity =
        tags.some((t) => t.toLowerCase().includes('security') || t.toLowerCase().startsWith('cwe-')) ||
        (secSeverity !== undefined && Number.parseFloat(String(secSeverity)) >= 7.0);

      let severity: FindingSeverity = 'warning';
      if (isSecurity && (rawLevel === 'error' || (secSeverity !== undefined && Number.parseFloat(String(secSeverity)) >= 7.0))) {
        severity = 'critical';
      } else if (rawLevel === 'error') {
        severity = 'error';
      } else if (rawLevel === 'warning') {
        severity = 'warning';
      } else {
        severity = 'info';
      }

      let category = ruleObj?.properties?.category || (isSecurity ? 'Security' : 'Reliability');
      if (severity === 'info') category = 'Style';

      const loc = res.locations?.[0]?.physicalLocation;
      const uri = loc?.artifactLocation?.uri;
      if (!uri) continue; // Skip findings without file location

      const file = normalizeFilePath(uri);
      const startLine = loc.region?.startLine || 1;
      const endLine = loc.region?.endLine || startLine;
      const startColumn = loc.region?.startColumn;
      const endColumn = loc.region?.endColumn;

      const message = res.message?.text || 'Issue detected by static analysis';

      // Check for suggestion / replacement
      let suggestion: FindingSuggestion | undefined;
      const fix = res.fixes?.[0];
      const replacement = fix?.artifactChanges?.[0]?.replacements?.[0];
      if (replacement?.insertedContent?.text !== undefined) {
        suggestion = {
          text: replacement.insertedContent.text,
          startLine: replacement.deletedRegion?.startLine || startLine,
          endLine: replacement.deletedRegion?.endLine || endLine,
        };
      }

      const finding: Finding = {
        id: `${file}:${startLine}:${ruleId}`,
        ruleId,
        category,
        severity,
        message,
        file,
        startLine,
        tool: toolName,
      };

      if (ruleName) finding.ruleName = ruleName;
      if (helpUri) finding.helpUri = helpUri;
      if (endLine && endLine !== startLine) finding.endLine = endLine;
      if (startColumn) finding.startColumn = startColumn;
      if (endColumn) finding.endColumn = endColumn;
      if (suggestion) finding.suggestion = suggestion;

      findings.push(finding);
    }
  }

  const counts = countSeverities(findings);
  return SarifReportSchema.parse({ counts, findings });
}

function parseRdjson(rd: RdjsonLog): SarifReport {
  const toolName = rd.source?.name || 'Reviewdog';
  const findings: Finding[] = [];
  const diagnostics = rd.diagnostics || [];

  for (const diag of diagnostics) {
    const rawPath = diag.location?.path;
    if (!rawPath) continue;

    const file = normalizeFilePath(rawPath);
    const startLine = diag.location?.range?.start?.line || 1;
    const endLine = diag.location?.range?.end?.line;
    const startColumn = diag.location?.range?.start?.column;
    const endColumn = diag.location?.range?.end?.column;

    const rawSev = (diag.severity || 'WARNING').toUpperCase();
    let severity: FindingSeverity = 'warning';
    if (rawSev === 'ERROR') severity = 'error';
    else if (rawSev === 'INFO') severity = 'info';

    const ruleId = diag.code?.value || 'LintDiagnostic';
    const helpUri = diag.code?.url || '';

    const finding: Finding = {
      id: `${file}:${startLine}:${ruleId}`,
      ruleId,
      category: 'Reliability',
      severity,
      message: diag.message || 'Diagnostic reported',
      file,
      startLine,
      tool: toolName,
    };

    if (helpUri) finding.helpUri = helpUri;
    if (endLine && endLine !== startLine) finding.endLine = endLine;
    if (startColumn) finding.startColumn = startColumn;
    if (endColumn) finding.endColumn = endColumn;

    findings.push(finding);
  }

  const counts = countSeverities(findings);
  return SarifReportSchema.parse({ counts, findings });
}

function countSeverities(findings: Finding[]) {
  const counts = { critical: 0, error: 0, warning: 0, info: 0, total: findings.length };
  for (const f of findings) {
    counts[f.severity] += 1;
  }
  return counts;
}
