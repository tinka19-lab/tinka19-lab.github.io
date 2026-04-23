// ── Config ────────────────────────────────────────────────────
const SUPABASE_URL = 'https://nisapebptuqykfaootju.supabase.co'
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5pc2FwZWJwdHVxeWtmYW9vdGp1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzU2NTY5MjIsImV4cCI6MjA5MTIzMjkyMn0.CGoiEPcWWs7OSkJfCoBuFS6vvmOe98LDpRC1mGDImgA'

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY)

const MONTHS = ['January','February','March','April','May','June',
                'July','August','September','October','November','December']

// ── State ─────────────────────────────────────────────────────
let blockedDates = new Set()
let bookings     = []
let calMonth, calYear

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {

  // Check existing session
  const { data: { session } } = await sb.auth.getSession()
  if (session) showDashboard()
  else         showLogin()

  // React to login / logout
  sb.auth.onAuthStateChange((event) => {
    if (event === 'SIGNED_IN')  showDashboard()
    if (event === 'SIGNED_OUT') showLogin()
  })

  // Login form
  document.getElementById('login-btn').addEventListener('click', handleLogin)
  document.getElementById('login-password').addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin()
  })

  // Logout
  document.getElementById('logout-btn').addEventListener('click', () => sb.auth.signOut())

  // Tab switching
  document.querySelectorAll('.tab-btn').forEach(btn =>
    btn.addEventListener('click', () => switchTab(btn.dataset.tab))
  )

  // Calendar navigation
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

  // Refresh bookings
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
}

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b =>
    b.classList.toggle('active', b.dataset.tab === tab)
  )
  document.getElementById('tab-availability').style.display = tab === 'availability' ? '' : 'none'
  document.getElementById('tab-bookings').style.display     = tab === 'bookings'     ? '' : 'none'
  document.getElementById('tab-content').style.display      = tab === 'content'      ? '' : 'none'

  if (tab === 'content' && !contentLoaded) {
    contentLoaded = true
    loadContentDays().then(renderContentTab)
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

  // Empty filler cells before the 1st
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
    // Show saved confirmation
    feedback.style.display = 'inline'
    setTimeout(() => { feedback.style.display = 'none' }, 2500)

    // Update local state
    const booking = bookings.find(b => b.id === id)
    if (booking) { booking.status = status; booking.admin_notes = adminNotes }

    // Update badge count
    const newCount = bookings.filter(b => b.status === 'new').length
    const badge    = document.getElementById('new-badge')
    badge.textContent   = newCount
    badge.style.display = newCount > 0 ? 'inline-block' : 'none'

    // Update status badge in row
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

// ── Content Tab ────────────────────────────────────────────────
let contentDays   = []
let pendingPhotos = {}  // dayId → uploaded public URL
let contentLoaded = false

async function loadContentDays() {
  const { data, error } = await sb
    .from('experience_days')
    .select('*')
    .order('sort_order')
  if (!error && data) contentDays = data
}

function renderContentTab() {
  const editor = document.getElementById('content-editor')
  if (!editor) return

  const sections = [
    { label: 'Day 1 — Shared by Both Plans', filter: d => d.show_for === 'both' },
    { label: '3-Day Immersion',              filter: d => d.show_for === '3'    },
    { label: '5-Day Immersion',              filter: d => d.show_for === '5'    },
  ]

  editor.innerHTML = sections.map(sec => {
    const days = contentDays.filter(sec.filter)
    if (!days.length) return ''
    return `
      <div class="content-section">
        <div class="content-section-title">${sec.label}</div>
        ${days.map(buildDayCard).join('')}
      </div>`
  }).join('')

  contentDays.forEach(day => attachDayCard(day.id))
}

function buildDayCard(day) {
  const paras    = (day.paragraphs || [])
  const rawSrc   = day.photo_url || ''
  const photoSrc = rawSrc.startsWith('http') ? rawSrc : (rawSrc ? '../' + rawSrc : '')

  const parasHtml = paras.map((p, i) => `
    <div class="para-row" data-index="${i}">
      <textarea class="para-textarea">${esc(p)}</textarea>
      <button class="para-remove" onclick="removeParagraph('${day.id}', this)" title="Remove">×</button>
    </div>`).join('')

  const photoHtml = photoSrc
    ? `<img class="photo-preview" id="preview-${day.id}" src="${photoSrc}" alt="">`
    : `<div class="photo-placeholder" id="preview-${day.id}">No photo yet</div>`

  return `
    <div class="day-card" id="day-card-${day.id}">
      <div class="day-card-head">
        <span class="day-badge">Day ${day.day_number}</span>
        <span class="day-card-title-preview">${esc(day.title)}</span>
      </div>
      <div class="day-card-body">

        <div class="content-field">
          <label>Day Title</label>
          <input type="text" class="content-input" id="title-${day.id}" value="${esc(day.title)}">
        </div>

        <div class="content-field">
          <label>Paragraphs</label>
          <div class="paragraphs-list" id="paras-${day.id}">${parasHtml}</div>
          <button class="btn-add-para" onclick="addParagraph('${day.id}')">+ Add Paragraph</button>
        </div>

        <div class="content-field">
          <label>Photo</label>
          <div class="photo-drop-zone" id="drop-${day.id}">
            ${photoHtml}
            <div class="drop-hint">Drop image here or click to upload</div>
            <input type="file" accept="image/*" id="file-${day.id}" style="display:none">
          </div>
          <div class="photo-status" id="photo-status-${day.id}"></div>
        </div>

        <div class="day-card-actions">
          <button class="btn-save" onclick="saveDayCard('${day.id}')">Save Changes</button>
          <span class="save-feedback" id="feedback-${day.id}" style="display:none">Saved ✓</span>
        </div>

      </div>
    </div>`
}

function attachDayCard(dayId) {
  const zone  = document.getElementById(`drop-${dayId}`)
  const input = document.getElementById(`file-${dayId}`)
  if (!zone || !input) return

  zone.addEventListener('click', () => input.click())

  input.addEventListener('change', e => {
    const file = e.target.files[0]
    if (file) handlePhotoFile(dayId, file)
  })

  zone.addEventListener('dragover', e => {
    e.preventDefault()
    zone.classList.add('drag-over')
  })
  zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'))
  zone.addEventListener('drop', e => {
    e.preventDefault()
    zone.classList.remove('drag-over')
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) handlePhotoFile(dayId, file)
  })
}

