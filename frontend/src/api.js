
async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  let result;

  try {
    result = await response.json();
  } catch {
    result = null;
  }

  if (!response.ok) {
    throw new Error(
      typeof result?.detail === "string"
        ? result.detail
        : `Request failed (${response.status})`
    );
  }

  return result;
}

function params(values = {}) {
  const query = new URLSearchParams();

  Object.entries(values).forEach(([key, value]) => {
    if (
      value !== "" &&
      value !== null &&
      value !== undefined
    ) {
      query.set(key, String(value));
    }
  });

  return query.toString();
}

export const api = {
  health: () => request("/health"),

  stats: () => request("/stats"),

  carriers: (filters = {}) =>
    request(`/carriers?${params(filters)}`),

  carrier: (usdot) =>
    request(`/carriers/${encodeURIComponent(usdot)}`),

  followups: (kind) =>
    request(`/followups?kind=${kind}`),

  outreach: (usdot, data) =>
    request(`/carriers/${encodeURIComponent(usdot)}/outreach`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),

  verify: (usdot, data) =>
    request(`/carriers/${encodeURIComponent(usdot)}/verification`, {
      method: "PATCH",
      body: JSON.stringify(data)
    }),

  discover: (data) =>
    request("/discover", {
      method: "POST",
      body: JSON.stringify(data)
    }),

  refreshCarrierEmails: () =>
    request("/carriers/emails/refresh-fmcsa", {
      method: "POST", body: "{}"
    }),

  findPublicEmails: (usdot) =>
    request(`/carriers/${encodeURIComponent(usdot)}/email-suggestions`, {
      method: "POST", body: "{}"
    }),

  saveCarrierEmail: (usdot, email) =>
    request(`/carriers/${encodeURIComponent(usdot)}/email`, {
      method: "PATCH", body: JSON.stringify({ email })
    }),

  // Retrieve a carrier's communication history
  activities: (usdot) =>
    request(
      `/carriers/${encodeURIComponent(usdot)}/activities`
    ),

  // Save a new communication record
  addActivity: (usdot, data) =>
    request(
      `/carriers/${encodeURIComponent(usdot)}/activities`,
      {
        method: "POST",
        body: JSON.stringify(data)
      }
    )
};
