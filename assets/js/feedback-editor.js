(() => {
  const root = document.querySelector("[data-feedback-editor]");
  if (!root) return;

  const endpoint = (root.dataset.endpoint || "").trim();
  const loginForm = document.querySelector("[data-feedback-editor-login]");
  const dashboard = document.querySelector("[data-feedback-editor-dashboard]");
  const statusBox = document.querySelector("[data-feedback-editor-status]");
  const list = document.querySelector("[data-feedback-editor-list]");
  const counts = document.querySelector("[data-feedback-editor-counts]");
  const filter = document.querySelector("[data-feedback-editor-filter]");
  const refreshButton = document.querySelector("[data-feedback-editor-refresh]");
  const nextRound = document.querySelector("[data-feedback-editor-next]");
  const historyHours = Number.parseInt(root.dataset.historyHours || "48", 10) || 48;
  const QUEUE_TIMEOUT_MS = 120000;

  let editorPassword = "";
  let queueRows = [];
  let historyRows = [];
  let historyLoaded = false;

  const STATUS_LABELS = {
    pending: "pending בתור",
    approved_for_update: "approved_for_update בתור",
    rejected: "rejected בתור",
    applied: `applied ב-${historyHours} שעות`,
    rejected_history: `rejected שטופלו ב-${historyHours} שעות`
  };

  const EDITABLE_STATUSES = ["pending", "approved_for_update", "rejected"];
  const SUBMITTER_ROLE_LABELS = {
    paper_author: "מחבר/ת המאמר",
    field_researcher: "חוקר/ת אחר/ת בתחום",
    other_or_prefer_not: "אחר או מעדיפ/ה לא לשתף"
  };

  const setStatus = (message, type = "info") => {
    if (!statusBox) return;
    statusBox.hidden = false;
    statusBox.textContent = message;
    statusBox.dataset.type = type;
  };

  const clearStatus = () => {
    if (statusBox) statusBox.hidden = true;
  };

  const preconnectWorker = () => {
    if (!endpoint) return;
    try {
      const origin = new URL(endpoint).origin;
      ["dns-prefetch", "preconnect"].forEach((rel) => {
        const link = document.createElement("link");
        link.rel = rel;
        link.href = origin;
        if (rel === "preconnect") link.crossOrigin = "";
        document.head.append(link);
      });
    } catch (error) {
      // Malformed endpoints are reported by the visible editor status.
    }
  };

  const readPassword = () => {
    const field = loginForm && loginForm.elements.namedItem("editorPassword");
    return field && "value" in field ? String(field.value) : "";
  };

  const timeoutMessage = (requestUrl) => (
    requestUrl.includes("/auth")
      ? "אימות הסיסמה נמשך יותר מדי זמן. נסו שוב."
      : "טעינת התור נמשכת יותר מדי זמן. ייתכן שיש בעיה זמנית בגישה לתור הפרטי או ל-GitHub. נסו לרענן בעוד דקה."
  );

  const apiRequest = async (method, payload, requestUrl = endpoint, timeoutMs = QUEUE_TIMEOUT_MS) => {
    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${editorPassword}`
    };
    const options = { method, headers };
    if (payload) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }

    const controller = "AbortController" in window ? new AbortController() : null;
    const timer = controller
      ? window.setTimeout(() => controller.abort(), timeoutMs)
      : null;
    if (controller) options.signal = controller.signal;

    try {
      const response = await fetch(requestUrl, options);
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "לא ניתן היה לבצע את הפעולה.");
      }
      return result;
    } catch (error) {
      if (error && error.name === "AbortError") {
        throw new Error(timeoutMessage(requestUrl));
      }
      throw error;
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  };

  const formatDate = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Jerusalem"
    }).format(date);
  };

  const nextRevisionText = () => {
    const now = new Date();
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Jerusalem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    }).formatToParts(now);
    const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    const hour = Number.parseInt(values.hour || "0", 10);
    const minute = Number.parseInt(values.minute || "0", 10);
    const slots = [0, 3, 6, 9, 12, 15, 18, 21];
    const nextHour = slots.find((slot) => hour < slot || (hour === slot && minute < 5));
    if (nextHour === undefined) return "סבב העדכון האוטומטי הבא: מחר 00:05 (שעון ישראל).";
    return `סבב העדכון האוטומטי הבא: היום ${String(nextHour).padStart(2, "0")}:05 (שעון ישראל).`;
  };

  const setNextRound = () => {
    if (nextRound) nextRound.textContent = nextRevisionText();
  };

  const currentMode = () => filter ? filter.value : "all_queue";

  const requiresHistory = (mode = currentMode()) => (
    mode === "recent_handled"
    || mode === "applied_recent"
    || mode === "rejected_recent"
  );

  const historyEndpoint = () => {
    const base = endpoint.replace(/\/+$/, "");
    return `${base}/history?hours=${encodeURIComponent(String(historyHours))}`;
  };

  const visibleRows = () => {
    const mode = currentMode();
    if (mode === "all_queue") return queueRows;
    if (mode === "recent_handled") {
      return historyRows.filter((row) => row.status === "applied" || row.status === "rejected");
    }
    if (mode === "applied_recent") {
      return historyRows.filter((row) => row.status === "applied");
    }
    if (mode === "rejected_recent") {
      return historyRows.filter((row) => row.status === "rejected");
    }
    return queueRows.filter((row) => row.status === mode);
  };

  const renderCounts = () => {
    if (!counts) return;
    counts.textContent = "";
    const queueStatuses = ["pending", "approved_for_update", "rejected"];
    queueStatuses.forEach((status) => {
      const item = document.createElement("span");
      item.className = `feedback-editor-count status-${status}`;
      item.textContent = `${STATUS_LABELS[status]}: ${queueRows.filter((row) => row.status === status).length}`;
      counts.append(item);
    });
    if (historyLoaded) {
      const applied = document.createElement("span");
      applied.className = "feedback-editor-count status-applied";
      applied.textContent = `${STATUS_LABELS.applied}: ${historyRows.filter((row) => row.status === "applied").length}`;
      const rejected = document.createElement("span");
      rejected.className = "feedback-editor-count status-rejected";
      rejected.textContent = `${STATUS_LABELS.rejected_history}: ${historyRows.filter((row) => row.status === "rejected").length}`;
      counts.append(applied, rejected);
    }
  };

  const field = (label, value, className = "") => {
    if (!value) return null;
    const wrapper = document.createElement("p");
    wrapper.className = `feedback-editor-field ${className}`.trim();
    const labelEl = document.createElement("strong");
    labelEl.textContent = `${label}: `;
    const valueEl = document.createElement("span");
    valueEl.dir = "auto";
    valueEl.textContent = value;
    wrapper.append(labelEl, valueEl);
    return wrapper;
  };

  const appendIfPresent = (parent, child) => {
    if (child) parent.append(child);
  };

  const formatBytes = (value) => {
    const bytes = Number.parseInt(String(value || "0"), 10);
    if (!Number.isFinite(bytes) || bytes <= 0) return "";
    if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
    return `${Math.ceil(bytes / 1024)} KB`;
  };

  const photoEndpoint = (path) => {
    const base = endpoint.replace(/\/+$/, "");
    return `${base}/photo?path=${encodeURIComponent(path)}`;
  };

  const loadPhotoPreview = async (row, image, button) => {
    if (!row.suggestedPhotoPath) return;
    if (button) button.disabled = true;
    try {
      const response = await fetch(photoEndpoint(row.suggestedPhotoPath), {
        headers: {
          "Authorization": `Bearer ${editorPassword}`
        }
      });
      if (!response.ok) throw new Error("לא ניתן היה לטעון את התמונה.");
      const blob = await response.blob();
      image.src = URL.createObjectURL(blob);
      image.hidden = false;
      if (button) button.hidden = true;
    } catch (error) {
      setStatus(error.message || "לא ניתן היה לטעון את התמונה.", "error");
      if (button) button.disabled = false;
    }
  };

  const renderPhoto = (row) => {
    if (!row.suggestedPhotoPath) return null;

    const wrapper = document.createElement("section");
    wrapper.className = "feedback-editor-photo";

    const heading = document.createElement("h3");
    heading.textContent = "תמונה מוצעת";

    const meta = document.createElement("p");
    meta.className = "feedback-editor-field latin";
    const dimensions = row.suggestedPhotoWidth && row.suggestedPhotoHeight
      ? `${row.suggestedPhotoWidth}x${row.suggestedPhotoHeight}`
      : "";
    meta.textContent = [
      row.suggestedPhotoName || "",
      dimensions,
      formatBytes(row.suggestedPhotoSize),
      row.suggestedPhotoType || ""
    ].filter(Boolean).join(" | ");

    const path = document.createElement("p");
    path.className = "feedback-editor-field latin";
    path.textContent = row.suggestedPhotoPath;

    const note = document.createElement("p");
    note.className = "form-note";
    note.textContent = "כדי לאשר החלפת תמונה, בחרו approved_for_update. תהליך ההארטביט יבדוק שהתמונה אופקית, יחתוך יחס קרוב ל־4:3, וימיר אותה ל־800x600 לפני פרסום.";

    const image = document.createElement("img");
    image.className = "feedback-editor-photo-preview";
    image.alt = "תצוגה מקדימה של התמונה המוצעת";
    image.hidden = true;

    const button = document.createElement("button");
    button.className = "button-secondary";
    button.type = "button";
    button.textContent = "טעינת תצוגה מקדימה";
    button.addEventListener("click", () => loadPhotoPreview(row, image, button));

    wrapper.append(heading, meta, path, note, image, button);
    return wrapper;
  };

  const renderFullText = (row) => {
    if (!row.fullTextPath) return null;

    const wrapper = document.createElement("section");
    wrapper.className = "feedback-editor-upload";

    const heading = document.createElement("h3");
    heading.textContent = "טקסט מלא שהועלה";

    const meta = document.createElement("p");
    meta.className = "feedback-editor-field latin";
    meta.textContent = [
      row.fullTextName || "",
      formatBytes(row.fullTextSize),
      row.fullTextType || ""
    ].filter(Boolean).join(" | ");

    const path = document.createElement("p");
    path.className = "feedback-editor-field latin";
    path.textContent = row.fullTextPath;

    const note = document.createElement("p");
    note.className = "form-note";
    note.textContent = "הקובץ נשמר בתור הפרטי בלבד. תהליך ההארטביט הבא יוכל להשתמש בו ליצירת תקציר מעודכן על בסיס הטקסט המלא.";

    wrapper.append(heading, meta, path, note);
    return wrapper;
  };

  const renderRow = (row) => {
    const card = document.createElement("article");
    card.className = `feedback-editor-card status-${row.status || "unknown"} source-${row.source || "queue"}`;

    const header = document.createElement("div");
    header.className = "feedback-editor-card-header";
    const title = document.createElement("h2");
    title.textContent = row.pageTitle || row.pageSlug || "עמוד ללא כותרת";
    const badge = document.createElement("span");
    badge.className = "feedback-editor-status-badge";
    badge.textContent = row.source === "history" ? `${row.status || "unknown"} · history` : (row.status || "unknown");
    header.append(title, badge);

    const pageLink = document.createElement("a");
    pageLink.className = "feedback-editor-page-link";
    pageLink.href = row.pageUrl || "#";
    pageLink.target = "_blank";
    pageLink.rel = "noopener noreferrer";
    pageLink.textContent = row.pageUrl || "";

    const comment = document.createElement("p");
    comment.className = "feedback-editor-comment";
    comment.dir = "auto";
    comment.textContent = row.comment || "";

    let controls = null;

    if (row.source !== "history") {
      controls = document.createElement("div");
      controls.className = "feedback-editor-controls";

      const statusLabel = document.createElement("label");
      statusLabel.className = "form-label";
      statusLabel.textContent = "סטטוס";
      const statusSelect = document.createElement("select");
      statusSelect.className = "form-control";

      if (!EDITABLE_STATUSES.includes(row.status)) {
        const current = document.createElement("option");
        current.value = row.status || "";
        current.textContent = row.status || "unknown";
        current.selected = true;
        statusSelect.append(current);
      }

      EDITABLE_STATUSES.forEach((status) => {
        const option = document.createElement("option");
        option.value = status;
        option.textContent = status;
        option.selected = row.status === status;
        statusSelect.append(option);
      });
      statusLabel.append(statusSelect);

      const notesLabel = document.createElement("label");
      notesLabel.className = "form-label";
      notesLabel.textContent = "הערת עורך פנימית";
      const notes = document.createElement("textarea");
      notes.className = "form-control feedback-editor-notes";
      notes.dir = "auto";
      notes.value = row.editorNotes || "";
      notesLabel.append(notes);

      const save = document.createElement("button");
      save.className = "button-primary";
      save.type = "button";
      save.textContent = "שמירת סטטוס";
      save.addEventListener("click", async () => {
        save.disabled = true;
        setStatus("שומר את הסטטוס...", "info");
        try {
          const result = await apiRequest("PATCH", {
            rowIndex: row.rowIndex,
            submittedAt: row.submittedAt,
            pageUrl: row.pageUrl,
            comment: row.comment,
            status: statusSelect.value,
            editorNotes: notes.value
          });
          queueRows = queueRows.map((item) => item.rowIndex === row.rowIndex ? result.row : item);
          render();
          setStatus("הסטטוס נשמר.", "info");
        } catch (error) {
          setStatus(error.message || "לא ניתן היה לשמור את הסטטוס.", "error");
        } finally {
          save.disabled = false;
        }
      });

      controls.append(statusLabel, notesLabel, save);
    }

    card.append(header);
    appendIfPresent(card, field("נשלח", formatDate(row.submittedAt)));
    if (row.source === "history") {
      appendIfPresent(card, field("טופל", formatDate(row.processedAt || row.appliedAt)));
      appendIfPresent(card, field("הערת טיפול", row.processingNotes));
    }
    if (row.pageUrl) card.append(pageLink);
    appendIfPresent(card, field("שם המאמר", row.paperTitle, "latin"));
    appendIfPresent(card, field("DOI", row.doi, "latin"));
    appendIfPresent(card, field("מי את/ה", SUBMITTER_ROLE_LABELS[row.submitterRole] || row.submitterRole));
    appendIfPresent(card, field("דואר אלקטרוני", row.submitterEmail, "latin"));
    appendIfPresent(card, field("טלפון", row.submitterPhone, "latin"));
    card.append(comment);
    appendIfPresent(card, renderPhoto(row));
    appendIfPresent(card, renderFullText(row));
    if (controls) {
      card.append(controls);
    }
    return card;
  };

  const render = () => {
    if (!list) return;
    list.textContent = "";
    renderCounts();
    if (requiresHistory() && !historyLoaded) {
      const empty = document.createElement("p");
      empty.className = "feedback-editor-empty";
      empty.textContent = `תצוגת ההיסטוריה נטענת רק לפי דרישה ומוגבלת ל-${historyHours} השעות האחרונות.`;
      list.append(empty);
      return;
    }
    const filteredRows = visibleRows();
    if (!filteredRows.length) {
      const empty = document.createElement("p");
      empty.className = "feedback-editor-empty";
      empty.textContent = requiresHistory()
        ? `אין רשומות היסטוריה מתאימות ב-${historyHours} השעות האחרונות.`
        : "אין הערות בתצוגה הנוכחית.";
      list.append(empty);
      return;
    }
    filteredRows
      .slice()
      .reverse()
      .forEach((row) => list.append(renderRow(row)));
  };

  const loadRows = async () => {
    if (!endpoint) {
      setStatus("מסך העורכים עדיין לא מחובר ל-Worker.", "error");
      return;
    }
    setStatus("טוען את תור ההערות...", "info");
    const result = await apiRequest("GET");
    queueRows = Array.isArray(result.rows) ? result.rows : [];
    if (loginForm) loginForm.hidden = true;
    if (dashboard) dashboard.hidden = false;
    clearStatus();
    setNextRound();
    render();
  };

  const loadHistoryRows = async (force = false) => {
    if (historyLoaded && !force) return;
    setStatus(`טוען היסטוריה מ-${historyHours} השעות האחרונות...`, "info");
    const result = await apiRequest("GET", null, historyEndpoint());
    historyRows = Array.isArray(result.rows) ? result.rows : [];
    historyLoaded = true;
    clearStatus();
    render();
  };

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      editorPassword = readPassword();
      try {
        setStatus("בודק את סיסמת העורך וטוען את תור ההערות...", "info");
        await loadRows();
      } catch (error) {
        setStatus(error.message || "לא ניתן היה לטעון את התור.", "error");
      }
    });
  }

  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      try {
        await loadRows();
        if (requiresHistory()) await loadHistoryRows(true);
      } catch (error) {
        setStatus(error.message || "לא ניתן היה לרענן את התור.", "error");
      }
    });
  }

  if (filter) {
    filter.addEventListener("change", async () => {
      render();
      if (!requiresHistory()) return;
      try {
        await loadHistoryRows();
      } catch (error) {
        setStatus(error.message || "לא ניתן היה לטעון את ההיסטוריה.", "error");
      }
    });
  }
  preconnectWorker();
  setNextRound();
})();
