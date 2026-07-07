const SUGGEST_QUEUE_HEADER = [
  "submitted_date",
  "submitted_at",
  "paper_name",
  "doi",
  "submitter_name",
  "submitter_email",
  "submitter_ip_hash",
  "status",
  "notes",
  "authors"
];

const SUGGEST_CONFIRMATION_HEADER = [
  "submitted_date",
  "submitted_at",
  "paper_name",
  "doi",
  "authors",
  "submitter_name",
  "submitter_email",
  "submitter_ip_hash",
  "token_hash",
  "expires_at",
  "status",
  "email_sent_at",
  "confirmed_at",
  "reported_at",
  "queue_added_at",
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
  "submitter_role",
  "full_text_path",
  "full_text_name",
  "full_text_type",
  "full_text_size"
];
const FEEDBACK_HISTORY_HEADER = [
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
  "submitter_role",
  "processed_at",
  "processing_notes",
  "full_text_path",
  "full_text_name",
  "full_text_type",
  "full_text_size"
];
const AUTHOR_NOTICE_QUEUE_HEADER = [
  "created_at",
  "updated_at",
  "author_key",
  "name_he",
  "name_en",
  "affiliation",
  "email",
  "email_source_url",
  "paper_slug",
  "paper_title_he",
  "paper_title_en",
  "paper_url",
  "status",
  "approved_at",
  "sent_at",
  "error",
  "editor_notes"
];

const DEFAULT_ALLOWED_ORIGINS = "https://democracy.tau.ac.il,https://demokratia-info.github.io";
const DEFAULT_SITE_ORIGIN = "https://democracy.tau.ac.il";
const DEFAULT_CONFIRMATION_REPORT_TO = "demokratia.info@gmail.com";
const DEFAULT_SUGGEST_CONFIRMATION_EXPIRY_DAYS = 7;
const DOI_PATTERN = /^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)?10\.\d{4,9}\/\S+$/i;
const FEEDBACK_EDITOR_STATUSES = new Set(["pending", "approved_for_update", "rejected"]);
const AUTHOR_NOTICE_EDITOR_STATUSES = new Set(["pending_editor_release", "ready_to_send", "failed"]);
const FEEDBACK_SUBMITTER_ROLES = new Set(["paper_author", "field_researcher", "other_or_prefer_not"]);
const FEEDBACK_COMMENT_MAX_LENGTH = 30000;
const FEEDBACK_PHOTO_TYPES = new Map([
  ["image/jpeg", "jpg"],
  ["image/png", "png"],
  ["image/webp", "webp"]
]);
const DEFAULT_FEEDBACK_PHOTO_DIR = "page_feedback_photos";
const DEFAULT_FEEDBACK_PHOTO_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_FEEDBACK_FULLTEXT_DIR = "page_feedback_fulltext";
const DEFAULT_FEEDBACK_FULLTEXT_MAX_BYTES = 50 * 1024 * 1024;
const DEFAULT_FEEDBACK_HISTORY_HOURS = 48;
const DEFAULT_FEEDBACK_HISTORY_LIMIT = 200;

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

      if (kind === "admin-page-feedback-auth") {
        return await handleAdminPageFeedbackAuth(request, env, cors);
      }

      if (kind === "admin-page-feedback-history") {
        return await handleAdminPageFeedbackHistory(request, env, cors);
      }

      if (kind === "admin-page-feedback") {
        return await handleAdminPageFeedback(request, env, cors);
      }

      if (kind === "admin-author-notices") {
        return await handleAdminAuthorNotices(request, env, cors);
      }

      if (kind === "confirm-suggestion") {
        return await handleSuggestionConfirmationAction(request, env, "confirm");
      }

      if (kind === "report-suggestion") {
        return await handleSuggestionConfirmationAction(request, env, "report");
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
  const activeGithub = githubConfig(env, "QUEUE_PATH", "suggest_queue.csv");
  const confirmationGithub = githubConfig(
    env,
    "SUGGEST_CONFIRMATION_QUEUE_PATH",
    "suggest_confirmation_queue.csv"
  );
  const dailyLimit = parseIntEnv(env.SUGGEST_PAPER_DAILY_LIMIT, 5);
  const token = confirmationToken();
  const tokenHash = await hashConfirmationToken(token, env);
  const expiresAt = confirmationExpiry(env);
  const confirmUrl = suggestionActionUrl(request, env, "confirm-suggestion", token);
  const reportUrl = suggestionActionUrl(request, env, "report-suggestion", token);
  requireConfirmationEmailConfig(env);

  const created = await appendSuggestionConfirmationRow({
    confirmationGithub,
    activeGithub,
    row: [
      submittedDate,
      submittedAt,
      suggestion.paperTitle,
      suggestion.doi,
      suggestion.authors,
      suggestion.submitterName,
      suggestion.submitterEmail,
      ipHash,
      tokenHash,
      expiresAt,
      "awaiting_confirmation",
      "",
      "",
      "",
      "",
      ""
    ],
    submittedDate,
    ipHash,
    dailyLimit,
    limitMessage: "You have already submitted five paper suggestions today.",
    cors
  });

  if (created instanceof Response) return created;

  try {
    await sendSuggestionConfirmationEmail(suggestion, confirmUrl, reportUrl, expiresAt, env);
  } catch (error) {
    await markSuggestionConfirmationEmailFailed(confirmationGithub, tokenHash, error);
    throw new Error("Could not send the confirmation email. Please try again later.");
  }

  await markSuggestionConfirmationEmailSent(confirmationGithub, tokenHash);
  return jsonResponse(
    {
      ok: true,
      requiresConfirmation: true,
      message: "Please check your email and click the confirmation link. The suggestion will be added only after confirmation."
    },
    200,
    cors
  );
}

