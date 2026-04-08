// ════════════════════════════════════════════════════
// SUPABASE CONFIG
// ════════════════════════════════════════════════════
const SUPABASE_URL = 'https://nisapebptuqykfaootju.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pc2FwZWJwdHVxeWtmYW9vdGp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTY5MjIsImV4cCI6MjA5MTIzMjkyMn0.CGoiEPcWWs7OSkJfCoBuFS6vvmOe98LDpRC1mGDImgA';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// ── Section-aware nav ──────────────────────────────
const nav = document.getElementById('main-nav');

const NAV_SECTION_STYLE = {
  'hero':         'nav-hero',
  'pricing':      'nav-bg-brown',
  'testimonials': 'nav-bg-terracotta',
  'booking':      'nav-transparent',
  'experience':   'nav-bg-experience',
  'hotels':       'nav-bg-hotels',
};
const ALL_NAV_CLASSES = ['nav-hero', 'nav-bg-brown', 'nav-bg-terracotta', 'nav-transparent', 'nav-bg-experience', 'nav-bg-hotels', 'scrolled'];

function applyNavSection(sectionId) {
  nav.classList.remove(...ALL_NAV_CLASSES);
  const cls = NAV_SECTION_STYLE[sectionId] || 'scrolled';
  nav.classList.add(cls);
}

const navSections = Array.from(document.querySelectorAll('section[id]'));

function updateNavFromScroll() {
  const navBottom = nav.offsetHeight + 4;
  let active = navSections[0];
  for (const section of navSections) {
    if (section.getBoundingClientRect().top <= navBottom) {
      active = section;
    }
  }
  applyNavSection(active.id);
}

window.addEventListener('scroll', updateNavFromScroll, { passive: true });
updateNavFromScroll();

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

// ── Date picker ──────────────────────────────────────
const MONTHS   = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAYS = ['Su','Mo','Tu','We','Th','Fr','Sa'];

const STRIPE_LINKS = {
  3: 'https://buy.stripe.com/9B6aEW4659AQbc9bFr5wI01',
  5: 'https://book.stripe.com/cNi5kC32114k1Bz4cZ5wI00'
};

// Blocked dates loaded from Supabase (set of "YYYY-MM-DD" strings)
let blockedDates = new Set();

function dpPad(n) { return String(n).padStart(2, '0'); }

// Returns true if all days in [startDate, startDate + days - 1] are not blocked and not in the past
function rangeAvailable(startStr, days) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 0; i < days; i++) {
    const d = new Date(startStr + 'T00:00:00');
    d.setDate(d.getDate() + i);
    if (d < today) return false;
    const ds = `${d.getFullYear()}-${dpPad(d.getMonth()+1)}-${dpPad(d.getDate())}`;
    if (blockedDates.has(ds)) return false;
  }
  return true;
}

function createCalendar(ids) {
  let selected = null;
  let duration = 3;
  const today  = new Date();
  let month    = today.getMonth();
  let year     = today.getFullYear();

  function render() {
    const label = document.getElementById(ids.label);
    const grid  = document.getElementById(ids.grid);
    const info  = document.getElementById(ids.info);

    label.textContent = MONTHS[month] + ' ' + year;
    grid.innerHTML = '';

    WEEKDAYS.forEach(d => {
      const el = document.createElement('div');
      el.className = 'dp-weekday';
      el.textContent = d;
      grid.appendChild(el);
    });

    const firstDay    = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div');
      el.className = 'dp-day';
      grid.appendChild(el);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const ds    = `${year}-${dpPad(month+1)}-${dpPad(d)}`;
      const avail = rangeAvailable(ds, duration);
      const el    = document.createElement('div');
      el.className = 'dp-day' + (avail ? ' available' : '');
      el.textContent = d;

      if (selected) {
        const start = new Date(selected + 'T00:00:00');
        const end   = new Date(selected + 'T00:00:00');
        end.setDate(end.getDate() + duration - 1);
        const cur = new Date(ds + 'T00:00:00');
        if (ds === selected)                              el.classList.add('selected');
        else if (cur > start && cur < end)                el.classList.add('in-range');
        else if (cur.toDateString() === end.toDateString()) el.classList.add('end-date');
      }

      if (avail) el.addEventListener('click', () => {
        selected = ds;
        render();
        if (ids.onSelect) ids.onSelect(selected, duration);
      });

      grid.appendChild(el);
    }

    if (selected) {
      const s = new Date(selected + 'T00:00:00');
      const e = new Date(selected + 'T00:00:00');
      e.setDate(e.getDate() + duration - 1);
      info.textContent =
        s.toLocaleDateString('en-GB', { day:'numeric', month:'short' }) +
        ' → ' +
        e.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
    } else {
      info.textContent = 'Select an available date to begin';
    }
  }

  document.getElementById(ids.prev).addEventListener('click', () => {
    month--; if (month < 0) { month = 11; year--; } render();
  });
  document.getElementById(ids.next).addEventListener('click', () => {
    month++; if (month > 11) { month = 0; year++; } render();
  });

  const durBtns = document.querySelectorAll('#' + ids.durContainer + ' .dp-dur-btn');
  durBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      durBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      duration = parseInt(btn.dataset.days);
      selected = null;
      if (ids.stripeBtn) document.getElementById(ids.stripeBtn).href = STRIPE_LINKS[duration];
      render();
    });
  });

  render();

  return {
    setDuration(d) {
      duration = d;
      selected = null;
      durBtns.forEach(b => b.classList.toggle('active', parseInt(b.dataset.days) === d));
      render();
    },
    getSelected() { return { date: selected, duration }; },
    refresh() { render(); }
  };
}

