---
layout: suggest-paper
title: Suggest a Paper
description: Suggest an academic paper for possible inclusion in the Hebrew democracy summaries website.
permalink: /suggest-paper.html
---

# Suggest a Paper

<p class="suggest-intro">Use this form to suggest an academic paper for possible inclusion on the website.</p>

<section class="privacy-notice" aria-labelledby="suggestPrivacyHeading">
  <h2 id="suggestPrivacyHeading">Privacy notice</h2>
  <p>This form collects the paper title, DOI, your name, your email address, and a daily salted hash of the source IP address for rate limiting. The information is used only to review paper suggestions and prevent abuse, is stored in the private <code>democracy-paper-suggestions-private</code> operational repository, and is visible only to website editors and authorized technical maintainers. To request deletion of a submission, email <a href="mailto:demokratia@tau.ac.il">demokratia@tau.ac.il</a> with enough detail to identify it.</p>
</section>

<form class="suggestion-form"
      data-suggest-paper-form
      data-endpoint="{{ site.data.site.suggestPaperEndpoint | default: '' | escape }}"
      data-home-url="{{ '/' | relative_url }}"
      data-daily-limit="{{ site.data.site.suggestPaperDailyLimit | default: 2 }}"
      data-redirect-delay-ms="{{ site.data.site.suggestPaperRedirectDelayMs | default: 5000 }}">
  <div class="form-field">
    <label class="form-label" for="paperTitle">Paper title</label>
    <input class="form-control" id="paperTitle" name="paperTitle" type="text" autocomplete="off" required maxlength="300">
  </div>

  <div class="form-field">
    <label class="form-label" for="doi">DOI number</label>
    <input class="form-control" id="doi" name="doi" type="text" inputmode="url" autocomplete="off" required maxlength="240" placeholder="10.xxxx/xxxxx">
  </div>

  <div class="form-field">
    <label class="form-label" for="submitterName">Your name</label>
    <input class="form-control" id="submitterName" name="submitterName" type="text" autocomplete="name" required maxlength="120">
  </div>

  <div class="form-field">
    <label class="form-label" for="submitterEmail">Email address</label>
    <input class="form-control" id="submitterEmail" name="submitterEmail" type="email" autocomplete="email" required maxlength="254">
  </div>

  <p class="form-note">Up to two paper suggestions may be submitted from the same source each calendar day. Email verification will be added when a mail server is available.</p>

  <div class="form-actions">
    <button class="button-primary" type="submit">Submit suggestion</button>
  </div>
</form>

<p class="form-status" data-suggest-status hidden role="status" aria-live="polite"></p>

<section class="thank-you-message" data-suggest-thank-you hidden tabindex="-1" aria-live="polite">
  <h2>Thank you</h2>
  <p>Your suggestion was received. You will be redirected to the homepage in a few seconds.</p>
</section>
