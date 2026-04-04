// ════════════════════════════════════════════════════
// AVAILABLE DATES
// Edit this array to open or close booking dates.
// Format: "YYYY-MM-DD"
// ════════════════════════════════════════════════════
const availableDates = [
  "2026-05-07", "2026-05-14", "2026-05-21",
  "2026-06-04", "2026-06-11", "2026-06-18",
  "2026-07-02", "2026-07-09", "2026-07-16",
  "2026-08-06", "2026-08-13", "2026-08-20",
  "2026-09-03", "2026-09-10", "2026-09-17",
  "2026-10-01", "2026-10-08", "2026-10-15"
];

// ── Section-aware nav ──────────────────────────────
const nav = document.getElementById('main-nav');

function applyNavTheme(theme) {
  if (theme === 'dark') {
    nav.classList.add('nav-on-dark');
    nav.classList.remove('scrolled');
  } else {
    nav.classList.add('scrolled');
    nav.classList.remove('nav-on-dark');
  }
}

// Default to dark (hero is first section)
applyNavTheme('dark');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const theme = entry.target.dataset.theme || 'light';
      applyNavTheme(theme);
    }
  });
}, { threshold: 0.3 });

document.querySelectorAll('section[data-theme]').forEach(section => {
  sectionObserver.observe(section);
});

// ── Mobile menu ─────────────────────────────────────
const hamburger   = document.getElementById('hamburger');
const mobileMenu  = document.getElementById('mobile-menu');
const mobileClose = document.getElementById('mobile-close');

hamburger.addEventListener('click',   () => mobileMenu.classList.add('open'));
mobileClose.addEventListener('click', () => mobileMenu.classList.remove('open'));
document.querySelectorAll('.mobile-link').forEach(link =>
  link.addEventListener('click', () => mobileMenu.classList.remove('open'))
);

// ── Scroll reveal ───────────────────────────────────
const io = new IntersectionObserver((entries) => {
  entries.forEach((entry, i) => {
    if (entry.isIntersecting) {
      setTimeout(() => entry.target.classList.add('visible'), i * 80);
      io.unobserve(entry.target);
    }
  });
}, { threshold: 0.08 });

document.querySelectorAll('.reveal').forEach(el => io.observe(el));

// ── FAQ accordion ───────────────────────────────────
document.querySelectorAll('.faq-question').forEach(btn => {
  btn.addEventListener('click', () => {
    const item   = btn.closest('.faq-item');
    const answer = item.querySelector('.faq-answer');
    const isOpen = item.classList.contains('open');

    document.querySelectorAll('.faq-item.open').forEach(open => {
      open.classList.remove('open');
      open.querySelector('.faq-answer').style.maxHeight = '0';
    });

    if (!isOpen) {
      item.classList.add('open');
      answer.style.maxHeight = answer.scrollHeight + 'px';
    }
  });
});

// ── Date picker ─────────────────────────────────────
let dpMonth    = new Date().getMonth();
let dpYear     = new Date().getFullYear();
let dpSelected = null;
let dpDuration = 3;

const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

