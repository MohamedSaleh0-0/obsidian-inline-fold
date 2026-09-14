import { App, Component, MarkdownRenderer } from "obsidian";

const VIEWPORT_MARGIN = 8;
const GAP_FROM_ANCHOR = 6;
/** Grace period so moving the pointer from the anchor into the popover itself doesn't close it. */
const HIDE_GRACE_MS = 150;

let activePopover: HTMLElement | null = null;
let activeAnchor: HTMLElement | null = null;
let activeComponent: Component | null = null;
/** A pinned popover (opened, or confirmed, by a click) ignores mouseleave — only
 *  closes via click-again, click-outside, Escape, or scroll. A purely
 *  hover-opened popover is never pinned and closes on mouseleave as usual. */
let activePinned = false;
let hideTimer: number | null = null;
let listenersInstalled = false;

function clearHideTimer(): void {
  if (hideTimer !== null) {
    window.clearTimeout(hideTimer);
    hideTimer = null;
  }
}

/** Removes the currently-shown popover, if any, and unloads its Component. */
export function hidePopover(): void {
  clearHideTimer();
  activePopover?.remove();
  activePopover = null;
  activeAnchor = null;
  activePinned = false;
  activeComponent?.unload();
  activeComponent = null;
}

function cancelPendingHide(): void {
  clearHideTimer();
}

/** Schedules a hide after a short grace period — a no-op while pinned. */
function scheduleHide(): void {
  if (activePinned) return;
  clearHideTimer();
  hideTimer = window.setTimeout(() => hidePopover(), HIDE_GRACE_MS);
}

function position(popoverEl: HTMLElement, anchorEl: HTMLElement): void {
  const anchorRect = anchorEl.getBoundingClientRect();
  const popoverRect = popoverEl.getBoundingClientRect();
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let top = anchorRect.bottom + GAP_FROM_ANCHOR;
  if (top + popoverRect.height > viewportHeight - VIEWPORT_MARGIN) {
    // Not enough room below — flip above the anchor instead.
    const above = anchorRect.top - GAP_FROM_ANCHOR - popoverRect.height;
    if (above >= VIEWPORT_MARGIN) top = above;
  }

  let left = anchorRect.left;
  left = Math.min(left, viewportWidth - popoverRect.width - VIEWPORT_MARGIN);
  left = Math.max(left, VIEWPORT_MARGIN);

  popoverEl.style.top = `${Math.max(top, VIEWPORT_MARGIN)}px`;
  popoverEl.style.left = `${left}px`;
}

/**
 * Closes the popover on scroll (rather than repositioning — this is a
 * transient hover/click card, not something worth tracking continuously)
 * and on an outside click, so click-mode popovers behave like any other
 * dismissable overlay. Installed lazily, once, on first use.
 */
function ensureGlobalListeners(doc: Document): void {
  if (listenersInstalled) return;
  listenersInstalled = true;

  doc.addEventListener("scroll", () => hidePopover(), { capture: true, passive: true });
  doc.addEventListener("keydown", (evt) => {
    if (evt.key === "Escape") hidePopover();
  });
  doc.addEventListener(
    "click",
    (evt) => {
      if (!activePopover || !activeAnchor) return;
      const target = evt.target as Node;
      if (activePopover.contains(target) || activeAnchor.contains(target)) return;
      hidePopover();
    },
    { capture: true },
  );
}

/**
 * Shows a popover anchored below (or above, if it wouldn't fit) `anchorEl`.
 * `buildContent` fills the popover body and may render async (rich
 * Markdown) — it receives a Component whose lifetime matches the
 * popover's, for MarkdownRenderer.render's cleanup requirements.
 *
 * Appended to the anchor's own document body (not a CM6/editor scroll
 * container) so it can't be clipped by `overflow: hidden` ancestors,
 * and positioned with `position: fixed` using viewport-relative
 * coordinates from getBoundingClientRect().
 */
export function showPopover(
  anchorEl: HTMLElement,
  buildContent: (container: HTMLElement, component: Component) => void | Promise<void>,
  pinned = false,
): void {
  if (activeAnchor === anchorEl) {
    cancelPendingHide();
    if (pinned) activePinned = true;
    return; // already open for this exact anchor
  }
  hidePopover();

  const doc = anchorEl.ownerDocument;
  ensureGlobalListeners(doc);

  const popoverEl = doc.createElement("div");
  popoverEl.className = "inline-fold-popover";
  doc.body.appendChild(popoverEl);

  const component = new Component();
  component.load();
  activePopover = popoverEl;
  activeAnchor = anchorEl;
  activePinned = pinned;
  activeComponent = component;

  popoverEl.addEventListener("mouseenter", cancelPendingHide);
  popoverEl.addEventListener("mouseleave", scheduleHide);

  position(popoverEl, anchorEl);
  void Promise.resolve(buildContent(popoverEl, component)).then(() => {
    if (activePopover === popoverEl) position(popoverEl, anchorEl);
  });
}

/**
 * Wires hover-with-grace-period and click onto a trigger element, per
 * the plugin's global interaction mode. Shared by both popover-mode
 * folds and annotations — the only difference between them is what
 * buildContent renders, not how the popover behaves.
 *
 * In "both" mode, a click pins whatever's currently open for this
 * trigger (including one already opened by hover) so it survives the
 * pointer moving away, mirroring how click already behaves as the
 * "sticky" interaction for the classic inline fold. Clicking again
 * while pinned closes it.
 */
export function bindPopoverTrigger(
  el: HTMLElement,
  interactionMode: "click" | "hover" | "both",
  buildContent: (container: HTMLElement, component: Component) => void | Promise<void>,
): void {
  if (interactionMode === "hover" || interactionMode === "both") {
    el.addEventListener("mouseenter", () => showPopover(el, buildContent));
    el.addEventListener("mouseleave", scheduleHide);
  }

  if (interactionMode === "click" || interactionMode === "both") {
    el.addEventListener("click", (evt) => {
      evt.preventDefault();
      evt.stopPropagation();
      if (activeAnchor !== el) {
        showPopover(el, buildContent, true);
      } else if (!activePinned) {
        activePinned = true;
        cancelPendingHide();
      } else {
        hidePopover();
      }
    });
  }
}

/** Renders a popover body as either simple inline markdown or full async Obsidian Markdown. */
export function renderPopoverContent(
  container: HTMLElement,
  text: string,
  mode: "simple" | "rich",
  component: Component,
  app: App | undefined,
  sourcePath: string | undefined,
  renderSimple: (container: HTMLElement, text: string) => void,
): void | Promise<void> {
  if (mode === "rich" && app) {
    return MarkdownRenderer.render(app, text, container, sourcePath ?? "", component);
  }
  renderSimple(container, text);
  return undefined;
}
