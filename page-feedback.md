---
layout: page-feedback
title: הצעות לתיקונים והערות
description: שליחת הערות, הצעות לתיקון או דיווח על טעות בעמוד באתר.
permalink: /page-feedback.html
noindex: true
---

# הצעות לתיקונים והערות

<p class="feedback-intro">אפשר לשלוח כאן תיקון, הערה או דיווח על בעיה בעמוד. ההערות נבדקות לפני כל שינוי באתר.</p>

<section class="privacy-notice" aria-labelledby="feedbackPrivacyHeading">
  <h2 id="feedbackPrivacyHeading">הודעת פרטיות קצרה</h2>
  <p>הפרטים שתמסרו ישמשו אך ורק לטיפול בפנייתכם, בהתאם למדיניות הפרטיות ותנאי השימוש של האתר.</p>
  <p>לעיון במדיניות: <a href="{{ '/conditions.html' | relative_url }}">תנאי השימוש</a></p>
</section>

<p class="feedback-source" data-page-feedback-source hidden>
  ההערה מתייחסת לעמוד:
  <a class="feedback-source-link" href="#" data-page-feedback-url></a>
</p>

<form class="feedback-form"
      data-page-feedback-form
      data-endpoint="{{ site.data.site.pageFeedbackEndpoint | default: '' | escape }}"
      data-editor-endpoint="{{ site.data.site.feedbackEditorEndpoint | default: '' | escape }}"
      data-source-origins="{{ site.data.site.feedbackSourceOrigins | default: site.url | escape }}"
      data-home-url="{{ site.home_url | default: '/' | escape }}"
      data-daily-limit="{{ site.data.site.pageFeedbackDailyLimit | default: 5 }}"
      data-redirect-delay-ms="{{ site.data.site.pageFeedbackRedirectDelayMs | default: 5000 }}"
      data-photo-max-bytes="{{ site.data.site.pageFeedbackPhotoMaxBytes | default: 8388608 }}"
      data-fulltext-max-bytes="{{ site.data.site.pageFeedbackFullTextMaxBytes | default: 52428800 }}"
      enctype="multipart/form-data">
  <input type="hidden" name="pageUrl">
  <input type="hidden" name="pageTitle">
  <input type="hidden" name="pageSlug">
  <input type="hidden" name="paperTitle">
  <input type="hidden" name="doi">
  <input type="hidden" name="summarySourceStatus">
  <input class="feedback-honeypot" type="text" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">

  <div class="form-field">
    <label class="form-label" for="comment">הערה, הצעת תיקון או הסבר לתמונה</label>
    <textarea class="form-control feedback-textarea" id="comment" name="comment" dir="auto" maxlength="5000"></textarea>
  </div>

  <div class="form-field">
    <label class="form-label" for="suggestedPhoto">תמונה מוצעת למאמר (לא חובה)</label>
    <input class="form-control" id="suggestedPhoto" name="suggestedPhoto" type="file" accept="image/jpeg,image/png,image/webp">
    <p class="form-note">יש להעלות תמונת רוחב ביחס 4:3 ככל האפשר. סטייה קלה ביחס תטופל בחיתוך לפני פרסום, והתמונה תומר ל־800x600 רק אם עורך יאשר אותה. בהעלאת התמונה אני מאשר/ת שהתמונה היא תמונה שיש לי הרשאה להשתמש בה ולפרסם אותה באתר. למשל: תמונה שצילמת בעצמך, תמונה שרכשת ממאגר, או תמונה שקיבלת לגביה אישור שימוש.</p>
    <p class="form-status feedback-photo-status" data-page-feedback-photo-status hidden role="status" aria-live="polite"></p>
  </div>

  <div class="form-field">
    <label class="form-label" for="submitterRole">מי את/ה</label>
    <select class="form-control" id="submitterRole" name="submitterRole">
      <option value="paper_author">מחבר/ת המאמר</option>
      <option value="field_researcher">חוקר/ת אחר/ת בתחום</option>
      <option value="other_or_prefer_not" selected>אחר או מעדיפ/ה לא לשתף</option>
    </select>
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
    <div class="form-actions editor-auth-actions">
      <button class="button-secondary" type="button" data-summary-editor-auth>אימות עורך</button>
    </div>
    <p class="form-status editor-auth-status" data-summary-editor-auth-status hidden role="status" aria-live="polite"></p>
  </div>

  <div class="form-field fulltext-upload-field" data-fulltext-upload hidden>
    <label class="form-label" for="fullTextFile">העלאת טקסט מלא של המאמר (PDF, לעורכים בלבד)</label>
    <input class="form-control" id="fullTextFile" name="fullTextFile" type="file" accept="application/pdf,.pdf">
    <p class="form-note">הקובץ יישמר בתור העיבוד הפרטי בלבד ולא יפורסם באתר. ההארטביט הבא יוכל להשתמש בו ליצירת תקציר מעודכן על בסיס הטקסט המלא.</p>
    <p class="form-status fulltext-upload-status" data-fulltext-status hidden role="status" aria-live="polite"></p>
  </div>

  <p class="form-note">פרטי הקשר אינם חובה, אינם מוצגים באתר, וישמשו רק אם יהיה צורך בהבהרה.</p>

  <div class="form-actions">
    <button class="button-primary" type="submit">שליחת ההערה</button>
  </div>
</form>

<p class="form-status" data-page-feedback-status hidden role="status" aria-live="polite"></p>

<section class="page-summary-editor" data-summary-editor hidden aria-labelledby="summaryEditorHeading">
  <h2 id="summaryEditorHeading">עריכת תקציר העמוד</h2>
  <p class="form-note">מסך זה נטען רק לאחר אימות סיסמת עורך. השינויים נשמרים כבקשת עדכון מאושרת לתור ההערות, ותהליך ההארטביט הבא יחיל אותם לאחר בדיקה.</p>
  <div class="form-actions">
    <button class="button-secondary" type="button" data-summary-editor-load>טעינת התקציר לעריכה</button>
  </div>
  <div class="summary-editor-fields" data-summary-editor-fields hidden></div>
  <div class="form-actions summary-editor-actions" data-summary-editor-actions hidden>
    <button class="button-primary" type="button" data-summary-editor-save>שמירת עריכה מאושרת</button>
    <button class="button-secondary" type="button" data-summary-editor-reset>טעינה מחדש מהעמוד</button>
  </div>
  <p class="form-status" data-summary-editor-status hidden role="status" aria-live="polite"></p>
</section>

<section class="thank-you-message" data-page-feedback-thank-you hidden tabindex="-1" aria-live="polite">
  <h2>תודה</h2>
  <p data-page-feedback-thank-you-text>ההערה התקבלה ותיבדק לפני כל שינוי באתר. בעוד כמה שניות תחזרו לעמוד שממנו נשלחה ההערה.</p>
</section>
