---
layout: feedback-editor
title: ניהול הערות עורכים
description: מסך פנימי לעורכי האתר לניהול הערות ותיקונים שהתקבלו מהטופס.
permalink: /feedback-editor.html
noindex: true
---

# ניהול הערות עורכים

<p class="feedback-intro">מסך זה מיועד לעורכי האתר. תוכן התור נטען רק לאחר הזנת סיסמת עורך.</p>

<section class="feedback-editor-panel"
         data-feedback-editor
         data-endpoint="{{ site.data.site.feedbackEditorEndpoint | default: '' | escape }}">
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
        <option value="active">דורש טיפול</option>
        <option value="pending">pending</option>
        <option value="approved_for_update">approved_for_update</option>
        <option value="rejected">rejected</option>
        <option value="applied">applied</option>
        <option value="all">הכל</option>
      </select>
    </div>

    <div class="feedback-editor-list" data-feedback-editor-list></div>
  </section>
</section>
