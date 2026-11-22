import path from 'node:path';
import { XMLParser } from 'fast-xml-parser';
import {
  CoverageReportSchema,
  type CoverageReport,
  type DirectoryCoverage,
  type UncoveredRange,
} from '../types/reports.js';

export interface FileCoverageData {
  filePath: string;
  lines: Map<number, number>; // lineNumber -> hitCount
  linesTotal: number;
  linesCovered: number;
}

export function parseCoverage(
  content: string,
  changedLinesPerFile: Map<string, Set<number>> = new Map(),
  workingDir: string = '.'
): CoverageReport {
  const trimmed = content.trim();
  if (!trimmed) {
    return {
      overall: { linesTotal: 0, linesCovered: 0, percentage: 100 },
      diffCoverage: { linesTotal: 0, linesCovered: 0, percentage: 100 },
      uncoveredDiffLines: [],
      directoryBreakdown: [],
    };
  }

  let fileMap: Map<string, FileCoverageData>;
  if (trimmed.startsWith('<?xml') || trimmed.startsWith('<coverage') || trimmed.startsWith('<report')) {
    fileMap = parseCoberturaOrJacoco(trimmed);
  } else {
    fileMap = parseLcov(trimmed);
  }

  // Calculate Overall
  let totalLines = 0;
  let coveredLines = 0;
  const dirMap = new Map<string, { linesTotal: number; linesCovered: number }>();

  for (const [filePath, data] of fileMap.entries()) {
    totalLines += data.linesTotal;
    coveredLines += data.linesCovered;

    const dir = getDirectory(filePath);
    const existing = dirMap.get(dir) || { linesTotal: 0, linesCovered: 0 };
    existing.linesTotal += data.linesTotal;
    existing.linesCovered += data.linesCovered;
    dirMap.set(dir, existing);
  }

  const overallPercentage = totalLines === 0 ? 100 : Math.round((coveredLines / totalLines) * 10000) / 100;

  const directoryBreakdown: DirectoryCoverage[] = Array.from(dirMap.entries())
    .map(([directory, stats]) => ({
      directory,
      linesTotal: stats.linesTotal,
      linesCovered: stats.linesCovered,
      percentage: stats.linesTotal === 0 ? 100 : Math.round((stats.linesCovered / stats.linesTotal) * 10000) / 100,
    }))
    .sort((a, b) => a.directory.localeCompare(b.directory));

  // Calculate Diff Coverage
  let diffLinesTotal = 0;
  let diffLinesCovered = 0;
  const uncoveredDiffLines: UncoveredRange[] = [];

  for (const [changedPath, linesSet] of changedLinesPerFile.entries()) {
    const matchedData = findFileCoverage(fileMap, changedPath, workingDir);
    if (!matchedData) {
      continue;
    }

    const uncoveredForFile: number[] = [];

    for (const lineNum of linesSet) {
      if (matchedData.lines.has(lineNum)) {
        diffLinesTotal += 1;
        const hits = matchedData.lines.get(lineNum) || 0;
        if (hits > 0) {
          diffLinesCovered += 1;
        } else {
          uncoveredForFile.push(lineNum);
        }
      }
    }

    if (uncoveredForFile.length > 0) {
      uncoveredForFile.sort((a, b) => a - b);
      uncoveredDiffLines.push({
        file: changedPath,
        ranges: formatLineRanges(uncoveredForFile),
      });
    }
  }

  const diffCoveragePercentage =
    diffLinesTotal === 0 ? 100 : Math.round((diffLinesCovered / diffLinesTotal) * 10000) / 100;

  const report: CoverageReport = {
    overall: {
      linesTotal: totalLines,
      linesCovered: coveredLines,
      percentage: overallPercentage,
    },
    diffCoverage: {
      linesTotal: diffLinesTotal,
      linesCovered: diffLinesCovered,
      percentage: diffCoveragePercentage,
    },
    uncoveredDiffLines,
    directoryBreakdown,
  };

  return CoverageReportSchema.parse(report);
}

export function parseLcov(content: string): Map<string, FileCoverageData> {
  const fileMap = new Map<string, FileCoverageData>();
  const lines = content.split('\n');

  let currentFile = '';
  let linesMap = new Map<number, number>();

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('SF:')) {
      currentFile = normalizeFilePath(line.substring(3).trim());
      linesMap = new Map<number, number>();
    } else if (line.startsWith('DA:')) {
      const parts = line.substring(3).split(',');
      if (parts[0] && parts[1]) {
        const lineNum = Number.parseInt(parts[0], 10);
        const hitCount = Number.parseInt(parts[1], 10);
        linesMap.set(lineNum, hitCount);
      }
    } else if (line === 'end_of_record') {
      if (currentFile) {
        let covered = 0;
        for (const hits of linesMap.values()) {
          if (hits > 0) covered += 1;
        }
        fileMap.set(currentFile, {
          filePath: currentFile,
          lines: linesMap,
          linesTotal: linesMap.size,
          linesCovered: covered,
        });
      }
      currentFile = '';
      linesMap = new Map();
    }
  }

  return fileMap;
}

