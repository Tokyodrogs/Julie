/* ------------------------------------------------------------------ *
 * All About Julie — hand-written JavaScript.
 * Progressive enhancement only: the page is fully readable without it.
 *
 * Features: theme toggle, scroll reveals, floating hearts, gallery
 * filtering, lightbox viewer with keyboard navigation, scroll progress.
 * ------------------------------------------------------------------ */

(function () {
  "use strict";

  var root = document.documentElement;
  var STORAGE_KEY = "julie-theme";
  var prefersReduced =
    window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------------------------------------------------- *
   * Toast — shared live-region announcer
   * ---------------------------------------------------------- */

  var toastEl = document.querySelector("[data-toast]");
  var toastTimer = null;

  function showToast(message) {
    if (!toastEl) {
      return;
    }
    toastEl.textContent = message;
    toastEl.hidden = false;
    toastEl.setAttribute("data-visible", "true");
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      toastEl.setAttribute("data-visible", "false");
      window.setTimeout(function () {
        toastEl.hidden = true;
      }, 220);
    }, 2000);
  }

  /* ---------------------------------------------------------- *
   * Theme
   * ---------------------------------------------------------- */

  function readStoredTheme() {
    try {
      return window.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      return null;
    }
  }

  function resolveTheme() {
    var stored = readStoredTheme();
    if (stored === "light" || stored === "dark") {
      return stored;
    }
    var prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }

  function applyTheme(theme) {
    root.setAttribute("data-theme", theme);
    var toggle = document.querySelector("[data-theme-toggle]");
    if (!toggle) {
      return;
    }
    var isDark = theme === "dark";
    toggle.setAttribute("aria-pressed", String(isDark));
    toggle.setAttribute(
      "aria-label",
      isDark ? "Switch to light theme" : "Switch to dark theme"
    );
  }

  function initTheme() {
    applyTheme(resolveTheme());

    var toggle = document.querySelector("[data-theme-toggle]");
    if (toggle) {
      toggle.addEventListener("click", function () {
        var next =
          root.getAttribute("data-theme") === "dark" ? "light" : "dark";
        applyTheme(next);
        try {
          window.localStorage.setItem(STORAGE_KEY, next);
        } catch (err) {
          /* storage unavailable — the theme still applies this session */
        }
      });
    }

    // Follow the OS until the visitor makes a manual choice.
    var mq = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)");
    if (mq && mq.addEventListener) {
      mq.addEventListener("change", function (event) {
        if (!readStoredTheme()) {
          applyTheme(event.matches ? "dark" : "light");
        }
      });
    }
  }

  /* ---------------------------------------------------------- *
   * Scroll reveal
   * ---------------------------------------------------------- */

  function initReveal() {
    var targets = Array.prototype.slice.call(
      document.querySelectorAll(".reveal")
    );
    if (!targets.length) {
      return;
    }

    if (prefersReduced || !("IntersectionObserver" in window)) {
      targets.forEach(function (el) {
        el.setAttribute("data-shown", "true");
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-shown", "true");
            observer.unobserve(entry.target);
          }
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 }
    );

    targets.forEach(function (el) {
      observer.observe(el);
    });
  }

  /* ---------------------------------------------------------- *
   * Floating hearts
   * ---------------------------------------------------------- */

  function initHearts() {
    var container = document.querySelector("[data-hearts]");
    if (!container || prefersReduced) {
      return;
    }
    var glyphs = ["\u2665", "\u2661", "\u273F", "\u2726"];
    var count = 14;
    var html = "";
    for (var i = 0; i < count; i++) {
      var left = (i * 100) / count + Math.random() * 5;
      var duration = 14 + Math.random() * 14;
      var delay = Math.random() * 18;
      var size = 0.7 + Math.random() * 1.1;
      html +=
        '<span style="left:' +
        left.toFixed(2) +
        "%;animation-duration:" +
        duration.toFixed(1) +
        "s;animation-delay:" +
        delay.toFixed(1) +
        "s;font-size:" +
        size.toFixed(2) +
        'rem">' +
        glyphs[i % glyphs.length] +
        "</span>";
    }
    container.innerHTML = html;
  }

  /* ---------------------------------------------------------- *
   * Scroll progress bar
   * ---------------------------------------------------------- */

  function initProgress() {
    var bar = document.querySelector("[data-progress]");
    if (!bar) {
      return;
    }
    var ticking = false;

    function update() {
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var ratio = max > 0 ? window.scrollY / max : 0;
      bar.style.transform = "scaleX(" + Math.min(Math.max(ratio, 0), 1) + ")";
      ticking = false;
    }

    window.addEventListener(
      "scroll",
      function () {
        if (!ticking) {
          ticking = true;
          window.requestAnimationFrame(update);
        }
      },
      { passive: true }
    );
    window.addEventListener("resize", update, { passive: true });
    update();
  }

  /* ---------------------------------------------------------- *
   * Gallery: filtering + lightbox
   * ---------------------------------------------------------- */

  function galleryItems() {
    return Array.prototype.slice.call(
      document.querySelectorAll("[data-gallery] > li")
    );
  }

  function initFilters() {
    var chips = Array.prototype.slice.call(
      document.querySelectorAll("[data-filter]")
    );
    var items = galleryItems();
    if (!chips.length || !items.length) {
      return;
    }

    chips.forEach(function (chip) {
      chip.addEventListener("click", function () {
        var filter = chip.getAttribute("data-filter");

        chips.forEach(function (other) {
          other.classList.toggle("is-active", other === chip);
        });

        var shown = 0;
        items.forEach(function (item) {
          var match =
            filter === "all" || item.getAttribute("data-cat") === filter;
          item.setAttribute("data-hidden", match ? "false" : "true");
          if (match) {
            shown += 1;
          }
        });

        showToast(
          shown === items.length
            ? "Showing all " + shown + " photos"
            : "Showing " + shown + " of " + items.length + " photos"
        );
      });
    });
  }

  function initLightbox() {
    var box = document.querySelector("[data-lightbox-root]");
    if (!box) {
      return;
    }
    var image = box.querySelector("[data-lightbox-image]");
    var caption = box.querySelector("[data-lightbox-caption]");
    var closeBtn = box.querySelector("[data-lightbox-close]");
    var prevBtn = box.querySelector("[data-lightbox-prev]");
    var nextBtn = box.querySelector("[data-lightbox-next]");

    var triggers = [];
    var current = -1;
    var lastFocused = null;

    function visibleTriggers() {
      return triggers.filter(function (trigger) {
        var item = trigger.closest("li");
        return !item || item.getAttribute("data-hidden") !== "true";
      });
    }

    function render(index) {
      var list = visibleTriggers();
      if (!list.length) {
        return;
      }
      current = (index + list.length) % list.length;
      var trigger = list[current];
      var img = trigger.querySelector("img");
      if (!img) {
        return;
      }
      image.src = img.getAttribute("src");
      image.alt = img.getAttribute("alt") || "";
      if (caption) {
        var label = trigger.querySelector(".frame-caption");
        caption.textContent = label
          ? label.textContent + "  (" + (current + 1) + "/" + list.length + ")"
          : current + 1 + " / " + list.length;
      }
    }

    function open(index) {
      lastFocused = document.activeElement;
      box.hidden = false;
      document.body.style.overflow = "hidden";
      render(index);
      if (closeBtn) {
        closeBtn.focus();
      }
    }

    function close() {
      box.hidden = true;
      document.body.style.overflow = "";
      current = -1;
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus();
      }
    }

    triggers = Array.prototype.slice.call(
      document.querySelectorAll("[data-lightbox]")
    );

    triggers.forEach(function (trigger) {
      trigger.addEventListener("click", function () {
        var list = visibleTriggers();
        open(Math.max(list.indexOf(trigger), 0));
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", close);
    }
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        render(current - 1);
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        render(current + 1);
      });
    }

    // Click the dark backdrop (not the photo) to dismiss.
    box.addEventListener("click", function (event) {
      if (event.target === box) {
        close();
      }
    });

    document.addEventListener("keydown", function (event) {
      if (box.hidden) {
        return;
      }
      if (event.key === "Escape") {
        close();
      } else if (event.key === "ArrowLeft") {
        event.preventDefault();
        render(current - 1);
      } else if (event.key === "ArrowRight") {
        event.preventDefault();
        render(current + 1);
      }
    });

    // Simple swipe support for touch.
    var touchX = null;
    box.addEventListener(
      "touchstart",
      function (event) {
        touchX = event.changedTouches[0].clientX;
      },
      { passive: true }
    );
    box.addEventListener(
      "touchend",
      function (event) {
        if (touchX === null) {
          return;
        }
        var delta = event.changedTouches[0].clientX - touchX;
        if (Math.abs(delta) > 45) {
          render(delta > 0 ? current - 1 : current + 1);
        }
        touchX = null;
      },
      { passive: true }
    );
  }

  /* ---------------------------------------------------------- *
   * Footer year
   * ---------------------------------------------------------- */

  function initYear() {
    var el = document.querySelector("[data-year]");
    if (el) {
      el.textContent = String(new Date().getFullYear());
    }
  }

  /* ---------------------------------------------------------- *
   * Boot
   * ---------------------------------------------------------- */

  function init() {
    initTheme();
    initReveal();
    initHearts();
    initProgress();
    initFilters();
    initLightbox();
    initYear();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
