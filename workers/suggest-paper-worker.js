const SUGGEST_QUEUE_HEADER = [
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

const FEEDBACK_QUEUE_HEADER = [
  "submitted_date",
  "submitted_at",
  "page_url",
  "page_title",
  "page_slug",
  "paper_title",
  "doi",
  "comment",
  "submitter_email",
  "submitter_phone",
  "submitter_ip_hash",
  "status",
  "editor_notes",
  "applied_at",
  "suggested_photo_path",
  "suggested_photo_name",
  "suggested_photo_type",
  "suggested_photo_size",
  "suggested_photo_width",
  "suggested_photo_height",
  "submitter_role"
];

const DEFAULT_ALLOWED_ORIGINS = "https://demokratia-info.github.io";
const DEFAULT_SITE_ORIGIN = "https://demokratia-info.github.io";
const DOI_PATTERN = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\/\S+$/i;
const FEEDBACK_EDITOR_STATUSES = new Set(["pending", "approved_for_update", "rejected"]);
const FEEDBACK_SUBMITTER_ROLES = new Set(["paper_author", "field_researcher", "other_or_prefer_not"]);
const FEEDBACK_PHOTO_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);
const DEFAULT_FEEDBACK_PHOTO_DIR = "page_feedback_photos";
const DEFAULT_FEEDBACK_PHOTO_MAX_BYTES = 8 * 1024 * 1024;

export default {
  async fetch(request, env) {
    const cors = corsHeaders(request, env);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: cors });
    }

    try {
      const kind = requestKind(request);

      if (kind === "admin-page-feedback-photo") {
        return await handleAdminPageFeedbackPhoto(request, env, cors);
      }

      if (kind === "admin-page-feedback") {
        return await handleAdminPageFeedback(request, env, cors);
      }

      if (request.method !== "POST") {
        return jsonResponse({ ok: false, error: "Method not allowed." }, 405, cors);
      }

      if (kind === "page-feedback") {
        return await handlePageFeedback(request, env, cors);
      }
      return await handlePaperSuggestion(request, env, cors);
    } catch (error) {
      return jsonResponse(
        { ok: false, error: error instanceof Error ? error.message : "Unexpected error." },
        400,
        cors
      );
    }
  }
};

async function handlePaperSuggestion(request, env, cors) {
  const payload = await request.json();
  const suggestion = validateSuggestionPayload(payload);
  const submittedDate = israelDate();
  const submittedAt = new Date().toISOString();
  const ipAddress = sourceIp(request);
  const ipHash = await hashSourceIp(ipAddress, submittedDate, env);
  const github = githubConfig(env, "QUEUE_PATH", "suggest_queue.csv");

  return appendQueueRow({
    github,
    header: SUGGEST_QUEUE_HEADER,
    row: [
      submittedDate,
      submittedAt,
      suggestion.paperTitle,
      suggestion.doi,
      suggestion.submitterName,
      suggestion.submitterEmail,
      ipHash,
      "pending",
      ""
    ],
    submittedDate,
    ipHash,
    ipHashIndex: 6,
    dailyLimit: 2,
    limitMessage: "You have already submitted two paper suggestions today.",
    commitMessage: "Add website paper suggestion",
    cors
  });
}