export function parseCoberturaOrJacoco(xmlContent: string): Map<string, FileCoverageData> {
  const fileMap = new Map<string, FileCoverageData>();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['package', 'class', 'line', 'sourcefile'].includes(name),
  });

  const parsed = parser.parse(xmlContent) as Record<string, unknown>;

  // Check if Cobertura
  if (parsed['coverage']) {
    const root = parsed['coverage'] as Record<string, unknown>;
    const packagesContainer = (root['packages'] as Record<string, unknown> | undefined) || root;
    const packages = (packagesContainer['package'] as Array<Record<string, unknown>> | undefined) || [];

    for (const pkg of packages) {
      const classesContainer = (pkg['classes'] as Record<string, unknown> | undefined) || pkg;
      const classes = (classesContainer['class'] as Array<Record<string, unknown>> | undefined) || [];

      for (const cls of classes) {
        const filename = (cls['@_filename'] as string) || (cls['@_name'] as string) || '';
        if (!filename) continue;

        const normalizedFile = normalizeFilePath(filename);
        const linesMap = new Map<number, number>();

        const linesContainer = (cls['lines'] as Record<string, unknown> | undefined) || cls;
        const lineList = (linesContainer['line'] as Array<Record<string, unknown>> | undefined) || [];

        for (const lineObj of lineList) {
          const num = Number.parseInt(String(lineObj['@_number']), 10);
          const hits = Number.parseInt(String(lineObj['@_hits']), 10) || 0;
          if (!Number.isNaN(num)) {
            linesMap.set(num, hits);
          }
        }

        let covered = 0;
        for (const hits of linesMap.values()) {
          if (hits > 0) covered += 1;
        }

        fileMap.set(normalizedFile, {
          filePath: normalizedFile,
          lines: linesMap,
          linesTotal: linesMap.size,
          linesCovered: covered,
        });
      }
    }
  } else if (parsed['report']) {
    // JaCoCo XML
    const root = parsed['report'] as Record<string, unknown>;
    const packages = (root['package'] as Array<Record<string, unknown>> | undefined) || [];

    for (const pkg of packages) {
      const pkgName = (pkg['@_name'] as string) || '';
      const sourceFiles = (pkg['sourcefile'] as Array<Record<string, unknown>> | undefined) || [];

      for (const sf of sourceFiles) {
        const sfName = sf['@_name'] as string;
        if (!sfName) continue;
        const filePath = normalizeFilePath(pkgName ? `${pkgName}/${sfName}` : sfName);
        const linesMap = new Map<number, number>();

        const lineList = (sf['line'] as Array<Record<string, unknown>> | undefined) || [];
        for (const lineObj of lineList) {
          const nr = Number.parseInt(String(lineObj['@_nr']), 10);
          const ci = Number.parseInt(String(lineObj['@_ci']), 10) || 0; // covered instructions
          if (!Number.isNaN(nr)) {
            linesMap.set(nr, ci > 0 ? 1 : 0);
          }
        }

        let covered = 0;
        for (const hits of linesMap.values()) {
          if (hits > 0) covered += 1;
        }

        fileMap.set(filePath, {
          filePath,
          lines: linesMap,
          linesTotal: linesMap.size,
          linesCovered: covered,
        });
      }
    }
  }

  return fileMap;
}

export function formatLineRanges(lines: number[]): string[] {
  if (lines.length === 0) return [];
  const ranges: string[] = [];
  let start = lines[0]!;
  let end = lines[0]!;

  for (let i = 1; i < lines.length; i++) {
    const current = lines[i]!;
    if (current === end + 1) {
      end = current;
    } else {
      ranges.push(start === end ? `L${start}` : `L${start}-L${end}`);
      start = current;
      end = current;
    }
  }
  ranges.push(start === end ? `L${start}` : `L${start}-L${end}`);
  return ranges;
}

export function normalizeFilePath(filePath: string): string {
  let normalized = filePath.replace(/\\/g, '/');
  if (normalized.startsWith('./')) {
    normalized = normalized.substring(2);
  }
  return normalized;
}

export function getDirectory(filePath: string): string {
  const dir = path.dirname(normalizeFilePath(filePath));
  return dir === '.' ? 'root' : dir;
}

function findFileCoverage(
  fileMap: Map<string, FileCoverageData>,
  targetPath: string,
  _workingDir: string
): FileCoverageData | undefined {
  const normalizedTarget = normalizeFilePath(targetPath);
  if (fileMap.has(normalizedTarget)) {
    return fileMap.get(normalizedTarget);
  }

  // Suffix match
  for (const [key, data] of fileMap.entries()) {
    if (key.endsWith(normalizedTarget) || normalizedTarget.endsWith(key)) {
      return data;
    }
  }

  return undefined;
}