// ── Crop modal ─────────────────────────────────────────────────
let cropperInstance = null
let cropDayId       = null
let cropFileExt     = 'jpg'

function handlePhotoFile(dayId, file) {
  cropDayId   = dayId
  cropFileExt = (file.name.split('.').pop() || 'jpg').toLowerCase()

  const reader = new FileReader()
  reader.onload = e => {
    const cropImg = document.getElementById('crop-image')
    // Destroy previous cropper before changing src
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

    if (error) {
      alert('Upload failed — please try again.')
      return
    }

    const { data: urlData } = sb.storage.from('experience-photos').getPublicUrl(path)
    pendingPhotos[cropDayId] = urlData.publicUrl

    // Update preview in the day card
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

function addParagraph(dayId) {
  const list = document.getElementById(`paras-${dayId}`)
  const row  = document.createElement('div')
  row.className = 'para-row'
  row.innerHTML = `
    <textarea class="para-textarea" placeholder="New paragraph…"></textarea>
    <button class="para-remove" onclick="removeParagraph('${dayId}', this)" title="Remove">×</button>`
  list.appendChild(row)
  row.querySelector('textarea').focus()
}

function removeParagraph(dayId, btn) {
  btn.closest('.para-row').remove()
}

async function saveDayCard(dayId) {
  const title = document.getElementById(`title-${dayId}`).value.trim()
  const paragraphs = Array.from(
    document.querySelectorAll(`#paras-${dayId} .para-textarea`)
  ).map(t => t.value.trim()).filter(Boolean)

  const updates = { title, paragraphs, updated_at: new Date().toISOString() }
  if (pendingPhotos[dayId]) updates.photo_url = pendingPhotos[dayId]

  const { error } = await sb
    .from('experience_days')
    .update(updates)
    .eq('id', dayId)

  const feedback = document.getElementById(`feedback-${dayId}`)
  if (!error) {
    const day = contentDays.find(d => d.id === dayId)
    if (day) {
      day.title      = title
      day.paragraphs = paragraphs
      if (updates.photo_url) day.photo_url = updates.photo_url
    }
    const titlePreview = document.querySelector(`#day-card-${dayId} .day-card-title-preview`)
    if (titlePreview) titlePreview.textContent = title

    if (pendingPhotos[dayId]) {
      delete pendingPhotos[dayId]
      const status = document.getElementById(`photo-status-${dayId}`)
      if (status) status.textContent = ''
    }

    feedback.style.display = 'inline'
    setTimeout(() => { feedback.style.display = 'none' }, 2500)
  } else {
    alert('Save failed. Please try again.')
  }
}
