import * as fs from 'node:fs';
import * as path from 'node:path';
import * as core from '@actions/core';
import * as github from '@actions/github';
import { PostInlineReviewInputsSchema } from '../types/config.js';
import { parseSarifOrRdjson } from '../parsers/sarif.js';
import { getGitDiffFromRepo, parseGitDiff } from '../parsers/git-diff.js';
import { formatSarifToReview } from '../formatters/sarif-to-review.js';
import { syncInlineReviews } from '../github/review-sync.js';

export async function run(): Promise<void> {
  try {
    const rawInputs = {
      sarifPath: core.getInput('sarif-path') || process.env['INPUT_SARIF_PATH'] || '',
      maxInlineComments: core.getInput('max-inline-comments') || process.env['INPUT_MAX_INLINE_COMMENTS'] || '15',
      githubToken: core.getInput('github-token') || process.env['INPUT_GITHUB_TOKEN'] || process.env['GITHUB_TOKEN'] || '',
      baseRef: core.getInput('base-ref') || process.env['INPUT_BASE_REF'] || process.env['GITHUB_BASE_REF'] || 'origin/main',
      headRef: core.getInput('head-ref') || process.env['INPUT_HEAD_REF'] || process.env['GITHUB_HEAD_REF'] || 'HEAD',
      workingDirectory: core.getInput('working-directory') || process.env['INPUT_WORKING_DIRECTORY'] || '.',
    };

    const inputs = PostInlineReviewInputsSchema.parse(rawInputs);
    const resolvedSarifPath = path.resolve(inputs.workingDirectory, inputs.sarifPath);

    if (!fs.existsSync(resolvedSarifPath)) {
      core.info(`SARIF file not found at ${resolvedSarifPath}. Skipping inline reviews.`);
      return;
    }

    const sarifContent = fs.readFileSync(resolvedSarifPath, 'utf-8');
    const sarifReport = parseSarifOrRdjson(sarifContent);

    core.info(
      `SARIF Parsed: ${sarifReport.counts.total} total findings (${sarifReport.counts.critical} critical, ${sarifReport.counts.error} error, ${sarifReport.counts.warning} warning, ${sarifReport.counts.info} info).`
    );

    // Get git diff
    const diffText = getGitDiffFromRepo(inputs.baseRef, inputs.headRef, inputs.workingDirectory);
    const { changedLinesPerFile } = parseGitDiff(diffText);

    const reviewResult = formatSarifToReview(
      sarifReport.findings,
      changedLinesPerFile,
      inputs.maxInlineComments
    );

    core.info(
      `Inline Review Filter: ${reviewResult.totalEligible} diff-matching findings. Capped at ${reviewResult.inlineComments.length} inline comments (${reviewResult.overflowFindings.length} overflow).`
    );

    // Export artifact lint-report.json
    const lintReportPayload = {
      counts: sarifReport.counts,
      inlineCommentsCount: reviewResult.inlineComments.length,
      overflowFindings: reviewResult.overflowFindings,
      infoFindings: reviewResult.infoFindings,
    };
    const reportArtifactDir = path.resolve(inputs.workingDirectory, '.pr-verification');
    if (!fs.existsSync(reportArtifactDir)) {
      fs.mkdirSync(reportArtifactDir, { recursive: true });
    }
    fs.writeFileSync(
      path.join(reportArtifactDir, 'lint-report.json'),
      JSON.stringify(lintReportPayload, null, 2)
    );

    // Post to PR if PR context & token available
    const context = github.context;
    const prNumber = context.payload.pull_request?.number || (process.env['PR_NUMBER'] ? Number.parseInt(process.env['PR_NUMBER'], 10) : undefined);
    let repoOwner = '';
    let repoName = '';
    const repoEnv = process.env['GITHUB_REPOSITORY'];
    if (repoEnv && repoEnv.includes('/')) {
      const parts = repoEnv.split('/');
      repoOwner = parts[0] || '';
      repoName = parts[1] || '';
    }

    if (prNumber && inputs.githubToken && repoOwner && repoName) {
      const octokit = github.getOctokit(inputs.githubToken);
      const commitSha = context.payload.pull_request?.head?.sha || process.env['GITHUB_SHA'] || inputs.headRef;

      const syncResult = await syncInlineReviews({
        octokit,
        owner: repoOwner,
        repo: repoName,
        pullNumber: prNumber,
        commitSha,
        inlineComments: reviewResult.inlineComments,
        currentFindings: sarifReport.findings,
      });

      core.info(
        `Inline Review Sync: ${syncResult.postedCount} comments posted, ${syncResult.skippedDuplicatesCount} duplicates skipped, ${syncResult.resolvedThreadsCount} fixed threads auto-resolved.`
      );
    } else {
      core.info('Not running in PR context or GITHUB_TOKEN not provided; skipped posting inline review comments to GitHub API.');
    }

    core.setOutput('total-findings', sarifReport.counts.total);
    core.setOutput('critical-findings', sarifReport.counts.critical);
    core.setOutput('error-findings', sarifReport.counts.error);
    core.setOutput('warning-findings', sarifReport.counts.warning);
    core.setOutput('inline-comments-posted', reviewResult.inlineComments.length);
    core.setOutput('overflow-count', reviewResult.overflowFindings.length);

    // Block merge if critical or error findings exist
    if (sarifReport.counts.critical > 0 || sarifReport.counts.error > 0) {
      core.setFailed(
        `Static analysis failed with ${sarifReport.counts.critical} critical and ${sarifReport.counts.error} error findings.`
      );
    }
  } catch (error) {
    core.setFailed(`post-inline-review failed: ${String(error)}`);
  }
}

if (process.env['NODE_ENV'] !== 'test') {
  void run();
}
