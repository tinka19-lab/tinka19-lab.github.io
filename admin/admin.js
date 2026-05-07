// ── Config ────────────────────────────────────────────────────
const SUPABASE_URL = 'https://nisapebptuqykfaootju.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pc2FwZWJwdHVxeWtmYW9vdGp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTY5MjIsImV4cCI6MjA5MTIzMjkyMn0.CGoiEPcWWs7OSkJfCoBuFS6vvmOe98LDpRC1mGDImgA'

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

// ── State ─────────────────────────────────────────────────────
let blockedDates   = new Set()
let bookings       = []
let calMonth, calYear
let contentLoadedEN = false
let contentLoadedDE = false
let contentDays     = []
let pendingPhotos   = {}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  const { data: { session } } = await sb.auth.getSession()
  if (session) showDashboard()
  else         showLogin()

  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN')  showDashboard()
    if (event === 'SIGNED_OUT') showLogin()
  })

  document.getElementById('login-btn').addEventListener('click', handleLogin)
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin()
  })

  document.getElementById('logout-btn').addEventListener('click', () => sb.auth.signOut())

  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  )

  document.getElementById('cal-prev').addEventListener('click', () => {
    calMonth--
    if (calMonth < 0) { calMonth = 11; calYear-- }
    renderAdminCal()
  })
  document.getElementById('cal-next').addEventListener('click', () => {
    calMonth++
    if (calMonth > 11) { calMonth = 0; calYear++ }
    renderAdminCal()
  })

  document.getElementById('refresh-btn').addEventListener('click', async () => {
    document.getElementById('bookings-list').innerHTML = '<div class="loading">Loading…</div>'
    await loadBookings()
    renderBookings()
  })
})

// ── Auth ──────────────────────────────────────────────────────
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex'
  document.getElementById('dashboard').style.display    = 'none'
}

async function handleLogin() {
  const email    = document.getElementById('login-email').value.trim()
  const password = document.getElementById('login-password').value
  const errEl    = document.getElementById('login-error')
  const btn      = document.getElementById('login-btn')

  errEl.style.display = 'none'
  btn.textContent = 'Signing in…'
  btn.disabled    = true

  const { error } = await sb.auth.signInWithPassword({ email, password })

  btn.textContent = 'Sign In'
  btn.disabled    = false

  if (error) {
    errEl.textContent   = 'Invalid email or password.'
    errEl.style.display = 'block'
  }
}

// ── Dashboard ─────────────────────────────────────────────────
async function showDashboard() {
  document.getElementById('login-screen').style.display = 'none'
  document.getElementById('dashboard').style.display    = 'block'

  const today = new Date()
  calMonth = today.getMonth()
  calYear  = today.getFullYear()

  await Promise.all([loadBlockedDates(), loadBookings()])
  renderAdminCal()
  renderBookings()

  const hash = window.location.hash.replace('#', '')
  if (['availability','bookings','content-en','content-de'].includes(hash)) switchTab(hash)
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  )
  document.getElementById('tab-availability').style.display  = tab === 'availability' ? '' : 'none'
  document.getElementById('tab-bookings').style.display      = tab === 'bookings'     ? '' : 'none'
  document.getElementById('tab-content-en').style.display    = tab === 'content-en'   ? '' : 'none'
  document.getElementById('tab-content-de').style.display    = tab === 'content-de'   ? '' : 'none'

  window.location.hash = tab

  if (tab === 'content-en' && !contentLoadedEN) {
    contentLoadedEN = true
    initContentTab('en')
  }
  if (tab === 'content-de' && !contentLoadedDE) {
    contentLoadedDE = true
    initContentTab('de')
  }
}

// ── Availability ──────────────────────────────────────────────
async function loadBlockedDates() {
  const { data, error } = await sb.from('blocked_dates').select('date')
  if (!error && data) blockedDates = new Set(data.map(d => d.date))
}

async function toggleDate(dateStr, el) {
  el.style.pointerEvents = 'none'

  if (blockedDates.has(dateStr)) {
    const { error } = await sb.from('blocked_dates').delete().eq('date', dateStr)
    if (!error) blockedDates.delete(dateStr)
  } else {
    const { error } = await sb.from('blocked_dates').insert({ date: dateStr })
    if (!error) blockedDates.add(dateStr)
  }

  el.style.pointerEvents = ''
  renderAdminCal()
}

function renderAdminCal() {
  const grid     = document.getElementById('cal-grid')
  const label    = document.getElementById('cal-label')
  const todayStr = toDateStr(new Date())

  label.textContent = `${MONTHS[calMonth]} ${calYear}`
  grid.innerHTML    = ''

  const firstDay    = new Date(calYear, calMonth, 1).getDay()
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()

  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div')
    el.className = 'cal-day empty'
    grid.appendChild(el)
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const ds  = `${calYear}-${pad(calMonth + 1)}-${pad(d)}`
    const el  = document.createElement('div')

    const isPast    = ds < todayStr
    const isBlocked = blockedDates.has(ds)
    const isToday   = ds === todayStr

    let cls = 'cal-day'
    if (isPast)         cls += ' past'
    else if (isBlocked) cls += ' blocked'
    else                cls += ' open'
    if (isToday)        cls += ' today'

    el.className   = cls
    el.textContent = d

    if (!isPast) el.addEventListener('click', () => toggleDate(ds, el))

    grid.appendChild(el)
  }
}

// ── Bookings ──────────────────────────────────────────────────
async function loadBookings() {
  const { data, error } = await sb
    .from('bookings')
    .select('*')
    .order('created_at', { ascending: false })
  if (!error && data) bookings = data
}

function renderBookings() {
  const list     = document.getElementById('bookings-list')
  const newCount = bookings.filter(b => b.status === 'new').length
  const badge    = document.getElementById('new-badge')

  badge.textContent    = newCount
  badge.style.display  = newCount > 0 ? 'inline-block' : 'none'

  if (!bookings.length) {
    list.innerHTML = '<div class="empty-state"><p>No bookings yet.</p></div>'
    return
  }

  list.innerHTML = ''

  bookings.forEach(b => {
    const card = document.createElement('div')
    card.className  = 'booking-card' + (b.status === 'new' ? ' is-new' : '')
    card.dataset.id = b.id

    const received = new Date(b.created_at).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
    const startFmt = b.start_date
      ? new Date(b.start_date + 'T00:00:00').toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric'
        })
      : '—'

    card.innerHTML = `
      <div class="booking-row" onclick="toggleDetail('${b.id}')">
        <div>
          <div class="booking-names">${esc(b.names)}</div>
          <div class="booking-email">${esc(b.email)}</div>
        </div>
        <div class="booking-meta">${esc(b.package)}</div>
        <div class="booking-date-col">${startFmt}</div>
        <div class="booking-date-col">${received}</div>
        <div><span class="status-badge status-${b.status}">${statusLabel(b.status)}</span></div>
      </div>
      <div class="booking-detail" id="detail-${b.id}" style="display:none">
        ${buildDetail(b)}
      </div>
    `

    list.appendChild(card)
  })
}

function buildDetail(b) {
  const hotels = b.hotel     || '—'
  const photo  = b.photography_addon ? 'Yes — interested' : 'No'

  return `
    <div class="detail-grid">
      <div class="detail-field">
        <label>Email</label>
        <div class="value"><a href="mailto:${esc(b.email)}">${esc(b.email)}</a></div>
      </div>
      <div class="detail-field">
        <label>Location</label>
        <div class="value">${esc(b.location || '—')}</div>
      </div>
      <div class="detail-field">
        <label>Package</label>
        <div class="value">${esc(b.package)}</div>
      </div>
      <div class="detail-field">
        <label>Start Date</label>
        <div class="value">${b.start_date
          ? new Date(b.start_date + 'T00:00:00').toLocaleDateString('en-GB', {
              day: 'numeric', month: 'long', year: 'numeric'
            })
          : '—'}</div>
      </div>
      <div class="detail-field">
        <label>Prior Experience</label>
        <div class="value">${esc(b.experience || '—')}</div>
      </div>
      <div class="detail-field">
        <label>Photography Add-On</label>
        <div class="value">${photo}</div>
      </div>
      <div class="detail-field" style="grid-column:1/-1">
        <label>Hotel Preference</label>
        <div class="value">${esc(hotels)}</div>
      </div>
      <div class="detail-field" style="grid-column:1/-1">
        <label>Intention</label>
        <div class="value">${esc(b.intention || '—')}</div>
      </div>
      <div class="detail-field" style="grid-column:1/-1">
        <label>Notes from Client</label>
        <div class="value">${esc(b.notes || '—')}</div>
      </div>
    </div>

    <div class="detail-actions">
      <label>Status</label>
      <select id="status-${b.id}">
        ${['new','reviewing','payment_sent','paid','confirmed','cancelled']
          .map(s => `<option value="${s}" ${b.status === s ? 'selected' : ''}>${statusLabel(s)}</option>`)
          .join('')}
      </select>
      <button class="btn-save" onclick="saveBooking('${b.id}')">Save</button>
      <span class="save-feedback" id="feedback-${b.id}" style="display:none">Saved ✓</span>
    </div>

    <div class="admin-notes-block">
      <label class="admin-notes-label">Your Notes</label>
      <textarea
        class="admin-notes-textarea"
        id="notes-${b.id}"
        placeholder="Private notes — visible only to you…"
      >${esc(b.admin_notes || '')}</textarea>
    </div>
  `
}

