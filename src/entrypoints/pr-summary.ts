import * as fs from 'node:fs';
import * as path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { PrSummaryInputsSchema } from '../types/config.js';
import {
  type TestResult,
  type CoverageReport,
  type SarifReport,
  type GateResultsReport,
  type Finding,
  GateResultsReportSchema,
} from '../types/reports.js';
import { getGitDiffFromRepo, getRecentGitCommits, parseGitDiff } from '../parsers/git-diff.js';
import { parseJUnitXml } from '../parsers/junit.js';
import { parseCoverage } from '../parsers/coverage.js';
import { parseSarifOrRdjson } from '../parsers/sarif.js';
import { loadImpactConfig, analyzeImpact } from '../impact-engine.js';
import { renderPrSummary } from '../formatters/pr-summary-renderer.js';
import { upsertStickyPrComment } from '../github/comment-sync.js';

export async function run(): Promise<void> {
  try {
    const rawInputs = {
      reportId: core.getInput('report-id') || process.env['INPUT_REPORT_ID'] || 'default',
      coverageThreshold: core.getInput('coverage-threshold') || process.env['INPUT_COVERAGE_THRESHOLD'] || '80',
      diffCoverageThreshold: core.getInput('diff-coverage-threshold') || process.env['INPUT_DIFF_COVERAGE_THRESHOLD'] || '80',
      junitPath: core.getInput('junit-path') || process.env['INPUT_JUNIT_PATH'] || '',
      coveragePath: core.getInput('coverage-path') || process.env['INPUT_COVERAGE_PATH'] || '',
      sarifPath: core.getInput('sarif-path') || process.env['INPUT_SARIF_PATH'] || '',
      impactRulesPath: core.getInput('impact-rules-path') || process.env['INPUT_IMPACT_RULES_PATH'] || '',
      gateResultsPath: core.getInput('gate-results-path') || process.env['INPUT_GATE_RESULTS_PATH'] || '',
      githubToken: core.getInput('github-token') || process.env['INPUT_GITHUB_TOKEN'] || process.env['GITHUB_TOKEN'] || '',
      baseRef: core.getInput('base-ref') || process.env['INPUT_BASE_REF'] || process.env['GITHUB_BASE_REF'] || 'origin/main',
      headRef: core.getInput('head-ref') || process.env['INPUT_HEAD_REF'] || process.env['GITHUB_HEAD_REF'] || 'HEAD',
      workingDirectory: core.getInput('working-directory') || process.env['INPUT_WORKING_DIRECTORY'] || '.',
    };

    const inputs = PrSummaryInputsSchema.parse(rawInputs);
    const cwd = inputs.workingDirectory;

    // 1. Git Diff & Commits
    const diffText = getGitDiffFromRepo(inputs.baseRef, inputs.headRef, cwd);
    const commits = getRecentGitCommits(inputs.baseRef, inputs.headRef, cwd);
    const { changedLinesPerFile, stats: diffStats } = parseGitDiff(diffText, commits);

    // 2. Impact Engine
    const impactConfig = loadImpactConfig(inputs.impactRulesPath, cwd);
    const changedPaths = diffStats.changedFiles.map((f) => f.path);
    const { matchedImpacts, allChecklistItems } = analyzeImpact(changedPaths, impactConfig);

    // 3. Parse JUnit Test Results
    let testResult: TestResult | undefined;
    if (inputs.junitPath) {
      const fullJunitPath = path.resolve(cwd, inputs.junitPath);
      if (fs.existsSync(fullJunitPath)) {
        const junitXml = fs.readFileSync(fullJunitPath, 'utf-8');
        testResult = parseJUnitXml(junitXml);
        core.info(`JUnit Parsed: ${testResult.total} tests (${testResult.passed} passed, ${testResult.failed} failed, ${testResult.skipped} skipped).`);
      } else {
        core.info(`JUnit file at '${inputs.junitPath}' not found; skipping.`);
      }
    }

    // 4. Parse Coverage (LCOV or Cobertura)
    let coverageReport: CoverageReport | undefined;
    if (inputs.coveragePath) {
      const fullCoveragePath = path.resolve(cwd, inputs.coveragePath);
      if (fs.existsSync(fullCoveragePath)) {
        const coverageContent = fs.readFileSync(fullCoveragePath, 'utf-8');
        coverageReport = parseCoverage(coverageContent, changedLinesPerFile, cwd);
        core.info(
          `Coverage Parsed: Overall ${coverageReport.overall.percentage}% (${coverageReport.overall.linesCovered}/${coverageReport.overall.linesTotal}), Diff ${coverageReport.diffCoverage.percentage}% (${coverageReport.diffCoverage.linesCovered}/${coverageReport.diffCoverage.linesTotal}).`
        );
      } else {
        core.info(`Coverage file at '${inputs.coveragePath}' not found; skipping.`);
      }
    }

    // 5. Parse SARIF & Lint Report
    let sarifReport: SarifReport | undefined;
    let overflowFindings: Finding[] = [];

    if (inputs.sarifPath) {
      const fullSarifPath = path.resolve(cwd, inputs.sarifPath);
      if (fs.existsSync(fullSarifPath)) {
        const sarifContent = fs.readFileSync(fullSarifPath, 'utf-8');
        sarifReport = parseSarifOrRdjson(sarifContent);
      }
    }

    const lintReportCandidate = path.resolve(cwd, '.pr-verification/lint-report.json');
    if (fs.existsSync(lintReportCandidate)) {
      try {
        const rawLint = JSON.parse(fs.readFileSync(lintReportCandidate, 'utf-8'));
        if (Array.isArray(rawLint.overflowFindings)) {
          overflowFindings = rawLint.overflowFindings;
        }
      } catch {
        // ignore
      }
    }

    // 6. Parse Gate Results
    let gateResults: GateResultsReport | undefined;
    const gatePath = inputs.gateResultsPath
      ? path.resolve(cwd, inputs.gateResultsPath)
      : path.resolve(cwd, '.pr-verification/gate-results.json');

    if (fs.existsSync(gatePath)) {
      try {
        const rawGates = JSON.parse(fs.readFileSync(gatePath, 'utf-8'));
        gateResults = GateResultsReportSchema.parse(rawGates);
      } catch (err) {
        core.warning(`Warning: Could not parse gate results from ${gatePath}: ${String(err)}`);
      }
    }

    // 7. Render Report
    const context = github.context;
    let repoOwner = '';
    let repoName = '';
    const repoEnv = process.env['GITHUB_REPOSITORY'];
    if (repoEnv && repoEnv.includes('/')) {
      const parts = repoEnv.split('/');
      repoOwner = parts[0] || '';
      repoName = parts[1] || '';
    }

    const commitSha = context.payload.pull_request?.head?.sha || process.env['GITHUB_SHA'] || inputs.headRef;
    const runId = String(context.runId || process.env['GITHUB_RUN_ID'] || '');

    const markdownSummary = renderPrSummary({
      reportId: inputs.reportId,
      repoName: repoEnv || undefined,
      headRef: inputs.headRef,
      baseRef: inputs.baseRef,
      commitSha,
      runId,
      coverageThreshold: inputs.coverageThreshold,
      diffCoverageThreshold: inputs.diffCoverageThreshold,
      diffStats,
      testResult,
      coverageReport,
      sarifReport,
      gateResults,
      matchedImpacts,
      checklistItems: allChecklistItems,
      overflowFindings,
    });

    // 8. Output to GitHub Step Summary
    await core.summary.addRaw(markdownSummary).write();

    // 9. Upsert Sticky PR Comment
    const prNumber = context.payload.pull_request?.number || (process.env['PR_NUMBER'] ? Number.parseInt(process.env['PR_NUMBER'], 10) : undefined);

    if (prNumber && inputs.githubToken && repoOwner && repoName) {
      const octokit = github.getOctokit(inputs.githubToken);
      const { commentId, updated } = await upsertStickyPrComment({
        octokit,
        owner: repoOwner,
        repo: repoName,
        issueNumber: prNumber,
        reportId: inputs.reportId,
        body: markdownSummary,
      });
      core.info(`Sticky PR Comment ${updated ? 'updated' : 'created'} (id: ${commentId}).`);
    } else {
      core.info('PR context or GITHUB_TOKEN not available; sticky PR comment not posted.');
    }

    // 10. Set outputs
    const isFailed = markdownSummary.includes('### 🔴 Verification Failed');
    core.setOutput('verdict', isFailed ? 'FAILED' : 'PASSED');
    if (coverageReport?.diffCoverage) {
      core.setOutput('diff-coverage', String(coverageReport.diffCoverage.percentage));
    }
    if (coverageReport?.overall) {
      core.setOutput('total-coverage', String(coverageReport.overall.percentage));
    }
    if (testResult) {
      core.setOutput('tests-passed', String(testResult.passed));
      core.setOutput('tests-failed', String(testResult.failed));
    }

    // 11. Check merge blocking conditions
    if (isFailed) {
      core.setFailed('PR Verification failed quality gates or thresholds.');
    } else {
      core.info('PR Verification completed successfully.');
    }
  } catch (error) {
    core.setFailed(`pr-summary failed: ${String(error)}`);
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  void run();
}