async function handlePageFeedback(request, env, cors) {
  const { payload, photo } = await pageFeedbackRequestPayload(request);

  if (clean(payload.website, 120)) {
    return jsonResponse({ ok: true }, 200, cors);
  }

  const hasPhotoUpload = Boolean(photo && photo.size > 0);
  const feedback = validateFeedbackPayload(payload, env, hasPhotoUpload);
  const photoMeta = await validateFeedbackPhoto(photo, payload, env);
  const submittedDate = israelDate();
  const submittedAt = new Date().toISOString();
  const ipAddress = sourceIp(request);
  const ipHash = await hashSourceIp(ipAddress, submittedDate, env);
  const github = githubConfig(env, "FEEDBACK_QUEUE_PATH", "page_feedback_queue.csv");
  const dailyLimit = parseIntEnv(env.PAGE_FEEDBACK_DAILY_LIMIT, 5);
  const approvedByEditorPassword = await optionalEditorPasswordMatches(payload, env);
  const feedbackStatus = approvedByEditorPassword ? "approved_for_update" : "pending";
  const photoPath = photoMeta
    ? feedbackPhotoPath(feedback, submittedDate, submittedAt, ipHash, photoMeta.extension, env)
    : "";
  const row = [
    submittedDate,
    submittedAt,
    feedback.pageUrl,
    feedback.pageTitle,
    feedback.pageSlug,
    feedback.paperTitle,
    feedback.doi,
    feedback.comment,
    feedback.submitterEmail,
    feedback.submitterPhone,
    ipHash,
    feedbackStatus,
    approvedByEditorPassword ? "submitted_with_editor_password" : "",
    "",
    photoPath,
    photoMeta ? photoMeta.name : "",
    photoMeta ? photoMeta.type : "",
    photoMeta ? String(photoMeta.size) : "",
    photoMeta ? String(photoMeta.width) : "",
    photoMeta ? String(photoMeta.height) : "",
    feedback.submitterRole
  ];
  let photoSaved = false;

  return appendQueueRow({
    github,
    header: FEEDBACK_QUEUE_HEADER,
    row,
    beforeAppend: async () => {
      if (photoMeta && !photoSaved) {
        await saveFeedbackPhoto(photoPath, photoMeta, env);
        photoSaved = true;
      }
      return row;
    },
    submittedDate,
    ipHash,
    ipHashIndex: 10,
    dailyLimit,
    bypassDailyLimit: approvedByEditorPassword,
    limitMessage: "You have already submitted several comments today.",
    commitMessage: "Add website page feedback",
    successBody: {
      ok: true,
      status: feedbackStatus,
      approvedForUpdate: approvedByEditorPassword
    },
    cors
  });
}

async function handleAdminPageFeedback(request, env, cors) {
  await requireEditorPassword(request, env);

  if (request.method === "GET") {
    return listPageFeedback(env, cors);
  }

  if (request.method === "PATCH" || request.method === "POST") {
    return updatePageFeedbackStatus(request, env, cors);
  }

  return jsonResponse({ ok: false, error: "Method not allowed." }, 405, cors);
}

async function handleAdminPageFeedbackPhoto(request, env, cors) {
  await requireEditorPassword(request, env);

  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405, cors);
  }

  const path = validatePrivatePhotoPath(new URL(request.url).searchParams.get("path"), env);
  const github = githubConfig(env, "FEEDBACK_PHOTO_DIR", DEFAULT_FEEDBACK_PHOTO_DIR);
  github.path = path;
  const file = await fetchGitHubFile(github);
  const headers = {
    ...cors,
    "Content-Type": contentTypeFromPath(path),
    "Cache-Control": "no-store"
  };
  return new Response(file.bytes, { status: 200, headers });
}

async function listPageFeedback(env, cors) {
  const github = githubConfig(env, "FEEDBACK_QUEUE_PATH", "page_feedback_queue.csv");
  const current = await fetchQueue(github, FEEDBACK_QUEUE_HEADER);
  const queue = normalizeQueueCsv(current.content, FEEDBACK_QUEUE_HEADER, github.path);
  const rows = parseCsv(queue);
  const items = rows.slice(1).map((row, index) => feedbackItemFromRow(row, index));
  const counts = items.reduce((accumulator, item) => {
    accumulator[item.status] = (accumulator[item.status] || 0) + 1;
    return accumulator;
  }, {});

  return jsonResponse(
    {
      ok: true,
      rows: items,
      counts,
      nextRevisionHours: [0, 6, 12, 18],
      nextRevisionMinute: 5,
      timezone: "Asia/Jerusalem"
    },
    200,
    cors
  );
}

