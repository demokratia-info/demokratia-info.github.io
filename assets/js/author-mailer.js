(() => {
  const root = document.querySelector("[data-author-mailer]");
  if (!root) return;

  const endpoint = (root.dataset.endpoint || "").trim();
  const loginForm = document.querySelector("[data-author-mailer-login]");
  const dashboard = document.querySelector("[data-author-mailer-dashboard]");
  const statusBox = document.querySelector("[data-author-mailer-status]");
  const list = document.querySelector("[data-author-mailer-list]");
  const counts = document.querySelector("[data-author-mailer-counts]");
  const filter = document.querySelector("[data-author-mailer-filter]");
  const refreshButton = document.querySelector("[data-author-mailer-refresh]");

  const ACTIVE_STATUSES = ["pending_editor_release", "ready_to_send", "failed"];
  let editorPassword = "";
  let rows = [];

  const setStatus = (message, type = "info") => {
    if (!statusBox) return;
    statusBox.hidden = false;
    statusBox.textContent = message;
    statusBox.dataset.type = type;
  };

  const clearStatus = () => {
    if (statusBox) statusBox.hidden = true;
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
    const date = new Date(value.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
    if (Number.isNaN(date.getTime())) return value;
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "Asia/Jerusalem"
    }).format(date);
  };

  const groupRows = (sourceRows) => {
    const groups = new Map();
    sourceRows.forEach((row) => {
      const key = `${row.authorKey || ""}|${row.email || ""}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(row);
    });
    return [...groups.values()].sort((left, right) => {
      const a = left[0].nameEn || left[0].nameHe || "";
      const b = right[0].nameEn || right[0].nameHe || "";
      return a.localeCompare(b);
    });
  };

  const visibleRows = () => {
    const mode = filter ? filter.value : "active";
    if (mode === "active") return rows.filter((row) => ACTIVE_STATUSES.includes(row.status));
    return rows.filter((row) => row.status === mode);
  };

  const renderCounts = () => {
    if (!counts) return;
    counts.textContent = "";
    ACTIVE_STATUSES.forEach((status) => {
      const item = document.createElement("span");
      item.className = `feedback-editor-count status-${status}`;
      item.textContent = `${status}: ${rows.filter((row) => row.status === status).length}`;
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

  const emailPreview = (group) => {
    const name = group[0].nameEn || group[0].nameHe || "Professor";
    const links = group
      .filter((row) => row.status === "ready_to_send")
      .map((row, index) => `${index + 1}. ${row.paperTitleHe || row.paperTitleEn}\n   ${row.paperUrl}`)
      .join("\n");
    return `שלום ${name},\n\nבאתר "הנגשת מידע בנושאי דמוקרטיה" פרסמנו תמצית/תמציות בעברית של מאמר/ים אקדמיים שלך:\n\n${links || "[בחרו לפחות מאמר אחד לשליחה]"}\n\nנשמח לקבל הערות או תיקונים. אם אינך מעוניין/ת שהתמצית תופיע באתר, אפשר להודיע לנו ונפעל להסיר אותה במהירות.\n\n---\n\nDear ${name},\n\nWe published Hebrew summary page(s) for your academic paper(s) on the Demokratia website.\n\nPlease reply with corrections or removal requests.`;
  };

  const rowControl = (row) => {
    const wrapper = document.createElement("label");
    wrapper.className = "author-mailer-paper";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = row.status === "ready_to_send";
    checkbox.dataset.rowIndex = row.rowIndex;

    const content = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = row.paperTitleHe || row.paperTitleEn || row.paperSlug;
    const link = document.createElement("a");
    link.href = row.paperUrl;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = row.paperUrl || "";
    content.append(title, document.createElement("br"), link);

    wrapper.append(checkbox, content);
    return wrapper;
  };

  const renderGroup = (group) => {
    const first = group[0];
    const card = document.createElement("article");
    card.className = "feedback-editor-card author-mailer-card";

    const header = document.createElement("div");
    header.className = "feedback-editor-card-header";
    const title = document.createElement("h2");
    title.textContent = first.nameEn || first.nameHe || "מחבר/ת ללא שם";
    const badge = document.createElement("span");
    badge.className = "feedback-editor-status-badge";
    badge.textContent = `${group.length} summaries`;
    header.append(title, badge);
    card.append(header);

    appendIfPresent(card, field("שם בעברית", first.nameHe));
    appendIfPresent(card, field("שיוך", first.affiliation));
    appendIfPresent(card, field("דוא\"ל", first.email, "latin"));

    if (first.emailSourceUrl) {
      const source = document.createElement("a");
      source.className = "feedback-editor-page-link";
      source.href = first.emailSourceUrl;
      source.target = "_blank";
      source.rel = "noopener noreferrer";
      source.textContent = first.emailSourceUrl;
      card.append(source);
    }

    const papers = document.createElement("div");
    papers.className = "author-mailer-papers";
    group.forEach((row) => papers.append(rowControl(row)));
    card.append(papers);

    const notesLabel = document.createElement("label");
    notesLabel.className = "form-label";
    notesLabel.textContent = "הערת עורך פנימית";
    const notes = document.createElement("textarea");
    notes.className = "form-control feedback-editor-notes";
    notes.dir = "auto";
    notes.value = group.find((row) => row.editorNotes)?.editorNotes || "";
    notesLabel.append(notes);
    card.append(notesLabel);

    const preview = document.createElement("pre");
    preview.className = "author-mailer-preview";
    preview.textContent = emailPreview(group);
    card.append(preview);

    const save = document.createElement("button");
    save.className = "button-primary";
    save.type = "button";
    save.textContent = "שמירת סימון לשליחה";
    save.addEventListener("click", async () => {
      save.disabled = true;
      setStatus("שומר סימון...", "info");
      try {
        const controls = [...card.querySelectorAll("input[type='checkbox'][data-row-index]")];
        const updates = controls.map((control) => {
          const row = group.find((item) => String(item.rowIndex) === control.dataset.rowIndex);
          return apiRequest("PATCH", {
            rowIndex: row.rowIndex,
            updatedAt: row.updatedAt,
            authorKey: row.authorKey,
            paperSlug: row.paperSlug,
            status: control.checked ? "ready_to_send" : "pending_editor_release",
            editorNotes: notes.value
          });
        });
        await Promise.all(updates);
        await loadRows();
        setStatus("הסימון נשמר.", "info");
      } catch (error) {
        setStatus(error.message || "לא ניתן היה לשמור את הסימון.", "error");
      } finally {
        save.disabled = false;
      }
    });
    card.append(save);

    appendIfPresent(card, field("עודכן", formatDate(first.updatedAt)));
    return card;
  };

  const render = () => {
    if (!list) return;
    list.textContent = "";
    renderCounts();
    const groups = groupRows(visibleRows());
    if (!groups.length) {
      const empty = document.createElement("p");
      empty.className = "feedback-editor-empty";
      empty.textContent = "אין רשומות בתצוגה הנוכחית.";
      list.append(empty);
      return;
    }
    groups.forEach((group) => list.append(renderGroup(group)));
  };

  const loadRows = async () => {
    if (!endpoint) {
      setStatus("מסך הודעות המחברים עדיין לא מחובר ל-Worker.", "error");
      return;
    }
    setStatus("טוען את תור ההודעות...", "info");
    const result = await apiRequest("GET");
    rows = Array.isArray(result.rows) ? result.rows : [];
    if (loginForm) loginForm.hidden = true;
    if (dashboard) dashboard.hidden = false;
    clearStatus();
    render();
  };

  if (loginForm) {
    loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const field = loginForm.elements.namedItem("editorPassword");
      editorPassword = field && "value" in field ? String(field.value) : "";
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

  if (filter) {
    filter.addEventListener("change", render);
  }
})();