async function handleSuggestionConfirmationAction(request, env, action) {
  if (request.method !== "GET") {
    return htmlResponse("Method not allowed", "This confirmation link only supports GET requests.", 405);
  }

  const token = clean(new URL(request.url).searchParams.get("token"), 300);
  if (!token) {
    return htmlResponse("Missing confirmation token", "The confirmation link is missing its token.", 400);
  }

  const tokenHash = await hashConfirmationToken(token, env);
  const confirmationGithub = githubConfig(
    env,
    "SUGGEST_CONFIRMATION_QUEUE_PATH",
    "suggest_confirmation_queue.csv"
  );

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await fetchQueue(confirmationGithub, SUGGEST_CONFIRMATION_HEADER);
    const queue = normalizeQueueCsv(current.content, SUGGEST_CONFIRMATION_HEADER, confirmationGithub.path);
    const rows = parseCsv(queue);
    const rowIndex = rows.findIndex((row, index) => index > 0 && row[8] === tokenHash);

    if (rowIndex < 1) {
      return htmlResponse(
        "Confirmation link not found",
        "We could not find this paper suggestion confirmation link. It may have already expired or been removed.",
        404
      );
    }

    const row = rows[rowIndex];
    while (row.length < SUGGEST_CONFIRMATION_HEADER.length) row.push("");

    const status = row[10] || "";
    const now = new Date().toISOString();
    if (status === "confirmed" && row[14]) {
      return htmlResponse(
        "Suggestion already confirmed",
        "This paper suggestion was already confirmed and added to the review queue."
      );
    }
    if (status === "reported_not_submitter") {
      return htmlResponse(
        "Suggestion already reported",
        "This paper suggestion was already reported as not submitted by this email address."
      );
    }
    if (status === "expired" || confirmationExpired(row[9])) {
      row[10] = "expired";
      row[15] = appendNote(row[15], "confirmation_link_expired");
      const saved = await saveQueue(
        confirmationGithub,
        current.sha,
        `${rows.map((csvRow) => csvLine(csvRow)).join("\n")}\n`,
        "Expire paper suggestion confirmation"
      );
      if (saved.status === 409) continue;
      if (!saved.ok) {
        const detail = await saved.text();
        throw new Error(`GitHub update failed: ${saved.status} ${detail}`);
      }
      return htmlResponse(
        "Confirmation link expired",
        "This confirmation link expired. Please submit the paper suggestion again if you still want it reviewed.",
        410
      );
    }

    if (action === "report") {
      row[10] = "reported_not_submitter";
      row[13] = row[13] || now;
      row[15] = appendNote(row[15], "reported_not_submitted_by_recipient");
      const saved = await saveQueue(
        confirmationGithub,
        current.sha,
        `${rows.map((csvRow) => csvLine(csvRow)).join("\n")}\n`,
        "Report unrecognized paper suggestion"
      );
      if (saved.status === 409) continue;
      if (!saved.ok) {
        const detail = await saved.text();
        throw new Error(`GitHub update failed: ${saved.status} ${detail}`);
      }

      await sendSuggestionReportEmail(row, env).catch(() => {});
      return htmlResponse(
        "Report received",
        "Thank you. We marked this suggestion as not submitted by this email address, and it will not be added to the review queue."
      );
    }

    await ensureConfirmedSuggestionQueued(row, env);
    row[10] = "confirmed";
    row[12] = row[12] || now;
    row[14] = row[14] || now;
    row[15] = appendNote(row[15], "confirmed_by_email_link");
    const saved = await saveQueue(
      confirmationGithub,
      current.sha,
      `${rows.map((csvRow) => csvLine(csvRow)).join("\n")}\n`,
      "Confirm website paper suggestion"
    );
    if (saved.status === 409) continue;
    if (!saved.ok) {
      const detail = await saved.text();
      throw new Error(`GitHub update failed: ${saved.status} ${detail}`);
    }

    return htmlResponse(
      "Suggestion confirmed",
      "Thank you. Your paper suggestion was confirmed and added to the review queue."
    );
  }

  return htmlResponse(
    "Queue busy",
    "The confirmation queue is busy. Please open the link again in a minute.",
    409
  );
}