function toggleDetail(id) {
  const el = document.getElementById(`detail-${id}`)
  el.style.display = el.style.display === 'none' ? '' : 'none'
}

async function saveBooking(id) {
  const status     = document.getElementById(`status-${id}`).value
  const adminNotes = document.getElementById(`notes-${id}`).value
  const feedback   = document.getElementById(`feedback-${id}`)

  const { error } = await sb
    .from('bookings')
    .update({ status, admin_notes: adminNotes })
    .eq('id', id)

  if (!error) {
    feedback.style.display = 'inline'
    setTimeout(() => { feedback.style.display = 'none' }, 2500)

    const booking = bookings.find(b => b.id === id)
    if (booking) { booking.status = status; booking.admin_notes = adminNotes }

    const newCount = bookings.filter(b => b.status === 'new').length
    const badge    = document.getElementById('new-badge')
    badge.textContent   = newCount
    badge.style.display = newCount > 0 ? 'inline-block' : 'none'

    const card = document.querySelector(`.booking-card[data-id="${id}"]`)
    if (card) {
      const sbadge = card.querySelector('.status-badge')
      if (sbadge) {
        sbadge.className   = `status-badge status-${status}`
        sbadge.textContent = statusLabel(status)
      }
      card.classList.toggle('is-new', status === 'new')
    }
  }
}

// ── Helpers ───────────────────────────────────────────────────
function statusLabel(s) {
  return { new:'New', reviewing:'Reviewing', payment_sent:'Payment Sent',
           paid:'Paid', confirmed:'Confirmed', cancelled:'Cancelled' }[s] || s
}

