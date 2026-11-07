import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('deployment requires an explicit manual opt-in, never a push or pull request', async () => {
  const workflow = await readFile(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
  assert.match(workflow, /workflow_dispatch:\s+inputs:\s+deploy:[\s\S]*?type: boolean\s+required: false\s+default: false/);
  const condition = workflow.split('\n').find(line => line.trimStart().startsWith('if:'));
  assert.equal(condition.trim(), "if: github.event_name == 'workflow_dispatch' && inputs.deploy == true && github.ref == 'refs/heads/main'");
  const blueprint = await readFile(new URL('../render.yaml', import.meta.url), 'utf8');
  assert.match(blueprint, /autoDeployTrigger: "off"/);
});
