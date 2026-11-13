// Phones only: when a field is focused the on-screen keyboard covers the lower half of the screen, so the field is scrolled to the middle of what is
// still visible. Runs once; ignored on tablet / desktop widths.
export function keepFocusedFieldVisible() {
  if (typeof window === "undefined" || window.__ecKeyboardGuard) return;
  window.__ecKeyboardGuard = true;
  const isField = (el) => el instanceof HTMLElement && (el.matches("input:not([type=checkbox]):not([type=radio]):not([type=file]), textarea, select") || el.isContentEditable);
  document.addEventListener("focusin", (e) => {
    if (window.innerWidth >= 768 || !isField(e.target)) return;
    const el = e.target;
    // wait for the keyboard animation to finish, then centre the field in the visible area
    setTimeout(() => { if (document.activeElement === el) el.scrollIntoView({ block: "center", behavior: "smooth" }); }, 350);
  });
}

// The part of the screen you can actually see (above Safari's bottom bar and the keyboard) as --visual-vh / --visual-top, so a bottom sheet can end exactly at the visible
// bottom. iOS reports 100vh as the taller "bar hidden" height, which is how a sheet's bottom buttons ended up under the bar.
export function trackVisibleViewport() {
  const viewport = typeof window !== "undefined" ? window.visualViewport : null;
  if (!viewport || window.__ecVisibleViewport) return;
  window.__ecVisibleViewport = true;
  const root = document.documentElement;
  const update = () => {
    root.style.setProperty("--visual-vh", `${viewport.height}px`);
    root.style.setProperty("--visual-top", `${viewport.offsetTop}px`);
  };
  viewport.addEventListener("resize", update);
  viewport.addEventListener("scroll", update);
  update();
}
