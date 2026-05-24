---
layout: author-mailer
title: ניהול הודעות למחברים
description: מסך פנימי לעורכי האתר לשחרור הדרגתי של הודעות דוא"ל למחברי המאמרים.
permalink: /author-mailer.html
noindex: true
---

# ניהול הודעות למחברים

<p class="feedback-intro">מסך זה מיועד לעורכי האתר. רשימת המחברים והכתובות נטענת רק לאחר הזנת סיסמת עורך. סימון בעמוד זה אינו שולח דוא"ל מיד; השליחה בפועל מתבצעת רק באמצעות הסקריפט המקומי.</p>

<section class="feedback-editor-panel author-mailer-panel"
         data-author-mailer
         data-endpoint="{{ site.data.site.authorNoticeEditorEndpoint | default: '' | escape }}">
  <form class="feedback-form feedback-editor-login" data-author-mailer-login>
    <div class="form-field">
      <label class="form-label" for="authorMailerPassword">סיסמת עורך</label>
      <input class="form-control" id="authorMailerPassword" name="editorPassword" type="password" autocomplete="current-password" required>
    </div>
    <div class="form-actions">
      <button class="button-primary" type="submit">כניסה לתור ההודעות</button>
    </div>
  </form>

  <p class="form-status" data-author-mailer-status hidden role="status" aria-live="polite"></p>

  <section class="feedback-editor-dashboard" data-author-mailer-dashboard hidden>
    <div class="feedback-editor-toolbar">
      <p class="feedback-editor-next">הסקריפט המקומי ישלח רק רשומות שסומנו ready_to_send.</p>
      <div class="form-actions">
        <button class="button-secondary" type="button" data-author-mailer-refresh>רענון</button>
      </div>
    </div>

    <div class="feedback-editor-counts" data-author-mailer-counts></div>

    <div class="form-field feedback-editor-filter">
      <label class="form-label" for="authorNoticeStatusFilter">סינון לפי סטטוס</label>
      <select class="form-control" id="authorNoticeStatusFilter" data-author-mailer-filter>
        <option value="active">כל התור הפעיל</option>
        <option value="pending_editor_release">pending_editor_release</option>
        <option value="ready_to_send">ready_to_send</option>
        <option value="failed">failed</option>
      </select>
      <p class="form-note">מחברים חסומים אינם מוצגים לשחרור ואינם אמורים להישלח לעולם.</p>
    </div>

    <div class="feedback-editor-list author-mailer-list" data-author-mailer-list></div>
  </section>
</section>
