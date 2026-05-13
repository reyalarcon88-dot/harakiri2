import PptxGenJS from 'pptxgenjs'

const pres = new PptxGenJS()
pres.layout = 'LAYOUT_WIDE' // 13.33 x 7.5 inches (16:9)

// ── THEME ──────────────────────────────────────────────────────────────────
const C = {
  navy:      '0F1E3D',
  navy2:     '162447',
  blue:      '1A56DB',
  blueLight: '3B82F6',
  teal:      '0D9488',
  accent:    'F59E0B',
  accentDark:'D97706',
  white:     'FFFFFF',
  offWhite:  'F4F7FF',
  light:     'EBF1FD',
  border:    'DDE4F0',
  muted:     '64748B',
  text:      '1E293B',
  green:     '10B981',
  greenBg:   'D1FAE5',
  purple:    '7C3AED',
  rose:      'E11D48',
}

const FONT = 'Calibri'

// Helper: slide with dark gradient background
function darkSlide(pres) {
  const s = pres.addSlide()
  s.background = { color: C.navy }
  // top accent bar
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: C.accent } })
  return s
}

// Helper: light slide
function lightSlide(pres) {
  const s = pres.addSlide()
  s.background = { color: C.offWhite }
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.06, fill: { color: C.blue } })
  return s
}

// Helper: section label
function label(s, text, x, y) {
  s.addText(text.toUpperCase(), {
    x, y, w: 8, h: 0.22,
    fontSize: 9, bold: true, color: C.accent,
    fontFace: FONT, charSpacing: 3,
  })
}

// Helper: section title (dark slide)
function titleDark(s, text, x, y, w = 10) {
  s.addText(text, {
    x, y, w, h: 0.65,
    fontSize: 32, bold: true, color: C.white,
    fontFace: FONT, charSpacing: -0.5,
  })
}

// Helper: section title (light slide)
function titleLight(s, text, accentWord, x, y, w = 10) {
  const parts = accentWord
    ? [{ text: text.replace(accentWord, ''), options: { color: C.text } }, { text: accentWord, options: { color: C.blue } }]
    : [{ text, options: { color: C.text } }]
  s.addText(parts, {
    x, y, w, h: 0.65,
    fontSize: 30, bold: true,
    fontFace: FONT, charSpacing: -0.5,
  })
}

// Helper: bullet list item
function bullet(s, icon, title, desc, x, y, dark = true) {
  const tc = dark ? C.white : C.text
  const dc = dark ? 'A0B0C8' : C.muted
  s.addText(icon, { x, y, w: 0.4, h: 0.25, fontSize: 14, fontFace: FONT, align: 'center' })
  s.addText(title, { x: x + 0.42, y, w: 4, h: 0.22, fontSize: 11, bold: true, color: tc, fontFace: FONT })
  s.addText(desc,  { x: x + 0.42, y: y + 0.22, w: 4, h: 0.32, fontSize: 9, color: dc, fontFace: FONT })
}

// Helper: card (rounded rect + content)
function card(s, x, y, w, h, fillColor, borderColor) {
  s.addShape(pres.ShapeType.roundRect, {
    x, y, w, h,
    rectRadius: 0.1,
    fill: { color: fillColor },
    line: { color: borderColor, width: 1 },
  })
}

// Helper: stat card
function statCard(s, x, y, w, num, label2, desc, numColor, bgColor, borderColor) {
  card(s, x, y, w, 1.55, bgColor, borderColor)
  s.addText(num,    { x, y: y + 0.15, w, h: 0.6,  fontSize: 34, bold: true, color: numColor, fontFace: FONT, align: 'center' })
  s.addText(label2, { x, y: y + 0.72, w, h: 0.3,  fontSize: 11, bold: true, color: C.text,   fontFace: FONT, align: 'center' })
  s.addText(desc,   { x, y: y + 0.98, w, h: 0.45, fontSize: 8.5, color: C.muted, fontFace: FONT, align: 'center', wrap: true })
}