function renderDP() {
  const label = document.getElementById('dp-month-label');
  const grid  = document.getElementById('dp-grid');
  const info  = document.getElementById('dp-info');

  label.textContent = MONTHS[dpMonth] + ' ' + dpYear;
  grid.innerHTML = '';

  WEEKDAYS.forEach(d => {
    const el = document.createElement('div');
    el.className = 'dp-weekday';
    el.textContent = d;
    grid.appendChild(el);
  });

  const firstDay    = new Date(dpYear, dpMonth, 1).getDay();
  const daysInMonth = new Date(dpYear, dpMonth + 1, 0).getDate();

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'dp-day';
    grid.appendChild(el);
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const ds   = `${dpYear}-${String(dpMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const avail = availableDates.includes(ds);
    const el   = document.createElement('div');
    el.className = 'dp-day' + (avail ? ' available' : '');
    el.textContent = d;

    if (dpSelected) {
      const start = new Date(dpSelected);
      const end   = new Date(dpSelected);
      end.setDate(end.getDate() + dpDuration - 1);
      const cur = new Date(ds);
      if (ds === dpSelected)                             el.classList.add('selected');
      else if (cur > start && cur < end)                 el.classList.add('in-range');
      else if (cur.toDateString() === end.toDateString()) el.classList.add('end-date');
    }

    if (avail) {
      el.addEventListener('click', () => { dpSelected = ds; renderDP(); });
    }

    grid.appendChild(el);
  }

  if (dpSelected) {
    const s = new Date(dpSelected);
    const e = new Date(dpSelected);
    e.setDate(e.getDate() + dpDuration - 1);
    info.textContent =
      s.toLocaleDateString('en-GB', {day:'numeric', month:'short'}) +
      ' → ' +
      e.toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
  } else {
    info.textContent = 'Select an available date to begin';
  }
}

document.getElementById('dp-prev').addEventListener('click', () => {
  dpMonth--;
  if (dpMonth < 0) { dpMonth = 11; dpYear--; }
  renderDP();
});

document.getElementById('dp-next').addEventListener('click', () => {
  dpMonth++;
  if (dpMonth > 11) { dpMonth = 0; dpYear++; }
  renderDP();
});

document.querySelectorAll('.dp-duration .dp-dur-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.dp-duration .dp-dur-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    dpDuration = parseInt(btn.dataset.days);
    renderDP();
  });
});

// Start calendar at first available month
if (availableDates.length) {
  const first = new Date(availableDates[0]);
  dpMonth = first.getMonth();
  dpYear  = first.getFullYear();
}
renderDP();

// ── Inquiry form submission ──────────────────────────
const form    = document.getElementById('inquiry-form');
const success = document.getElementById('form-success');

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  try {
    const res = await fetch(form.action, {
      method: 'POST',
      body: data,
      headers: { 'Accept': 'application/json' }
    });
    if (res.ok) {
      form.style.display    = 'none';
      success.style.display = 'block';
    } else {
      alert('Something went wrong. Please email Tina directly at koestler.tina@gmail.com');
    }
  } catch {
    alert('Something went wrong. Please email Tina directly at koestler.tina@gmail.com');
  }
});

// ── Journey toggle ─────────────────────────────────────
const journeyBtns = document.querySelectorAll('#journey-toggle button');
const timelineItems = document.querySelectorAll('.timeline-item');

function updateJourney(days) {
  timelineItems.forEach((item, i) => {
    const day = i + 1;
    if (days === 3) {
      item.style.display = day <= 3 ? '' : 'none';
    } else {
      item.style.display = '';
    }
  });
  const note = document.querySelector('.timeline-note');
  if (note) {
    note.style.display = days === 3 ? 'none' : '';
  }
}

journeyBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    journeyBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateJourney(parseInt(btn.dataset.journey));
  });
});

// Default to 5-day view
updateJourney(5);

// ── Photo carousel ──────────────────────────────────
const carouselTrack = document.getElementById('carousel-track');
if (carouselTrack) {
  const dots  = document.querySelectorAll('.carousel-dot');
  const total = carouselTrack.querySelectorAll('img').length;
  let current = 0;

  function goTo(n) {
    current = (n + total) % total;
    carouselTrack.style.transform = `translateX(-${current * 100}%)`;
    dots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  document.getElementById('carousel-prev').addEventListener('click', () => goTo(current - 1));
  document.getElementById('carousel-next').addEventListener('click', () => goTo(current + 1));
  dots.forEach((dot, i) => dot.addEventListener('click', () => goTo(i)));

  // Auto-advance every 4 seconds
  setInterval(() => goTo(current + 1), 4000);
}

// ── Google Translate ─────────────────────────────────
function googleTranslateElementInit() {
  const opts = {
    pageLanguage: 'en',
    includedLanguages: 'de,en',
    layout: google.translate.TranslateElement.InlineLayout.SIMPLE
  };
  new google.translate.TranslateElement(opts, 'google_translate_element_nav');
  new google.translate.TranslateElement(opts, 'google_translate_element_footer');
}
