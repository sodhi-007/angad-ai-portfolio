import test from "node:test";
import assert from "node:assert/strict";

// Extracted from public/app.js so we can unit-test it server-side.
function renderMarkdownLinks(text) {
  const escaped = text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return escaped.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, label, url) => {
    const trimmed = url.trim();
    if (/^https?:\/\//i.test(trimmed)) return `<a href="${trimmed}" target="_blank" rel="noopener noreferrer">${label}</a>`;
    if (/^mailto:/i.test(trimmed)) return `<a href="${trimmed}">${label}</a>`;
    return match;
  });
}

test("renders https links with target and rel", () => {
  const result = renderMarkdownLinks("Visit [Google](https://google.com) now");
  assert.match(result, /^Visit <a href="https:\/\/google\.com" target="_blank" rel="noopener noreferrer">Google<\/a> now$/);
});

test("renders http links with target and rel", () => {
  const result = renderMarkdownLinks("[site](http://example.com)");
  assert.match(result, /<a href="http:\/\/example\.com" target="_blank" rel="noopener noreferrer">site<\/a>/);
});

test("renders mailto links without target or rel", () => {
  const result = renderMarkdownLinks("[Email](mailto:test@example.com)");
  assert.equal(result, '<a href="mailto:test@example.com">Email</a>');
});

test("rejects javascript: URLs and renders them as plain text", () => {
  const result = renderMarkdownLinks("[click](javascript:alert(1))");
  assert.doesNotMatch(result, /<a /);
  assert.match(result, /\[click\]\(javascript:alert\(1\)\)/);
});

test("rejects data: URLs", () => {
  const result = renderMarkdownLinks("[img](data:text/html,<script>alert(1)</script>)");
  assert.doesNotMatch(result, /<a /);
});

test("escapes HTML entities in surrounding text", () => {
  const result = renderMarkdownLinks("<script>alert(1)</script> [safe](https://safe.com)");
  assert.match(result, /^&lt;script&gt;/);
  assert.match(result, /<a href="https:\/\/safe\.com"/);
});

test("handles multiple links in one string", () => {
  const result = renderMarkdownLinks("[A](https://a.com) and [B](mailto:b@c.com)");
  assert.match(result, /<a href="https:\/\/a\.com".*>A<\/a>/);
  assert.match(result, /<a href="mailto:b@c\.com">B<\/a>/);
});