async function updatePageFeedbackStatus(request, env, cors) {
  const payload = await request.json();
  const rowIndex = Number.parseInt(String(payload.rowIndex ?? ""), 10);
  const status = clean(payload.status, 40);
  const editorNotes = clean(payload.editorNotes || payload.editor_notes || "", 1000);
  const submittedAt = clean(payload.submittedAt || payload.submitted_at || "", 80);
  const pageUrl = clean(payload.pageUrl || payload.page_url || "", 700);
  const comment = clean(payload.comment || "", 5000);

  if (!Number.isInteger(rowIndex) || rowIndex < 0) {
    throw new Error("Invalid queue row.");
  }
  if (!FEEDBACK_EDITOR_STATUSES.has(status)) {
    throw new Error("Status must be pending, approved_for_update, or rejected.");
  }

  const github = githubConfig(env, "FEEDBACK_QUEUE_PATH", "page_feedback_queue.csv");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await fetchQueue(github, FEEDBACK_QUEUE_HEADER);
    const queue = normalizeQueueCsv(current.content, FEEDBACK_QUEUE_HEADER, github.path);
    const rows = parseCsv(queue);
    const csvRow = rows[rowIndex + 1];

    if (!csvRow) throw new Error("Queue row no longer exists.");
    if (
      clean(csvRow[1], 80) !== submittedAt
      || clean(csvRow[2], 700) !== pageUrl
      || clean(csvRow[7], 5000) !== comment
    ) {
      return jsonResponse(
        { ok: false, error: "The queue changed. Reload before saving this row." },
        409,
        cors
      );
    }

    while (csvRow.length < FEEDBACK_QUEUE_HEADER.length) csvRow.push("");
    csvRow[11] = status;
    csvRow[12] = editorNotes;
    csvRow[13] = "";

    const nextContent = `${rows.map((row) => csvLine(row)).join("\n")}\n`;
    const saved = await saveQueue(github, current.sha, nextContent, "Update page feedback status");

    if (saved.status === 409) continue;
    if (!saved.ok) {
      const detail = await saved.text();
      throw new Error(`GitHub update failed: ${saved.status} ${detail}`);
    }

    return jsonResponse({ ok: true, row: feedbackItemFromRow(csvRow, rowIndex) }, 200, cors);
  }

  return jsonResponse(
    { ok: false, error: "The queue is busy. Please try again." },
    409,
    cors
  );
}

function feedbackItemFromRow(row, index) {
  return {
    rowIndex: index,
    submittedDate: row[0] || "",
    submittedAt: row[1] || "",
    pageUrl: row[2] || "",
    pageTitle: row[3] || "",
    pageSlug: row[4] || "",
    paperTitle: row[5] || "",
    doi: row[6] || "",
    comment: row[7] || "",
    submitterEmail: row[8] || "",
    submitterPhone: row[9] || "",
    status: row[11] || "",
    editorNotes: row[12] || "",
    appliedAt: row[13] || "",
    suggestedPhotoPath: row[14] || "",
    suggestedPhotoName: row[15] || "",
    suggestedPhotoType: row[16] || "",
    suggestedPhotoSize: row[17] || "",
    suggestedPhotoWidth: row[18] || "",
    suggestedPhotoHeight: row[19] || "",
    submitterRole: row[20] || "other_or_prefer_not"
  };
}

async function appendQueueRow({
  github,
  header,
  row,
  submittedDate,
  ipHash,
  ipHashIndex,
  dailyLimit,
  bypassDailyLimit = false,
  limitMessage,
  commitMessage,
  successBody = { ok: true },
  beforeAppend = null,
  cors
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await fetchQueue(github, header);
    const queue = normalizeQueueCsv(current.content, header, github.path);
    const rows = parseCsv(queue);
    const count = rows
      .slice(1)
      .filter((csvRow) => csvRow[0] === submittedDate && csvRow[ipHashIndex] === ipHash)
      .length;

    if (!bypassDailyLimit && count >= dailyLimit) {
      return jsonResponse({ ok: false, error: limitMessage }, 429, cors);
    }

    const rowForAppend = beforeAppend ? await beforeAppend() : row;
    const nextContent = `${queue}${csvLine(rowForAppend)}\n`;
    const saved = await saveQueue(github, current.sha, nextContent, commitMessage);

    if (saved.status === 409) continue;
    if (!saved.ok) {
      const detail = await saved.text();
      throw new Error(`GitHub update failed: ${saved.status} ${detail}`);
    }

    return jsonResponse(successBody, 200, cors);
  }

  return jsonResponse(
    { ok: false, error: "The queue is busy. Please try again." },
    409,
    cors
  );
}

