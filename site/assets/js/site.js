(function () {
  const header = document.querySelector("[data-site-header]");
  const toggle = document.querySelector("[data-site-nav-toggle]");
  const nav = document.querySelector("[data-site-nav]");
  const dropdowns = Array.from(document.querySelectorAll("[data-site-dropdown]"));

  function setHeaderHeight() {
    if (!header) return;
    document.documentElement.style.setProperty("--site-header-height", `${header.offsetHeight}px`);
  }

  function closeMenu() {
    document.body.classList.remove("site-nav-open");
    if (toggle) toggle.setAttribute("aria-expanded", "false");
    dropdowns.forEach((dropdown) => {
      dropdown.classList.remove("is-open");
      const button = dropdown.querySelector("[data-site-dropdown-toggle]");
      if (button) button.setAttribute("aria-expanded", "false");
    });
  }

  function setActiveNav() {
    const key = document.body.dataset.navKey;
    if (!key) return;
    document.querySelectorAll(`[data-nav-key="${key}"]`).forEach((item) => {
      item.classList.add("is-active");
      if (item.tagName === "A") item.setAttribute("aria-current", "page");
      const dropdown = item.closest("[data-site-dropdown]");
      if (dropdown) dropdown.classList.add("is-active");
    });
  }

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      const open = !document.body.classList.contains("site-nav-open");
      document.body.classList.toggle("site-nav-open", open);
      toggle.setAttribute("aria-expanded", String(open));
    });

    nav.addEventListener("click", (event) => {
      const link = event.target.closest("a");
      if (link) closeMenu();
    });
  }

  dropdowns.forEach((dropdown) => {
    const button = dropdown.querySelector("[data-site-dropdown-toggle]");
    if (!button) return;

    button.addEventListener("click", () => {
      const smallScreen = window.matchMedia("(max-width: 980px)").matches;
      if (!smallScreen) return;
      const open = !dropdown.classList.contains("is-open");
      dropdown.classList.toggle("is-open", open);
      button.setAttribute("aria-expanded", String(open));
    });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeMenu();
  });

  document.addEventListener("click", (event) => {
    if (!header || header.contains(event.target)) return;
    closeMenu();
  });

  window.addEventListener("resize", setHeaderHeight);
  setHeaderHeight();
  setActiveNav();
})();