function esc(str) {
  if (str == null) return ''
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function pad(n)      { return String(n).padStart(2, '0') }
function toDateStr(d){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}` }

// ════════════════════════════════════════════════════
// CONTENT EDITOR
// ════════════════════════════════════════════════════

// All editable sections with their fields
const CONTENT_SECTIONS = {
  en: [
    {
      title: 'Navigation',
      fields: [
        { key: 'nav.experience', label: 'Menu: The Experience',   type: 'text',     default: 'The Experience' },
        { key: 'nav.pricing',    label: 'Menu: Pricing',          type: 'text',     default: 'Pricing' },
        { key: 'nav.hotels',     label: 'Menu: Hotels',           type: 'text',     default: 'Hotels' },
        { key: 'nav.about',      label: 'Menu: About Tina',       type: 'text',     default: 'About Tina' },
        { key: 'nav.faq',        label: 'Menu: FAQ',              type: 'text',     default: 'FAQ' },
        { key: 'nav.cta',        label: 'Menu: Book a Free Call', type: 'text',     default: 'Book a Free Call' },
      ]
    },
    {
      title: 'Hero',
      fields: [
        { key: 'hero.label',        label: 'Label (small text)',  type: 'text',     default: 'Vienna · Private · By Application Only' },
        { key: 'hero.h1',           label: 'Headline',            type: 'textarea', default: 'Where two become\none again.' },
        { key: 'hero.subhead',      label: 'Subheading',          type: 'textarea', default: 'A fully private 3 to 5 day Tantric immersion in Vienna,\ndesigned exclusively for you as a couple.' },
        { key: 'hero.btn_primary',  label: 'Button: Reserve',     type: 'text',     default: 'Reserve Your Dates' },
        { key: 'hero.btn_secondary',label: 'Button: Explore',     type: 'text',     default: 'Explore the Experience' },
      ]
    },
    {
      title: 'Opening Statement',
      fields: [
        { key: 'invitation.label',      label: 'Label',           type: 'text',     default: 'An Invitation' },
        { key: 'invitation.h2',         label: 'Headline',        type: 'textarea', default: 'This is not a retreat.\nIt is a return.' },
        { key: 'invitation.p1',         label: 'Paragraph 1',     type: 'textarea', default: 'Most couples arrive at intimacy through habit — repeating patterns that once felt alive and have slowly grown quieter. Not because love has faded. Because no one ever taught them how to keep deepening it.' },
        { key: 'invitation.p2',         label: 'Paragraph 2',     type: 'textarea', default: 'The Private Tantra Couples Immersion is a fully curated 3 to 5 day experience in Vienna, created for couples who are ready to move beyond the surface of their connection. Into genuine presence. Into erotic aliveness. Into the kind of intimacy that continues long after you return home.' },
        { key: 'invitation.p3',         label: 'Paragraph 3',     type: 'textarea', default: 'Whether you are newly together or have shared decades — this experience meets you exactly where you are.' },
        { key: 'invitation.blockquote', label: 'Quote',           type: 'textarea', default: '"This work is not about fixing what is broken.\nIt is about remembering what was always there."' },
        { key: 'invitation.cite',       label: 'Quote attribution',type: 'text',    default: '— Tina Koestler' },
      ]
    },
    {
      title: 'Experience Section',
      fields: [
        { key: 'experience.label',         label: 'Label',          type: 'text',     default: 'Your Journey' },
        { key: 'experience.h2',            label: 'Headline',       type: 'text',     default: 'Five Days. One Transformation.' },
        { key: 'experience.p',             label: 'Description',    type: 'textarea', default: 'Each day is thoughtfully sequenced — building on what came before, and preparing you for what comes next. Shorter stays of 3 days are available and will be curated accordingly.' },
        { key: 'experience.timeline_note', label: 'Footer note',    type: 'textarea', default: '"Shorter stays of 3 days are available and carefully curated to honour the most essential arc of the journey. Contact me to discuss what feels right for you."' },
      ]
    },
    {
      title: 'Pricing — General',
      fields: [
        { key: 'pricing.label',        label: 'Label',          type: 'text',     default: 'Investment' },
        { key: 'pricing.h2',           label: 'Headline',       type: 'text',     default: 'Choose Your Experience' },
        { key: 'pricing.note',         label: 'Subtitle note',  type: 'textarea', default: 'Accommodation is shown as a separate add-on below — both tiers are available with or without hotel. Pricing shown is for the experience service only.' },
        { key: 'pricing.deposit_note', label: 'Deposit note',   type: 'text',     default: '20% deposit required to confirm. Balance due before arrival.' },
        { key: 'pricing.addons.label', label: 'Add-ons label',  type: 'text',     default: 'Enhance Your Experience' },
        { key: 'pricing.addons.p',     label: 'Add-ons text',   type: 'textarea', default: 'Both packages can be complemented with optional add-ons. The order matters — a photoshoot is best experienced after your immersion sessions, before you depart.' },
        { key: 'pricing.addons.note',  label: 'Add-ons note',   type: 'text',     default: 'Both add-ons are entirely optional and can be booked separately or together.' },
      ]
    },
    {
      title: 'Pricing — Sensuality Package (Tier 1)',
      fields: [
        { key: 'pricing.t1.tag',   label: 'Tag',         type: 'text',     default: 'Self-Guided' },
        { key: 'pricing.t1.name',  label: 'Name',        type: 'text',     default: 'Sensuality Package' },
        { key: 'pricing.t1.price', label: 'Price',       type: 'text',     default: '€497' },
        { key: 'pricing.t1.desc',  label: 'Description', type: 'textarea', default: 'For couples who want to begin this journey in their own way and their own time. Bring the essence of the immersion into your home with a curated sensory experience.' },
        { key: 'pricing.t1.f1',    label: 'Feature 1',   type: 'textarea', default: 'Curated Tantric Wellness Box — premium gifts chosen to open your senses and deepen your connection, valued at €350' },
        { key: 'pricing.t1.f2',    label: 'Feature 2',   type: 'textarea', default: 'Self-Guided Retreat: video recordings and guided practices, tasks and assignments to guide you through Tantric intimacy practices' },
        { key: 'pricing.t1.f3',    label: 'Feature 3',   type: 'textarea', default: 'Lovers\' Ritual Guide — a beautifully curated companion to take home and continue your journey' },
        { key: 'pricing.t1.f4',    label: 'Feature 4',   type: 'textarea', default: 'Can be complemented with the Photography Add-On, and optionally with hotel accommodation (see below)' },
        { key: 'pricing.t1.btn',   label: 'Button text', type: 'text',     default: 'Reserve Sensuality Package' },
      ]
    },
    {
      title: 'Pricing — 3-Day Immersion',
      fields: [
        { key: 'pricing.t2_3.tag',        label: 'Tag',         type: 'text',     default: '3-Day Immersion' },
        { key: 'pricing.t2_3.name',       label: 'Name',        type: 'text',     default: 'The Immersion' },
        { key: 'pricing.t2_3.price',      label: 'Price',       type: 'text',     default: 'From €950' },
        { key: 'pricing.t2_3.price_note', label: 'Price note',  type: 'textarea', default: 'Experience only, without hotel accommodation. Contact me for your personalised quote.' },
        { key: 'pricing.t2_3.f1',         label: 'Feature 1',   type: 'textarea', default: 'Curated Tantric Wellness Box — premium gifts chosen to open your senses and deepen your connection, valued at €350' },
        { key: 'pricing.t2_3.f2',         label: 'Feature 2',   type: 'textarea', default: '1 × private couples workshop with Tina Koestler (3 hours)' },
        { key: 'pricing.t2_3.f3',         label: 'Feature 3',   type: 'textarea', default: 'Lovers\' Ritual Guide — a beautifully curated companion to take home and continue your journey' },
        { key: 'pricing.t2_3.f4',         label: 'Feature 4',   type: 'textarea', default: 'Personalised session design based on your intentions and comfort level' },
        { key: 'pricing.t2_3.f5',         label: 'Feature 5',   type: 'textarea', default: 'Intimacy rituals, opening and closing ceremonies' },
        { key: 'pricing.t2_3.f6',         label: 'Feature 6',   type: 'textarea', default: '30-minute integration call with me approx. 2 weeks after your immersion' },
        { key: 'pricing.t2_3.f7',         label: 'Feature 7',   type: 'textarea', default: 'Can be complemented with the Photography Add-On, and optionally with hotel accommodation (see below)' },
        { key: 'pricing.t2_3.btn',        label: 'Button text', type: 'text',     default: 'Reserve 3-Day Immersion' },
      ]
    },
    {
      title: 'Pricing — 5-Day Immersion',
      fields: [
        { key: 'pricing.t2_5.tag',        label: 'Tag',         type: 'text',     default: '5-Day Immersion' },
        { key: 'pricing.t2_5.name',       label: 'Name',        type: 'text',     default: 'The Immersion' },
        { key: 'pricing.t2_5.price',      label: 'Price',       type: 'text',     default: 'From €1,400' },
        { key: 'pricing.t2_5.price_note', label: 'Price note',  type: 'textarea', default: 'Experience only, without hotel accommodation. Contact me for your personalised quote.' },
        { key: 'pricing.t2_5.f1',         label: 'Feature 1',   type: 'textarea', default: 'Curated Tantric Wellness Box — premium gifts chosen to open your senses and deepen your connection, valued at €350' },
        { key: 'pricing.t2_5.f2',         label: 'Feature 2',   type: 'textarea', default: '2 × private couples workshops with Tina Koestler' },
        { key: 'pricing.t2_5.f3',         label: 'Feature 3',   type: 'textarea', default: 'Lovers\' Ritual Guide — a beautifully curated companion to take home and continue your journey' },
        { key: 'pricing.t2_5.f4',         label: 'Feature 4',   type: 'textarea', default: 'Personalised session design based on your intentions and comfort level' },
        { key: 'pricing.t2_5.f5',         label: 'Feature 5',   type: 'textarea', default: 'Intimacy rituals, opening and closing ceremonies' },
        { key: 'pricing.t2_5.f6',         label: 'Feature 6',   type: 'textarea', default: '30-minute integration call with me approx. 2 weeks after your immersion' },
        { key: 'pricing.t2_5.f7',         label: 'Feature 7',   type: 'textarea', default: 'Can be complemented with the Photography Add-On, and optionally with hotel accommodation (see below)' },
        { key: 'pricing.t2_5.btn',        label: 'Button text', type: 'text',     default: 'Reserve 5-Day Immersion' },
      ]
    },
    {
      title: 'Photography',
      fields: [
        { key: 'photo.label',       label: 'Label',                 type: 'text',     default: 'Optional Add-On' },
        { key: 'photo.h2',          label: 'Headline',              type: 'text',     default: 'Capture It Forever.' },
        { key: 'photo.p1',          label: 'Paragraph 1',           type: 'textarea', default: 'Some experiences deserve to be remembered in images that match the depth of what was felt.' },
        { key: 'photo.p2',          label: 'Paragraph 2',           type: 'textarea', default: 'As an optional addition to your immersion, I offer access to Patrick Schörg — Vienna\'s most awarded intimate photographer, and one of the leading boudoir and erotic photographers in the German-speaking world.' },
        { key: 'photo.opt1.title',  label: 'Option 1 title',        type: 'text',     default: 'Erotic Couples Photoshoot' },
        { key: 'photo.opt1.p',      label: 'Option 1 description',  type: 'textarea', default: 'A private, fully guided session for you as a couple. Intimate, artful, and completely yours — images you will treasure for the rest of your lives.' },
        { key: 'photo.opt2.title',  label: 'Option 2 title',        type: 'text',     default: 'Divine Feminine Photoshoot' },
        { key: 'photo.opt2.p',      label: 'Option 2 description',  type: 'textarea', default: 'A solo experience for the woman — a boudoir session designed to reveal your sensuality, strength and beauty in a way you have perhaps never seen yourself before.' },
        { key: 'photo.btn',         label: 'Button text',           type: 'text',     default: 'Add a Photoshoot to My Booking' },
      ]
    },
    {
      title: 'Hotels',
      fields: [
        { key: 'hotels.label',         label: 'Label',                type: 'text',     default: 'Accommodation' },
        { key: 'hotels.h2',            label: 'Headline',             type: 'text',     default: 'Stay in the Heart of Vienna' },
        { key: 'hotels.p',             label: 'Description',          type: 'textarea', default: 'I have curated three exceptional hotels in Vienna that match the intimacy and quality of this experience. Add accommodation to either tier at checkout, or arrive with your own arrangements.' },
        { key: 'hotels.meridien.tag',  label: 'Le Méridien: tag',     type: 'text',     default: 'Contemporary Luxury' },
        { key: 'hotels.meridien.desc', label: 'Le Méridien: description', type: 'textarea', default: 'A refined 5-star hotel in the heart of Vienna\'s 1st district, steps from the Ringstrasse and the Vienna State Opera. Le Méridien blends contemporary design with Viennese grandeur, featuring spacious rooms, a wellness spa, and the kind of effortless elegance that invites couples to slow down and be fully present together.' },
        { key: 'hotels.almanac.tag',   label: 'Almanac Palais: tag',  type: 'text',     default: 'Intimate Palais' },
        { key: 'hotels.almanac.desc',  label: 'Almanac Palais: description', type: 'textarea', default: 'A boutique luxury hotel housed in a restored 19th-century Palais on Parkring, overlooking the Stadtpark. Almanac Palais Vienna offers intimate, individually designed rooms, a rooftop terrace, and an atmosphere of quiet sophistication — a rare find in the heart of Vienna.' },
        { key: 'hotels.ritz.tag',      label: 'Ritz-Carlton: tag',    type: 'text',     default: 'Iconic Grandeur' },
        { key: 'hotels.ritz.desc',     label: 'Ritz-Carlton: description', type: 'textarea', default: 'Vienna\'s most celebrated address for those who seek the pinnacle of luxury. Located on Schubertring opposite the Stadtpark, The Ritz-Carlton occupies two restored historic palaces. With its legendary service, ornate suites, and Degas Spa, it is the ultimate setting for an unforgettable couples experience.' },
        { key: 'hotels.note1',         label: 'Note 1',               type: 'textarea', default: 'By selecting a hotel, you are enquiring about availability for your desired dates. If your preferred hotel is not available, I will personally reach out to offer a suitable alternative. Only upon your agreement will I proceed with making the reservation on your behalf.' },
        { key: 'hotels.note2',         label: 'Note 2',               type: 'textarea', default: 'Hotel accommodation is an optional add-on. This concierge service may also include additional arrangements such as private transportation, restaurant reservations, theater tickets, or similar services at additional cost.' },
      ]
    },
    {
      title: 'About Tina',
      fields: [
        { key: 'about.label', label: 'Label',        type: 'text',     default: 'Your Guide' },
        { key: 'about.h2',    label: 'Headline',     type: 'text',     default: 'Hi, I\'m Tina.' },
        { key: 'about.p1',    label: 'Paragraph 1',  type: 'textarea', default: 'For most of my adult life I was very good at being capable. I knew how to hold things together, show up reliably, and make things work — in my career, in relationships, in all the ways that earn respect and keep things running smoothly.' },
        { key: 'about.p2',    label: 'Paragraph 2',  type: 'textarea', default: 'What I didn\'t know was how to truly let someone in. How to be present in my own body. How to receive as fully as I gave.' },
        { key: 'about.p3',    label: 'Paragraph 3',  type: 'textarea', default: 'The path back wasn\'t more doing. It was the body. Breath. Touch. Presence. Learning to trust what I already carried inside me — and learning to share that with another person in a way that actually landed.' },
        { key: 'about.p4',    label: 'Paragraph 4',  type: 'textarea', default: 'Today I guide couples through the same return. Not by fixing what is broken. But by creating the conditions where what is already within you — the desire, the tenderness, the depth of connection — can come alive again.' },
        { key: 'about.c1',    label: 'Credential 1', type: 'text',     default: 'Tantra Facilitator & Somatic Embodiment Coach' },
        { key: 'about.c2',    label: 'Credential 2', type: 'text',     default: 'Womb Wisdom Teacher' },
        { key: 'about.c3',    label: 'Credential 3', type: 'text',     default: 'Based in Vienna & Bratislava' },
        { key: 'about.c4',    label: 'Credential 4', type: 'text',     default: 'Working with couples, women, and men across Central Europe and online' },
        { key: 'about.link',  label: 'Link text',    type: 'text',     default: 'Learn more about my work → tinakoestler.com' },
      ]
    },
    {
      title: 'Testimonials',
      fields: [
        { key: 'testimonials.h2',        label: 'Headline',         type: 'text',     default: 'What Couples Say' },
        { key: 'testimonials.t1.text',   label: 'Testimonial 1',   type: 'textarea', default: 'This experience gave us back something we didn\'t even realise we had lost. We came to Vienna as two people who loved each other. We left as two people who truly knew each other.' },
        { key: 'testimonials.t1.author', label: 'Author 1',        type: 'text',     default: '— M. & T., Vienna' },
        { key: 'testimonials.t2.text',   label: 'Testimonial 2',   type: 'textarea', default: 'Tina created a space that felt completely safe and completely real. Nothing was forced. Everything was invited. We have been together for twelve years and this was the most intimate week of our relationship.' },
        { key: 'testimonials.t2.author', label: 'Author 2',        type: 'text',     default: '— S. & A., Bratislava' },
        { key: 'testimonials.t3.text',   label: 'Testimonial 3',   type: 'textarea', default: 'I came alone for the photoshoot and left with something I cannot fully name. A reclaiming. Tina holds space unlike anyone I have ever worked with.' },
        { key: 'testimonials.t3.author', label: 'Author 3',        type: 'text',     default: '— L., Prague' },
      ]
    },
    {
      title: 'FAQ',
      fields: [
        { key: 'faq.h2', label: 'Headline', type: 'text', default: 'Questions' },
        { key: 'faq.q1', label: 'Question 1', type: 'text',     default: 'Is this experience sexual in nature?' },
        { key: 'faq.a1', label: 'Answer 1',   type: 'textarea', default: 'The immersion explores intimacy, sensuality and erotic energy — but it is not a sexual service. All practices are conducted with full consent, clear boundaries, and within a safe, professional container. Most practices are fully clothed. The yoni-lingam honoring ritual is a sacred practice of reverence, not sexual contact. I will discuss everything with you in your intro call before any booking is confirmed.' },
        { key: 'faq.q2', label: 'Question 2', type: 'text',     default: 'We are beginners — is this right for us?' },
        { key: 'faq.a2', label: 'Answer 2',   type: 'textarea', default: 'Yes. The immersion is designed primarily for beginners and intermediate practitioners. You do not need any prior experience with Tantra. I work entirely at your pace and comfort level. Every session is personalised to where you are.' },
        { key: 'faq.q3', label: 'Question 3', type: 'text',     default: 'What if we are not sure we are ready?' },
        { key: 'faq.a3', label: 'Answer 3',   type: 'textarea', default: 'Book a free intro call with me. Many couples come to that call with exactly this question — and leave knowing clearly whether this is right for them and when. There is no pressure.' },
        { key: 'faq.q4', label: 'Question 4', type: 'text',     default: 'Can we do 3 days instead of 5?' },
        { key: 'faq.a4', label: 'Answer 4',   type: 'textarea', default: 'Yes. A 3-day experience is available and is carefully curated to honour the most essential arc of the journey. Contact me to discuss what feels right.' },
        { key: 'faq.q5', label: 'Question 5', type: 'text',     default: 'Is the accommodation mandatory?' },
        { key: 'faq.a5', label: 'Answer 5',   type: 'textarea', default: 'No. Both tiers are available with or without hotel accommodation. If you are already in Vienna or prefer to arrange your own stay, that is absolutely fine.' },
        { key: 'faq.q6', label: 'Question 6', type: 'text',     default: 'How far in advance should we book?' },
        { key: 'faq.a6', label: 'Answer 6',   type: 'textarea', default: 'As this is a fully private, bespoke experience, I take a limited number of immersion couples per month. I recommend enquiring at least 4–6 weeks in advance. Some dates book out further ahead.' },
        { key: 'faq.q7', label: 'Question 7', type: 'text',     default: 'What language is the immersion conducted in?' },
        { key: 'faq.a7', label: 'Answer 7',   type: 'textarea', default: 'Primarily English. Sessions can also be conducted in German if preferred upon prior agreement. Please mention your language preference when enquiring.' },
        { key: 'faq.q8', label: 'Question 8', type: 'text',     default: 'Is the 20% deposit refundable?' },
        { key: 'faq.a8', label: 'Answer 8',   type: 'textarea', default: 'The deposit secures your dates and covers my preparation time. In the event of cancellation more than 30 days before your start date, 50% of the deposit will be refunded. Cancellations within 30 days are non-refundable. Should I be unable to confirm the booking upon receipt, or need to cancel for any reason, a full 100% refund will of course be issued. Full details provided at booking.' },
      ]
    },
    {
      title: 'Booking Section',
      fields: [
        { key: 'booking.h2',         label: 'Headline',            type: 'text',     default: 'Ready to Begin?' },
        { key: 'booking.p',          label: 'Subtext',             type: 'textarea', default: 'There are two ways to take the next step.\nChoose what feels right for you.' },
        { key: 'booking.opt_a.h3',   label: 'Option A: Heading',   type: 'text',     default: 'Not sure yet?' },
        { key: 'booking.opt_a.sub',  label: 'Option A: Subtitle',  type: 'text',     default: 'Talk to me first.' },
        { key: 'booking.opt_a.p',    label: 'Option A: Text',      type: 'textarea', default: 'A free 30-minute intro call — to ask your questions, share your intentions, and feel whether this experience is right for you. No pressure. Just a conversation.' },
        { key: 'booking.opt_a.btn',  label: 'Option A: Button',    type: 'text',     default: 'Book Your Free Call' },
        { key: 'booking.opt_b.h3',   label: 'Option B: Heading',   type: 'text',     default: 'Ready to commit?' },
        { key: 'booking.opt_b.sub',  label: 'Option B: Subtitle',  type: 'text',     default: 'Reserve with a deposit.' },
        { key: 'booking.opt_b.p',    label: 'Option B: Text',      type: 'textarea', default: 'Select your preferred dates and reserve your immersion with a 20% deposit. I will confirm within 24 hours and send your full intake form.' },
        { key: 'booking.form.label', label: 'Form label',          type: 'text',     default: 'Or send a message' },
        { key: 'booking.form.h3',    label: 'Form heading',        type: 'text',     default: 'Have a specific question?' },
      ]
    },
    {
      title: 'Footer',
      fields: [
        { key: 'footer.tagline', label: 'Tagline (use line breaks with Enter)', type: 'textarea', default: 'Tantra Facilitator\nEmbodiment Coach\nWomb Wisdom Teacher' },
      ]
    },
  ],
  de: [
    {
      title: 'Navigation',
      fields: [
        { key: 'nav.experience', label: 'Menü: Das Erlebnis',          type: 'text', default: 'Das Erlebnis' },
        { key: 'nav.pricing',    label: 'Menü: Preise',                type: 'text', default: 'Preise' },
        { key: 'nav.hotels',     label: 'Menü: Hotels',                type: 'text', default: 'Hotels' },
        { key: 'nav.about',      label: 'Menü: Über Tina',             type: 'text', default: 'Über Tina' },
        { key: 'nav.faq',        label: 'Menü: FAQ',                   type: 'text', default: 'FAQ' },
        { key: 'nav.cta',        label: 'Menü: Kostenloses Gespräch',  type: 'text', default: 'Kostenloses Gespräch buchen' },
      ]
    },
    {
      title: 'Hero',
      fields: [
        { key: 'hero.label',         label: 'Label (kleiner Text)',  type: 'text',     default: 'Wien · Privat · Nur auf Anfrage' },
        { key: 'hero.h1',            label: 'Überschrift',           type: 'textarea', default: 'Zwei werden\nwieder eins.' },
        { key: 'hero.subhead',       label: 'Unterüberschrift',      type: 'textarea', default: 'Ein vollständig privates 3 bis 5-tägiges Tantric Immersion in Wien,\nexklusiv für Sie als Paar gestaltet.' },
        { key: 'hero.btn_primary',   label: 'Button: Reservieren',   type: 'text',     default: 'Termin reservieren' },
        { key: 'hero.btn_secondary', label: 'Button: Entdecken',     type: 'text',     default: 'Das Erlebnis entdecken' },
      ]
    },
    {
      title: 'Eröffnungsstatement',
      fields: [
        { key: 'invitation.label',      label: 'Label',             type: 'text',     default: 'Eine Einladung' },
        { key: 'invitation.h2',         label: 'Überschrift',       type: 'textarea', default: 'Dies ist kein Retreat.\nEs ist eine Rückkehr.' },
        { key: 'invitation.p1',         label: 'Absatz 1',          type: 'textarea', default: 'Die meisten Paare begegnen Intimität durch Gewohnheit — sie wiederholen Muster, die einst lebendig waren und langsam stiller geworden sind. Nicht weil die Liebe verblasst ist. Sondern weil niemand ihnen je gezeigt hat, wie sie sich weiter vertiefen lässt.' },
        { key: 'invitation.p2',         label: 'Absatz 2',          type: 'textarea', default: 'Das Private Tantra Couples Immersion ist ein vollständig kuratiertes 3 bis 5-tägiges Erlebnis in Wien, geschaffen für Paare, die bereit sind, über die Oberfläche ihrer Verbindung hinauszugehen. In echte Präsenz. In erotische Lebendigkeit. In die Art von Intimität, die auch nach der Rückkehr nach Hause anhält.' },
        { key: 'invitation.p3',         label: 'Absatz 3',          type: 'textarea', default: 'Ob Sie gerade erst zusammen sind oder Jahrzehnte miteinander geteilt haben — dieses Erlebnis begegnet Ihnen genau dort, wo Sie stehen.' },
        { key: 'invitation.blockquote', label: 'Zitat',             type: 'textarea', default: '"Diese Arbeit dreht sich nicht darum, etwas zu reparieren, das zerbrochen ist.\nSie dreht sich darum, sich zu erinnern, was schon immer da war."' },
        { key: 'invitation.cite',       label: 'Zitatquelle',       type: 'text',     default: '— Tina Koestler' },
      ]
    },
    {
      title: 'Erlebnis-Bereich',
      fields: [
        { key: 'experience.label',         label: 'Label',            type: 'text',     default: 'Ihre Reise' },
        { key: 'experience.h2',            label: 'Überschrift',      type: 'text',     default: 'Fünf Tage. Eine Transformation.' },
        { key: 'experience.p',             label: 'Beschreibung',     type: 'textarea', default: 'Jeder Tag ist durchdacht aufeinander aufgebaut — er baut auf dem auf, was zuvor war, und bereitet Sie auf das vor, was folgt. Kürzere Aufenthalte von 3 Tagen sind verfügbar und werden entsprechend kuratiert.' },
        { key: 'experience.timeline_note', label: 'Fußnote',          type: 'textarea', default: '"Kürzere Aufenthalte von 3 Tagen sind verfügbar und sorgfältig kuratiert, um den wesentlichsten Bogen der Reise zu ehren. Kontaktieren Sie mich, um zu besprechen, was sich für Sie richtig anfühlt."' },
      ]
    },
    {
      title: 'Preise — Allgemein',
      fields: [
        { key: 'pricing.label',        label: 'Label',             type: 'text',     default: 'Investition' },
        { key: 'pricing.h2',           label: 'Überschrift',       type: 'text',     default: 'Wählen Sie Ihr Erlebnis' },
        { key: 'pricing.note',         label: 'Hinweis',           type: 'textarea', default: 'Unterkunft wird unten als separates Add-on angezeigt — beide Pakete sind mit oder ohne Hotel verfügbar. Die angezeigten Preise gelten nur für das Erlebnis.' },
        { key: 'pricing.deposit_note', label: 'Anzahlungshinweis', type: 'text',     default: '20% Anzahlung zur Bestätigung erforderlich. Restbetrag vor Anreise fällig.' },
        { key: 'pricing.addons.label', label: 'Add-ons Label',     type: 'text',     default: 'Ihr Erlebnis bereichern' },
        { key: 'pricing.addons.p',     label: 'Add-ons Text',      type: 'textarea', default: 'Beide Pakete können durch optionale Add-ons ergänzt werden. Die Reihenfolge ist wichtig — ein Fotoshooting ist am besten nach Ihren Immersions-Sessions erlebt, bevor Sie abreisen.' },
        { key: 'pricing.addons.note',  label: 'Add-ons Hinweis',   type: 'text',     default: 'Beide Add-ons sind vollständig optional und können separat oder zusammen gebucht werden.' },
      ]
    },
    {
      title: 'Preise — Sensuality Package (Tier 1)',
      fields: [
        { key: 'pricing.t1.tag',   label: 'Tag',         type: 'text',     default: 'Selbstgeführt' },
        { key: 'pricing.t1.name',  label: 'Name',        type: 'text',     default: 'Sensuality Package' },
        { key: 'pricing.t1.price', label: 'Preis',       type: 'text',     default: '€497' },
        { key: 'pricing.t1.desc',  label: 'Beschreibung',type: 'textarea', default: 'Für Paare, die diese Reise auf ihre eigene Weise und in ihrem eigenen Tempo beginnen möchten. Bringen Sie das Wesen des Immersions-Erlebnisses mit einer kuratierten sensorischen Erfahrung nach Hause.' },
        { key: 'pricing.t1.f1',    label: 'Punkt 1',     type: 'textarea', default: 'Kuratierte Tantric Wellness Box — hochwertige Geschenke, die Ihre Sinne öffnen und Ihre Verbindung vertiefen, im Wert von €350' },
        { key: 'pricing.t1.f2',    label: 'Punkt 2',     type: 'textarea', default: 'Selbstgeführtes Retreat: Videoaufzeichnungen und geführte Praktiken, Aufgaben und Übungen, die Sie durch tantische Intimitätspraktiken führen' },
        { key: 'pricing.t1.f3',    label: 'Punkt 3',     type: 'textarea', default: 'Lovers\' Ritual Guide — ein wunderschön gestalteter Begleiter für zu Hause, um Ihre Reise fortzusetzen' },
        { key: 'pricing.t1.f4',    label: 'Punkt 4',     type: 'textarea', default: 'Kann durch das Fotoshooting-Add-on ergänzt werden, optional auch mit Hotelunterkunft (siehe unten)' },
        { key: 'pricing.t1.btn',   label: 'Button-Text', type: 'text',     default: 'Sensuality Package reservieren' },
      ]
    },
    {
      title: 'Preise — 3-Tages-Immersion',
      fields: [
        { key: 'pricing.t2_3.tag',        label: 'Tag',          type: 'text',     default: '3-Tages-Immersion' },
        { key: 'pricing.t2_3.name',       label: 'Name',         type: 'text',     default: 'Das Immersion' },
        { key: 'pricing.t2_3.price',      label: 'Preis',        type: 'text',     default: 'Ab €950' },
        { key: 'pricing.t2_3.price_note', label: 'Preishinweis', type: 'textarea', default: 'Nur das Erlebnis, ohne Hotelunterkunft. Kontaktieren Sie mich für Ihr persönliches Angebot.' },
        { key: 'pricing.t2_3.f1', label: 'Punkt 1', type: 'textarea', default: 'Kuratierte Tantric Wellness Box — hochwertige Geschenke, im Wert von €350' },
        { key: 'pricing.t2_3.f2', label: 'Punkt 2', type: 'textarea', default: '1 × privater Paare-Workshop mit Tina Koestler (3 Stunden)' },
        { key: 'pricing.t2_3.f3', label: 'Punkt 3', type: 'textarea', default: 'Lovers\' Ritual Guide — ein wunderschön gestalteter Begleiter für zu Hause' },
        { key: 'pricing.t2_3.f4', label: 'Punkt 4', type: 'textarea', default: 'Personalisiertes Session-Design basierend auf Ihren Intentionen und Ihrem Komfortniveau' },
        { key: 'pricing.t2_3.f5', label: 'Punkt 5', type: 'textarea', default: 'Intimitätsrituale, Eröffnungs- und Abschlusszeremonien' },
        { key: 'pricing.t2_3.f6', label: 'Punkt 6', type: 'textarea', default: '30-minütiger Integrationscall mit mir ca. 2 Wochen nach Ihrem Immersion' },
        { key: 'pricing.t2_3.f7', label: 'Punkt 7', type: 'textarea', default: 'Kann durch das Fotoshooting-Add-on ergänzt werden, optional auch mit Hotelunterkunft' },
        { key: 'pricing.t2_3.btn', label: 'Button-Text', type: 'text', default: '3-Tages-Immersion reservieren' },
      ]
    },
    {
      title: 'Preise — 5-Tages-Immersion',
      fields: [
        { key: 'pricing.t2_5.tag',        label: 'Tag',          type: 'text',     default: '5-Tages-Immersion' },
        { key: 'pricing.t2_5.name',       label: 'Name',         type: 'text',     default: 'Das Immersion' },
        { key: 'pricing.t2_5.price',      label: 'Preis',        type: 'text',     default: 'Ab €1.400' },
        { key: 'pricing.t2_5.price_note', label: 'Preishinweis', type: 'textarea', default: 'Nur das Erlebnis, ohne Hotelunterkunft. Kontaktieren Sie mich für Ihr persönliches Angebot.' },
        { key: 'pricing.t2_5.f1', label: 'Punkt 1', type: 'textarea', default: 'Kuratierte Tantric Wellness Box — hochwertige Geschenke, im Wert von €350' },
        { key: 'pricing.t2_5.f2', label: 'Punkt 2', type: 'textarea', default: '2 × private Paare-Workshops mit Tina Koestler' },
        { key: 'pricing.t2_5.f3', label: 'Punkt 3', type: 'textarea', default: 'Lovers\' Ritual Guide — ein wunderschön gestalteter Begleiter für zu Hause' },
        { key: 'pricing.t2_5.f4', label: 'Punkt 4', type: 'textarea', default: 'Personalisiertes Session-Design basierend auf Ihren Intentionen und Ihrem Komfortniveau' },
        { key: 'pricing.t2_5.f5', label: 'Punkt 5', type: 'textarea', default: 'Intimitätsrituale, Eröffnungs- und Abschlusszeremonien' },
        { key: 'pricing.t2_5.f6', label: 'Punkt 6', type: 'textarea', default: '30-minütiger Integrationscall mit mir ca. 2 Wochen nach Ihrem Immersion' },
        { key: 'pricing.t2_5.f7', label: 'Punkt 7', type: 'textarea', default: 'Kann durch das Fotoshooting-Add-on ergänzt werden, optional auch mit Hotelunterkunft' },
        { key: 'pricing.t2_5.btn', label: 'Button-Text', type: 'text', default: '5-Tages-Immersion reservieren' },
      ]
    },
    {
      title: 'Fotografie',
      fields: [
        { key: 'photo.label',      label: 'Label',                  type: 'text',     default: 'Optionales Add-on' },
        { key: 'photo.h2',         label: 'Überschrift',            type: 'text',     default: 'Für immer festhalten.' },
        { key: 'photo.p1',         label: 'Absatz 1',               type: 'textarea', default: 'Manche Erlebnisse verdienen es, in Bildern erinnert zu werden, die der Tiefe des Gefühlten entsprechen.' },
        { key: 'photo.p2',         label: 'Absatz 2',               type: 'textarea', default: 'Als optionale Ergänzung zu Ihrem Immersion biete ich Zugang zu Patrick Schörg — Wiens meistausgezeichnetem Intimfotografen.' },
        { key: 'photo.opt1.title', label: 'Option 1 Titel',         type: 'text',     default: 'Erotisches Paar-Fotoshooting' },
        { key: 'photo.opt1.p',     label: 'Option 1 Beschreibung',  type: 'textarea', default: 'Eine private, vollständig geführte Session für Sie als Paar. Intim, kunstvoll und ganz Ihres — Bilder, die Sie Ihr Leben lang in Ehren halten werden.' },
        { key: 'photo.opt2.title', label: 'Option 2 Titel',         type: 'text',     default: 'Göttlich Feminin Fotoshooting' },
        { key: 'photo.opt2.p',     label: 'Option 2 Beschreibung',  type: 'textarea', default: 'Ein Solo-Erlebnis für die Frau — eine Boudoir-Session, die darauf ausgelegt ist, Ihre Sinnlichkeit, Stärke und Schönheit zu enthüllen.' },
        { key: 'photo.btn',        label: 'Button-Text',            type: 'text',     default: 'Ein Fotoshooting zu meiner Buchung hinzufügen' },
      ]
    },
    {
      title: 'Hotels',
      fields: [
        { key: 'hotels.label',         label: 'Label',                    type: 'text',     default: 'Unterkunft' },
        { key: 'hotels.h2',            label: 'Überschrift',              type: 'text',     default: 'Im Herzen Wiens übernachten' },
        { key: 'hotels.p',             label: 'Beschreibung',             type: 'textarea', default: 'Ich habe drei außergewöhnliche Hotels in Wien kuratiert, die der Intimität und Qualität dieses Erlebnisses entsprechen.' },
        { key: 'hotels.meridien.tag',  label: 'Le Méridien: Tag',         type: 'text',     default: 'Zeitgenössischer Luxus' },
        { key: 'hotels.meridien.desc', label: 'Le Méridien: Beschreibung',type: 'textarea', default: 'Ein elegantes 5-Sterne-Hotel im Herzen des 1. Bezirks Wiens, nur wenige Schritte von der Ringstraße und der Wiener Staatsoper entfernt.' },
        { key: 'hotels.almanac.tag',   label: 'Almanac Palais: Tag',      type: 'text',     default: 'Intimes Palais' },
        { key: 'hotels.almanac.desc',  label: 'Almanac Palais: Beschreibung', type: 'textarea', default: 'Ein Boutique-Luxushotel in einem restaurierten Palais aus dem 19. Jahrhundert am Parkring mit Blick auf den Stadtpark.' },
        { key: 'hotels.ritz.tag',      label: 'Ritz-Carlton: Tag',        type: 'text',     default: 'Ikonische Grandeur' },
        { key: 'hotels.ritz.desc',     label: 'Ritz-Carlton: Beschreibung', type: 'textarea', default: 'Wiens gefeiertste Adresse für jene, die den Gipfel des Luxus suchen.' },
        { key: 'hotels.note1',         label: 'Hinweis 1',                type: 'textarea', default: 'Mit der Auswahl eines Hotels erkundigen Sie sich nach der Verfügbarkeit für Ihre gewünschten Daten.' },
        { key: 'hotels.note2',         label: 'Hinweis 2',                type: 'textarea', default: 'Hotelunterkunft ist ein optionales Add-on.' },
      ]
    },
    {
      title: 'Über Tina',
      fields: [
        { key: 'about.label', label: 'Label',       type: 'text',     default: 'Ihre Begleiterin' },
        { key: 'about.h2',    label: 'Überschrift', type: 'text',     default: 'Hallo, ich bin Tina.' },
        { key: 'about.p1',    label: 'Absatz 1',    type: 'textarea', default: 'Den größten Teil meines Erwachsenenlebens war ich sehr gut darin, fähig zu sein.' },
        { key: 'about.p2',    label: 'Absatz 2',    type: 'textarea', default: 'Was ich nicht wusste, war, wie man jemanden wirklich hereinlässt.' },
        { key: 'about.p3',    label: 'Absatz 3',    type: 'textarea', default: 'Der Weg zurück war kein weiteres Tun. Es war der Körper. Atem. Berührung. Präsenz.' },
        { key: 'about.p4',    label: 'Absatz 4',    type: 'textarea', default: 'Heute führe ich Paare durch dieselbe Rückkehr.' },
        { key: 'about.c1',    label: 'Eigenschaft 1', type: 'text',   default: 'Tantra-Facilitatorin & Somatische Embodiment Coach' },
        { key: 'about.c2',    label: 'Eigenschaft 2', type: 'text',   default: 'Womb Wisdom Lehrerin' },
        { key: 'about.c3',    label: 'Eigenschaft 3', type: 'text',   default: 'Ansässig in Wien & Bratislava' },
        { key: 'about.c4',    label: 'Eigenschaft 4', type: 'text',   default: 'Begleitung von Paaren, Frauen und Männern in Mitteleuropa und online' },
        { key: 'about.link',  label: 'Link-Text',   type: 'text',     default: 'Mehr über meine Arbeit erfahren → tinakoestler.com' },
      ]
    },
    {
      title: 'Testimonials',
      fields: [
        { key: 'testimonials.h2',        label: 'Überschrift',   type: 'text',     default: 'Was Paare sagen' },
        { key: 'testimonials.t1.text',   label: 'Testimonial 1', type: 'textarea', default: 'Dieses Erlebnis hat uns etwas zurückgegeben, das wir nicht einmal wussten, dass wir es verloren hatten.' },
        { key: 'testimonials.t1.author', label: 'Autor 1',       type: 'text',     default: '— M. & T., Wien' },
        { key: 'testimonials.t2.text',   label: 'Testimonial 2', type: 'textarea', default: 'Tina hat einen Raum geschaffen, der sich vollständig sicher und vollständig real anfühlte.' },
        { key: 'testimonials.t2.author', label: 'Autor 2',       type: 'text',     default: '— S. & A., Bratislava' },
        { key: 'testimonials.t3.text',   label: 'Testimonial 3', type: 'textarea', default: 'Ich kam allein zum Fotoshooting und ging mit etwas, das ich nicht vollständig benennen kann.' },
        { key: 'testimonials.t3.author', label: 'Autor 3',       type: 'text',     default: '— L., Prag' },
      ]
    },
    {
      title: 'FAQ',
      fields: [
        { key: 'faq.h2', label: 'Überschrift', type: 'text', default: 'Fragen' },
        { key: 'faq.q1', label: 'Frage 1',    type: 'text',     default: 'Ist dieses Erlebnis sexueller Natur?' },
        { key: 'faq.a1', label: 'Antwort 1',  type: 'textarea', default: 'Das Immersion erkundet Intimität, Sinnlichkeit und erotische Energie — aber es ist kein sexueller Service.' },
        { key: 'faq.q2', label: 'Frage 2',    type: 'text',     default: 'Wir sind Anfänger — ist das das Richtige für uns?' },
        { key: 'faq.a2', label: 'Antwort 2',  type: 'textarea', default: 'Ja. Das Immersion ist in erster Linie für Anfänger und Fortgeschrittene konzipiert.' },
        { key: 'faq.q3', label: 'Frage 3',    type: 'text',     default: 'Was, wenn wir nicht sicher sind, ob wir bereit sind?' },
        { key: 'faq.a3', label: 'Antwort 3',  type: 'textarea', default: 'Buchen Sie ein kostenloses Erstgespräch mit mir.' },
        { key: 'faq.q4', label: 'Frage 4',    type: 'text',     default: 'Können wir 3 Tage statt 5 machen?' },
        { key: 'faq.a4', label: 'Antwort 4',  type: 'textarea', default: 'Ja. Ein 3-tägiges Erlebnis ist verfügbar.' },
        { key: 'faq.q5', label: 'Frage 5',    type: 'text',     default: 'Ist die Unterkunft obligatorisch?' },
        { key: 'faq.a5', label: 'Antwort 5',  type: 'textarea', default: 'Nein. Beide Pakete sind mit oder ohne Hotelunterkunft verfügbar.' },
        { key: 'faq.q6', label: 'Frage 6',    type: 'text',     default: 'Wie weit im Voraus sollten wir buchen?' },
        { key: 'faq.a6', label: 'Antwort 6',  type: 'textarea', default: 'Ich empfehle, mindestens 4–6 Wochen im Voraus anzufragen.' },
        { key: 'faq.q7', label: 'Frage 7',    type: 'text',     default: 'In welcher Sprache wird das Immersion durchgeführt?' },
        { key: 'faq.a7', label: 'Antwort 7',  type: 'textarea', default: 'Primär auf Englisch. Sessions können auch auf Wunsch auf Deutsch abgehalten werden.' },
        { key: 'faq.q8', label: 'Frage 8',    type: 'text',     default: 'Ist die 20% Anzahlung erstattungsfähig?' },
        { key: 'faq.a8', label: 'Antwort 8',  type: 'textarea', default: 'Die Anzahlung sichert Ihre Termine und deckt meine Vorbereitungszeit ab.' },
      ]
    },
    {
      title: 'Buchungsbereich',
      fields: [
        { key: 'booking.h2',         label: 'Überschrift',           type: 'text',     default: 'Bereit zu beginnen?' },
        { key: 'booking.p',          label: 'Text',                  type: 'textarea', default: 'Es gibt zwei Wege, den nächsten Schritt zu machen.\nWählen Sie, was sich für Sie richtig anfühlt.' },
        { key: 'booking.opt_a.h3',   label: 'Option A: Überschrift', type: 'text',     default: 'Noch nicht sicher?' },
        { key: 'booking.opt_a.sub',  label: 'Option A: Untertitel',  type: 'text',     default: 'Sprechen Sie zuerst mit mir.' },
        { key: 'booking.opt_a.p',    label: 'Option A: Text',        type: 'textarea', default: 'Ein kostenloses 30-minütiges Erstgespräch — um Ihre Fragen zu stellen, Ihre Intentionen zu teilen und zu spüren, ob dieses Erlebnis das Richtige für Sie ist.' },
        { key: 'booking.opt_a.btn',  label: 'Option A: Button',      type: 'text',     default: 'Ihr kostenloses Gespräch buchen' },
        { key: 'booking.opt_b.h3',   label: 'Option B: Überschrift', type: 'text',     default: 'Bereit zu buchen?' },
        { key: 'booking.opt_b.sub',  label: 'Option B: Untertitel',  type: 'text',     default: 'Mit einer Anzahlung reservieren.' },
        { key: 'booking.opt_b.p',    label: 'Option B: Text',        type: 'textarea', default: 'Wählen Sie Ihre bevorzugten Daten und reservieren Sie Ihr Immersion mit einer 20% Anzahlung.' },
        { key: 'booking.form.label', label: 'Formular Label',        type: 'text',     default: 'Oder senden Sie eine Nachricht' },
        { key: 'booking.form.h3',    label: 'Formular Überschrift',  type: 'text',     default: 'Haben Sie eine bestimmte Frage?' },
      ]
    },
    {
      title: 'Footer',
      fields: [
        { key: 'footer.tagline', label: 'Tagline (Zeilenumbrüche mit Enter)', type: 'textarea', default: 'Tantra-Facilitatorin\nEmbodiment Coach\nWomb Wisdom Lehrerin' },
      ]
    },
  ]
}

// ── Init content tab ───────────────────────────────────────────
async function initContentTab(lang) {
  const editorId = `content-editor-${lang}`
  const editor   = document.getElementById(editorId)
  if (!editor) return

  // Load existing saved values from Supabase
  const { data: savedRows } = await sb
    .from('page_content')
    .select('key,value')
    .eq('lang', lang)

  const saved = {}
  if (savedRows) savedRows.forEach(r => { saved[r.key] = r.value })

  // Load experience days too
  if (!contentDays.length) {
    const { data } = await sb.from('experience_days').select('*').order('sort_order')
    if (data) contentDays = data
  }

  const sections = CONTENT_SECTIONS[lang] || []
  editor.innerHTML = sections.map(sec => buildContentSection(sec, saved, lang)).join('')
    + buildJourneySection(lang, saved)

  // Attach save handlers
  editor.querySelectorAll('.content-section-save').forEach(btn => {
    btn.addEventListener('click', () => saveContentSection(btn, lang))
  })

  // Attach journey day save handlers
  contentDays.forEach(day => attachDayCard(day.id, lang))
}

function buildContentSection(sec, saved, lang) {
  const sectionId = `cs-${lang}-${sec.title.replace(/\s+/g,'-').replace(/[^a-zA-Z0-9-]/g,'')}`
  const fields = sec.fields.map(f => {
    const val = saved[f.key] !== undefined ? saved[f.key] : f.default
    const inputHtml = f.type === 'textarea'
      ? `<textarea class="content-input" data-key="${f.key}" rows="3">${esc(val)}</textarea>`
      : `<input  type="text" class="content-input" data-key="${f.key}" value="${esc(val)}">`
    return `
      <div class="content-field">
        <label>${f.label}</label>
        ${inputHtml}
      </div>`
  }).join('')

  return `
    <div class="content-section" id="${sectionId}">
      <div class="content-section-title">${sec.title}</div>
      <div class="content-section-body">
        ${fields}
        <div class="day-card-actions" style="margin-top:16px;">
          <button class="btn-save content-section-save" data-section="${sectionId}">Save ${sec.title}</button>
          <span class="save-feedback" id="sfb-${sectionId}" style="display:none">Saved ✓</span>
        </div>
      </div>
    </div>`
}

async function saveContentSection(btn, lang) {
  const sectionId = btn.dataset.section
  const section   = document.getElementById(sectionId)
  if (!section) return

  const inputs = section.querySelectorAll('.content-input[data-key]')
  const rows   = []

  inputs.forEach(el => {
    const key   = el.dataset.key
    const value = el.value.trim()
    rows.push({ key, lang, value, updated_at: new Date().toISOString() })
  })

  btn.disabled    = true
  btn.textContent = 'Saving…'

  const { error } = await sb.from('page_content').upsert(rows, { onConflict: 'key,lang' })

  btn.disabled    = false
  btn.textContent = `Save ${btn.dataset.section.replace(`cs-${lang}-`,'').replace(/-/g,' ')}`

  const fb = document.getElementById(`sfb-${sectionId}`)
  if (!error && fb) {
    fb.style.display = 'inline'
    setTimeout(() => { fb.style.display = 'none' }, 2500)
  } else if (error) {
    alert('Save failed. Please try again.')
  }
}

// ── Journey days section ───────────────────────────────────────
function buildJourneySection(lang, saved) {
  const isDE = lang === 'de'
  const sections = [
    { label: isDE ? 'Tag 1 — Beide Pläne' : 'Day 1 — Shared by Both Plans', filter: d => d.show_for === 'both' },
    { label: isDE ? '3-Tages-Immersion'   : '3-Day Immersion',              filter: d => d.show_for === '3'    },
    { label: isDE ? '5-Tages-Immersion'   : '5-Day Immersion',              filter: d => d.show_for === '5'    },
  ]

  const html = sections.map(sec => {
    const days = contentDays.filter(sec.filter)
    if (!days.length) return ''
    return `
      <div class="content-section">
        <div class="content-section-title">${isDE ? 'Reisetage (DE)' : 'Journey Days'} — ${sec.label}</div>
        ${days.map(d => buildDayCard(d, lang)).join('')}
      </div>`
  }).join('')

  return `<div id="journey-section-${lang}">${html}</div>`
}

function buildDayCard(day, lang) {
  const isDE     = lang === 'de'
  const title    = isDE ? (day.title_de      || '') : (day.title      || '')
  const paras    = isDE ? (day.paragraphs_de || []) : (day.paragraphs || [])
  const rawSrc   = day.photo_url || ''
  const photoSrc = rawSrc.startsWith('http') ? rawSrc : (rawSrc ? '../' + rawSrc : '')

  const parasHtml = paras.map((p, i) => `
    <div class="para-row" data-index="${i}">
      <textarea class="para-textarea">${esc(p)}</textarea>
      <button class="para-remove" onclick="removeParagraph('${day.id}', this, '${lang}')" title="Remove">×</button>
    </div>`).join('')

  const photoSection = isDE ? '' : `
    <div class="content-field">
      <label>Photo</label>
      <div class="photo-drop-zone" id="drop-${day.id}">
        ${photoSrc
          ? `<img class="photo-preview" id="preview-${day.id}" src="${photoSrc}" alt="">`
          : `<div class="photo-placeholder" id="preview-${day.id}">No photo yet</div>`
        }
        <div class="drop-hint">Drop image here or click to upload</div>
        <input type="file" accept="image/*" id="file-${day.id}" style="display:none">
      </div>
      <div class="photo-status" id="photo-status-${day.id}"></div>
    </div>`

  return `
    <div class="day-card" id="day-card-${lang}-${day.id}">
      <div class="day-card-head">
        <span class="day-badge">Day ${day.day_number}</span>
        <span class="day-card-title-preview">${esc(title || day.title)}</span>
      </div>
      <div class="day-card-body">
        <div class="content-field">
          <label>${isDE ? 'Titel (DE)' : 'Day Title'}</label>
          <input type="text" class="content-input" id="title-${lang}-${day.id}" value="${esc(title)}">
        </div>
        <div class="content-field">
          <label>${isDE ? 'Absätze (DE)' : 'Paragraphs'}</label>
          <div class="paragraphs-list" id="paras-${lang}-${day.id}">${parasHtml}</div>
          <button class="btn-add-para" onclick="addParagraph('${day.id}', '${lang}')">+ Add Paragraph</button>
        </div>
        ${photoSection}
        <div class="day-card-actions">
          <button class="btn-save" onclick="saveDayCard('${day.id}', '${lang}')">Save Changes</button>
          <span class="save-feedback" id="feedback-${lang}-${day.id}" style="display:none">Saved ✓</span>
        </div>
      </div>
    </div>`
}

function attachDayCard(dayId, lang) {
  if (lang === 'de') return  // photo upload only for EN
  const zone  = document.getElementById(`drop-${dayId}`)
  const input = document.getElementById(`file-${dayId}`)
  if (!zone || !input) return

  zone.addEventListener('click', () => input.click())
  input.addEventListener('change', e => {
    const file = e.target.files[0]
    if (file) handlePhotoFile(dayId, file)
  })
  zone.addEventListener('dragover',  e => { e.preventDefault(); zone.classList.add('drag-over') })
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'))
  zone.addEventListener('drop', e => {
    e.preventDefault()
    zone.classList.remove('drag-over')
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handlePhotoFile(dayId, file)
  })
}

function addParagraph(dayId, lang) {
  const list = document.getElementById(`paras-${lang}-${dayId}`)
  const row  = document.createElement('div')
  row.className = 'para-row'
  row.innerHTML = `
    <textarea class="para-textarea" placeholder="New paragraph…"></textarea>
    <button class="para-remove" onclick="removeParagraph('${dayId}', this, '${lang}')" title="Remove">×</button>`
  list.appendChild(row)
  row.querySelector('textarea').focus()
}

function removeParagraph(dayId, btn, lang) {
  btn.closest('.para-row').remove()
}

async function saveDayCard(dayId, lang) {
  const isDE     = lang === 'de'
  const titleEl  = document.getElementById(`title-${lang}-${dayId}`)
  const title    = titleEl ? titleEl.value.trim() : ''
  const paragraphs = Array.from(
    document.querySelectorAll(`#paras-${lang}-${dayId} .para-textarea`)
  ).map(t => t.value.trim()).filter(Boolean)

  let updates
  if (isDE) {
    updates = { title_de: title, paragraphs_de: paragraphs, updated_at: new Date().toISOString() }
  } else {
    updates = { title, paragraphs, updated_at: new Date().toISOString() }
    if (pendingPhotos[dayId]) updates.photo_url = pendingPhotos[dayId]
  }

  const { error } = await sb
    .from('experience_days')
    .update(updates)
    .eq('id', dayId)

  const feedback = document.getElementById(`feedback-${lang}-${dayId}`)
  if (!error) {
    const day = contentDays.find(d => d.id === dayId)
    if (day) {
      if (isDE) { day.title_de = title; day.paragraphs_de = paragraphs }
      else       { day.title   = title; day.paragraphs    = paragraphs }
      if (!isDE && updates.photo_url) day.photo_url = updates.photo_url
    }
    const preview = document.querySelector(`#day-card-${lang}-${dayId} .day-card-title-preview`)
    if (preview) preview.textContent = title || day?.title || ''

    if (!isDE && pendingPhotos[dayId]) {
      delete pendingPhotos[dayId]
      const status = document.getElementById(`photo-status-${dayId}`)
      if (status) status.textContent = ''
    }

    if (feedback) {
      feedback.style.display = 'inline'
      setTimeout(() => { feedback.style.display = 'none' }, 2500)
    }
  } else {
    alert('Save failed. Please try again.')
  }
}

