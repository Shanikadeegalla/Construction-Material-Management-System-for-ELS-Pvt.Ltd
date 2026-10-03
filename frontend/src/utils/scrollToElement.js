/**
 * Scroll an element smoothly into view, focus it for accessibility,
 * and apply a temporary pulse animation to highlight it for the user.
 *
 * @param {HTMLElement|string} targetElement - DOM element or ref or CSS selector string
 * @param {Object} options
 * @param {number} [options.offset=80] - Top offset in pixels (for sticky headers)
 * @param {boolean} [options.focusFirstInput=true] - Whether to focus the first form field or target element
 * @param {number} [options.highlightDuration=1800] - Duration of highlight pulse in ms
 */
export const scrollToElement = (targetElement, options = {}) => {
  const {
    offset = 80,
    focusFirstInput = true,
    highlightDuration = 1800
  } = options;

  let el = null;
  if (typeof targetElement === 'string') {
    el = document.querySelector(targetElement);
  } else if (targetElement && targetElement.current) {
    el = targetElement.current;
  } else if (targetElement instanceof HTMLElement) {
    el = targetElement;
  }

  if (!el) return;

  // Use requestAnimationFrame so DOM updates are rendered before scrolling
  requestAnimationFrame(() => {
    // 1. Scroll smoothly to target element
    const elementPosition = el.getBoundingClientRect().top + window.pageYOffset;
    const offsetPosition = elementPosition - offset;

    window.scrollTo({
      top: Math.max(0, offsetPosition),
      behavior: 'smooth'
    });

    // 2. Accessibility: Move keyboard focus
    if (focusFirstInput) {
      const input = el.querySelector('input:not([type="hidden"]), select, textarea, button');
      if (input) {
        input.focus({ preventScroll: true });
      } else {
        el.setAttribute('tabIndex', '-1');
        el.focus({ preventScroll: true });
      }
    } else {
      el.setAttribute('tabIndex', '-1');
      el.focus({ preventScroll: true });
    }

    // 3. Visual pulse highlight animation
    el.classList.add('ux-target-highlight');
    setTimeout(() => {
      el.classList.remove('ux-target-highlight');
    }, highlightDuration);
  });
};

export default scrollToElement;
