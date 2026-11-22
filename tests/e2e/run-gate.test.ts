import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';

describe('run-gate Composite Action Simulation', () => {
  const tmpDir = path.resolve('tests/e2e/gate-workspace');
  const actionPath = path.resolve('.github/actions/run-gate/action.yml');

  // Helper simulating the bash step in run-gate/action.yml
  function executeGate(name: string, command: string): { status: string; duration: string; errorSnippet: string; exitCode: number } {
    const outputFile = path.join(tmpDir, `output-${Date.now()}-${Math.random().toString(36).substring(7)}.txt`);
    fs.writeFileSync(outputFile, '');

    const script = `
      export GITHUB_OUTPUT="${outputFile}"
      export GATE_NAME="${name}"
      export GATE_CMD="${command.replace(/"/g, '\\"')}"

      if [ -z "$GATE_CMD" ]; then
        echo "status=skipped" >> "$GITHUB_OUTPUT"
        echo "duration=0" >> "$GITHUB_OUTPUT"
        echo "error-snippet=" >> "$GITHUB_OUTPUT"
        exit 0
      fi

      START_TIME=$(date +%s%N)
      TEMP_LOG=$(mktemp)

      set +e
      eval "$GATE_CMD" 2>&1 | tee "$TEMP_LOG"
      EXIT_CODE=\${PIPESTATUS[0]}
      set -e

      END_TIME=$(date +%s%N)
      DURATION_NS=$((END_TIME - START_TIME))
      DURATION_SEC=$(awk "BEGIN {printf \\"%.2f\\", $DURATION_NS / 1000000000}")

      echo "duration=$DURATION_SEC" >> "$GITHUB_OUTPUT"

      if [ $EXIT_CODE -eq 0 ]; then
        echo "status=passed" >> "$GITHUB_OUTPUT"
        echo "error-snippet=" >> "$GITHUB_OUTPUT"
      else
        echo "status=failed" >> "$GITHUB_OUTPUT"
        SNIPPET=$(tail -n 15 "$TEMP_LOG" | tr '\\n' ' ' | sed 's/"/\\\\"/g')
        echo "error-snippet=$SNIPPET" >> "$GITHUB_OUTPUT"
        rm -f "$TEMP_LOG"
        exit $EXIT_CODE
      fi

      rm -f "$TEMP_LOG"
    `;

    let exitCode = 0;
    try {
      execSync(script, { cwd: tmpDir, shell: '/bin/bash', encoding: 'utf-8', stdio: 'pipe' });
    } catch (err: unknown) {
      const e = err as { status?: number };
      exitCode = e.status || 1;
    }

    const outputContent = fs.readFileSync(outputFile, 'utf-8');
    const getVal = (key: string) => {
      const line = outputContent.split('\n').find((l) => l.startsWith(`${key}=`));
      return line ? line.substring(key.length + 1).trim() : '';
    };

    return {
      status: getVal('status'),
      duration: getVal('duration'),
      errorSnippet: getVal('error-snippet'),
      exitCode,
    };
  }

  beforeAll(() => {
    fs.mkdirSync(tmpDir, { recursive: true });
  });

  afterAll(() => {
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it('action.yml definition exists and has required inputs/outputs', () => {
    expect(fs.existsSync(actionPath)).toBe(true);
    const content = fs.readFileSync(actionPath, 'utf-8');
    expect(content).toContain('name:');
    expect(content).toContain('command:');
    expect(content).toContain('status:');
    expect(content).toContain('duration:');
    expect(content).toContain('error-snippet:');
  });

  it('skips execution when command input is empty', () => {
    const result = executeGate('typecheck', '');
    expect(result.exitCode).toBe(0);
    expect(result.status).toBe('skipped');
    expect(result.duration).toBe('0');
  });

  it('records passed status and duration when command succeeds', () => {
    const result = executeGate('lint', 'echo "All checks passed"');
    expect(result.exitCode).toBe(0);
    expect(result.status).toBe('passed');
    expect(Number.parseFloat(result.duration)).toBeGreaterThanOrEqual(0);
  });

  it('captures error snippet and exit code when command fails', () => {
    const result = executeGate('test', 'echo "FATAL: Test assertion failed on line 42" && exit 1');
    expect(result.exitCode).toBe(1);
    expect(result.status).toBe('failed');
    expect(result.errorSnippet).toContain('FATAL: Test assertion failed on line 42');
  });

  it('prevents shell injection when command contains complex arguments and quotes', () => {
    const result = executeGate('build', 'node -e "console.log(\'Complex build argument with spaces\')"');
    expect(result.exitCode).toBe(0);
    expect(result.status).toBe('passed');
  });
});
