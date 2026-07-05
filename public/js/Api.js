(() => {
  function getCurrentUser() {
    return window.MangakuSession?.getCurrentUserSession?.() || null;
  }

  function buildHeaders(baseHeaders = {}) {
    return window.MangakuCore.buildAuthHeaders(getCurrentUser(), baseHeaders);
  }

  function summarizePayload(payload) {
    if (!payload) {
      return undefined;
    }

    if (payload instanceof FormData) {
      const entries = {};
      payload.forEach((value, key) => {
        entries[key] =
          value instanceof File ? `File(${value.name}, ${value.size}b)` : value;
      });
      return entries;
    }

    if (typeof payload === "string") {
      return payload.length > 200 ? `${payload.slice(0, 200)}…` : payload;
    }

    return payload;
  }

  function redirectToLogin() {
    window.MangakuSession?.clearCurrentUserSession?.();
    window.location.replace("/login.html");
  }

  async function request(method, url, options = {}) {
    const {
      payload,
      headers: customHeaders = {},
      json = true,
      redirectOn401 = true,
    } = options;

    const headers = buildHeaders({ ...customHeaders });
    const fetchOptions = { method, headers };

    if (payload !== undefined) {
      if (payload instanceof FormData) {
        fetchOptions.body = payload;
      } else if (json) {
        headers["Content-Type"] = "application/json";
        fetchOptions.body = JSON.stringify(payload);
      } else {
        fetchOptions.body = payload;
      }
    }

    const startedAt = performance.now();
    const payloadSummary = summarizePayload(payload);

    console.log(`[Api] → ${method} ${url}`, payloadSummary ?? "");

    let response;
    try {
      response = await fetch(url, fetchOptions);
    } catch (error) {
      const duration = Math.round(performance.now() - startedAt);
      console.log(`[Api] ← ERROR ${method} ${url} (${duration}ms)`, error.message);
      throw error;
    }

    const duration = Math.round(performance.now() - startedAt);
    const result = await window.MangakuCore.parseJsonResponse(response);
    const statusLabel = response.ok ? "OK" : `ERR ${response.status}`;

    console.log(
      `[Api] ← ${statusLabel} ${method} ${url} (${duration}ms)`,
      result?.status === "error" ? result.message : result?.message || "",
    );

    if (response.status === 401 && redirectOn401) {
      redirectToLogin();
      throw new Error(result.message || "Session berakhir. Silakan login ulang.");
    }

    return { response, result, ok: response.ok };
  }

  async function requestJson(method, url, payload, options = {}) {
    const { response, result, ok } = await request(method, url, {
      payload,
      ...options,
    });

    if (!ok) {
      throw new Error(result.message || "Permintaan ke server gagal.");
    }

    return result;
  }

  window.MangakuApi = {
    get(url, options) {
      return requestJson("GET", url, undefined, options);
    },
    post(url, payload, options) {
      return requestJson("POST", url, payload, options);
    },
    put(url, payload, options) {
      return requestJson("PUT", url, payload, options);
    },
    patch(url, payload, options) {
      return requestJson("PATCH", url, payload, options);
    },
    delete(url, options) {
      return requestJson("DELETE", url, undefined, options);
    },
    uploadForm(url, formData, method = "POST", options = {}) {
      return requestJson(method, url, formData, {
        json: false,
        ...options,
      });
    },
    raw(method, url, options) {
      return request(method, url, options);
    },
  };
})();
