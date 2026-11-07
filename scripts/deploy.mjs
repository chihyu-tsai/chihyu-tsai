import { appendFile } from 'node:fs/promises';

const hook = process.env.RENDER_DEPLOY_HOOK_URL;
let summary;
if (!hook) {
  summary = 'CI passed. Deployment was skipped: configure the RENDER_DEPLOY_HOOK_URL repository secret to enable CD.';
} else {
  let url;
  try { url = new URL(hook); }
  catch { throw new Error('The Render deploy hook is not a valid URL. Check the repository secret.'); }
  if (url.protocol !== 'https:' || url.hostname !== 'api.render.com' || url.username || url.password || (url.port && url.port !== '443') || !url.pathname.startsWith('/deploy/')) throw new Error('Use the Render HTTPS deploy hook from the service settings.');
  const sha = process.env.DEPLOY_SHA;
  if (!/^[a-f0-9]{40}$/.test(sha || '')) throw new Error('A valid tested commit SHA is required.');
  url.searchParams.set('ref', sha);
  // Do not log the secret URL, response body, or network error details.
  let response;
  try { response = await fetch(url, { method: 'POST', redirect: 'error', signal: AbortSignal.timeout(30000) }); }
  catch { throw new Error('Render deploy request failed. Verify the deploy hook in repository secrets.'); }
  if (!response.ok) throw new Error(`Render rejected the deploy request (HTTP ${response.status}).`);
  summary = `CI passed. Render accepted deployment of ${sha}. This is an asynchronous request; check Render for final deployment/health status.`;
}
console.log(summary);
if (process.env.GITHUB_STEP_SUMMARY) await appendFile(process.env.GITHUB_STEP_SUMMARY, summary + '\n');