async function appendSuggestionConfirmationRow({
  confirmationGithub,
  activeGithub,
  row,
  submittedDate,
  ipHash,
  dailyLimit,
  limitMessage,
  cors
}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const [confirmationCurrent, activeCount] = await Promise.all([
      fetchQueue(confirmationGithub, SUGGEST_CONFIRMATION_HEADER),
      countRowsByDateAndHash(activeGithub, SUGGEST_QUEUE_HEADER, submittedDate, ipHash, 6)
    ]);
    const confirmationQueue = normalizeQueueCsv(
      confirmationCurrent.content,
      SUGGEST_CONFIRMATION_HEADER,
      confirmationGithub.path
    );
    const confirmationRows = parseCsv(confirmationQueue);
    const confirmationCount = confirmationRows
      .slice(1)
      .filter((csvRow) => csvRow[0] === submittedDate && csvRow[7] === ipHash)
      .length;

    if (activeCount + confirmationCount >= dailyLimit) {
      return jsonResponse({ ok: false, error: limitMessage }, 429, cors);
    }

    const nextContent = `${confirmationQueue}${csvLine(row)}\n`;
    const saved = await saveQueue(
      confirmationGithub,
      confirmationCurrent.sha,
      nextContent,
      "Add pending paper suggestion confirmation"
    );

    if (saved.status === 409) continue;
    if (!saved.ok) {
      const detail = await saved.text();
      throw new Error(`GitHub update failed: ${saved.status} ${detail}`);
    }

    return { ok: true };
  }

  return jsonResponse(
    { ok: false, error: "The confirmation queue is busy. Please try again." },
    409,
    cors
  );
}

async function countRowsByDateAndHash(github, header, submittedDate, ipHash, ipHashIndex) {
  const current = await fetchQueue(github, header);
  const queue = normalizeQueueCsv(current.content, header, github.path);
  return parseCsv(queue)
    .slice(1)
    .filter((row) => row[0] === submittedDate && row[ipHashIndex] === ipHash)
    .length;
}

async function ensureConfirmedSuggestionQueued(confirmationRow, env) {
  const activeGithub = githubConfig(env, "QUEUE_PATH", "suggest_queue.csv");
  const submittedDate = confirmationRow[0] || "";
  const submittedAt = confirmationRow[1] || "";
  const paperName = confirmationRow[2] || "";
  const doi = confirmationRow[3] || "";
  const authors = confirmationRow[4] || "";
  const submitterName = confirmationRow[5] || "";
  const submitterEmail = confirmationRow[6] || "";
  const ipHash = confirmationRow[7] || "";

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await fetchQueue(activeGithub, SUGGEST_QUEUE_HEADER);
    const queue = normalizeQueueCsv(current.content, SUGGEST_QUEUE_HEADER, activeGithub.path);
    const rows = parseCsv(queue);
    const alreadyQueued = rows.slice(1).some((row) => (
      row[0] === submittedDate
      && row[1] === submittedAt
      && row[2] === paperName
      && row[5] === submitterName
      && row[6] === submitterEmail
    ));

    if (alreadyQueued) return false;

    const activeRow = [
      submittedDate,
      submittedAt,
      paperName,
      doi,
      submitterName,
      submitterEmail,
      ipHash,
      "pending",
      "email_confirmed",
      authors
    ];
    const saved = await saveQueue(
      activeGithub,
      current.sha,
      `${queue}${csvLine(activeRow)}\n`,
      "Add confirmed website paper suggestion"
    );

    if (saved.status === 409) continue;
    if (!saved.ok) {
      const detail = await saved.text();
      throw new Error(`GitHub update failed: ${saved.status} ${detail}`);
    }

    return true;
  }

  throw new Error("The suggestion queue is busy. Please try again.");
}

async function markSuggestionConfirmationEmailSent(github, tokenHash) {
  await updateSuggestionConfirmationEmailFields(github, tokenHash, (row) => {
    row[11] = row[11] || new Date().toISOString();
    row[15] = appendNote(row[15], "confirmation_email_sent");
  });
}

async function markSuggestionConfirmationEmailFailed(github, tokenHash, error) {
  await updateSuggestionConfirmationEmailFields(github, tokenHash, (row) => {
    row[10] = "email_failed";
    row[15] = appendNote(row[15], `confirmation_email_failed:${clean(error && error.message, 220)}`);
  }).catch(() => {});
}

