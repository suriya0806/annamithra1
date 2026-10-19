import { useEffect, useRef } from 'react';

/**
 * Shared, reusable React hook for registering the F5 "Add Item" shortcut.
 *
 * Behavior:
 * - Only active when `isEnabled` is true (user logged in, on an active item-entry page).
 * - Intercepts F5 and prevents the browser's normal page refresh ONLY on relevant pages.
 * - Leaves standard browser refresh intact on all other pages.
 * - Guards against text composition (IME) and does not trigger while a modal is open.
 * - Cleanly registers and unregisters window event listeners on mount / unmount / tab change.
 *
 * @param {Object} options
 * @param {Function} options.onAddItem - Action to perform when F5 is pressed
 * @param {boolean} options.isEnabled - Whether the shortcut is currently active
 * @param {boolean} [options.isModalOpen=false] - Whether any modal is currently displayed
 */
export function useAddItemShortcut({ onAddItem, isEnabled = true, isModalOpen = false }) {
  const onAddItemRef = useRef(onAddItem);
  onAddItemRef.current = onAddItem;

  const isEnabledRef = useRef(isEnabled);
  isEnabledRef.current = isEnabled;

  const isModalOpenRef = useRef(isModalOpen);
  isModalOpenRef.current = isModalOpen;

  useEffect(() => {
    if (!isEnabled) return;

    const handleKeyDown = (e) => {
      if (e.key !== 'F5') return;

      // 1. Text composition guard (e.g. IME)
      if (e.isComposing) return;

      // 2. Modal open guard: Do not trigger Add Item while a modal is already open
      const hasModalInDom = Boolean(document.querySelector('.modal-overlay'));
      if (isModalOpenRef.current || hasModalInDom) {
        // Prevent accidental browser reload while editing inside a modal
        e.preventDefault();
        return;
      }

      // 3. Page active check
      if (!isEnabledRef.current) return;

      // 4. Intercept F5 and execute Add Item action
      e.preventDefault();
      if (typeof onAddItemRef.current === 'function') {
        onAddItemRef.current(e);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isEnabled]);
}

export default useAddItemShortcut;
