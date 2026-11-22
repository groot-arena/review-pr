import { XMLParser } from 'fast-xml-parser';
import { TestResultSchema, type TestResult, type TestFailure } from '../types/reports.js';

interface RawFailure {
  '@_message'?: string;
  '#text'?: string;
}

interface RawTestCase {
  '@_name'?: string;
  '@_classname'?: string;
  '@_file'?: string;
  '@_time'?: string | number;
  failure?: RawFailure[];
  error?: RawFailure[];
  skipped?: unknown;
}

interface RawTestSuite {
  '@_name'?: string;
  '@_tests'?: string | number;
  '@_failures'?: string | number;
  '@_errors'?: string | number;
  '@_skipped'?: string | number;
  '@_time'?: string | number;
  testcase?: RawTestCase[];
  testsuite?: RawTestSuite[];
}

export function parseJUnitXml(xmlContent: string): TestResult {
  if (!xmlContent || !xmlContent.trim()) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      errors: 0,
      duration: 0,
      failures: [],
    };
  }

  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['testsuite', 'testcase', 'failure', 'error'].includes(name),
  });

  const parsed = parser.parse(xmlContent) as Record<string, unknown>;

  const testSuites: RawTestSuite[] = [];

  const rootSuites = parsed['testsuites'] as Record<string, unknown> | undefined;
  if (rootSuites && Array.isArray(rootSuites['testsuite'])) {
    testSuites.push(...(rootSuites['testsuite'] as RawTestSuite[]));
  } else if (parsed['testsuite']) {
    if (Array.isArray(parsed['testsuite'])) {
      testSuites.push(...(parsed['testsuite'] as RawTestSuite[]));
    } else {
      testSuites.push(parsed['testsuite'] as RawTestSuite);
    }
  }

  let total = 0;
  let failed = 0;
  let errors = 0;
  let skipped = 0;
  let duration = 0;
  const failures: TestFailure[] = [];

  function collectSuites(suiteList: RawTestSuite[]) {
    for (const suite of suiteList) {
      if (suite['@_time'] !== undefined) {
        duration += Number.parseFloat(String(suite['@_time'])) || 0;
      }

      if (suite.testcase && Array.isArray(suite.testcase)) {
        for (const tc of suite.testcase) {
          total += 1;
          const name = tc['@_name'] || 'Unnamed test';
          const classname = tc['@_classname'] || suite['@_name'] || '';
          const file = tc['@_file'];

          if (tc.skipped !== undefined) {
            skipped += 1;
            continue;
          }

          const failList = tc.failure || [];
          const errorList = tc.error || [];

          if (failList.length > 0) {
            failed += 1;
            for (const f of failList) {
              failures.push(buildFailure(name, classname, file, f));
            }
          } else if (errorList.length > 0) {
            errors += 1;
            for (const e of errorList) {
              failures.push(buildFailure(name, classname, file, e));
            }
          }
        }
      }

      if (suite.testsuite && Array.isArray(suite.testsuite)) {
        collectSuites(suite.testsuite);
      }
    }
  }

  collectSuites(testSuites);

  const passed = Math.max(0, total - (failed + errors + skipped));

  const result: TestResult = {
    total,
    passed,
    failed,
    skipped,
    errors,
    duration: Math.round(duration * 100) / 100,
    failures,
  };

  return TestResultSchema.parse(result);
}

function buildFailure(name: string, classname: string, file: string | undefined, raw: RawFailure): TestFailure {
  const message = raw['@_message'] || 'Test failed';
  const rawSnippet = typeof raw['#text'] === 'string' ? raw['#text'] : '';
  const snippet = truncateSnippet(rawSnippet.trim() || message);

  const failure: TestFailure = {
    name,
    classname,
    message,
    snippet,
  };
  if (file) {
    failure.file = file;
  }
  return failure;
}

function truncateSnippet(text: string, maxLines: number = 8, maxChars: number = 600): string {
  const lines = text.split('\n');
  let truncated = lines.slice(0, maxLines).join('\n');
  if (lines.length > maxLines) {
    truncated += '\n... [truncated]';
  }
  if (truncated.length > maxChars) {
    truncated = truncated.substring(0, maxChars) + '... [truncated]';
  }
  return truncated;
}
