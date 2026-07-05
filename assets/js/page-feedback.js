(() => {
  const form = document.querySelector("[data-page-feedback-form]");
  if (!form) return;

  const endpoint = (form.dataset.endpoint || "").trim();
  const editorEndpoint = (form.dataset.editorEndpoint || "").trim();
  const editorAuthEndpoint = editorEndpoint ? `${editorEndpoint.replace(/\/+$/, "")}/auth` : "";
  const sourceOrigins = (form.dataset.sourceOrigins || window.location.origin)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!sourceOrigins.includes(window.location.origin)) sourceOrigins.push(window.location.origin);
  const homeUrl = form.dataset.homeUrl || "/";
  const dailyLimit = Number.parseInt(form.dataset.dailyLimit || "5", 10);
  const redirectDelayMs = Number.parseInt(form.dataset.redirectDelayMs || "5000", 10);
  const photoMaxBytes = Number.parseInt(form.dataset.photoMaxBytes || "8388608", 10);
  const submitButton = form.querySelector("[type='submit']");
  const editorPasswordField = form.elements.namedItem("editorPassword");
  const photoInput = form.elements.namedItem("suggestedPhoto");
  const status = document.querySelector("[data-page-feedback-status]");
  const photoStatus = document.querySelector("[data-page-feedback-photo-status]");
  const thankYou = document.querySelector("[data-page-feedback-thank-you]");
  const thankYouText = document.querySelector("[data-page-feedback-thank-you-text]");
  const source = document.querySelector("[data-page-feedback-source]");
  const sourceLink = document.querySelector("[data-page-feedback-url]");
  const editorAuthButton = document.querySelector("[data-summary-editor-auth]");
  const editorAuthStatus = document.querySelector("[data-summary-editor-auth-status]");
  const summaryEditor = document.querySelector("[data-summary-editor]");
  const summaryEditorLoadButton = document.querySelector("[data-summary-editor-load]");
  const summaryEditorFields = document.querySelector("[data-summary-editor-fields]");
  const summaryEditorActions = document.querySelector("[data-summary-editor-actions]");
  const summaryEditorSaveButton = document.querySelector("[data-summary-editor-save]");
  const summaryEditorResetButton = document.querySelector("[data-summary-editor-reset]");
  const summaryEditorStatus = document.querySelector("[data-summary-editor-status]");
  const params = new URLSearchParams(window.location.search);
  const normalThankYouMessage = "ההערה התקבלה ותיבדק לפני כל שינוי באתר. בעוד כמה שניות תחזרו לעמוד שממנו נשלחה ההערה.";
  const approvedThankYouMessage = "ההערה התקבלה וסומנה כמאושרת לעדכון. בעוד כמה שניות תחזרו לעמוד שממנו נשלחה ההערה.";
  const editorRevisionThankYouMessage = "עריכת העמוד נשמרה כעדכון מאושר. תהליך ההארטביט הבא יחיל אותה לאחר בדיקה, ובעוד כמה שניות תחזרו לעמוד המאמר.";
  let editorPasswordVerified = false;

  const todayKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const storageKey = () => `pageFeedback:${todayKey()}`;

  const localSubmissionCount = () => {
    try {
      return Number.parseInt(window.localStorage.getItem(storageKey()) || "0", 10) || 0;
    } catch {
      return 0;
    }
  };

  const setLocalSubmissionCount = (count) => {
    try {
      window.localStorage.setItem(storageKey(), String(count));
    } catch {
      // The Worker is authoritative; local storage is only a friendly hint.
    }
  };

  const setStatus = (message, type = "info") => {
    if (!status) return;
    status.hidden = false;
    status.textContent = message;
    status.dataset.type = type;
  };

  const setPhotoStatus = (message, type = "info") => {
    if (!photoStatus) return;
    if (!message) {
      photoStatus.hidden = true;
      photoStatus.textContent = "";
      return;
    }
    photoStatus.hidden = false;
    photoStatus.textContent = message;
    photoStatus.dataset.type = type;
  };

  const setPanelStatus = (element, message, type = "info") => {
    if (!element) return;
    if (!message) {
      element.hidden = true;
      element.textContent = "";
      return;
    }
    element.hidden = false;
    element.textContent = message;
    element.dataset.type = type;
  };

  const readField = (name) => {
    const field = form.elements.namedItem(name);
    return field && "value" in field ? String(field.value).trim() : "";
  };

  const setField = (name, value) => {
    const field = form.elements.namedItem(name);
    if (field && "value" in field) field.value = value || "";
  };

  const allowedSourceUrl = (value) => {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.origin);
      return sourceOrigins.includes(url.origin) ? url.toString() : "";
    } catch {
      return "";
    }
  };

  const sourcePageUrl = allowedSourceUrl(params.get("page") || params.get("pageUrl"))
    || allowedSourceUrl(document.referrer);
  const slugFromUrl = (value) => {
    try {
      const filename = new URL(value).pathname.split("/").filter(Boolean).pop() || "";
      return decodeURIComponent(filename).replace(/\.html$/i, "");
    } catch {
      return "";
    }
  };
  const sourcePageTitle = (params.get("title") || params.get("pageTitle") || "").trim();
  const sourcePageSlug = (params.get("slug") || slugFromUrl(sourcePageUrl)).trim();
  const sourcePaperTitle = (params.get("paper") || params.get("paperTitle") || "").trim();
  const sourceDoi = (params.get("doi") || "").trim();

  setField("pageUrl", sourcePageUrl);
  setField("pageTitle", sourcePageTitle);
  setField("pageSlug", sourcePageSlug);
  setField("paperTitle", sourcePaperTitle);
  setField("doi", sourceDoi);

  if (sourcePageUrl && sourceLink) {
    sourceLink.href = sourcePageUrl;
    sourceLink.textContent = sourcePageTitle || sourcePageUrl;
    if (source) source.hidden = false;
  }

  const disableForm = (message) => {
    if (submitButton) submitButton.disabled = true;
    setStatus(message, "error");
  };

  if (!sourcePageUrl) {
    disableForm("לא ניתן לזהות את העמוד שאליו מתייחסת ההערה. חזרו לעמוד הרלוונטי ופתחו ממנו את הקישור להערות.");
    return;
  }

  if (!endpoint) {
    disableForm("טופס ההערות עדיין לא מחובר. נסו שוב מאוחר יותר.");
    return;
  }

  const safeRedirectUrl = () => allowedSourceUrl(readField("pageUrl")) || homeUrl;

  const hasEditorPassword = () => Boolean(readField("editorPassword"));

  const selectedPhoto = () => {
    if (!photoInput || !("files" in photoInput) || !photoInput.files.length) return null;
    return photoInput.files[0];
  };

  const readPhotoMeta = () => new Promise((resolve, reject) => {
    const file = selectedPhoto();
    if (!file) {
      setPhotoStatus("");
      resolve(null);
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      reject(new Error("אפשר להעלות תמונת JPEG, PNG או WebP בלבד."));
      return;
    }

    if (file.size > photoMaxBytes) {
      const maxMb = Math.floor(photoMaxBytes / 1024 / 1024);
      reject(new Error(`התמונה גדולה מדי. הגודל המרבי הוא ${maxMb}MB.`));
      return;
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const width = image.naturalWidth || 0;
      const height = image.naturalHeight || 0;
      if (!width || !height) {
        reject(new Error("לא ניתן לקרוא את ממדי התמונה."));
        return;
      }
      if (width <= height) {
        reject(new Error("יש להעלות תמונת רוחב בלבד."));
        return;
      }
      const ratio = width / height;
      const ratioError = Math.abs(ratio - (4 / 3)) / (4 / 3);
      const ratioText = ratioError <= 0.04
        ? "היחס קרוב ל־4:3."
        : "היחס אינו 4:3 במדויק; אם התמונה תאושר, היא תיחתך בעדינות לפני פרסום.";
      setPhotoStatus(`תמונה נבחרה: ${width}x${height}. ${ratioText}`, "info");
      resolve({ width, height, type: file.type, size: file.size });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("לא ניתן לקרוא את קובץ התמונה."));
    };
    image.src = objectUrl;
  });

  const elementText = (element) => (element ? element.textContent.replace(/\s+/g, " ").trim() : "");
  const elementHtml = (element) => (element ? element.innerHTML.replace(/\s+/g, " ").trim() : "");

  const summaryFromDocument = (documentHtml) => {
    const parsed = new DOMParser().parseFromString(documentHtml, "text/html");
    const main = parsed.querySelector(".paper-main");
    if (!main) {
      throw new Error("לא ניתן היה לזהות את מבנה עמוד המאמר.");
    }

    const sections = Array.from(main.children)
      .filter((child) => child.tagName && child.tagName.toLowerCase() === "section")
      .map((section) => ({
        headingHe: elementText(section.querySelector("h2")),
        paragraphsHtml: Array.from(section.querySelectorAll("p"))
          .map(elementHtml)
          .filter(Boolean)
      }))
      .filter((section) => section.headingHe || section.paragraphsHtml.length);

    return {
      titleHe: elementText(main.querySelector("h1")) || sourcePageTitle,
      subtitleHe: elementText(main.querySelector(".subtitle")),
      oneLinerHtml: elementHtml(main.querySelector(".one-liner")),
      sections
    };
  };

  const makeEditorField = ({ label, value = "", fieldName = "", multiline = false, className = "", dir = "auto" }) => {
    const wrapper = document.createElement("div");
    wrapper.className = "form-field";
    const id = `summaryEditor-${fieldName}-${Math.random().toString(16).slice(2)}`;
    const labelEl = document.createElement("label");
    labelEl.className = "form-label";
    labelEl.htmlFor = id;
    labelEl.textContent = label;
    const control = document.createElement(multiline ? "textarea" : "input");
    control.className = `form-control ${className}`.trim();
    control.id = id;
    control.dir = dir;
    control.dataset.summaryEditorField = fieldName;
    if (!multiline) control.type = "text";
    control.value = value || "";
    wrapper.append(labelEl, control);
    return wrapper;
  };

  const renderSummaryEditor = (summary) => {
    if (!summaryEditorFields || !summaryEditorActions) return;
    summaryEditorFields.textContent = "";
    summaryEditorFields.hidden = false;
    summaryEditorActions.hidden = false;

    summaryEditorFields.append(
      makeEditorField({ label: "כותרת העמוד", value: summary.titleHe, fieldName: "titleHe" }),
      makeEditorField({ label: "כותרת משנה", value: summary.subtitleHe, fieldName: "subtitleHe" }),
      makeEditorField({
        label: "שורת פתיחה",
        value: summary.oneLinerHtml,
        fieldName: "oneLinerHtml",
        multiline: true,
        className: "summary-editor-textarea"
      })
    );

    summary.sections.forEach((section, index) => {
      const wrapper = document.createElement("section");
      wrapper.className = "summary-editor-section";
      wrapper.dataset.summaryEditorSection = String(index);
      const heading = document.createElement("h3");
      heading.textContent = `סעיף ${index + 1}`;
      const paragraphs = section.paragraphsHtml.join("\n\n");
      wrapper.append(
        heading,
        makeEditorField({
          label: "כותרת סעיף",
          value: section.headingHe,
          fieldName: "sectionHeading",
          className: "summary-editor-section-heading"
        }),
        makeEditorField({
          label: "פסקאות הסעיף",
          value: paragraphs,
          fieldName: "sectionParagraphs",
          multiline: true,
          className: "summary-editor-textarea summary-editor-paragraphs"
        })
      );
      summaryEditorFields.append(wrapper);
    });
  };

  const loadSummaryEditor = async () => {
    if (!summaryEditorFields || !summaryEditorActions) return;
    setPanelStatus(summaryEditorStatus, "טוען את עמוד המאמר לעריכה...", "info");
    if (summaryEditorLoadButton) summaryEditorLoadButton.disabled = true;
    if (summaryEditorResetButton) summaryEditorResetButton.disabled = true;

    try {
      const response = await fetch(sourcePageUrl, {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin"
      });
      if (!response.ok) throw new Error("לא ניתן היה לטעון את עמוד המאמר.");
      renderSummaryEditor(summaryFromDocument(await response.text()));
      setPanelStatus(summaryEditorStatus, "התקציר נטען. אפשר לערוך את הטקסט ולשמור כעדכון מאושר.", "info");
    } catch (error) {
      summaryEditorFields.hidden = true;
      summaryEditorActions.hidden = true;
      setPanelStatus(summaryEditorStatus, error.message || "לא ניתן היה לטעון את התקציר לעריכה.", "error");
    } finally {
      if (summaryEditorLoadButton) summaryEditorLoadButton.disabled = false;
      if (summaryEditorResetButton) summaryEditorResetButton.disabled = false;
    }
  };

  const readEditorControl = (fieldName, root = summaryEditorFields) => {
    const control = root && root.querySelector(`[data-summary-editor-field="${fieldName}"]`);
    return control && "value" in control ? String(control.value).trim() : "";
  };

  const paragraphsFromEditorText = (value) => String(value || "")
    .replace(/\r/g, "")
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.replace(/\s*\n\s*/g, " ").trim())
    .filter(Boolean);

  const collectSummaryRevision = () => {
    if (!summaryEditorFields || summaryEditorFields.hidden) {
      throw new Error("יש לטעון את התקציר לפני שמירת העריכה.");
    }

    const titleHe = readEditorControl("titleHe");
    const oneLinerHtml = readEditorControl("oneLinerHtml");
    const sections = Array.from(summaryEditorFields.querySelectorAll("[data-summary-editor-section]"))
      .map((section) => ({
        headingHe: readEditorControl("sectionHeading", section),
        paragraphsHtml: paragraphsFromEditorText(readEditorControl("sectionParagraphs", section))
      }))
      .filter((section) => section.headingHe || section.paragraphsHtml.length);

    if (!titleHe) throw new Error("כותרת העמוד אינה יכולה להיות ריקה.");
    if (!oneLinerHtml) throw new Error("שורת הפתיחה אינה יכולה להיות ריקה.");
    if (!sections.length) throw new Error("יש להשאיר לפחות סעיף אחד בתקציר.");
    for (const section of sections) {
      if (!section.headingHe || !section.paragraphsHtml.length) {
        throw new Error("לכל סעיף צריך להיות שם ולפחות פסקה אחת.");
      }
    }

    return {
      type: "summary_revision_v1",
      source: "page_feedback_summary_editor",
      pageSlug: readField("pageSlug"),
      pageUrl: readField("pageUrl"),
      pageTitle: readField("pageTitle"),
      paperTitle: readField("paperTitle"),
      doi: readField("doi"),
      editedAt: new Date().toISOString(),
      fields: {
        titleHe,
        subtitleHe: readEditorControl("subtitleHe"),
        oneLinerHtml
      },
      sections
    };
  };

  const verifyEditorPassword = async () => {
    const password = readField("editorPassword");
    if (!password) {
      setPanelStatus(editorAuthStatus, "יש להזין סיסמת עורך.", "error");
      return;
    }
    if (!editorAuthEndpoint) {
      setPanelStatus(editorAuthStatus, "מסך העריכה עדיין לא מחובר ל-Worker.", "error");
      return;
    }

    if (editorAuthButton) editorAuthButton.disabled = true;
    setPanelStatus(editorAuthStatus, "בודק סיסמת עורך...", "info");

    try {
      const response = await fetch(editorAuthEndpoint, {
        method: "GET",
        headers: {
          "Accept": "application/json",
          "Authorization": `Bearer ${password}`
        }
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "סיסמת העורך שגויה.");
      }
      editorPasswordVerified = true;
      if (summaryEditor) summaryEditor.hidden = false;
      setPanelStatus(editorAuthStatus, "סיסמת העורך אומתה. אפשר לערוך את התקציר של העמוד הזה.", "info");
      await loadSummaryEditor();
      if (summaryEditor) summaryEditor.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      editorPasswordVerified = false;
      if (summaryEditor) summaryEditor.hidden = true;
      setPanelStatus(editorAuthStatus, error.message || "לא ניתן היה לאמת את סיסמת העורך.", "error");
    } finally {
      if (editorAuthButton) editorAuthButton.disabled = false;
    }
  };

  const submitSummaryRevision = async () => {
    if (!editorPasswordVerified) {
      setPanelStatus(summaryEditorStatus, "יש לאמת סיסמת עורך לפני שמירת עריכה.", "error");
      return;
    }

    let revision;
    try {
      revision = collectSummaryRevision();
    } catch (error) {
      setPanelStatus(summaryEditorStatus, error.message || "לא ניתן היה לקרוא את העריכה.", "error");
      return;
    }

    const comment = `EDITOR_SUMMARY_REVISION_V1 ${JSON.stringify(revision)}`;
    if (comment.length > 30000) {
      setPanelStatus(summaryEditorStatus, "העריכה ארוכה מדי לשמירה אוטומטית. כדאי לפצל אותה לכמה תיקונים.", "error");
      return;
    }

    if (summaryEditorSaveButton) summaryEditorSaveButton.disabled = true;
    setPanelStatus(summaryEditorStatus, "שומר את העריכה כתיקון מאושר...", "info");

    const payload = new FormData();
    payload.set("pageUrl", revision.pageUrl);
    payload.set("pageTitle", revision.pageTitle || revision.fields.titleHe);
    payload.set("pageSlug", revision.pageSlug);
    payload.set("paperTitle", revision.paperTitle);
    payload.set("doi", revision.doi);
    payload.set("comment", comment);
    payload.set("submitterRole", "other_or_prefer_not");
    payload.set("editorPassword", readField("editorPassword"));

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json"
        },
        body: payload
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "לא ניתן היה לשמור את העריכה.");
      }
      showThankYou(true, editorRevisionThankYouMessage);
    } catch (error) {
      setPanelStatus(summaryEditorStatus, error.message || "לא ניתן היה לשמור את העריכה.", "error");
    } finally {
      if (summaryEditorSaveButton) summaryEditorSaveButton.disabled = false;
    }
  };

  const showThankYou = (approvedForUpdate, message = "") => {
    form.hidden = true;
    if (status) status.hidden = true;
    if (source) source.hidden = true;
    if (summaryEditor) summaryEditor.hidden = true;
    if (thankYou) {
      if (thankYouText) {
        thankYouText.textContent = message || (approvedForUpdate ? approvedThankYouMessage : normalThankYouMessage);
      }
      thankYou.hidden = false;
      thankYou.focus();
    }
    window.setTimeout(() => {
      window.location.assign(safeRedirectUrl());
    }, redirectDelayMs);
  };

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    if (localSubmissionCount() >= dailyLimit && !hasEditorPassword()) {
      setStatus("נשלחו כבר כמה הערות ממכשיר זה היום. אפשר לנסות שוב מחר.", "error");
      return;
    }

    let photoMeta = null;
    try {
      photoMeta = await readPhotoMeta();
    } catch (error) {
      setPhotoStatus(error.message || "לא ניתן להעלות את התמונה.", "error");
      return;
    }

    if (!readField("comment") && !photoMeta) {
      setStatus("יש לכתוב הערה או לבחור תמונה מוצעת.", "error");
      return;
    }

    if (submitButton) submitButton.disabled = true;
    setStatus("שולח את ההערה...", "info");

    const payload = new FormData(form);
    if (photoMeta) {
      payload.set("suggestedPhotoWidth", String(photoMeta.width));
      payload.set("suggestedPhotoHeight", String(photoMeta.height));
      payload.set("suggestedPhotoType", photoMeta.type);
      payload.set("suggestedPhotoSize", String(photoMeta.size));
    }

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Accept": "application/json"
        },
        body: payload
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 429) {
        throw new Error("נשלחו כבר כמה הערות ממקור זה היום. אפשר לנסות שוב מחר.");
      }
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "לא ניתן היה לשלוח את ההערה.");
      }

      const approvedForUpdate = result.approvedForUpdate === true || result.status === "approved_for_update";
      if (!approvedForUpdate) {
        setLocalSubmissionCount(localSubmissionCount() + 1);
      }
      showThankYou(approvedForUpdate);
    } catch (error) {
      if (submitButton) submitButton.disabled = false;
      setStatus(error.message || "לא ניתן היה לשלוח את ההערה.", "error");
    }
  });

  if (editorAuthButton) {
    editorAuthButton.addEventListener("click", verifyEditorPassword);
  }

  if (editorPasswordField) {
    editorPasswordField.addEventListener("input", () => {
      if (!editorPasswordVerified) return;
      editorPasswordVerified = false;
      if (summaryEditor) summaryEditor.hidden = true;
      setPanelStatus(editorAuthStatus, "סיסמת העורך השתנתה. יש לאמת אותה מחדש כדי לערוך.", "info");
    });
  }

  if (summaryEditorLoadButton) {
    summaryEditorLoadButton.addEventListener("click", loadSummaryEditor);
  }

  if (summaryEditorResetButton) {
    summaryEditorResetButton.addEventListener("click", loadSummaryEditor);
  }

  if (summaryEditorSaveButton) {
    summaryEditorSaveButton.addEventListener("click", submitSummaryRevision);
  }

  if (photoInput) {
    photoInput.addEventListener("change", async () => {
      try {
        await readPhotoMeta();
      } catch (error) {
        setPhotoStatus(error.message || "לא ניתן להעלות את התמונה.", "error");
      }
    });
  }
})();
