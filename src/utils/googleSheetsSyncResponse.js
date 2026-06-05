export async function parseGoogleSheetsSyncResponse(response) {
  if (response.type === 'opaque') {
    return {
      success: false,
      error: 'Apps Script 回應不可讀取，無法確認同步是否成功',
    };
  }

  const bodyText = await response.text();
  let body = null;

  if (bodyText.trim()) {
    try {
      body = JSON.parse(bodyText);
    } catch {
      return {
        success: false,
        error: 'Apps Script 回應不是有效 JSON，無法確認同步是否成功',
      };
    }
  }

  if (!response.ok) {
    return {
      success: false,
      error: getResponseError(body) ?? `Apps Script HTTP ${response.status}`,
    };
  }

  return normalizeGoogleSheetsSyncBody(body);
}

export function normalizeGoogleSheetsSyncBody(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return {
      success: false,
      error: 'Apps Script 未回傳明確成功狀態',
    };
  }

  if (body.ok === false || body.success === false) {
    return {
      success: false,
      error: getResponseError(body) ?? 'Apps Script 回報同步失敗',
    };
  }

  if (body.ok === true || body.success === true) {
    return {
      success: true,
      written: Number.isFinite(Number(body.written)) ? Number(body.written) : undefined,
    };
  }

  return {
    success: false,
    error: 'Apps Script 未回傳明確成功狀態',
  };
}

function getResponseError(body) {
  if (!body || typeof body !== 'object') return null;

  for (const key of ['error', 'message', 'description']) {
    const value = body[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }

  return null;
}
