// Renders text containing **bold** markers (see docs/shared/recipeScrape.js) into a
// container as real <strong> elements + text nodes. Never uses innerHTML — the
// markers are plain, non-HTML syntax we invented ourselves, so there's no injection
// surface even though the underlying text originated from a third-party page.
export function appendBoldMarkedText(container, text) {
  const parts = String(text).split(/(\*\*[^*]+\*\*)/g);
  for (const part of parts) {
    if (part.startsWith("**") && part.endsWith("**")) {
      const strong = document.createElement("strong");
      strong.textContent = part.slice(2, -2);
      container.appendChild(strong);
    } else if (part) {
      container.appendChild(document.createTextNode(part));
    }
  }
}