function requestKind(request) {
  const pathname = new URL(request.url).pathname.replace(/\/+$/, "");
  if (pathname.endsWith("/admin/page-feedback/photo")) return "admin-page-feedback-photo";
  if (pathname.endsWith("/admin/page-feedback")) return "admin-page-feedback";
  return pathname.endsWith("/page-feedback") ? "page-feedback" : "paper-suggestion";
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = String(env.ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigin = allowed.includes(origin) ? origin : allowed[0] || DEFAULT_ALLOWED_ORIGINS;
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept, Authorization, X-Editor-Password",
    "Vary": "Origin",
    "Content-Type": "application/json; charset=utf-8"
  };
}

function jsonResponse(body, status, headers) {
  return new Response(JSON.stringify(body), { status, headers });
}

function validateSuggestionPayload(payload) {
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

async function pageFeedbackRequestPayload(request) {
  const contentType = request.headers.get("Content-Type") || "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payload = {};
    for (const [key, value] of formData.entries()) {
      if (typeof value === "string") payload[key] = value;
    }
    const photo = formData.get("suggestedPhoto");
    return {
      payload,
      photo: photo && typeof photo === "object" && "arrayBuffer" in photo ? photo : null
    };
  }

  return { payload: await request.json(), photo: null };
}

function validateFeedbackPayload(payload, env, hasPhotoUpload = false) {
  const pageUrl = normalizePageUrl(payload.pageUrl || payload.page_url || payload.url, env);
  const fallbackSlug = slugFromPageUrl(pageUrl);
  const pageTitle = clean(payload.pageTitle || payload.page_title || payload.title || fallbackSlug, 300);
  const pageSlug = clean(payload.pageSlug || payload.page_slug || fallbackSlug, 180);
  const paperTitle = clean(payload.paperTitle || payload.paper_title || "", 300);
  const doi = normalizeDoi(clean(payload.doi || "", 240));
  const comment = clean(payload.comment || payload.message || payload.notes, 5000);
  const submitterEmail = clean(payload.submitterEmail || payload.submitter_email || payload.email, 254).toLowerCase();
  const submitterPhone = clean(payload.submitterPhone || payload.submitter_phone || payload.phone, 40);
  const submitterRole = clean(payload.submitterRole || payload.submitter_role || "", 80) || "other_or_prefer_not";

  if (!pageTitle) throw new Error("Page title is required.");
  if (!comment && !hasPhotoUpload) throw new Error("Comment or suggested photo is required.");
  if (!FEEDBACK_SUBMITTER_ROLES.has(submitterRole)) {
    throw new Error("Submitter role is invalid.");
  }
  if (doi && !DOI_PATTERN.test(doi)) throw new Error("DOI must be valid.");
  if (submitterEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    throw new Error("Email address is invalid.");
  }
  if (submitterPhone && !/^[0-9+()\-\s.]{5,40}$/.test(submitterPhone)) {
    throw new Error("Phone number is invalid.");
  }

  return {
    pageUrl,
    pageTitle,
    pageSlug,
    paperTitle,
    doi,
    comment,
    submitterEmail,
    submitterPhone,
    submitterRole
  };
}