// Initialise calendars (rendered immediately, refreshed once blocked dates load)
const mainCal = createCalendar({
  prev: 'dp-prev', next: 'dp-next',
  label: 'dp-month-label', grid: 'dp-grid', info: 'dp-info',
  durContainer: 'booking-dur'
});

const modalCal = createCalendar({
  prev: 'modal-dp-prev', next: 'modal-dp-next',
  label: 'modal-dp-month-label', grid: 'modal-dp-grid', info: 'modal-dp-info',
  durContainer: 'modal-dp-duration',
  onSelect: () => { document.getElementById('dp-step1-next').disabled = false; }
});

// Load blocked dates from Supabase, then re-render calendars
(async () => {
  const { data, error } = await sb.from('blocked_dates').select('date');
  if (!error && data) {
    blockedDates = new Set(data.map(d => d.date));
    mainCal.refresh();
    modalCal.refresh();
    // Reset modal "next" button in case selected date is now blocked
    document.getElementById('dp-step1-next').disabled = true;
  }
})();

// ── Modal step navigation ────────────────────────────
const dpModal = document.getElementById('dp-modal');
const dpSteps = [
  document.getElementById('dp-step-1'),
  document.getElementById('dp-step-2'),
  document.getElementById('dp-step-3')
];

function showDpStep(n) {
  dpSteps.forEach((s, i) => s.style.display = i === n ? '' : 'none');
  dpModal.querySelector('.dp-modal-card').scrollTop = 0;
}

document.querySelectorAll('.open-dp-modal').forEach(btn => {
  btn.addEventListener('click', () => {
    const days  = parseInt(btn.dataset.days);
    const label = days === 3 ? '3-Day Immersion' : '5-Day Immersion';
    modalCal.setDuration(days);
    document.getElementById('dp-step1-next').disabled = true;
    document.getElementById('dp-modal-package').textContent = label;
    dpModalCompleted = false;
    showDpStep(0);
    dpModal.classList.add('open');
  });
});

// Step 1 → Step 2
document.getElementById('dp-step1-next').addEventListener('click', () => {
  const { date, duration } = modalCal.getSelected();
  const label = duration === 3 ? '3-Day Immersion' : '5-Day Immersion';
  const dateFormatted = new Date(date + 'T00:00:00').toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' });
  document.getElementById('dp-step2-label').textContent = label;
  document.getElementById('modal-hidden-package').value = label;
  document.getElementById('modal-hidden-date').value    = dateFormatted;
  showDpStep(1);
});

// Step 2 → Step 1 (back)
document.getElementById('dp-step2-back').addEventListener('click', () => showDpStep(0));

// ── Modal form → save to Supabase ────────────────────
const modalForm = document.getElementById('modal-inquiry-form');
let dpModalCompleted = false;

modalForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const fd       = new FormData(modalForm);
  const pkg      = fd.get('Package') || '';
  const duration = pkg.startsWith('3') ? 3 : 5;

  // Parse the date back to ISO format
  const rawDate  = document.getElementById('modal-hidden-date').value;
  const dateObj  = new Date(rawDate);
  const isoDate  = isNaN(dateObj)
    ? null
    : `${dateObj.getFullYear()}-${dpPad(dateObj.getMonth()+1)}-${dpPad(dateObj.getDate())}`;

  // Collect hotel selections
  const hotels = ['Le Méridien Vienna','Almanac Palais Vienna','The Ritz-Carlton, Vienna','No accommodation needed']
    .filter(h => fd.get('Hotel') === h || modalForm.querySelectorAll(`[name="Hotel"]:checked`))
    .map(h => {
      const cb = modalForm.querySelector(`[name="Hotel"][value="${h}"]`);
      return (cb && cb.checked) ? h : null;
    })
    .filter(Boolean)
    .join(', ');

  const booking = {
    names:             fd.get('Names')        || '',
    email:             fd.get('email')        || '',
    package:           pkg,
    duration_days:     duration,
    start_date:        isoDate,
    location:          fd.get('Location')     || '',
    intention:         fd.get('Intention')    || '',
    experience:        fd.get('Experience')   || '',
    photography_addon: modalForm.querySelector('[name="Photography Add-On"]')?.checked || false,
    hotel:             hotels || '',
    notes:             fd.get('Notes')        || '',
    status:            'new'
  };

  const submitBtn = modalForm.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Sending…';

  const { error } = await sb.from('bookings').insert(booking);

  submitBtn.disabled = false;
  submitBtn.textContent = 'Send Inquiry';

  if (!error) {
    dpModalCompleted = true;
    modalForm.reset();
    showDpStep(2);
  } else {
    alert('Something went wrong. Please email Tina directly at koestler.tina@gmail.com');
  }
});

// Step 3 close
document.getElementById('dp-step3-close').addEventListener('click', () => dpModal.classList.remove('open'));

// ── Partial capture on modal close ──────────────────
function sendPartialCapture() {
  if (dpModalCompleted) return;
  const email = modalForm.querySelector('[name="email"]').value.trim();
  if (!email) return;

  const data = new FormData();
  data.append('_subject', 'Abandoned Inquiry');
  data.append('Status',   'Abandoned — form not completed');
  data.append('email',    email);
  const pkg   = document.getElementById('modal-hidden-package').value;
  const date  = document.getElementById('modal-hidden-date').value;
  const names = modalForm.querySelector('[name="Names"]').value.trim();
  if (pkg)   data.append('Package',              pkg);
  if (date)  data.append('Preferred Start Date', date);
  if (names) data.append('Names',                names);

  navigator.sendBeacon('https://formspree.io/f/xlgoogbk', data);
}

function closeModal() {
  sendPartialCapture();
  dpModal.classList.remove('open');
  dpModalCompleted = false;
}

dpModal.addEventListener('click', (e) => { if (e.target === dpModal) closeModal(); });
document.getElementById('dp-modal-close').addEventListener('click', closeModal);

// ── Inquiry form (bottom) → stays on Formspree ──────
const form  = document.getElementById('inquiry-form');
const modal = document.getElementById('form-modal');

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
      form.reset();
      modal.classList.add('open');
    } else {
      alert('Something went wrong. Please email Tina directly at koestler.tina@gmail.com');
    }
  } catch {
    alert('Something went wrong. Please email Tina directly at koestler.tina@gmail.com');
  }
});

modal.addEventListener('click', (e) => {
  if (e.target === modal) modal.classList.remove('open');
});

// ── Journey toggle ───────────────────────────────────
const journeyBtns   = document.querySelectorAll('#journey-toggle button');
const timelineItems = document.querySelectorAll('.timeline-item');

function updateJourney(days) {
  timelineItems.forEach(item => {
    const show = item.dataset.show || 'both';
    item.style.display = (show === 'both' || show === String(days)) ? '' : 'none';
  });
  const note = document.querySelector('.timeline-note');
  if (note) note.style.display = days === 3 ? 'none' : '';
}

journeyBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    journeyBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    updateJourney(parseInt(btn.dataset.journey));
  });
});

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

  setInterval(() => goTo(current + 1), 5000);
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
