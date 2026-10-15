// Calls to the sync server. Every write carries a custom header the server checks.
export class ApiError extends Error {
  constructor(status, code, data) {
    super(code);
    this.status = status;
    this.data = data;
  }
}

export function createApi({ base = '', fetchImpl = (...args) => fetch(...args) } = {}) {
  async function call(method, path, body) {
    const headers = { 'X-Requested-With': 'gamefolk' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    let response;
    try {
      response = await fetchImpl(`${base}/api/${path}`, {
        method,
        headers,
        credentials: 'same-origin',
        body: body === undefined ? undefined : JSON.stringify(body)
      });
    } catch {
      throw new ApiError(0, 'offline');
    }
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new ApiError(response.status, data.error || `http-${response.status}`, data);
    return data;
  }

  return {
    get: path => call('GET', path),
    post: (path, body = {}) => call('POST', path, body),
    put: (path, body) => call('PUT', path, body),
    del: path => call('DELETE', path)
  };
}

// Sync works only when the site is opened from a web address, not from a file.
export function syncAvailable() {
  const { protocol, hostname } = globalThis.location || {};
  return protocol === 'https:' || (protocol === 'http:' && (hostname === 'localhost' || hostname === '127.0.0.1'));
}