async function validateFeedbackPhoto(photo, payload, env) {
  if (!photo || !photo.size) return null;

  const type = clean(photo.type || payload.suggestedPhotoType || "", 80).toLowerCase();
  if (!FEEDBACK_PHOTO_TYPES.has(type)) {
    throw new Error("Suggested photo must be a JPEG, PNG, or WebP image.");
  }

  const maxBytes = parseIntEnv(env.PAGE_FEEDBACK_PHOTO_MAX_BYTES, DEFAULT_FEEDBACK_PHOTO_MAX_BYTES);
  if (photo.size > maxBytes) {
    throw new Error(`Suggested photo is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)}MB.`);
  }

  const bytes = new Uint8Array(await photo.arrayBuffer());
  const dimensions = imageDimensions(bytes, type) || dimensionsFromPayload(payload);
  if (!dimensions) {
    throw new Error("Could not read suggested photo dimensions.");
  }
  if (dimensions.width <= dimensions.height) {
    throw new Error("Suggested photo must be landscape. Please upload a horizontal image.");
  }

  return {
    bytes,
    type,
    extension: FEEDBACK_PHOTO_TYPES.get(type),
    name: clean(photo.name || "suggested-photo", 180),
    size: photo.size,
    width: dimensions.width,
    height: dimensions.height
  };
}

function dimensionsFromPayload(payload) {
  const width = Number.parseInt(String(payload.suggestedPhotoWidth || payload.photoWidth || ""), 10);
  const height = Number.parseInt(String(payload.suggestedPhotoHeight || payload.photoHeight || ""), 10);
  if (Number.isInteger(width) && Number.isInteger(height) && width > 0 && height > 0) {
    return { width, height };
  }
  return null;
}

function imageDimensions(bytes, type) {
  if (type === "image/png") return pngDimensions(bytes);
  if (type === "image/jpeg") return jpegDimensions(bytes);
  if (type === "image/webp") return webpDimensions(bytes);
  return null;
}

function pngDimensions(bytes) {
  if (
    bytes.length < 24
    || bytes[0] !== 0x89
    || bytes[1] !== 0x50
    || bytes[2] !== 0x4e
    || bytes[3] !== 0x47
  ) {
    return null;
  }
  return {
    width: readUint32BE(bytes, 16),
    height: readUint32BE(bytes, 20)
  };
}

function jpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    const marker = bytes[offset + 1];
    offset += 2;
    while (bytes[offset] === 0xff) offset += 1;
    if (marker === 0xd8 || marker === 0xd9) continue;
    if (offset + 2 > bytes.length) return null;
    const length = readUint16BE(bytes, offset);
    if (length < 2 || offset + length > bytes.length) return null;
    if (
      (marker >= 0xc0 && marker <= 0xc3)
      || (marker >= 0xc5 && marker <= 0xc7)
      || (marker >= 0xc9 && marker <= 0xcb)
      || (marker >= 0xcd && marker <= 0xcf)
    ) {
      return {
        height: readUint16BE(bytes, offset + 3),
        width: readUint16BE(bytes, offset + 5)
      };
    }
    offset += length;
  }
  return null;
}

function webpDimensions(bytes) {
  if (
    bytes.length < 30
    || textFromBytes(bytes, 0, 4) !== "RIFF"
    || textFromBytes(bytes, 8, 12) !== "WEBP"
  ) {
    return null;
  }

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunk = textFromBytes(bytes, offset, offset + 4);
    const size = readUint32LE(bytes, offset + 4);
    const dataOffset = offset + 8;
    if (dataOffset + size > bytes.length) return null;

    if (chunk === "VP8X" && size >= 10) {
      return {
        width: 1 + readUint24LE(bytes, dataOffset + 4),
        height: 1 + readUint24LE(bytes, dataOffset + 7)
      };
    }

    if (chunk === "VP8 " && size >= 10 && bytes[dataOffset + 3] === 0x9d && bytes[dataOffset + 4] === 0x01 && bytes[dataOffset + 5] === 0x2a) {
      return {
        width: readUint16LE(bytes, dataOffset + 6) & 0x3fff,
        height: readUint16LE(bytes, dataOffset + 8) & 0x3fff
      };
    }

    if (chunk === "VP8L" && size >= 5 && bytes[dataOffset] === 0x2f) {
      const b1 = bytes[dataOffset + 1];
      const b2 = bytes[dataOffset + 2];
      const b3 = bytes[dataOffset + 3];
      const b4 = bytes[dataOffset + 4];
      return {
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6))
      };
    }

    offset = dataOffset + size + (size % 2);
  }

  return null;
}

