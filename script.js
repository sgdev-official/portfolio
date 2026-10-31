/* Shubhomoy (Sgdev) portfolio — script.js
   1) mobile menu  2) active nav button while scrolling  3) scroll reveal */
(function () {
  "use strict";
  var root = document.documentElement;
  root.classList.add("js");

  /* 1. Mobile menu */
  var burger = document.getElementById("burger");
  var menu = document.getElementById("menu");
  function setMenu(open) {
    menu.classList.toggle("show", open);
    burger.setAttribute("aria-expanded", String(open));
    burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
  }
  burger.addEventListener("click", function () {
    setMenu(burger.getAttribute("aria-expanded") !== "true");
  });
  menu.addEventListener("click", function (e) {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setMenu(false);
  });

  /* 2. Highlight the nav button of the section on screen */
  var links = {};
  document.querySelectorAll(".nb[data-s]").forEach(function (a) { links[a.dataset.s] = a; });
  var ids = ["top", "about", "projects", "contact"];
  function markActive() {
    var current = "top";
    var y = window.scrollY + window.innerHeight * 0.35;
    ids.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.offsetTop <= y) current = id;
    });
    Object.keys(links).forEach(function (id) {
      links[id].classList.toggle("active", id === current);
    });
  }
  window.addEventListener("scroll", markActive, { passive: true });
  markActive();

  /* 3. Fade items in once as they scroll into view */
  var items = document.querySelectorAll(".card, .skills li, .contact, .status-card");
  items.forEach(function (el) { el.classList.add("rv"); });
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { threshold: 0.12 });
    items.forEach(function (el) { io.observe(el); });
  } else {
    items.forEach(function (el) { el.classList.add("in"); });
  }
})();