// Helper: module card
function moduleCard(s, x, y, num, icon, title, desc) {
  card(s, x, y, 2.98, 1.55, C.white, C.border)
  s.addText(num,   { x, y: y + 0.12, w: 2.98, h: 0.18, fontSize: 8, bold: true, color: C.blue, fontFace: FONT, align: 'center', charSpacing: 2 })
  s.addText(icon,  { x, y: y + 0.30, w: 2.98, h: 0.32, fontSize: 20, fontFace: FONT, align: 'center' })
  s.addText(title, { x: x + 0.12, y: y + 0.62, w: 2.74, h: 0.25, fontSize: 10.5, bold: true, color: C.text, fontFace: FONT })
  s.addText(desc,  { x: x + 0.12, y: y + 0.86, w: 2.74, h: 0.56, fontSize: 8.5, color: C.muted, fontFace: FONT, wrap: true })
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 1 — COVER
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide()
  s.background = { color: C.navy }

  // Decorative circles
  s.addShape(pres.ShapeType.ellipse, { x: 9.5, y: -1.2, w: 4, h: 4, fill: { color: '1A56DB', transparency: 88 }, line: { color: '1A56DB', transparency: 88 } })
  s.addShape(pres.ShapeType.ellipse, { x: -1,  y: 5,    w: 3, h: 3, fill: { color: '0D9488', transparency: 88 }, line: { color: '0D9488', transparency: 88 } })

  // Top accent bar
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.07, fill: { color: C.accent } })

  // Tag
  s.addText('EXECUTIVE PRESENTATION  ·  2026', {
    x: 0, y: 1.2, w: 13.33, h: 0.28,
    fontSize: 10, bold: true, color: C.accent, charSpacing: 4,
    fontFace: FONT, align: 'center',
  })

  // Icon box
  s.addShape(pres.ShapeType.roundRect, {
    x: 5.67, y: 1.65, w: 2, h: 2,
    rectRadius: 0.3,
    fill: { color: C.blue },
    line: { color: C.blueLight, width: 1 },
  })
  s.addText('📦', { x: 5.67, y: 1.85, w: 2, h: 1.4, fontSize: 52, fontFace: FONT, align: 'center' })

  // Title
  s.addText('Project', { x: 0, y: 3.85, w: 13.33, h: 0.75, fontSize: 56, bold: true, color: C.white, fontFace: FONT, align: 'center', charSpacing: -1 })
  s.addText('Inventory System', { x: 0, y: 4.55, w: 13.33, h: 0.75, fontSize: 56, bold: true, color: C.accent, fontFace: FONT, align: 'center', charSpacing: -1 })

  // Subtitle
  s.addText('Integrated platform for Inventory, Purchasing & Project Management', {
    x: 1.5, y: 5.45, w: 10.33, h: 0.4,
    fontSize: 13, color: 'A0B0C8', fontFace: FONT, align: 'center',
  })

  // Bottom divider
  s.addShape(pres.ShapeType.rect, { x: 5.67, y: 6.08, w: 2, h: 0.03, fill: { color: C.accent } })

  // Meta row
  const meta = [['Company', 'RMC'], ['Version', '1.0 — MVP'], ['Year', '2026'], ['Status', 'In Development']]
  meta.forEach(([k, v], i) => {
    const x = 2.4 + i * 2.3
    s.addText(v, { x, y: 6.2,  w: 2, h: 0.3,  fontSize: 12, bold: true, color: C.white,   fontFace: FONT, align: 'center' })
    s.addText(k, { x, y: 6.52, w: 2, h: 0.22, fontSize: 9,  color: 'A0B0C8', fontFace: FONT, align: 'center' })
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 2 — THE PROBLEM
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide(pres)

  label(s, 'The Challenge', 0.55, 0.22)
  titleLight(s, 'What Problem Are We Solving?', 'Solving?', 0.55, 0.44)

  // Accent underline
  s.addShape(pres.ShapeType.rect, { x: 0.55, y: 1.1, w: 0.5, h: 0.05, fill: { color: C.blue } })

  const problems = [
    ['📋', 'Manual Inventory Control',   'Disconnected spreadsheets prone to errors, with no real-time visibility or audit trail.'],
    ['🔗', 'Siloed Operations',           'Purchasing, projects and warehouse run on separate systems with no data flow between them.'],
    ['📊', 'No Data Visibility',          'No single source of truth for making informed decisions on stock, costs or project progress.'],
    ['🏗️', 'Project Tracking Gaps',       'No clear way to track which materials were dispatched to each site, costs or delivery status.'],
    ['🔄', 'Returns & Transfers',         'No formal process to return unused materials to the warehouse or move stock between locations.'],
    ['📄', 'Scattered Documentation',     'Invoices, contracts and project files stored without order or centralized traceability.'],
  ]

  problems.forEach(([icon, title, desc], i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = 0.55 + col * 4.22
    const y = 1.35 + row * 1.72
    card(s, x, y, 3.98, 1.5, C.white, C.border)
    s.addText(icon,  { x: x + 0.18, y: y + 0.2,  w: 0.45, h: 0.35, fontSize: 18, fontFace: FONT })
    s.addText(title, { x: x + 0.18, y: y + 0.55, w: 3.6,  h: 0.28, fontSize: 11, bold: true, color: C.text,  fontFace: FONT })
    s.addText(desc,  { x: x + 0.18, y: y + 0.82, w: 3.6,  h: 0.55, fontSize: 9,  color: C.muted, fontFace: FONT, wrap: true })
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 3 — WHAT IS IT
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide(pres)

  label(s, 'The Solution', 0.55, 0.22)
  titleDark(s, 'What is the Project Inventory System?', 0.55, 0.44, 12)

  // Left text
  const paras = [
    'The Project Inventory System is a fully integrated web platform built for RMC that unifies inventory management, purchasing, and project operations in a single place.',
    'Every department works with real-time data, full material traceability, and automatic reports — empowering smarter, faster decisions.',
  ]
  paras.forEach((p, i) => {
    s.addText(p, { x: 0.55, y: 1.35 + i * 0.9, w: 5.8, h: 0.78, fontSize: 11, color: 'C0CFDF', fontFace: FONT, wrap: true, lineSpacingMultiple: 1.3 })
  })

  // Quote box
  s.addShape(pres.ShapeType.rect, { x: 0.55, y: 3.18, w: 0.06, h: 1.0, fill: { color: C.accent } })
  s.addText('"One platform for the full cycle — from purchasing materials to dispatching to the job site and returning surplus to the warehouse."', {
    x: 0.75, y: 3.18, w: 5.6, h: 1.0,
    fontSize: 10.5, color: C.accent, fontFace: FONT, italic: true, wrap: true, lineSpacingMultiple: 1.4,
  })

  // Right pills
  const pills = [
    '✓  Web access from any device',
    '✓  Full material & document traceability',
    '✓  User roles & permissions',
    '✓  Automatic PDF generation',
    '✓  One-click Excel export',
    '✓  Modern, responsive design',
    '✓  Reliable local database backup',
  ]
  pills.forEach((p, i) => {
    card(s, 7.05, 1.3 + i * 0.72, 5.73, 0.55, '1A2F55', '2A4570')
    s.addText(p, { x: 7.25, y: 1.4 + i * 0.72, w: 5.4, h: 0.35, fontSize: 10, color: C.white, fontFace: FONT, bold: false })
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 4 — MODULES
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide(pres)
  label(s, 'System Architecture', 0.55, 0.22)
  titleLight(s, 'Platform Modules', 'Modules', 0.55, 0.44)
  s.addShape(pres.ShapeType.rect, { x: 0.55, y: 1.1, w: 0.5, h: 0.05, fill: { color: C.blue } })

  const modules = [
    ['01', '📊', 'Dashboard',      'Real-time KPIs, stock alerts and executive overview'],
    ['02', '🏭', 'Warehouses',     'Facilities, racks, shelves and physical product locations'],
    ['03', '📦', 'Products',       'Catalog with families, units, minimum stock and costs'],
    ['04', '🛒', 'Purchases',      'Purchase orders, suppliers, documents and tracking'],
    ['05', '🏗️', 'Projects',       'Planning, materials, budgets and site dispatches'],
    ['06', '📥', 'Receiving',      'Goods receipt, verification and warehouse placement'],
    ['07', '🔄', 'Transfers',      'Stock movements between locations with full traceability'],
    ['08', '👥', 'People',         'Suppliers, clients and contractors in one registry'],
    ['09', '📅', 'Tasks',          'Activity calendar and team task tracking'],
    ['10', '📈', 'Reports',        'Inventory & purchasing analytics exportable to PDF/Excel'],
    ['11', '⚙️', 'Settings',       'System parameters, users, roles and master data'],
    ['+',  '🚀', 'Expandable',     'Modular architecture ready for new features'],
  ]

  modules.forEach(([num, icon, title, desc], i) => {
    const col = i % 4
    const row = Math.floor(i / 4)
    moduleCard(s, 0.28 + col * 3.2, 1.3 + row * 1.75, num, icon, title, desc)
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 5 — WAREHOUSES
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide(pres)
  label(s, 'Module 02', 0.55, 0.22)
  titleLight(s, 'Warehouse & Inventory Management', 'Inventory Management', 0.55, 0.44)
  s.addShape(pres.ShapeType.rect, { x: 0.55, y: 1.1, w: 0.5, h: 0.05, fill: { color: C.blue } })

  const features = [
    ['🗺️', 'Digital Warehouse Map',       'Visual layout of the facility with identified racks and shelves'],
    ['📍', 'Exact Product Location',       'Every item has a precise position: Warehouse → Rack → Shelf → Qty'],
    ['⚠️', 'Minimum Stock Alerts',         'Automatic notifications when inventory drops below configured levels'],
    ['🔄', 'Movement Control',             'Complete history of receipts, withdrawals and transfers with timestamps'],
    ['🏢', 'Multi-Warehouse',             'Support for multiple facilities with independent management'],
  ]
  features.forEach(([icon, title, desc], i) => {
    const y = 1.3 + i * 1.08
    card(s, 0.55, y, 6.7, 0.9, C.white, C.border)
    s.addText(icon,  { x: 0.72, y: y + 0.22, w: 0.5, h: 0.45, fontSize: 18, fontFace: FONT })
    s.addText(title, { x: 1.32, y: y + 0.12, w: 5.7, h: 0.28, fontSize: 11, bold: true, color: C.text, fontFace: FONT })
    s.addText(desc,  { x: 1.32, y: y + 0.4,  w: 5.7, h: 0.35, fontSize: 9.5, color: C.muted, fontFace: FONT, wrap: true })
  })

  // Hierarchy box
  card(s, 7.6, 1.3, 5.18, 5.45, C.white, C.border)
  s.addText('INVENTORY HIERARCHY', { x: 7.8, y: 1.45, w: 4.8, h: 0.25, fontSize: 8.5, bold: true, color: C.blue, fontFace: FONT, charSpacing: 2 })

  const hier = [
    ['🏭', 'Warehouse',       'Level 1', C.blue],
    ['🗄️', 'Rack',           'Level 2', '7C3AED'],
    ['📂', 'Shelf',           'Level 3', C.teal],
    ['📦', 'Product + Stock', 'Level 4', C.accent],
  ]
  hier.forEach(([icon, title, lv, color], i) => {
    const y = 1.88 + i * 1.08
    s.addShape(pres.ShapeType.rect, { x: 7.8, y, w: 0.06, h: 0.7, fill: { color } })
    s.addText(icon,  { x: 8.0,  y: y + 0.1,  w: 0.4, h: 0.4,  fontSize: 18, fontFace: FONT })
    s.addText(title, { x: 8.5,  y: y + 0.1,  w: 3.0, h: 0.3,  fontSize: 11, bold: true, color: C.text, fontFace: FONT })
    s.addText(lv,    { x: 11.5, y: y + 0.1,  w: 1.1, h: 0.3,  fontSize: 9,  color: C.muted, fontFace: FONT, align: 'right' })
  })
  s.addText('This structure allows any product to be located instantly and maintains accurate inventory by physical location.', {
    x: 7.8, y: 6.1, w: 4.8, h: 0.55, fontSize: 9, color: C.muted, fontFace: FONT, wrap: true, italic: true,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 6 — PURCHASES
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide(pres)
  label(s, 'Module 04', 0.55, 0.22)
  titleDark(s, 'Purchase Management', 0.55, 0.44)

  // Flow
  const steps = [
    ['📝', 'Request', 'Material requirement'],
    ['✅', 'Approval', 'Validation & budget'],
    ['🛒', 'Purchase Order', 'Issued to supplier'],
    ['📥', 'Receiving', 'Goods into warehouse'],
    ['📊', 'Live Stock', 'Real-time inventory'],
  ]
  const sw = 2.1
  steps.forEach(([icon, title, sub], i) => {
    const x = 0.38 + i * 2.58
    card(s, x, 1.35, sw, 1.3, '1A2F55', '2A4570')
    s.addText(icon,  { x, y: 1.42, w: sw, h: 0.42, fontSize: 20, fontFace: FONT, align: 'center' })
    s.addText(title, { x, y: 1.84, w: sw, h: 0.28, fontSize: 10, bold: true, color: C.white,   fontFace: FONT, align: 'center' })
    s.addText(sub,   { x, y: 2.12, w: sw, h: 0.25, fontSize: 8.5, color: 'A0B0C8', fontFace: FONT, align: 'center' })
    if (i < 4) s.addText('→', { x: x + sw, y: 1.75, w: 0.48, h: 0.5, fontSize: 22, color: C.accent, fontFace: FONT, align: 'center' })
  })

  // 3 detail cards
  const details = [
    ['SUPPLIER MANAGEMENT', [
      '• Centralized supplier registry',
      '• Purchase history per supplier',
      '• Price comparison tools',
      '• Contact data & terms',
    ]],
    ['ORDER CONTROL', [
      '• Status: Draft / Sent / Received',
      '• Invoice & document attachment',
      '• Automatic PDF generation',
      '• Advanced search & filters',
    ]],
    ['TRACEABILITY', [
      '• Each purchase linked to a project',
      '• Item-by-item tracking',
      '• Full change audit trail',
      '• Pending delivery alerts',
    ]],
  ]
  details.forEach(([heading, items], i) => {
    const x = 0.38 + i * 4.32
    card(s, x, 2.88, 4.1, 3.55, '1A2F55', '2A4570')
    s.addText(heading, { x: x + 0.2, y: 3.02, w: 3.7, h: 0.25, fontSize: 9, bold: true, color: C.accent, fontFace: FONT, charSpacing: 1.5 })
    s.addText(items.join('\n'), { x: x + 0.2, y: 3.32, w: 3.7, h: 2.8, fontSize: 10, color: 'C0CFDF', fontFace: FONT, wrap: true, lineSpacingMultiple: 1.5 })
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 7 — PROJECTS
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide(pres)
  label(s, 'Module 05', 0.55, 0.22)
  titleLight(s, 'Project & Site Management', 'Site Management', 0.55, 0.44)
  s.addShape(pres.ShapeType.rect, { x: 0.55, y: 1.1, w: 0.5, h: 0.05, fill: { color: C.blue } })

  const cards = [
    ['📋', 'Material Planning', [
      'Bill of materials per project',
      'Linked to live warehouse inventory',
      'Planned vs. dispatched tracking',
      'Missing material alerts',
      'Estimated vs. actual cost',
    ]],
    ['🚚', 'Site Dispatch', [
      'Material withdrawal from warehouse',
      'Dispatch progress bar',
      'Auto-generated dispatch documents',
      'Field material traceability',
      'Automatic stock update',
    ]],
    ['🔙', 'Returns', [
      'Formal surplus return process',
      'Automatic restock to warehouse',
      'Return history per project',
      'Cost & KPI adjustment',
    ]],
    ['📁', 'Documentation', [
      'Attach plans, contracts & permits',
      'PDF material request generation',
      'Document history per project',
      'Quick access to all project files',
    ]],
  ]
  cards.forEach(([icon, title, items], i) => {
    const x = 0.28 + (i % 2) * 6.52
    const y = 1.3  + Math.floor(i / 2) * 2.88
    card(s, x, y, 6.22, 2.65, C.white, C.border)
    s.addText(icon,  { x: x + 0.22, y: y + 0.22, w: 0.5, h: 0.4, fontSize: 18, fontFace: FONT })
    s.addText(title, { x: x + 0.8,  y: y + 0.22, w: 5.2, h: 0.38, fontSize: 12.5, bold: true, color: C.text, fontFace: FONT })
    items.forEach((item, j) => {
      s.addShape(pres.ShapeType.ellipse, { x: x + 0.28, y: y + 0.72 + j * 0.38, w: 0.1, h: 0.1, fill: { color: C.green } })
      s.addText(item, { x: x + 0.48, y: y + 0.65 + j * 0.38, w: 5.5, h: 0.3, fontSize: 9.5, color: C.text, fontFace: FONT })
    })
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 8 — REPORTS
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide(pres)
  label(s, 'Module 10', 0.55, 0.22)
  titleDark(s, 'Reports & Data Analytics', 0.55, 0.44)

  const reports = [
    ['📦', 'Inventory Report',    'Stock valuation by warehouse, below-minimum products, material turnover and category analysis.',   'PDF · Excel'],
    ['🛒', 'Purchasing Report',   'Summary by supplier, monthly spend trend, price comparison and active order status.',               'PDF · Excel'],
    ['🏗️', 'Projects Report',     'Dispatch progress per project, planned vs. actual budget and pending material deliveries.',         'PDF · Excel'],
    ['📊', 'Executive Dashboard', 'Real-time KPIs: inventory value, active orders, ongoing projects and critical operation alerts.',    'On-screen · PDF'],
  ]

  const cols = [[0, 1], [2, 3]]
  cols.forEach((pair, col) => {
    pair.forEach((idx, row) => {
      const [icon, title, desc, exp] = reports[idx]
      const x = 0.42 + col * 6.52
      const y = 1.35 + row * 2.9
      card(s, x, y, 6.22, 2.65, '1A2F55', '2A4570')
      s.addText(icon,  { x: x + 0.22, y: y + 0.25,  w: 0.55, h: 0.55, fontSize: 26, fontFace: FONT })
      s.addText(title, { x: x + 0.9,  y: y + 0.25,  w: 5.1,  h: 0.45, fontSize: 13, bold: true, color: C.white, fontFace: FONT })
      s.addText(desc,  { x: x + 0.22, y: y + 0.82,  w: 5.8,  h: 1.15, fontSize: 9.5, color: 'A0B0C8', fontFace: FONT, wrap: true, lineSpacingMultiple: 1.35 })
      // Export badge
      card(s, x + 0.22, y + 2.1, 2.6, 0.38, '0D9488', '0D9488')
      s.addText('✓  ' + exp, { x: x + 0.22, y: y + 2.12, w: 2.6, h: 0.34, fontSize: 9, bold: true, color: C.white, fontFace: FONT, align: 'center' })
    })
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 9 — BENEFITS
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide(pres)
  label(s, 'Business Value', 0.55, 0.22)
  titleLight(s, 'Concrete Benefits for RMC', 'Benefits', 0.55, 0.44)
  s.addShape(pres.ShapeType.rect, { x: 0.55, y: 1.1, w: 0.5, h: 0.05, fill: { color: C.blue } })

  const benefits = [
    ['−80%', 'Time on Stock Control',      'Eliminates manual spreadsheet tracking and centralizes all data in a single system.',            C.blue,   'DBEAFE', 'BFDBFE'],
    ['100%', 'Material Traceability',       'From purchase to dispatch, every movement is logged with date and responsible party.',          C.teal,   'CCFBF1', '99F6E4'],
    ['$0',   'Losses from Disorganization','Stock alerts and material tracking eliminate losses from misplacement or disorder.',            C.green,  'D1FAE5', 'A7F3D0'],
    ['+',    'Data-Driven Decisions',       'Automatic reports with real data enable better purchasing and project planning.',              C.purple, 'EDE9FE', 'DDD6FE'],
    ['1',    'Unified Platform',            'Warehouse, purchasing and projects in one place. No more emails, chats or loose files.',        '0369A1', 'E0F2FE', 'BAE6FD'],
    ['∞',    'Scalability',                 'Modular architecture that grows with the company: new warehouses, users and features.',        C.rose,   'FEE2E2', 'FECACA'],
  ]

  benefits.forEach(([num, title, desc, tc, bg, border], i) => {
    const col = i % 3
    const row = Math.floor(i / 3)
    const x = 0.28 + col * 4.35
    const y = 1.3  + row * 2.6
    card(s, x, y, 4.1, 2.35, bg, border)
    s.addText(num,   { x, y: y + 0.18, w: 4.1, h: 0.65, fontSize: 38, bold: true, color: tc, fontFace: FONT, align: 'center' })
    s.addText(title, { x: x + 0.2, y: y + 0.82, w: 3.7, h: 0.32, fontSize: 11, bold: true, color: C.text,  fontFace: FONT })
    s.addText(desc,  { x: x + 0.2, y: y + 1.12, w: 3.7, h: 0.9,  fontSize: 9,  color: C.muted, fontFace: FONT, wrap: true, lineSpacingMultiple: 1.3 })
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 10 — TECHNOLOGY
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = darkSlide(pres)
  label(s, 'Infrastructure', 0.55, 0.22)
  titleDark(s, 'Modern & Reliable Technology Stack', 0.55, 0.44)

  const stack = [
    ['⚛️', 'Next.js 16 + React 19',      'Latest-generation web framework',       'Frontend'],
    ['🗄️', 'Prisma ORM + SQLite',         'Robust and portable database',          'Backend'],
    ['🎨', 'Tailwind CSS + shadcn/ui',    'Modern, accessible interface',          'UI'],
    ['⚡', 'Bun Runtime',                 'Ultra-fast JavaScript server',          'Runtime'],
    ['📄', 'React PDF + xlsx',            'Document & report generation',          'Docs'],
    ['🔒', 'NextAuth + TypeScript',       'Secure auth & typed codebase',          'Security'],
  ]
  stack.forEach(([icon, name, desc, badge], i) => {
    const y = 1.35 + i * 0.92
    card(s, 0.42, y, 6.22, 0.76, '1A2F55', '2A4570')
    s.addText(icon, { x: 0.6,  y: y + 0.18, w: 0.4,  h: 0.4,  fontSize: 17, fontFace: FONT })
    s.addText(name, { x: 1.1,  y: y + 0.08, w: 3.5,  h: 0.32, fontSize: 11, bold: true,  color: C.white,   fontFace: FONT })
    s.addText(desc, { x: 1.1,  y: y + 0.4,  w: 3.5,  h: 0.28, fontSize: 9,  color: 'A0B0C8', fontFace: FONT })
    card(s, 5.7, y + 0.2, 0.84, 0.35, '1A56DB', '1A56DB')
    s.addText(badge, { x: 5.7, y: y + 0.22, w: 0.84, h: 0.31, fontSize: 8.5, bold: true, color: C.white, fontFace: FONT, align: 'center' })
  })

  // Arch diagram
  card(s, 7.05, 1.35, 5.83, 5.9, '1A2F55', '2A4570')
  s.addText('APPLICATION ARCHITECTURE', { x: 7.25, y: 1.5, w: 5.4, h: 0.25, fontSize: 8.5, bold: true, color: C.accent, fontFace: FONT, charSpacing: 1.5, align: 'center' })

  const layers = [
    ['PRESENTATION', 'Web Interface (Browser / Desktop)'],
    ['APPLICATION',  'Next.js — Pages + API Routes'],
    ['BUSINESS',     'Services · Validations (Zod) · Logic'],
    ['DATA',         'Prisma ORM → SQLite Database'],
  ]
  layers.forEach(([lbl, val], i) => {
    const y = 1.9 + i * 1.15
    card(s, 7.25, y, 5.4, 0.88, '0F1E3D', '2A4570')
    s.addText(lbl, { x: 7.35, y: y + 0.06, w: 5.2, h: 0.22, fontSize: 7.5, bold: true, color: C.accent, fontFace: FONT, align: 'center', charSpacing: 1.5 })
    s.addText(val, { x: 7.35, y: y + 0.28, w: 5.2, h: 0.38, fontSize: 11,  color: C.white, fontFace: FONT, align: 'center' })
    if (i < 3) s.addText('↓', { x: 9.55, y: y + 0.9, w: 0.55, h: 0.22, fontSize: 12, color: '3A4A6A', fontFace: FONT, align: 'center' })
  })

  s.addText('Monolithic modular architecture.\nEasy to deploy on local server or cloud.', {
    x: 7.25, y: 6.55, w: 5.4, h: 0.55, fontSize: 8.5, color: '6A7FA0', fontFace: FONT, align: 'center', italic: true,
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 11 — ROADMAP
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = lightSlide(pres)
  label(s, 'Implementation Plan', 0.55, 0.22)
  titleLight(s, 'Project Roadmap', 'Roadmap', 0.55, 0.44)
  s.addShape(pres.ShapeType.rect, { x: 0.55, y: 1.1, w: 0.5, h: 0.05, fill: { color: C.blue } })

  // Vertical timeline line
  s.addShape(pres.ShapeType.rect, { x: 2.28, y: 1.55, w: 0.04, h: 5.45, fill: { color: C.border } })

  const phases = [
    { phase: 'Q1', year: '2026', title: 'MVP Development',            badge: 'COMPLETED', bc: C.green,  dot: C.green,
      desc: 'Core modules: Dashboard, Warehouses, Products, Purchasing, Projects and base Reports. Database and architecture design.' },
    { phase: 'Q2', year: '2026', title: 'Refinement & Pilot',         badge: 'IN PROGRESS', bc: C.blue, dot: C.blue,
      desc: 'User testing & workflow review, Receiving and Transfer modules, PDF generation, and real environment testing.' },
    { phase: 'Q3', year: '2026', title: 'Production & Training',      badge: 'UPCOMING', bc: C.accent, dot: C.border,
      desc: 'Deployment on RMC servers, historical data migration, team training and initial go-live support.' },
    { phase: 'Q4', year: '2026', title: 'Feature Expansion',          badge: 'FUTURE', bc: C.muted,  dot: C.border,
      desc: 'External integrations, warehouse mobile app, quotation module and advanced business intelligence.' },
  ]

  phases.forEach(({ phase, year, title, badge, bc, dot, desc }, i) => {
    const y = 1.6 + i * 1.4

    // Phase label
    s.addText(phase, { x: 0.55, y: y + 0.05, w: 1.5, h: 0.28, fontSize: 13, bold: true, color: C.text,  fontFace: FONT, align: 'right' })
    s.addText(year,  { x: 0.55, y: y + 0.32, w: 1.5, h: 0.22, fontSize: 9,  color: C.muted, fontFace: FONT, align: 'right' })

    // Dot
    s.addShape(pres.ShapeType.ellipse, { x: 2.18, y: y + 0.1, w: 0.24, h: 0.24, fill: { color: dot }, line: { color: dot === C.border ? C.muted : dot, width: 2 } })

    // Card
    card(s, 2.62, y, 10.28, 1.2, C.white, C.border)
    s.addText(title, { x: 2.82, y: y + 0.1, w: 7.0, h: 0.32, fontSize: 12, bold: true, color: C.text, fontFace: FONT })
    // Badge
    const badgeBg = { [C.green]: 'D1FAE5', [C.blue]: 'DBEAFE', [C.accent]: 'FEF3C7', [C.muted]: 'F1F5F9' }[bc] || 'F1F5F9'
    card(s, 10.0, y + 0.12, 2.7, 0.28, badgeBg, bc)
    s.addText(badge, { x: 10.0, y: y + 0.13, w: 2.7, h: 0.26, fontSize: 8, bold: true, color: bc, fontFace: FONT, align: 'center' })
    s.addText(desc,  { x: 2.82, y: y + 0.44, w: 9.9, h: 0.65, fontSize: 9.5, color: C.muted, fontFace: FONT, wrap: true, lineSpacingMultiple: 1.3 })
  })
}

// ══════════════════════════════════════════════════════════════════════════════
// SLIDE 12 — CLOSING
// ══════════════════════════════════════════════════════════════════════════════
{
  const s = pres.addSlide()
  s.background = { color: C.navy }
  s.addShape(pres.ShapeType.rect, { x: 0, y: 0, w: 13.33, h: 0.07, fill: { color: C.accent } })
  s.addShape(pres.ShapeType.ellipse, { x: 9.5, y: -1.2, w: 4, h: 4, fill: { color: '1A56DB', transparency: 88 }, line: { color: '1A56DB', transparency: 88 } })
  s.addShape(pres.ShapeType.ellipse, { x: -1,  y: 5,    w: 3, h: 3, fill: { color: '0D9488', transparency: 88 }, line: { color: '0D9488', transparency: 88 } })

  // Icon
  s.addShape(pres.ShapeType.roundRect, { x: 5.67, y: 0.5, w: 2, h: 2, rectRadius: 0.3, fill: { color: C.blue }, line: { color: C.blueLight, width: 1 } })
  s.addText('🚀', { x: 5.67, y: 0.65, w: 2, h: 1.5, fontSize: 52, fontFace: FONT, align: 'center' })

  s.addText("RMC's Digital Future", { x: 0, y: 2.72, w: 13.33, h: 0.7, fontSize: 44, bold: true, color: C.white,  fontFace: FONT, align: 'center', charSpacing: -1 })
  s.addText('Starts Here.', {         x: 0, y: 3.4,  w: 13.33, h: 0.7, fontSize: 44, bold: true, color: C.accent, fontFace: FONT, align: 'center', charSpacing: -1 })

  s.addText('A purpose-built system to digitize operations, control inventory and make smarter decisions.', {
    x: 1.5, y: 4.25, w: 10.33, h: 0.45, fontSize: 13, color: 'A0B0C8', fontFace: FONT, align: 'center',
  })

  s.addShape(pres.ShapeType.rect, { x: 5.67, y: 4.88, w: 2, h: 0.04, fill: { color: C.accent } })

  // Pills
  const pills2 = [['11', 'Integrated Modules'], ['100%', 'Built for RMC'], ['Web', 'Access Anywhere'], ['Live', 'Real-time Data']]
  pills2.forEach(([val, lbl], i) => {
    const x = 1.2 + i * 2.78
    card(s, x, 5.12, 2.42, 0.82, '1A2F55', '2A4570')
    s.addText(val, { x, y: 5.18, w: 2.42, h: 0.34, fontSize: 13, bold: true, color: C.accent, fontFace: FONT, align: 'center' })
    s.addText(lbl, { x, y: 5.5,  w: 2.42, h: 0.26, fontSize: 9,  color: 'A0B0C8',            fontFace: FONT, align: 'center' })
  })

  s.addText('Project Inventory System  ·  RMC  ·  2026', {
    x: 0, y: 7.1, w: 13.33, h: 0.3, fontSize: 9, color: '3A4A6A', fontFace: FONT, align: 'center',
  })
}

// ── SAVE ───────────────────────────────────────────────────────────────────
await pres.writeFile({ fileName: 'Project-Inventory-RMC.pptx' })
console.log('✅  Project-Inventory-RMC.pptx created successfully!')
