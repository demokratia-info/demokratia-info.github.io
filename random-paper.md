---
layout: random-paper
title: מעבר לעמוד אקראי
description: מעבר אוטומטי לתמצית מאמר אקראית באתר.
permalink: /random-paper.html
---

# מעבר לעמוד אקראי

<p data-pagefind-ignore>מעביר לעמוד אקראי...</p>

<p data-pagefind-ignore><a id="randomPaperFallback" href="{{ site.home_url | default: '/' | escape }}">לעמוד הבית</a></p>

<script data-pagefind-ignore>
(() => {
  const papers = [
    {% assign papers = site.papers | sort: "sortKey" | reverse %}
    {% for paper in papers %}
      {{ paper.url | relative_url | jsonify }}{% unless forloop.last %},{% endunless %}
    {% endfor %}
  ].filter(Boolean);

  if (!papers.length) return;

  const target = papers[Math.floor(Math.random() * papers.length)];
  const fallback = document.getElementById("randomPaperFallback");
  if (fallback) fallback.href = target;
  window.location.replace(target);
})();
</script>
