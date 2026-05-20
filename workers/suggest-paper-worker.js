const QUEUE_HEADER = [
  "submitted_date",
  "submitted_at",
  "paper_name",
  "doi",
  "submitter_name",
  "submitter_email",
  "submitter_ip_hash",
  "status",
  "notes"
];

const DEFAULT_ALLOWED_ORIGINS = "https://demokratia-info.github.io";
const DOI_PATTERN = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\/\S+$/i;

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    if (request.method !== "POST") {
      return jsonResponse({ ok: false, error: "Method not allowed." }, 405, cors);
    }

    try {
      const payload = await request.json();
      const suggestion = validatePayload(payload);
      const submittedDate = israelDate();
      const submittedAt = new Date().toISOString();
      const ipAddress = sourceIp(request);
      const ipHash = await hashSourceIp(ipAddress, submittedDate, env);
      const github = githubConfig(env);

      for (let attempt = 0; attempt < 3; attempt += 1) {
        const current = await fetchQueue(github);
        const queue = normalizeQueueCsv(current.content);
        const rows = parseCsv(queue);
        const count = rows
          .slice(1)
          .filter((row) => row[0] === submittedDate && row[6] === ipHash)
          .length;

        if (count >= 2) {
          return jsonResponse(
            { ok: false, error: "You have already submitted two paper suggestions today." },
            429,
            cors
          );
        }

        const nextRow = csvLine([
          submittedDate,
          submittedAt,
          suggestion.paperTitle,
          suggestion.doi,
          suggestion.submitterName,
          suggestion.submitterEmail,
          ipHash,
          "pending",
          ""
        ]);
        const nextContent = `${queue}${nextRow}\n`;
        const saved = await saveQueue(github, current.sha, nextContent);

        if (saved.status === 409) continue;
        if (!saved.ok) {
          const detail = await saved.text();
          throw new Error(`GitHub update failed: ${saved.status} ${detail}`);
        }

        return jsonResponse({ ok: true }, 200, cors);
      }

      return jsonResponse(
        { ok: false, error: "The suggestion queue is busy. Please try again." },
        409,
        cors
      );
    } catch (error) {
      return jsonResponse(
        { ok: false, error: error instanceof Error ? error.message : "Unexpected error." },
        400,
        cors
      );
    }
  }
};

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigin = allowed.includes(origin) ? origin : allowed[0] || DEFAULT_ALLOWED_ORIGINS;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

function validatePayload(payload) {
  const paperTitle = clean(payload.paperTitle || payload.paper_name || payload.title, 300);
  const doi = normalizeDoi(clean(payload.doi, 240));
  const submitterName = clean(payload.submitterName || payload.submitter_name || payload.name, 120);
  const submitterEmail = clean(payload.submitterEmail || payload.submitter_email || payload.email, 254).toLowerCase();

  if (!paperTitle) throw new Error("Paper title is required.");
  if (!doi) throw new Error("DOI number is required.");
  if (!DOI_PATTERN.test(doi)) throw new Error("Please enter a valid DOI number.");
  if (!submitterName) throw new Error("Your name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    throw new Error("A valid email address is required.");
  }

  return { paperTitle, doi, submitterName, submitterEmail };
}

function clean(value, maxLength) {
  return String(value || "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maxLength);
}

function normalizeDoi(value) {
  return value
    .replace(/^doi:\s*/i, "")
    .replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "https://doi.org/")
    .trim();
}

function israelDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

function sourceIp(request) {
  const forwarded = request.headers.get("CF-Connecting-IP")
    || request.headers.get("X-Forwarded-For")
    || "";
  return forwarded.split(",")[0].trim() || "unknown";
}

async function hashSourceIp(ipAddress, submittedDate, env) {
  const secret = env.IP_HASH_SECRET || env.GITHUB_TOKEN || "change-this-secret";
  const bytes = new TextEncoder().encode(`${secret}:${submittedDate}:${ipAddress}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function githubConfig(env) {
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN worker secret.");
  return {
    owner: env.GITHUB_OWNER || "demokratia-info",
    repo: env.GITHUB_REPO || "democracy-paper-suggestions-private",
    branch: env.GITHUB_BRANCH || "main",
    path: env.QUEUE_PATH || "suggest_queue.csv",
    token
  };
}

async function fetchQueue(github) {
  const url = githubApiUrl(github, true);
  const response = await fetch(url, {
    headers: githubHeaders(github)
  });

  if (response.status === 404) {
    return { sha: null, content: `${QUEUE_HEADER.join(",")}\n` };
  }

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub read failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  return {
    sha: data.sha,
    content: base64ToText(data.content || "")
  };
}

async function saveQueue(github, sha, content) {
  const body = {
    message: "Add website paper suggestion",
    branch: github.branch,
    content: textToBase64(content)
  };
  if (sha) body.sha = sha;

  return fetch(githubApiUrl(github, false), {
    method: "PUT",
    headers: githubHeaders(github),
    body: JSON.stringify(body)
  });
}

function githubApiUrl(github, withRef) {
  const encodedPath = github.path.split("/").map(encodeURIComponent).join("/");
  const base = `https://api.github.com/repos/${github.owner}/${github.repo}/contents/${encodedPath}`;
  return withRef ? `${base}?ref=${github.branch}` : base;
}

function githubHeaders(github) {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${github.token}`,
    "Content-Type": "application/json",
    "User-Agent": "democracy-paper-suggestions"
  };
}

function normalizeQueueCsv(csv) {
  const trimmed = String(csv || "").trimEnd();
  if (!trimmed) return `${QUEUE_HEADER.join(",")}\n`;
  const firstLine = trimmed.split(/\r?\n/, 1)[0];
  const expected = QUEUE_HEADER.join(",");
  if (firstLine !== expected) {
    throw new Error(`suggest_queue.csv header must be: ${expected}`);
  }
  return `${trimmed}\n`;
}

function parseCsv(csv) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    const next = csv[index + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') {
        field += '"';
        index += 1;
      } else if (char === '"') {
        inQuotes = false;
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }

  return rows;
}

function csvLine(values) {
  return values.map(csvEscape).join(",");
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function base64ToText(value) {
  const binary = atob(String(value).replace(/\s+/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function textToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}
