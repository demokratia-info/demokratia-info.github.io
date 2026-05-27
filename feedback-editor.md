---
layout: feedback-editor
title: ניהול הערות עורכים
description: מסך פנימי לעורכי האתר לניהול הערות ותיקונים שהתקבלו מהטופס.
permalink: /feedback-editor.html
noindex: true
---

# ניהול הערות עורכים

<p class="feedback-intro">מסך זה מיועד לעורכי האתר. תוכן התור, כולל תצוגות מקדימות של תמונות מוצעות, נטען רק לאחר הזנת סיסמת עורך.</p>

<section class="privacy-notice" aria-labelledby="feedbackEditorPrivacyHeading">
  <h2 id="feedbackEditorPrivacyHeading">הודעת פרטיות קצרה</h2>
  <p>מסך זה שולח סיסמת עורך לאימות ואינו שומר אותה. לאחר כניסה, המערכת מציגה ושומרת שינויי סטטוס והערות עורך על בקשות תיקון, כולל פרטי קשר ותמונות שהוגשו דרך טופס ההערות. המידע משמש לניהול תיקונים באתר, נשמר במאגר התפעולי הפרטי <code>democracy-paper-suggestions-private</code>, ונגיש רק לעורכי האתר ולמתחזקים מורשים. לבקשת מחיקה של רשומה או פרטי קשר כתבו ל־<a href="mailto:demokratia@tau.ac.il">demokratia@tau.ac.il</a>.</p>
</section>

<section class="feedback-editor-panel"
         data-feedback-editor
         data-endpoint="{{ site.data.site.feedbackEditorEndpoint | default: '' | escape }}"
         data-history-hours="48">
  <form class="feedback-form feedback-editor-login" data-feedback-editor-login>
    <div class="form-field">
      <label class="form-label" for="editorPassword">סיסמת עורך</label>
      <input class="form-control" id="editorPassword" name="editorPassword" type="password" autocomplete="current-password" required>
    </div>
    <div class="form-actions">
      <button class="button-primary" type="submit">כניסה לתור ההערות</button>
    </div>
  </form>

  <p class="form-status" data-feedback-editor-status hidden role="status" aria-live="polite"></p>

  <section class="feedback-editor-dashboard" data-feedback-editor-dashboard hidden>
    <div class="feedback-editor-toolbar">
      <p class="feedback-editor-next" data-feedback-editor-next></p>
      <div class="form-actions">
        <button class="button-secondary" type="button" data-feedback-editor-refresh>רענון</button>
      </div>
    </div>

    <div class="feedback-editor-counts" data-feedback-editor-counts></div>

    <div class="form-field feedback-editor-filter">
      <label class="form-label" for="feedbackStatusFilter">סינון לפי סטטוס</label>
      <select class="form-control" id="feedbackStatusFilter" data-feedback-editor-filter>
        <option value="all_queue">כל התור הפעיל</option>
        <option value="pending">pending</option>
        <option value="approved_for_update">approved_for_update</option>
        <option value="rejected">rejected בתור</option>
        <option value="recent_handled">בוצעו או נדחו ב־48 השעות האחרונות</option>
        <option value="applied_recent">applied ב־48 השעות האחרונות</option>
        <option value="rejected_recent">rejected שטופלו ב־48 השעות האחרונות</option>
      </select>
      <p class="form-note feedback-editor-history-note">המסך הראשי מציג את התור הפעיל בלבד. רשומות שבוצעו או נדחו ונמחקו מהתור נטענות מהיסטוריית הטיפול רק לפי דרישה, ול־48 השעות האחרונות.</p>
    </div>

    <div class="feedback-editor-list" data-feedback-editor-list></div>
  </section>
</section>
