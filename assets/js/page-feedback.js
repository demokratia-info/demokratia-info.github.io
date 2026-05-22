(() => {
  const form = document.querySelector("[data-page-feedback-form]");
  if (!form) return;

  const endpoint = (form.dataset.endpoint || "").trim();
  const homeUrl = form.dataset.homeUrl || "/";
  const dailyLimit = Number.parseInt(form.dataset.dailyLimit || "5", 10);
  const redirectDelayMs = Number.parseInt(form.dataset.redirectDelayMs || "5000", 10);
  const photoMaxBytes = Number.parseInt(form.dataset.photoMaxBytes || "8388608", 10);
  const submitButton = form.querySelector("[type='submit']");
  const photoInput = form.elements.namedItem("suggestedPhoto");
  const status = document.querySelector("[data-page-feedback-status]");
  const photoStatus = document.querySelector("[data-page-feedback-photo-status]");
  const thankYou = document.querySelector("[data-page-feedback-thank-you]");
  const thankYouText = document.querySelector("[data-page-feedback-thank-you-text]");
  const source = document.querySelector("[data-page-feedback-source]");
  const sourceLink = document.querySelector("[data-page-feedback-url]");
  const params = new URLSearchParams(window.location.search);
  const normalThankYouMessage = "ההערה התקבלה ותיבדק לפני כל שינוי באתר. בעוד כמה שניות תחזרו לעמוד שממנו נשלחה ההערה.";
  const approvedThankYouMessage = "ההערה התקבלה וסומנה כמאושרת לעדכון. בעוד כמה שניות תחזרו לעמוד שממנו נשלחה ההערה.";

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

  const safeRedirectUrl = () => sameOriginUrl(readField("pageUrl")) || homeUrl;

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

  const showThankYou = (approvedForUpdate) => {
    form.hidden = true;
    if (status) status.hidden = true;
    if (source) source.hidden = true;
    if (thankYou) {
      if (thankYouText) {
        thankYouText.textContent = approvedForUpdate ? approvedThankYouMessage : normalThankYouMessage;
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