function readUint16BE(bytes, offset) {
  return (bytes[offset] << 8) | bytes[offset + 1];
}

function readUint16LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8);
}

function readUint24LE(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function readUint32BE(bytes, offset) {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0;
}

function readUint32LE(bytes, offset) {
  return (bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16) | (bytes[offset + 3] << 24)) >>> 0;
}

function textFromBytes(bytes, start, end) {
  return String.fromCharCode(...bytes.subarray(start, end));
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

function normalizePageUrl(value, env) {
  const raw = clean(value, 700);
  if (!raw) throw new Error("Page URL is required.");

  const origin = siteOrigin(env);
  let url;
  try {
    url = new URL(raw, origin);
  } catch {
    throw new Error("Page URL is invalid.");
  }

  if (url.origin !== origin) {
    throw new Error("Page URL must belong to this website.");
  }

  url.hash = "";
  return url.toString();
}

function siteOrigin(env) {
  const origin = String(env.SITE_ORIGIN || DEFAULT_SITE_ORIGIN).trim().replace(/\/+$/, "");
  return new URL(origin).origin;
}

function slugFromPageUrl(pageUrl) {
  try {
    const pathname = new URL(pageUrl).pathname;
    const filename = pathname.split("/").filter(Boolean).pop() || "home";
    return decodeURIComponent(filename).replace(/\.html$/i, "").slice(0, 180);
  } catch {
    return "";
  }
}

function feedbackPhotoPath(feedback, submittedDate, submittedAt, ipHash, extension, env) {
  const baseDir = String(env.FEEDBACK_PHOTO_DIR || DEFAULT_FEEDBACK_PHOTO_DIR)
    .trim()
    .replace(/^\/+|\/+$/g, "") || DEFAULT_FEEDBACK_PHOTO_DIR;
  const slug = safePathPart(feedback.pageSlug || slugFromPageUrl(feedback.pageUrl) || "page");
  const stamp = submittedAt.replace(/\D/g, "").slice(0, 14);
  const suffix = ipHash.slice(0, 12) || "upload";
  return `${baseDir}/${submittedDate}/${stamp}-${slug}-${suffix}.${extension}`;
}

function safePathPart(value) {
  return String(value || "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90) || "page";
}

async function saveFeedbackPhoto(path, photoMeta, env) {
  const github = githubConfig(env, "FEEDBACK_PHOTO_DIR", DEFAULT_FEEDBACK_PHOTO_DIR);
  github.path = path;
  const response = await saveGitHubFile(
    github,
    photoMeta.bytes,
    `Add page feedback photo for ${path.split("/").pop()}`
  );

  if (response.status === 409) return;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub photo upload failed: ${response.status} ${detail}`);
  }
}

function validatePrivatePhotoPath(value, env) {
  const path = clean(value || "", 500);
  const baseDir = String(env.FEEDBACK_PHOTO_DIR || DEFAULT_FEEDBACK_PHOTO_DIR)
    .trim()
    .replace(/^\/+|\/+$/g, "") || DEFAULT_FEEDBACK_PHOTO_DIR;
  if (!path || path.includes("..") || path.startsWith("/") || !path.startsWith(`${baseDir}/`)) {
    throw new Error("Invalid suggested photo path.");
  }
  if (!/\.(?:jpe?g|png|webp)$/i.test(path)) {
    throw new Error("Invalid suggested photo type.");
  }
  return path;
}

function contentTypeFromPath(path) {
  if (/\.png$/i.test(path)) return "image/png";
  if (/\.webp$/i.test(path)) return "image/webp";
  return "image/jpeg";
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

function githubConfig(env, queuePathEnvName, defaultPath) {
  const token = env.GITHUB_TOKEN;
  if (!token) throw new Error("Missing GITHUB_TOKEN worker secret.");
  return {
    owner: env.GITHUB_OWNER || "demokratia-info",
    repo: env.GITHUB_REPO || "democracy-paper-suggestions-private",
    branch: env.GITHUB_BRANCH || "main",
    path: env[queuePathEnvName] || defaultPath,
    token
  };
}

async function requireEditorPassword(request, env) {
  const supplied = editorPasswordFromRequest(request);
  if (!supplied) throw new Error("Editor password is required.");

  if (!env.EDITOR_PASSWORD_SHA256 && !env.EDITOR_PASSWORD) {
    throw new Error("Missing EDITOR_PASSWORD or EDITOR_PASSWORD_SHA256 worker secret.");
  }

  if (!(await editorPasswordMatches(supplied, env))) {
    throw new Error("Editor password is incorrect.");
  }
}

async function optionalEditorPasswordMatches(payload, env) {
  const supplied = String(payload.editorPassword || payload.editor_password || "").trim();
  if (!supplied) return false;
  return editorPasswordMatches(supplied, env);
}

async function editorPasswordMatches(supplied, env) {
  if (env.EDITOR_PASSWORD_SHA256) {
    const suppliedHash = await sha256Hex(supplied);
    return constantTimeEqual(suppliedHash, String(env.EDITOR_PASSWORD_SHA256).trim().toLowerCase());
  }

  if (!env.EDITOR_PASSWORD) return false;
  return constantTimeEqual(supplied, String(env.EDITOR_PASSWORD));
}

function editorPasswordFromRequest(request) {
  const auth = request.headers.get("Authorization") || "";
  const bearer = auth.match(/^Bearer\s+(.+)$/i);
  if (bearer) return bearer[1];
  return request.headers.get("X-Editor-Password") || "";
}

async function sha256Hex(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(left, right) {
  const a = String(left || "");
  const b = String(right || "");
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) {
    diff |= (a.charCodeAt(index) || 0) ^ (b.charCodeAt(index) || 0);
  }
  return diff === 0;
}

async function fetchQueue(github, header) {
  const url = githubApiUrl(github, true);
  const response = await fetch(url, {
    headers: githubHeaders(github)
  });

  if (response.status === 404) {
    return { sha: null, content: `${header.join(",")}\n` };
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

async function fetchGitHubFile(github) {
  const response = await fetch(githubApiUrl(github, true), {
    headers: githubHeaders(github)
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub file read failed: ${response.status} ${detail}`);
  }

  const data = await response.json();
  return {
    sha: data.sha,
    bytes: base64ToBytes(data.content || "")
  };
}

