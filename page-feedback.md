---
layout: page-feedback
title: הצעות לתיקונים והערות
description: שליחת הערות, הצעות לתיקון או דיווח על טעות בעמוד באתר.
permalink: /page-feedback.html
---

# הצעות לתיקונים והערות

<p class="feedback-intro">אפשר לשלוח כאן תיקון, הערה או דיווח על בעיה בעמוד. ההערות נבדקות לפני כל שינוי באתר.</p>

<p class="feedback-source" data-page-feedback-source hidden>
  ההערה מתייחסת לעמוד:
  <a class="feedback-source-link" href="#" data-page-feedback-url></a>
</p>

<form class="feedback-form"
      data-page-feedback-form
      data-endpoint="{{ site.data.site.pageFeedbackEndpoint | default: '' | escape }}"
      data-home-url="{{ '/' | relative_url }}"
      data-daily-limit="{{ site.data.site.pageFeedbackDailyLimit | default: 5 }}"
      data-redirect-delay-ms="{{ site.data.site.pageFeedbackRedirectDelayMs | default: 5000 }}"
      data-photo-max-bytes="{{ site.data.site.pageFeedbackPhotoMaxBytes | default: 8388608 }}"
      enctype="multipart/form-data">
  <input type="hidden" name="pageUrl">
  <input type="hidden" name="pageTitle">
  <input type="hidden" name="pageSlug">
  <input type="hidden" name="paperTitle">
  <input type="hidden" name="doi">
  <input class="feedback-honeypot" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">

  <div class="form-field">
    <label class="form-label" for="comment">הערה, הצעת תיקון או הסבר לתמונה</label>
    <textarea class="form-control feedback-textarea" id="comment" name="comment" dir="auto" maxlength="5000"></textarea>
  </div>

  <div class="form-field">
    <label class="form-label" for="suggestedPhoto">תמונה מוצעת למאמר (לא חובה)</label>
    <input class="form-control" id="suggestedPhoto" name="suggestedPhoto" type="file" accept="image/jpeg,image/png,image/webp">
    <p class="form-note">יש להעלות תמונת רוחב ביחס 4:3 ככל האפשר. סטייה קלה ביחס תטופל בחיתוך לפני פרסום, והתמונה תומר ל־800x600 רק אם עורך יאשר אותה.</p>
    <p class="form-status feedback-photo-status" data-page-feedback-photo-status hidden role="status" aria-live="polite"></p>
  </div>

  <div class="form-field">
    <label class="form-label" for="submitterEmail">דואר אלקטרוני (לא חובה)</label>
    <input class="form-control" id="submitterEmail" name="submitterEmail" type="email" dir="ltr" autocomplete="email" maxlength="254">
  </div>

  <div class="form-field">
    <label class="form-label" for="submitterPhone">טלפון (לא חובה)</label>
    <input class="form-control" id="submitterPhone" name="submitterPhone" type="tel" dir="ltr" autocomplete="tel" maxlength="40">
  </div>

  <div class="form-field">
    <label class="form-label" for="feedbackEditorPassword">סיסמת עורך (לא חובה)</label>
    <input class="form-control" id="feedbackEditorPassword" name="editorPassword" type="password" autocomplete="off" maxlength="300">
  </div>

  <p class="form-note">פרטי הקשר אינם חובה, אינם מוצגים באתר, וישמשו רק אם יהיה צורך בהבהרה.</p>

  <div class="form-actions">
    <button class="button-primary" type="submit">שליחת ההערה</button>
  </div>
</form>

<p class="form-status" data-page-feedback-status hidden role="status" aria-live="polite"></p>

<section class="thank-you-message" data-page-feedback-thank-you hidden tabindex="-1" aria-live="polite">
  <h2>תודה</h2>
  <p data-page-feedback-thank-you-text>ההערה התקבלה ותיבדק לפני כל שינוי באתר. בעוד כמה שניות תחזרו לעמוד שממנו נשלחה ההערה.</p>
</section>
