const { config } = require('./config.js');

const axiosDefaults = {
  timeout: config.httpTimeoutMs,
  headers: {
    Accept: 'application/json',
    'User-Agent': 'rwa-ledger/1.0',
  },
};

async function readAxios(request, url) {
  try {
    const response = await request;
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const body = error.response?.data;
    let detail = error.message;
    if (typeof body === 'string' && body.trim()) {
      detail = body.slice(0, 180);
    } else if (body && typeof body === 'object') {
      detail = body.error || body.status?.error_message || body.message || detail;
    }
    const wrapped = new Error(`GET ${url} failed${status ? ` (${status})` : ''}: ${detail}`);
    wrapped.cause = error;
    throw wrapped;
  }
}

async function optional(label, loader) {
  try {
    return { ok: true, data: await loader() };
  } catch (error) {
    return { ok: false, error: `${label}: ${error.message}` };
  }
}

module.exports = { axiosDefaults, readAxios, optional };