async function updateSuggestionConfirmationEmailFields(github, tokenHash, mutateRow) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await fetchQueue(github, SUGGEST_CONFIRMATION_HEADER);
    const queue = normalizeQueueCsv(current.content, SUGGEST_CONFIRMATION_HEADER, github.path);
    const rows = parseCsv(queue);
    const row = rows.find((csvRow, index) => index > 0 && csvRow[8] === tokenHash);
    if (!row) return false;
    while (row.length < SUGGEST_CONFIRMATION_HEADER.length) row.push("");
    mutateRow(row);
    const saved = await saveQueue(
      github,
      current.sha,
      `${rows.map((csvRow) => csvLine(csvRow)).join("\n")}\n`,
      "Update paper suggestion confirmation email status"
    );

    if (saved.status === 409) continue;
    if (!saved.ok) {
      const detail = await saved.text();
      throw new Error(`GitHub update failed: ${saved.status} ${detail}`);
    }
    return true;
  }
  return false;
}

async function handlePageFeedback(request, env, cors) {
  const { payload, photo, fullText } = await pageFeedbackRequestPayload(request);

  if (clean(payload.website, 120)) {
    return jsonResponse({ ok: true }, 200, cors);
  }

  const hasPhotoUpload = Boolean(photo && photo.size > 0);
  const hasFullTextUpload = Boolean(fullText && fullText.size > 0);
  const feedback = validateFeedbackPayload(payload, env, hasPhotoUpload || hasFullTextUpload);
  const photoMeta = await validateFeedbackPhoto(photo, payload, env);
  const submittedDate = israelDate();
  const submittedAt = new Date().toISOString();
  const ipAddress = sourceIp(request);
  const ipHash = await hashSourceIp(ipAddress, submittedDate, env);
  const github = githubConfig(env, "FEEDBACK_QUEUE_PATH", "page_feedback_queue.csv");
  const dailyLimit = parseIntEnv(env.PAGE_FEEDBACK_DAILY_LIMIT, 5);
  const approvedByEditorPassword = await optionalEditorPasswordMatches(payload, env);
  if (hasFullTextUpload && !approvedByEditorPassword) {
    throw new Error("Full text upload requires a valid editor password.");
  }
  const fullTextMeta = await validateFeedbackFullText(fullText, payload, env);
  const feedbackStatus = approvedByEditorPassword ? "approved_for_update" : "pending";
  const photoPath = photoMeta
    ? feedbackPhotoPath(feedback, submittedDate, submittedAt, ipHash, photoMeta.extension, env)
    : "";
  const fullTextPath = fullTextMeta
    ? feedbackFullTextPath(feedback, submittedDate, submittedAt, ipHash, env)
    : "";
  const editorNotes = appendNote(
    approvedByEditorPassword ? "submitted_with_editor_password" : "",
    fullTextMeta ? "full_text_uploaded" : ""
  );
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
    editorNotes,
    "",
    photoPath,
    photoMeta ? photoMeta.name : "",
    photoMeta ? photoMeta.type : "",
    photoMeta ? String(photoMeta.size) : "",
    photoMeta ? String(photoMeta.width) : "",
    photoMeta ? String(photoMeta.height) : "",
    feedback.submitterRole,
    fullTextPath,
    fullTextMeta ? fullTextMeta.name : "",
    fullTextMeta ? fullTextMeta.type : "",
    fullTextMeta ? String(fullTextMeta.size) : ""
  ];
  let photoSaved = false;
  let fullTextSaved = false;

  return appendQueueRow({
    github,
    header: FEEDBACK_QUEUE_HEADER,
    row,
    beforeAppend: async () => {
      if (photoMeta && !photoSaved) {
        await saveFeedbackPhoto(photoPath, photoMeta, env);
        photoSaved = true;
      }
      if (fullTextMeta && !fullTextSaved) {
        await saveFeedbackFullText(fullTextPath, fullTextMeta, env);
        fullTextSaved = true;
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

async function handleAdminPageFeedbackAuth(request, env, cors) {
  await requireEditorPassword(request, env);

  if (request.method !== "GET" && request.method !== "POST") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405, cors);
  }

  return jsonResponse({ ok: true }, 200, cors);
}

async function handleAdminPageFeedbackHistory(request, env, cors) {
  await requireEditorPassword(request, env);

  if (request.method !== "GET") {
    return jsonResponse({ ok: false, error: "Method not allowed." }, 405, cors);
  }

  const url = new URL(request.url);
  const hours = parseIntBounded(
    url.searchParams.get("hours"),
    DEFAULT_FEEDBACK_HISTORY_HOURS,
    1,
    168
  );
  const limit = parseIntBounded(
    url.searchParams.get("limit"),
    DEFAULT_FEEDBACK_HISTORY_LIMIT,
    1,
    500
  );
  return listPageFeedbackHistory(env, cors, hours, limit);
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

async function handleAdminAuthorNotices(request, env, cors) {
  await requireEditorPassword(request, env);

  if (request.method === "GET") {
    return listAuthorNotices(env, cors);
  }

  if (request.method === "PATCH" || request.method === "POST") {
    return updateAuthorNoticeStatus(request, env, cors);
  }

  return jsonResponse({ ok: false, error: "Method not allowed." }, 405, cors);
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
      nextRevisionHours: [0, 3, 6, 9, 12, 15, 18, 21],
      nextRevisionMinute: 5,
      timezone: "Asia/Jerusalem"
    },
    200,
    cors
  );
}

async function listPageFeedbackHistory(env, cors, hours, limit) {
  const github = githubConfig(env, "FEEDBACK_HISTORY_PATH", "page_feedback_history.csv");
  const current = await fetchQueue(github, FEEDBACK_HISTORY_HEADER);
  const history = normalizeQueueCsv(current.content, FEEDBACK_HISTORY_HEADER, github.path);
  const rows = parseCsv(history);
  const cutoff = Date.now() - hours * 60 * 60 * 1000;
  const items = rows
    .slice(1)
    .map((row, index) => feedbackHistoryItemFromRow(row, index))
    .filter((item) => {
      const processedTime = timestampMs(item.processedAt || item.appliedAt || item.submittedAt);
      return Number.isFinite(processedTime) && processedTime >= cutoff;
    })
    .slice(-limit);
  const counts = items.reduce((accumulator, item) => {
    accumulator[item.status] = (accumulator[item.status] || 0) + 1;
    return accumulator;
  }, {});

  return jsonResponse(
    {
      ok: true,
      rows: items,
      counts,
      hours,
      limit,
      timezone: "Asia/Jerusalem"
    },
    200,
    cors
  );
}

async function listAuthorNotices(env, cors) {
  const github = githubConfig(env, "AUTHOR_NOTICE_QUEUE_PATH", "author_notice_queue.csv");
  const current = await fetchQueue(github, AUTHOR_NOTICE_QUEUE_HEADER);
  const queue = normalizeQueueCsv(current.content, AUTHOR_NOTICE_QUEUE_HEADER, github.path);
  const rows = parseCsv(queue);
  const items = rows
    .slice(1)
    .map((row, index) => authorNoticeItemFromRow(row, index))
    .filter((item) => item.status !== "blocked" && item.status !== "sent" && item.status !== "skipped");
  const counts = items.reduce((accumulator, item) => {
    accumulator[item.status] = (accumulator[item.status] || 0) + 1;
    return accumulator;
  }, {});

  return jsonResponse(
    {
      ok: true,
      rows: items,
      counts,
      senderMode: "gmail",
      replyTo: "demokratia@tau.ac.il",
      timezone: "Asia/Jerusalem"
    },
    200,
    cors
  );
}

async function updateAuthorNoticeStatus(request, env, cors) {
  const payload = await request.json();
  const rowIndex = Number.parseInt(String(payload.rowIndex ?? ""), 10);
  const status = clean(payload.status, 60);
  const editorNotes = clean(payload.editorNotes || payload.editor_notes || "", 1000);
  const updatedAt = clean(payload.updatedAt || payload.updated_at || "", 80);
  const authorKey = clean(payload.authorKey || payload.author_key || "", 260);
  const paperSlug = clean(payload.paperSlug || payload.paper_slug || "", 220);

  if (!Number.isInteger(rowIndex) || rowIndex < 0) {
    throw new Error("Invalid queue row.");
  }
  if (!AUTHOR_NOTICE_EDITOR_STATUSES.has(status)) {
    throw new Error("Status must be pending_editor_release, ready_to_send, or failed.");
  }

  const github = githubConfig(env, "AUTHOR_NOTICE_QUEUE_PATH", "author_notice_queue.csv");

  for (let attempt = 0; attempt < 3; attempt += 1) {
    const current = await fetchQueue(github, AUTHOR_NOTICE_QUEUE_HEADER);
    const queue = normalizeQueueCsv(current.content, AUTHOR_NOTICE_QUEUE_HEADER, github.path);
    const rows = parseCsv(queue);
    const csvRow = rows[rowIndex + 1];

    if (!csvRow) throw new Error("Queue row no longer exists.");
    if (
      clean(csvRow[1], 80) !== updatedAt
      || clean(csvRow[2], 260) !== authorKey
      || clean(csvRow[8], 220) !== paperSlug
    ) {
      return jsonResponse(
        { ok: false, error: "The queue changed. Reload before saving this row." },
        409,
        cors
      );
    }

    while (csvRow.length < AUTHOR_NOTICE_QUEUE_HEADER.length) csvRow.push("");
    csvRow[1] = new Date().toISOString();
    csvRow[12] = status;
    csvRow[13] = status === "ready_to_send" ? (csvRow[13] || new Date().toISOString()) : "";
    csvRow[15] = status === "failed" ? csvRow[15] : "";
    csvRow[16] = editorNotes;

    const nextContent = `${rows.map((row) => csvLine(row)).join("\n")}\n`;
    const saved = await saveQueue(github, current.sha, nextContent, "Update author notice status");

    if (saved.status === 409) continue;
    if (!saved.ok) {
      const detail = await saved.text();
      throw new Error(`GitHub update failed: ${saved.status} ${detail}`);
    }

    return jsonResponse({ ok: true, row: authorNoticeItemFromRow(csvRow, rowIndex) }, 200, cors);
  }

  return jsonResponse(
    { ok: false, error: "The queue is busy. Please try again." },
    409,
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
  const comment = clean(payload.comment || "", FEEDBACK_COMMENT_MAX_LENGTH);

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
      || clean(csvRow[7], FEEDBACK_COMMENT_MAX_LENGTH) !== comment
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

function feedbackItemFromRow(row, index, fullTextStartIndex = 21) {
  return {
    rowIndex: index,
    source: "queue",
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
    submitterRole: row[20] || "other_or_prefer_not",
    fullTextPath: row[fullTextStartIndex] || "",
    fullTextName: row[fullTextStartIndex + 1] || "",
    fullTextType: row[fullTextStartIndex + 2] || "",
    fullTextSize: row[fullTextStartIndex + 3] || ""
  };
}

function feedbackHistoryItemFromRow(row, index) {
  const item = feedbackItemFromRow(row, index, 23);
  return {
    ...item,
    source: "history",
    processedAt: row[21] || "",
    processingNotes: row[22] || ""
  };
}

function authorNoticeItemFromRow(row, index) {
  return {
    rowIndex: index,
    createdAt: row[0] || "",
    updatedAt: row[1] || "",
    authorKey: row[2] || "",
    nameHe: row[3] || "",
    nameEn: row[4] || "",
    affiliation: row[5] || "",
    email: row[6] || "",
    emailSourceUrl: row[7] || "",
    paperSlug: row[8] || "",
    paperTitleHe: row[9] || "",
    paperTitleEn: row[10] || "",
    paperUrl: row[11] || "",
    status: row[12] || "",
    approvedAt: row[13] || "",
    sentAt: row[14] || "",
    error: row[15] || "",
    editorNotes: row[16] || ""
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
  if (pathname.endsWith("/admin/page-feedback/auth")) return "admin-page-feedback-auth";
  if (pathname.endsWith("/admin/page-feedback/history")) return "admin-page-feedback-history";
  if (pathname.endsWith("/admin/page-feedback")) return "admin-page-feedback";
  if (pathname.endsWith("/admin/author-notices")) return "admin-author-notices";
  if (pathname.endsWith("/confirm-suggestion")) return "confirm-suggestion";
  if (pathname.endsWith("/report-suggestion")) return "report-suggestion";
  return pathname.endsWith("/page-feedback") ? "page-feedback" : "paper-suggestion";
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin") || "";
  const allowed = Array.from(new Set([
    ...String(DEFAULT_ALLOWED_ORIGINS).split(","),
    ...String(env.ALLOWED_ORIGINS || "").split(",")
  ]
    .map((item) => item.trim())
    .filter(Boolean)));
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
  const authors = clean(payload.authors || payload.paperAuthors || payload.paper_authors || payload.author_names, 500);
  const doi = normalizeDoi(clean(payload.doi, 240));
  const submitterName = clean(payload.submitterName || payload.submitter_name || payload.name, 120);
  const submitterEmail = clean(payload.submitterEmail || payload.submitter_email || payload.email, 254).toLowerCase();

  if (!paperTitle) throw new Error("Paper title is required.");
  if (doi && !DOI_PATTERN.test(doi)) throw new Error("Please enter a valid DOI number.");
  if (!submitterName) throw new Error("Your name is required.");
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(submitterEmail)) {
    throw new Error("A valid email address is required.");
  }

  return { paperTitle, authors, doi, submitterName, submitterEmail };
}

function requireConfirmationEmailConfig(env) {
  if (!env.RESEND_API_KEY && !env.CONFIRMATION_EMAIL_WEBHOOK_URL) {
    throw new Error("Confirmation email service is not configured.");
  }
  if (!clean(env.CONFIRMATION_MAIL_FROM || env.MAIL_FROM || "", 300)) {
    throw new Error("Confirmation email sender is not configured.");
  }
}

function confirmationToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return bytesToBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function hashConfirmationToken(token, env) {
  const secret = env.CONFIRMATION_TOKEN_SECRET || env.IP_HASH_SECRET || env.GITHUB_TOKEN || "change-this-secret";
  const bytes = new TextEncoder().encode(`${secret}:${token}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

function confirmationExpiry(env) {
  const days = parseIntEnv(env.SUGGEST_CONFIRMATION_EXPIRY_DAYS, DEFAULT_SUGGEST_CONFIRMATION_EXPIRY_DAYS);
  return new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
}

function confirmationExpired(expiresAt) {
  const expiresMs = Date.parse(String(expiresAt || ""));
  return Number.isFinite(expiresMs) && expiresMs < Date.now();
}

function suggestionActionUrl(request, env, path, token) {
  const base = String(env.CONFIRMATION_BASE_URL || new URL(request.url).origin).trim() || new URL(request.url).origin;
  const url = new URL(`/${path}`, base);
  url.searchParams.set("token", token);
  return url.toString();
}

async function sendSuggestionConfirmationEmail(suggestion, confirmUrl, reportUrl, expiresAt, env) {
  const subject = "Confirm your Demokratia paper suggestion";
  const expiryText = new Date(expiresAt).toLocaleString("en-GB", { timeZone: "Asia/Jerusalem" });
  const details = [
    `Paper title: ${suggestion.paperTitle}`,
    suggestion.authors ? `Author names: ${suggestion.authors}` : "",
    suggestion.doi ? `DOI: ${suggestion.doi}` : ""
  ].filter(Boolean).join("\n");
  const text = `Hello ${suggestion.submitterName},

We received a paper suggestion for the Demokratia website from this email address.

${details}

Please confirm that you submitted this suggestion:
${confirmUrl}

If you did not submit this suggestion, please report it here:
${reportUrl}

The confirmation link expires on ${expiryText} Israel time. The suggestion will be added to the review queue only after confirmation.

Thank you,
Demokratia`;
  const html = `<p>Hello ${escapeHtml(suggestion.submitterName)},</p>
<p>We received a paper suggestion for the Demokratia website from this email address.</p>
<p><strong>Paper title:</strong> ${escapeHtml(suggestion.paperTitle)}${suggestion.authors ? `<br><strong>Author names:</strong> ${escapeHtml(suggestion.authors)}` : ""}${suggestion.doi ? `<br><strong>DOI:</strong> ${escapeHtml(suggestion.doi)}` : ""}</p>
<p><a href="${escapeHtml(confirmUrl)}">Confirm this suggestion</a></p>
<p>If you did not submit this suggestion, <a href="${escapeHtml(reportUrl)}">report it here</a>.</p>
<p>The confirmation link expires on ${escapeHtml(expiryText)} Israel time. The suggestion will be added to the review queue only after confirmation.</p>
<p>Thank you,<br>Demokratia</p>`;

  return sendEmailMessage({
    to: suggestion.submitterEmail,
    subject,
    text,
    html,
    env
  });
}

async function sendSuggestionReportEmail(row, env) {
  const subject = "Paper suggestion reported as unrecognized";
  const reportTo = clean(env.CONFIRMATION_REPORT_TO || DEFAULT_CONFIRMATION_REPORT_TO, 254);
  const text = `A paper suggestion confirmation link was reported as not submitted by the email recipient.

Submitted at: ${row[1] || ""}
Paper title: ${row[2] || ""}
DOI: ${row[3] || ""}
Authors: ${row[4] || ""}
Submitter name: ${row[5] || ""}
Submitter email: ${row[6] || ""}

The pending suggestion was marked reported_not_submitter and was not added to suggest_queue.csv.`;
  const html = `<p>A paper suggestion confirmation link was reported as not submitted by the email recipient.</p>
<p><strong>Submitted at:</strong> ${escapeHtml(row[1] || "")}<br>
<strong>Paper title:</strong> ${escapeHtml(row[2] || "")}<br>
<strong>DOI:</strong> ${escapeHtml(row[3] || "")}<br>
<strong>Authors:</strong> ${escapeHtml(row[4] || "")}<br>
<strong>Submitter name:</strong> ${escapeHtml(row[5] || "")}<br>
<strong>Submitter email:</strong> ${escapeHtml(row[6] || "")}</p>
<p>The pending suggestion was marked <code>reported_not_submitter</code> and was not added to <code>suggest_queue.csv</code>.</p>`;

  return sendEmailMessage({ to: reportTo, subject, text, html, env });
}

async function sendEmailMessage({ to, subject, text, html, env }) {
  const from = clean(env.CONFIRMATION_MAIL_FROM || env.MAIL_FROM || "", 300);
  const replyTo = clean(
    env.CONFIRMATION_MAIL_REPLY_TO || env.MAIL_REPLY_TO || DEFAULT_CONFIRMATION_REPORT_TO,
    254
  );

  if (env.RESEND_API_KEY) {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${env.RESEND_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from,
        to: [to],
        reply_to: replyTo,
        subject,
        text,
        html
      })
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Email API failed: ${response.status} ${detail}`);
    }
    return response;
  }

  if (env.CONFIRMATION_EMAIL_WEBHOOK_URL) {
    const headers = { "Content-Type": "application/json" };
    if (env.CONFIRMATION_EMAIL_WEBHOOK_TOKEN) {
      headers.Authorization = `Bearer ${env.CONFIRMATION_EMAIL_WEBHOOK_TOKEN}`;
    }
    const response = await fetch(env.CONFIRMATION_EMAIL_WEBHOOK_URL, {
      method: "POST",
      headers,
      body: JSON.stringify({ from, to, replyTo, subject, text, html })
    });
    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Email webhook failed: ${response.status} ${detail}`);
    }
    return response;
  }

  throw new Error("Confirmation email service is not configured.");
}

function htmlResponse(title, message, status = 200) {
  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; background: #f6f1e7; color: #16211f; }
    main { max-width: 680px; margin: 12vh auto; padding: 0 24px; line-height: 1.6; }
    a { color: #0f5d58; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <p><a href="${DEFAULT_SITE_ORIGIN}/">Return to the Demokratia website</a></p>
  </main>
</body>
</html>`;
  return new Response(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

function appendNote(existing, note) {
  const next = clean(note, 300);
  if (!next) return existing || "";
  return clean(existing ? `${existing}; ${next}` : next, 1000);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
    const fullText = formData.get("fullTextFile");
    return {
      payload,
      photo: photo && typeof photo === "object" && "arrayBuffer" in photo ? photo : null,
      fullText: fullText && typeof fullText === "object" && "arrayBuffer" in fullText ? fullText : null
    };
  }

  return { payload: await request.json(), photo: null, fullText: null };
}

function validateFeedbackPayload(payload, env, hasPhotoUpload = false) {
  const pageUrl = normalizePageUrl(payload.pageUrl || payload.page_url || payload.url, env);
  const fallbackSlug = slugFromPageUrl(pageUrl);
  const pageTitle = clean(payload.pageTitle || payload.page_title || payload.title || fallbackSlug, 300);
  const pageSlug = clean(payload.pageSlug || payload.page_slug || fallbackSlug, 180);
  const paperTitle = clean(payload.paperTitle || payload.paper_title || "", 300);
  const doi = normalizeDoi(clean(payload.doi || "", 240));
  const comment = clean(payload.comment || payload.message || payload.notes, FEEDBACK_COMMENT_MAX_LENGTH);
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

async function validateFeedbackFullText(fullText, payload, env) {
  if (!fullText || !fullText.size) return null;

  const type = clean(fullText.type || payload.fullTextType || payload.full_text_type || "", 80).toLowerCase();
  if (type && type !== "application/pdf" && type !== "application/x-pdf" && type !== "application/octet-stream") {
    throw new Error("Full text upload must be a PDF file.");
  }

  const maxBytes = parseIntEnv(env.PAGE_FEEDBACK_FULLTEXT_MAX_BYTES, DEFAULT_FEEDBACK_FULLTEXT_MAX_BYTES);
  if (fullText.size > maxBytes) {
    throw new Error(`Full text PDF is too large. Maximum size is ${Math.floor(maxBytes / 1024 / 1024)}MB.`);
  }

  const name = clean(fullText.name || payload.fullTextName || payload.full_text_name || "full-text.pdf", 180);
  if (!/\.pdf$/i.test(name)) {
    throw new Error("Full text upload must use a .pdf filename.");
  }

  const bytes = new Uint8Array(await fullText.arrayBuffer());
  if (
    bytes.length < 5
    || bytes[0] !== 0x25
    || bytes[1] !== 0x50
    || bytes[2] !== 0x44
    || bytes[3] !== 0x46
    || bytes[4] !== 0x2d
  ) {
    throw new Error("Full text upload must be a valid PDF file.");
  }

  return {
    bytes,
    type: type && type !== "application/octet-stream" ? type : "application/pdf",
    name,
    size: fullText.size
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

function feedbackFullTextPath(feedback, submittedDate, submittedAt, ipHash, env) {
  const baseDir = String(env.FEEDBACK_FULLTEXT_DIR || DEFAULT_FEEDBACK_FULLTEXT_DIR)
    .trim()
    .replace(/^\/+|\/+$/g, "") || DEFAULT_FEEDBACK_FULLTEXT_DIR;
  const slug = safePathPart(feedback.pageSlug || slugFromPageUrl(feedback.pageUrl) || "paper");
  const stamp = submittedAt.replace(/\D/g, "").slice(0, 14);
  const suffix = ipHash.slice(0, 12) || "upload";
  return `${baseDir}/${submittedDate}/${stamp}-${slug}-${suffix}.pdf`;
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

async function saveFeedbackFullText(path, fullTextMeta, env) {
  const github = githubConfig(env, "FEEDBACK_FULLTEXT_DIR", DEFAULT_FEEDBACK_FULLTEXT_DIR);
  github.path = path;
  const response = await saveGitHubFile(
    github,
    fullTextMeta.bytes,
    `Add page feedback full text PDF for ${path.split("/").pop()}`
  );

  if (response.status === 409) return;
  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`GitHub full text upload failed: ${response.status} ${detail}`);
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

function parseIntBounded(value, fallback, min, max) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function timestampMs(value) {
  const raw = String(value || "").trim();
  if (!raw) return Number.NaN;
  const normalized = raw.replace(/([+-]\d{2})(\d{2})$/, "$1:$2");
  const parsed = Date.parse(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}
