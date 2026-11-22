import { execSync } from 'node:child_process';
import type { DiffStats, GitCommit, ChangedFileDiff, PrSize } from '../types/reports.js';

export interface ParsedDiff {
  changedLinesPerFile: Map<string, Set<number>>;
  stats: DiffStats;
}

export function parseGitDiff(diffText: string, commits: GitCommit[] = []): ParsedDiff {
  const changedLinesPerFile = new Map<string, Set<number>>();
  const fileStatsMap = new Map<string, { additions: number; deletions: number }>();

  const lines = diffText.split('\n');
  let currentFile: string | null = null;
  let currentNewLine = 0;

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      // e.g. "diff --git a/src/index.ts b/src/index.ts"
      const match = line.match(/^diff --git a\/(.+?) b\/(.+?)$/);
      if (match?.[2]) {
        currentFile = match[2];
        if (!changedLinesPerFile.has(currentFile)) {
          changedLinesPerFile.set(currentFile, new Set());
        }
        if (!fileStatsMap.has(currentFile)) {
          fileStatsMap.set(currentFile, { additions: 0, deletions: 0 });
        }
      } else {
        currentFile = null;
      }
      currentNewLine = 0;
      continue;
    }

    if (!currentFile) {
      continue;
    }

    // Chunk header @@ -1,4 +1,6 @@
    if (line.startsWith('@@ ')) {
      const chunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (chunkMatch?.[1]) {
        currentNewLine = Number.parseInt(chunkMatch[1], 10);
      }
      continue;
    }

    if (line.startsWith('+++ ') || line.startsWith('--- ')) {
      continue;
    }

    if (line.startsWith('+')) {
      const set = changedLinesPerFile.get(currentFile);
      if (set) {
        set.add(currentNewLine);
      }
      const stats = fileStatsMap.get(currentFile);
      if (stats) {
        stats.additions += 1;
      }
      currentNewLine += 1;
    } else if (line.startsWith('-')) {
      const stats = fileStatsMap.get(currentFile);
      if (stats) {
        stats.deletions += 1;
      }
      // Deleted lines don't increment new line number
    } else {
      // Context line
      currentNewLine += 1;
    }
  }

  let totalAdditions = 0;
  let totalDeletions = 0;
  const changedFiles: ChangedFileDiff[] = [];

  for (const [filePath, stats] of fileStatsMap.entries()) {
    totalAdditions += stats.additions;
    totalDeletions += stats.deletions;
    changedFiles.push({
      path: filePath,
      additions: stats.additions,
      deletions: stats.deletions,
      category: categorizeFilePath(filePath),
    });
  }

  const totalLinesChanged = totalAdditions + totalDeletions;
  const size = calculatePrSize(totalLinesChanged);

  return {
    changedLinesPerFile,
    stats: {
      filesChanged: changedFiles.length,
      additions: totalAdditions,
      deletions: totalDeletions,
      size,
      changedFiles,
      commits,
    },
  };
}

export function categorizeFilePath(filePath: string): string {
  const lower = filePath.toLowerCase();
  if (
    lower.includes('test') ||
    lower.includes('spec') ||
    lower.includes('__tests__') ||
    lower.endsWith('.test.ts') ||
    lower.endsWith('.spec.ts') ||
    lower.endsWith('_test.go') ||
    lower.endsWith('test.py')
  ) {
    return 'Tests';
  }
  if (
    lower.endsWith('.md') ||
    lower.startsWith('docs/') ||
    lower.includes('/docs/') ||
    lower === 'license'
  ) {
    return 'Documentation';
  }
  if (
    lower.includes('docker') ||
    lower.startsWith('.github/') ||
    lower.includes('terraform') ||
    lower.includes('k8s') ||
    lower.includes('helm')
  ) {
    return 'Infrastructure / CI';
  }
  if (
    lower.endsWith('.json') ||
    lower.endsWith('.yaml') ||
    lower.endsWith('.yml') ||
    lower.endsWith('.toml') ||
    lower.endsWith('.xml')
  ) {
    return 'Configuration';
  }
  return 'Source Code';
}

export function calculatePrSize(totalLinesChanged: number): PrSize {
  if (totalLinesChanged < 30) return 'XS';
  if (totalLinesChanged < 100) return 'S';
  if (totalLinesChanged < 500) return 'M';
  if (totalLinesChanged < 1000) return 'L';
  return 'XL';
}

export function getGitDiffFromRepo(baseRef: string, headRef: string = 'HEAD', cwd: string = '.'): string {
  try {
    return execSync(`git diff ${baseRef}...${headRef}`, {
      cwd,
      encoding: 'utf-8',
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch {
    // Fallback to two-dot diff or HEAD^
    try {
      return execSync(`git diff ${baseRef} ${headRef}`, {
        cwd,
        encoding: 'utf-8',
        maxBuffer: 20 * 1024 * 1024,
      });
    } catch {
      return '';
    }
  }
}

export function getRecentGitCommits(baseRef: string, headRef: string = 'HEAD', cwd: string = '.'): GitCommit[] {
  try {
    const raw = execSync(`git log ${baseRef}..${headRef} --pretty=format:"%H|%an|%s" -n 10`, {
      cwd,
      encoding: 'utf-8',
    });
    if (!raw.trim()) return [];
    return raw
      .trim()
      .split('\n')
      .map((line) => {
        const parts = line.split('|');
        return {
          hash: parts[0]?.trim() || '',
          author: parts[1]?.trim() || 'Unknown',
          message: parts.slice(2).join('|').trim() || '',
        };
      })
      .filter((c) => c.hash.length > 0);
  } catch {
    return [];
  }
}
