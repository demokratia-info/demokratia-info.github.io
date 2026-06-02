(() => {
  const form = document.querySelector("[data-suggest-paper-form]");
  if (!form) return;

  const endpoint = (form.dataset.endpoint || "").trim();
  const homeUrl = form.dataset.homeUrl || "/";
  const dailyLimit = Number.parseInt(form.dataset.dailyLimit || "2", 10);
  const redirectDelayMs = Number.parseInt(form.dataset.redirectDelayMs || "5000", 10);
  const submitButton = form.querySelector("[type='submit']");
  const status = document.querySelector("[data-suggest-status]");
  const thankYou = document.querySelector("[data-suggest-thank-you]");

  const todayKey = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const storageKey = () => `paperSuggestions:${todayKey()}`;

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
      // The server-side endpoint is authoritative; local storage is only a friendly hint.
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

  const showThankYou = () => {
    form.hidden = true;
    if (status) status.hidden = true;
    if (thankYou) {
      thankYou.hidden = false;
      thankYou.focus();
    }
    window.setTimeout(() => {
      window.location.assign(homeUrl);
    }, redirectDelayMs);
  };

  if (!endpoint) {
    if (submitButton) submitButton.disabled = true;
    setStatus("Submissions are not connected yet. Please try again later.", "error");
    return;
  }

  if (localSubmissionCount() >= dailyLimit) {
    if (submitButton) submitButton.disabled = true;
    setStatus("You have already submitted five paper suggestions today.", "error");
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) return;

    if (localSubmissionCount() >= dailyLimit) {
      setStatus("You have already submitted five paper suggestions today.", "error");
      return;
    }

    if (submitButton) submitButton.disabled = true;
    setStatus("Submitting your suggestion...", "info");

    const payload = {
      paperTitle: readField("paperTitle"),
      authors: readField("authors"),
      doi: readField("doi"),
      submitterName: readField("submitterName"),
      submitterEmail: readField("submitterEmail")
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
        throw new Error("You have already submitted five paper suggestions today.");
      }
      if (!response.ok || result.ok === false) {
        throw new Error(result.error || "The suggestion could not be submitted.");
      }

      setLocalSubmissionCount(localSubmissionCount() + 1);
      showThankYou();
    } catch (error) {
      if (submitButton) submitButton.disabled = false;
      setStatus(error.message || "The suggestion could not be submitted.", "error");
    }
  });
})();