async function saveQueue(github, sha, content, message) {
  const body = {
    message,
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

async function saveGitHubFile(github, bytes, message) {
  const body = {
    message,
    branch: github.branch,
    content: bytesToBase64(bytes)
  };

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
    "User-Agent": "democracy-website-feedback"
  };
}

function normalizeQueueCsv(csv, header, path) {
  const trimmed = String(csv || "").trimEnd();
  if (!trimmed) return `${header.join(",")}\n`;
  const rows = parseCsv(`${trimmed}\n`);
  const currentHeader = rows[0] || [];
  const sameHeader = currentHeader.length === header.length
    && currentHeader.every((value, index) => value === header[index]);
  const oldHeaderPrefix = currentHeader.length < header.length
    && currentHeader.every((value, index) => value === header[index]);

  if (!sameHeader && !oldHeaderPrefix) {
    throw new Error(`${path} header must be: ${header.join(",")}`);
  }

  rows[0] = header;
  for (const row of rows.slice(1)) {
    while (row.length < header.length) row.push("");
  }
  return `${rows.map((row) => csvLine(row)).join("\n")}\n`;
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
  const bytes = base64ToBytes(value);
  return new TextDecoder().decode(bytes);
}

function base64ToBytes(value) {
  const binary = atob(String(value).replace(/\s+/g, ""));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

function textToBase64(value) {
  const bytes = new TextEncoder().encode(value);
  return bytesToBase64(bytes);
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function parseIntEnv(value, fallback) {
  const parsed = Number.parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
