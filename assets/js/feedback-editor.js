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

  let editorPassword = "";
  let rows = [];

  const STATUS_LABELS = {
    pending: "pending",
    approved_for_update: "approved_for_update",
    rejected: "rejected",
    applied: "applied"
  };

  const EDITABLE_STATUSES = ["pending", "approved_for_update", "rejected"];

  const setStatus = (message, type = "info") => {
    if (!statusBox) return;
    statusBox.hidden = false;
    statusBox.textContent = message;
    statusBox.dataset.type = type;
  };

  const clearStatus = () => {
    if (statusBox) statusBox.hidden = true;
  };

  const readPassword = () => {
    const field = loginForm && loginForm.elements.namedItem("editorPassword");
    return field && "value" in field ? String(field.value) : "";
  };

  const apiRequest = async (method, payload) => {
    const headers = {
      "Accept": "application/json",
      "Authorization": `Bearer ${editorPassword}`
    };
    const options = { method, headers };
    if (payload) {
      headers["Content-Type"] = "application/json";
      options.body = JSON.stringify(payload);
    }

    const response = await fetch(endpoint, options);
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || "לא ניתן היה לבצע את הפעולה.");
    }
    return result;
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
    const slots = [0, 6, 12, 18];
    const nextHour = slots.find((slot) => hour < slot || (hour === slot && minute < 5));
    if (nextHour === undefined) return "סבב העדכון האוטומטי הבא: מחר 00:05 (שעון ישראל).";
    return `סבב העדכון האוטומטי הבא: היום ${String(nextHour).padStart(2, "0")}:05 (שעון ישראל).`;
  };

  const setNextRound = () => {
    if (nextRound) nextRound.textContent = nextRevisionText();
  };

  const visibleRows = () => {
    const mode = filter ? filter.value : "active";
    if (mode === "all") return rows;
    if (mode === "active") {
      return rows.filter((row) => row.status === "pending" || row.status === "approved_for_update");
    }
    return rows.filter((row) => row.status === mode);
  };

  const renderCounts = () => {
    if (!counts) return;
    counts.textContent = "";
    const statuses = ["pending", "approved_for_update", "rejected", "applied"];
    statuses.forEach((status) => {
      const item = document.createElement("span");
      item.className = `feedback-editor-count status-${status}`;
      item.textContent = `${STATUS_LABELS[status]}: ${rows.filter((row) => row.status === status).length}`;
      counts.append(item);
    });
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

  const renderRow = (row) => {
    const card = document.createElement("article");
    card.className = `feedback-editor-card status-${row.status || "unknown"}`;

    const header = document.createElement("div");
    header.className = "feedback-editor-card-header";
    const title = document.createElement("h2");
    title.textContent = row.pageTitle || row.pageSlug || "עמוד ללא כותרת";
    const badge = document.createElement("span");
    badge.className = "feedback-editor-status-badge";
    badge.textContent = row.status || "unknown";
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

    const controls = document.createElement("div");
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
        rows = rows.map((item) => item.rowIndex === row.rowIndex ? result.row : item);
        render();
        setStatus("הסטטוס נשמר.", "info");
      } catch (error) {
        setStatus(error.message || "לא ניתן היה לשמור את הסטטוס.", "error");
      } finally {
        save.disabled = false;
      }
    });

    controls.append(statusLabel, notesLabel, save);

    card.append(header);
    appendIfPresent(card, field("נשלח", formatDate(row.submittedAt)));
    if (row.pageUrl) card.append(pageLink);
    appendIfPresent(card, field("שם המאמר", row.paperTitle, "latin"));
    appendIfPresent(card, field("DOI", row.doi, "latin"));
    appendIfPresent(card, field("דואר אלקטרוני", row.submitterEmail, "latin"));
    appendIfPresent(card, field("טלפון", row.submitterPhone, "latin"));
    card.append(comment, controls);
    return card;
  };

  const render = () => {
    if (!list) return;
    list.textContent = "";
    renderCounts();
    const filteredRows = visibleRows();
    if (!filteredRows.length) {
      const empty = document.createElement("p");
      empty.className = "feedback-editor-empty";
      empty.textContent = "אין הערות בתצוגה הנוכחית.";
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
    rows = Array.isArray(result.rows) ? result.rows : [];
    if (loginForm) loginForm.hidden = true;
    if (dashboard) dashboard.hidden = false;
    clearStatus();
    setNextRound();
    render();
  };

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      editorPassword = readPassword();
      try {
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
      } catch (error) {
        setStatus(error.message || "לא ניתן היה לרענן את התור.", "error");
      }
    });
  }

  if (filter) filter.addEventListener("change", render);
  setNextRound();
})();
