const requestIdPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function parseBaseUrl(value) {
  if (!value) throw new Error('not_configured');
  const url = new URL(value);
  const local = url.hostname === '127.0.0.1' || url.hostname === 'localhost';
  if (
    (!local && url.protocol !== 'https:') ||
    (local && !['http:', 'https:'].includes(url.protocol)) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    (url.pathname !== '/' && url.pathname !== '')
  )
    throw new Error('invalid_configuration');
  return url;
}

function validHealthDocument(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const keys = Object.keys(value).sort();
  return (
    keys.length === 2 &&
    keys[0] === 'request_id' &&
    keys[1] === 'status' &&
    value.status === 'ok' &&
    typeof value.request_id === 'string' &&
    requestIdPattern.test(value.request_id)
  );
}

async function checkEndpoint(baseUrl, path, fetchImpl) {
  const target = new URL(path, baseUrl);
  const response = await fetchImpl(target, {
    method: 'GET',
    headers: { accept: 'application/json' },
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  const contentType = response.headers.get('content-type') ?? '';
  if (!response.ok || !contentType.toLowerCase().includes('application/json'))
    throw new Error('unhealthy');
  const body = await response.json();
  if (!validHealthDocument(body)) throw new Error('invalid_response');
}

export async function checkSandboxHealth(value, fetchImpl = fetch) {
  const baseUrl = parseBaseUrl(value);
  await checkEndpoint(baseUrl, '/v1/health', fetchImpl);
  await checkEndpoint(baseUrl, '/v1/ready', fetchImpl);
}

if (process.argv[1]?.endsWith('check-sandbox-health.mjs')) {
  try {
    await checkSandboxHealth(process.env.SANDBOX_API_URL);
    console.log('Sandbox health check passed.');
  } catch {
    console.error('Sandbox health check failed.');
    process.exitCode = 1;
  }
}
