(() => {
  const form = document.querySelector("[data-page-feedback-form]");
  if (!form) return;

  const endpoint = (form.dataset.endpoint || "").trim();
  const homeUrl = form.dataset.homeUrl || "/";
  const dailyLimit = Number.parseInt(form.dataset.dailyLimit || "5", 10);
  const redirectDelayMs = Number.parseInt(form.dataset.redirectDelayMs || "5000", 10);
  const submitButton = form.querySelector("[type='submit']");
  const status = document.querySelector("[data-page-feedback-status]");
  const thankYou = document.querySelector("[data-page-feedback-thank-you]");
  const source = document.querySelector("[data-page-feedback-source]");
  const sourceLink = document.querySelector("[data-page-feedback-url]");
  const params = new URLSearchParams(window.location.search);

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

  const readField = (name) => {
    const field = form.elements.namedItem(name);
    return field && "value" in field ? String(field.value).trim() : "";
  };

  const setField = (name, value) => {
    const field = form.elements.namedItem(name);
    if (field && "value" in field) field.value = value || "";
  };

  const sameOriginUrl = (value) => {
    if (!value) return "";
    try {
      const url = new URL(value, window.location.origin);
      return url.origin === window.location.origin ? url.toString() : "";
    } catch {
      return "";
    }
  };

  const sourcePageUrl = sameOriginUrl(params.get("page") || params.get("pageUrl"))
    || sameOriginUrl(document.referrer);
  const sourcePageTitle = (params.get("title") || params.get("pageTitle") || "").trim();
  const sourcePageSlug = (params.get("slug") || "").trim();
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

  if (localSubmissionCount() >= dailyLimit) {
    disableForm("נשלחו כבר כמה הערות ממכשיר זה היום. אפשר לנסות שוב מחר.");
  }

  const safeRedirectUrl = () => sameOriginUrl(readField("pageUrl")) || homeUrl;

  const showThankYou = () => {
    form.hidden = true;
    if (status) status.hidden = true;
    if (source) source.hidden = true;
    if (thankYou) {
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

    if (localSubmissionCount() >= dailyLimit) {
      setStatus("נשלחו כבר כמה הערות ממכשיר זה היום. אפשר לנסות שוב מחר.", "error");
      return;
    }

    if (submitButton) submitButton.disabled = true;
    setStatus("שולח את ההערה...", "info");

    const payload = {
      pageUrl: readField("pageUrl"),
      pageTitle: readField("pageTitle"),
      pageSlug: readField("pageSlug"),
      paperTitle: readField("paperTitle"),
      doi: readField("doi"),
      comment: readField("comment"),
      submitterEmail: readField("submitterEmail"),
      submitterPhone: readField("submitterPhone"),
      website: readField("website")
    };

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = await response.json().catch(() => ({}));

      if (response.status === 429) {
        throw new Error("נשלחו כבר כמה הערות ממקור זה היום. אפשר לנסות שוב מחר.");
      }
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "לא ניתן היה לשלוח את ההערה.");
      }

      setLocalSubmissionCount(localSubmissionCount() + 1);
      showThankYou();
    } catch (error) {
      if (submitButton) submitButton.disabled = false;
      setStatus(error.message || "לא ניתן היה לשלוח את ההערה.", "error");
    }
  });
})();