// ── Crop modal (photo upload — EN only) ───────────────────────
let cropperInstance = null
let cropDayId       = null
let cropFileExt     = 'jpg'

function handlePhotoFile(dayId, file) {
  cropDayId   = dayId
  cropFileExt = (file.name.split('.').pop() || 'jpg').toLowerCase()

  const reader = new FileReader()
  reader.onload = e => {
    const cropImg = document.getElementById('crop-image')
    if (cropperInstance) { cropperInstance.destroy(); cropperInstance = null }
    cropImg.src = e.target.result
    cropImg.onload = () => {
      cropperInstance = new Cropper(cropImg, {
        aspectRatio: 4 / 3,
        viewMode:    1,
        dragMode:    'move',
        autoCropArea: 0.9,
        responsive:  true,
      })
    }
    document.getElementById('crop-modal').classList.add('open')
  }
  reader.readAsDataURL(file)
}

document.getElementById('crop-cancel').addEventListener('click', () => {
  document.getElementById('crop-modal').classList.remove('open')
})

document.getElementById('crop-apply').addEventListener('click', async () => {
  if (!cropperInstance || !cropDayId) return

  const applyBtn = document.getElementById('crop-apply')
  applyBtn.disabled    = true
  applyBtn.textContent = 'Uploading…'

  const canvas = cropperInstance.getCroppedCanvas({ width: 1200, height: 900 })

  canvas.toBlob(async blob => {
    const path = `${cropDayId}.${cropFileExt}`

    const { error } = await sb.storage
      .from('experience-photos')
      .upload(path, blob, { upsert: true, contentType: `image/${cropFileExt === 'jpg' ? 'jpeg' : cropFileExt}` })

    applyBtn.disabled    = false
    applyBtn.textContent = 'Apply Crop & Upload'

    if (error) { alert('Upload failed — please try again.'); return }

    const { data: urlData } = sb.storage.from('experience-photos').getPublicUrl(path)
    pendingPhotos[cropDayId] = urlData.publicUrl

    let preview = document.getElementById(`preview-${cropDayId}`)
    if (preview.tagName !== 'IMG') {
      const img = document.createElement('img')
      img.className = 'photo-preview'
      img.id        = `preview-${cropDayId}`
      preview.replaceWith(img)
      preview = img
    }
    preview.src = canvas.toDataURL()

    const status = document.getElementById(`photo-status-${cropDayId}`)
    if (status) {
      status.textContent = '✓ Photo cropped & ready — click Save Changes to apply.'
      status.style.color = 'var(--sage)'
    }

    document.getElementById('crop-modal').classList.remove('open')
  }, `image/${cropFileExt === 'jpg' ? 'jpeg' : cropFileExt}`, 0.92)
})
