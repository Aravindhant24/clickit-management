import { useEffect, useState } from 'react'
import './App.css'
import sslImage from './assets/ssl.png'
import systemUpdateImage from './assets/system-update.png'
import serviceChannelImage from './assets/servicechannel.png'

const sidebarSections = [
  {
    title: 'View Options',
    items: [
      { label: 'Overview' },
      { label: 'Alerts', badge: '74' },
      { label: 'Point of Sale', children: ['POS Module', 'POS Exceptions'] },
      { label: 'Web Client', children: ['Live View', 'Video Playback', 'Investigation Module'] },
      {
        label: 'Video/Image Request',
        children: [
          'Video Requests',
          'Video History',
          'Auto Image Request',
          'Frame Extraction',
          'Video Upload Schedule',
          'Franchisee Options',
        ],
      },
      { label: 'VMS Health', children: ['Days of Storage', 'Drive Temperature', 'Hardware Monitor', 'Disk Usage'] },
      {
        label: 'Cameras',
        children: [
          'Alerts',
          'All Camera Details',
          'Rename Cameras',
          'Change Camera Password',
          'Firmware Update',
          'Camera Image Report',
          'Storage by Camera',
        ],
      },
      {
        label: 'Licenses',
        children: [
          'Camera Licensing',
          'VMS Licensing',
          'CMS Licensing',
          '360 Licensing',
          'Analytics Licensing',
          'Protection Area Licensing',
          'Multisite License',
        ],
      },
    ],
  },
  {
    title: 'Admin',
    items: [
      { label: 'User Management', children: ['Company Architecture', 'Security Levels', 'User Configuration'] },
      {
        label: 'Updates',
        children: ['Clickit Versions', 'Security Patches', 'OS Migration', 'SSL Certificates', 'Configuration'],
      },
      { label: 'CMS Settings', children: ['Company Setup', 'Location Setup', 'VMS Setup'] },
      { label: 'Utility', children: ['Unlock Code', 'Ticketing App', 'System Scanner'] },
    ],
  },
]

const tools = [
  { label: 'Camera Firmware Update', type: 'firmware' },
  { label: 'Camera Password', type: 'password' },
  { label: 'Operating System', type: 'image', image: systemUpdateImage, alt: 'Operating system tool' },
  { label: 'Web Users', type: 'users' },
  { label: 'SSL Certificates', type: 'image', image: sslImage, alt: 'SSL certificates tool', isNew: true },
  { label: 'System Scanner', type: 'scanner', isNew: true },
]

const actionItemUiMap = {
  'older-clickit-versions': {
    panelId: 'camera-models-panel',
    feedback: 'Opened IP Camera Models.',
  },
  'ssl-certificates-expiring-soon': {
    icon: sslImage,
    iconAlt: 'SSL certificate illustration',
    panelId: 'trial-license-panel',
    feedback: 'Opened VM Trial Licenses.',
  },
  'security-patch-updates': {
    icon: systemUpdateImage,
    iconAlt: 'Security patch update illustration',
    panelId: 'multisite-license-panel',
    feedback: 'Opened Multisite License.',
  },
}

const API_ROOT = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '')
const LICENSES_API_BASE = `${API_ROOT}/licenses`
const CAMERA_MODELS_API_BASE = `${API_ROOT}/camera-models`
const SYSTEM_STATUS_API_BASE = `${API_ROOT}/system-status`
const ACTION_ITEMS_API_BASE = `${API_ROOT}/action-items`

function App() {
  const [openMenus, setOpenMenus] = useState({})
  const [licenseRows, setLicenseRows] = useState([])
  const [cameraRows, setCameraRows] = useState([])
  const [cameraViewRow, setCameraViewRow] = useState(null)
  const [systemStatus, setSystemStatus] = useState({
    totalSystems: 0,
    systemsOnline: 0,
    systemsOffline: 0,
  })
  const [actionItems, setActionItems] = useState([])
  const [currentPage, setCurrentPage] = useState(1)
  const [licenseForm, setLicenseForm] = useState({
    name: '',
    email: '',
    status: 'Active',
    expiry: '',
  })
  const [topSearch, setTopSearch] = useState('')
  const [searchFeedback, setSearchFeedback] = useState('')
  const [editingId, setEditingId] = useState(null)
  const [editForm, setEditForm] = useState({ name: '', email: '', status: 'Active', expiry: '' })
  const [viewRow, setViewRow] = useState(null)
  const [tableMessage, setTableMessage] = useState('')
  const [cameraTableMessage, setCameraTableMessage] = useState('')
  const [systemStatusMessage, setSystemStatusMessage] = useState('')
  const [actionItemsMessage, setActionItemsMessage] = useState('')
  const pageSize = 5

  const toggleMenu = (key) => {
    setOpenMenus((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  const totalPages = Math.max(1, Math.ceil(licenseRows.length / pageSize))
  const startIndex = (currentPage - 1) * pageSize
  const pagedLicenses = licenseRows.slice(startIndex, startIndex + pageSize)

  const handleLicenseInput = (field, value) => {
    setLicenseForm((prev) => ({ ...prev, [field]: value }))
  }

  const fetchLicenses = async () => {
    try {
      const res = await fetch(LICENSES_API_BASE)
      if (!res.ok) throw new Error('Failed to fetch data')
      const rows = await res.json()
      setLicenseRows(rows)
      setTableMessage('')
    } catch {
      setLicenseRows([])
      setTableMessage('Unable to load license data. Start the backend API with `npm run server`.')
    }
  }

  const fetchCameraModels = async () => {
    try {
      const res = await fetch(CAMERA_MODELS_API_BASE)
      if (!res.ok) throw new Error('Failed to fetch camera models')
      const rows = await res.json()
      setCameraRows(rows)
      setCameraTableMessage('')
    } catch {
      setCameraRows([])
      setCameraTableMessage('Unable to load camera models. Start the backend API with `npm run server`.')
    }
  }

  const fetchSystemStatus = async () => {
    try {
      const res = await fetch(SYSTEM_STATUS_API_BASE)
      if (!res.ok) throw new Error('Failed to fetch system status')
      const row = await res.json()
      setSystemStatus(row)
      setSystemStatusMessage('')
    } catch {
      setSystemStatus({
        totalSystems: 0,
        systemsOnline: 0,
        systemsOffline: 0,
      })
      setSystemStatusMessage('Unable to load system status. Start the backend API with `npm run server`.')
    }
  }

  const fetchActionItems = async () => {
    try {
      const res = await fetch(ACTION_ITEMS_API_BASE)
      if (!res.ok) throw new Error('Failed to fetch action items')
      const rows = await res.json()
      const mappedRows = rows.map((row) => ({
        ...row,
        ...actionItemUiMap[row.key],
      }))
      setActionItems(mappedRows)
      setActionItemsMessage('')
    } catch {
      setActionItems([])
      setActionItemsMessage('Unable to load action items. Start the backend API with `npm run server`.')
    }
  }

  const handleAddLicense = async () => {
    if (!licenseForm.name.trim() || !licenseForm.email.trim() || !licenseForm.expiry.trim()) return

    const nextRow = {
      ...licenseForm,
      name: licenseForm.name.trim(),
      email: licenseForm.email.trim(),
      expiry: licenseForm.expiry.trim(),
    }

    try {
      const res = await fetch(LICENSES_API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(nextRow),
      })
      if (!res.ok) throw new Error('create failed')
      await res.json()
      await fetchLicenses()
      setCurrentPage(Math.ceil((licenseRows.length + 1) / pageSize))
      setLicenseForm({
        name: '',
        email: '',
        status: 'Active',
        expiry: '',
      })
      setTableMessage('')
    } catch {
      setTableMessage('Failed to add license. Make sure the backend API is running.')
    }
  }

  const handleStartEdit = (row) => {
    setEditingId(row.id)
    setEditForm({
      name: row.name,
      email: row.email,
      status: row.status,
      expiry: row.expiry,
    })
  }

  const handleSaveEdit = async (id) => {
    if (!editForm.name.trim() || !editForm.email.trim() || !editForm.expiry.trim()) return

    const updatedDraft = {
      name: editForm.name.trim(),
      email: editForm.email.trim(),
      status: editForm.status,
      expiry: editForm.expiry.trim(),
    }

    try {
      const res = await fetch(`${LICENSES_API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedDraft),
      })
      if (!res.ok) throw new Error('update failed')
      await res.json()
      await fetchLicenses()
      setEditingId(null)
      setTableMessage('')
    } catch {
      setTableMessage('Failed to save changes. Make sure the backend API is running.')
    }
  }

  const handleRemove = async (id) => {
    try {
      const res = await fetch(`${LICENSES_API_BASE}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      await fetchLicenses()
      if (editingId === id) setEditingId(null)
      if (viewRow?.id === id) setViewRow(null)
      setTableMessage('')
    } catch {
      setTableMessage('Failed to remove license. Make sure the backend API is running.')
    }
  }

  const handleTopSearch = () => {
    const query = topSearch.trim().toLowerCase()
    if (!query) {
      setSearchFeedback('Enter text to search.')
      return
    }

    const panelTargets = [
      { id: 'my-tools-panel', terms: ['my tools', ...tools.map((tool) => tool.label)] },
      { id: 'status-panel', terms: ['status', 'systems', 'action items'] },
      { id: 'camera-models-panel', terms: ['ip camera models', 'camera models', 'cameras'] },
      { id: 'trial-license-panel', terms: ['vm trial licenses', 'trial licenses'] },
      { id: 'multisite-license-panel', terms: ['multisite license', 'multisite', 'license'] },
    ]

    const panelHit = panelTargets.find((panel) => panel.terms.some((term) => term.toLowerCase().includes(query)))
    if (panelHit) {
      navigateToPanel(panelHit.id, `Navigated to ${panelHit.terms[0]}.`)
      return
    }

    for (const section of sidebarSections) {
      for (const item of section.items) {
        const menuKey = `${section.title}-${item.label}`
        if (item.label.toLowerCase().includes(query)) {
          if (item.children?.length) {
            setOpenMenus((prev) => ({ ...prev, [menuKey]: true }))
            setSearchFeedback(`Opened ${item.label}.`)
          } else {
            setSearchFeedback(`Found ${item.label}.`)
          }
          return
        }

        const childHit = item.children?.find((child) => child.toLowerCase().includes(query))
        if (childHit) {
          setOpenMenus((prev) => ({ ...prev, [menuKey]: true }))
          setSearchFeedback(`Opened ${item.label} > ${childHit}.`)
          return
        }
      }
    }

    const licenseIndex = licenseRows.findIndex(
      (row) =>
        row.name.toLowerCase().includes(query) ||
        row.email.toLowerCase().includes(query) ||
        getLicenseStatus(row).toLowerCase().includes(query)
    )

    if (licenseIndex >= 0) {
      const page = Math.floor(licenseIndex / pageSize) + 1
      setCurrentPage(page)
      navigateToPanel('multisite-license-panel', `Found result in Multisite License (page ${page}).`)
      return
    }

    setSearchFeedback('No matching result found.')
  }

  const navigateToPanel = (panelId, feedback) => {
    document.getElementById(panelId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    if (feedback) setSearchFeedback(feedback)
  }

  const handleSidebarNavigation = (label, parentLabel) => {
    if (label === 'Multisite License') {
      const licensesMenuKey = `View Options-${parentLabel}`
      setOpenMenus((prev) => ({ ...prev, [licensesMenuKey]: true }))
      navigateToPanel('multisite-license-panel', 'Opened Multisite License.')
      return
    }
  }

  const handleViewDetails = (panelId, feedback) => {
    navigateToPanel(panelId, feedback)
  }

  const getDaysRemaining = (expiryText) => {
    const text = String(expiryText || '').trim()
    const inlineDaysMatch = text.match(/\(([-]?\d+)\s*days?\)/i)
    if (inlineDaysMatch) return Number(inlineDaysMatch[1])

    const dateOnly = text.split('(')[0].trim()
    const parsed = new Date(dateOnly)
    if (Number.isNaN(parsed.getTime())) return '-'

    const now = new Date()
    const msPerDay = 1000 * 60 * 60 * 24
    const diff = Math.ceil((parsed.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / msPerDay)
    return diff
  }

  const getLicenseStatus = (row) => {
    const daysRemaining = getDaysRemaining(row.expiry)
    if (typeof daysRemaining !== 'number') return row.status
    if (daysRemaining < 0) return 'Expired'
    if (daysRemaining <= 30) return 'Expiring'
    return 'Active'
  }

  const statusCounts = licenseRows.reduce(
    (counts, row) => {
      const status = getLicenseStatus(row)
      if (status === 'Expired') counts.expired += 1
      else if (status === 'Expiring') counts.expiring += 1
      else counts.active += 1
      return counts
    },
    { active: 0, expiring: 0, expired: 0 }
  )

  const totalLicenses = licenseRows.length
  const activePercent = totalLicenses ? Math.round((statusCounts.active / totalLicenses) * 100) : 0
  const expiringPercent = totalLicenses ? Math.round((statusCounts.expiring / totalLicenses) * 100) : 0
  const expiredPercent = Math.max(0, 100 - activePercent - expiringPercent)
  const seatChartStyle = {
    background: `conic-gradient(var(--blue) 0 ${activePercent}%, #4ec5f2 ${activePercent}% ${activePercent + expiringPercent}%, var(--red) ${activePercent + expiringPercent}% ${activePercent + expiringPercent + expiredPercent}%)`,
  }

  const renderToolIcon = (tool) => {
    if (tool.type === 'image') {
      return <img className="tool-image" src={tool.image} alt={tool.alt} />
    }

    if (tool.type === 'firmware') {
      return (
        <div className="tool-icon tool-icon-firmware" aria-hidden="true">
          <span className="firmware-ring" />
          <span className="firmware-arrow one" />
          <span className="firmware-arrow two" />
        </div>
      )
    }

    if (tool.type === 'password') {
      return (
        <div className="tool-icon tool-icon-password" aria-hidden="true">
          <span className="lock-body" />
          <span className="lock-shackle" />
          <span className="password-base" />
        </div>
      )
    }

    if (tool.type === 'users') {
      return (
        <div className="tool-icon tool-icon-users" aria-hidden="true">
          <span className="user-head" />
          <span className="user-body" />
        </div>
      )
    }

    if (tool.type === 'scanner') {
      return (
        <div className="tool-icon tool-icon-scanner" aria-hidden="true">
          <span className="scanner-node n1" />
          <span className="scanner-node n2" />
          <span className="scanner-node n3" />
          <span className="scanner-node n4" />
          <span className="scanner-node n5" />
          <span className="scanner-line l1" />
          <span className="scanner-line l2" />
          <span className="scanner-line l3" />
          <span className="scanner-line l4" />
        </div>
      )
    }

    return <div className="tool-icon" aria-hidden="true" />
  }

  useEffect(() => {
    fetchLicenses()
    fetchCameraModels()
    fetchSystemStatus()
    fetchActionItems()
  }, [])

  useEffect(() => {
    setCurrentPage((prev) => Math.min(prev, totalPages))
  }, [totalPages])

  return (
    <div className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-main">Central Management</div>
          <div className="brand-sub">Powered by ClickIt</div>
        </div>

        {sidebarSections.map((section) => (
          <div key={section.title} className="sidebar-section">
            <p>{section.title}</p>
            {section.items.map((item) => {
              const menuKey = `${section.title}-${item.label}`
              const isOpen = Boolean(openMenus[menuKey])
              const hasChildren = Boolean(item.children?.length)

              return (
              <div key={item.label} className="side-group">
                <button
                  className={`side-btn ${item.label === 'Overview' ? 'active' : ''} ${isOpen ? 'open' : ''}`}
                  onClick={() => hasChildren && toggleMenu(menuKey)}
                  type="button"
                >
                  <span>{item.label}</span>
                  {item.badge ? <small className="badge">{item.badge}</small> : hasChildren ? <small className="chev">{'>'}</small> : null}
                </button>
                {hasChildren && isOpen ? (
                  <div className="sub-menu">
                    {item.children.map((child) => (
                      <button
                        key={child}
                        className={`sub-btn ${child === 'Multisite License' ? 'is-link' : ''}`}
                        onClick={() => handleSidebarNavigation(child, item.label)}
                        type="button"
                      >
                        {child}
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )})}
          </div>
        ))}
      </aside>

      <main className="content">
        <header className="topbar">
          <div className="crumbs">Overview &gt; Company</div>
          <div className="profile">Isac Tamir</div>
        </header>

        <section className="welcome">
          <h1>Welcome, Isac! What are you looking for?</h1>
          <div className="search-row">
            <input
              type="text"
              placeholder="Search Central..."
              value={topSearch}
              onChange={(e) => setTopSearch(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleTopSearch()}
            />
            <button type="button" onClick={handleTopSearch}>Search</button>
          </div>
          {searchFeedback ? <p className="search-feedback">{searchFeedback}</p> : null}
        </section>

        <section className="panel" id="my-tools-panel">
          <h2>My Tools</h2>
          <div className="tools-grid">
            {tools.map((tool) => (
              <article key={tool.label} className="tool-card my-tool-card">
                {tool.isNew ? <span className="tool-badge">New</span> : null}
                {renderToolIcon(tool)}
                <h3>{tool.label}</h3>
              </article>
            ))}
            <article className="tool-card tool-card-add" aria-label="Add tool">
              <span className="tool-add-icon">+</span>
            </article>
          </div>
          <div className="external-tools">
            <h3 className="external-tools-label">External Links</h3>
            <div className="external-tools-grid">
            <a
              className="external-tool-link"
              href="https://servicechannel.com/"
              target="_blank"
              rel="noreferrer"
            >
              <img className="external-tool-image" src={serviceChannelImage} alt="ServiceChannel" />
            </a>
            <article className="tool-card tool-card-add external-tool-add" aria-label="Add external link">
              <span className="tool-add-icon">+</span>
            </article>
            </div>
          </div>
        </section>

        <section className="panel status-panel" id="status-panel">
          <div className="status-left">
            <h2>Status</h2>
            <div className="status-card">
              <div className="status-card-title">Total Systems</div>
              <div className="status-radial-chart" aria-label="Systems status radial chart">
                <div className="status-radial-track" />
                <div className="status-radial-green" />
                <div className="status-radial-red" />
              </div>
              <ul className="status-legend">
                <li className="total">
                  <span>Total Systems</span>
                  <b>{systemStatus.totalSystems.toLocaleString()}</b>
                </li>
                <li className="online">
                  <span>Systems Online</span>
                  <b>{systemStatus.systemsOnline.toLocaleString()}</b>
                </li>
                <li className="offline">
                  <span>System Offline</span>
                  <b>{systemStatus.systemsOffline.toLocaleString()}</b>
                </li>
              </ul>
              {systemStatusMessage ? <p className="table-feedback">{systemStatusMessage}</p> : null}
            </div>
          </div>

          <div className="status-right">
            <div className="action-shell">
              <h2>Action Items</h2>
              {actionItems[0] ? (
                <div className="action-card featured" key={actionItems[0].label}>
                  <p>{actionItems[0].label}</p>
                  <div className="meter">
                    <span style={{ width: `${actionItems[0].level || 0}%` }} />
                  </div>
                  <div className="action-footer">
                    <button type="button" onClick={() => handleViewDetails(actionItems[0].panelId, actionItems[0].feedback)}>View Details</button>
                    <strong>
                      {actionItems[0].value} <span>{actionItems[0].meta}</span>
                    </strong>
                  </div>
                </div>
              ) : null}

              <div className="action-grid">
                {actionItems.slice(1).map((item) => (
                  <div className="action-card compact" key={item.label}>
                    <div className="action-head">
                      <p>{item.label}</p>
                      <img className="action-illustration" src={item.icon} alt={item.iconAlt} />
                    </div>
                    <div className="action-stat">
                      <strong>{item.value}</strong>
                      <span>{item.unit}</span>
                    </div>
                    {item.note ? <small>{item.note}</small> : null}
                    {item.link ? <button type="button" onClick={() => handleViewDetails(item.panelId, item.feedback)}>{item.link}</button> : null}
                  </div>
                ))}
              </div>
              {actionItemsMessage ? <p className="table-feedback">{actionItemsMessage}</p> : null}
            </div>
          </div>
        </section>

        <section className="panel" id="camera-models-panel">
          <h2>IP Camera Models</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Model</th>
                  <th># of Cameras</th>
                  <th># of Systems with Camera</th>
                  <th>AI + Analytics</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {cameraRows.map((row) => (
                  <tr key={row.id || row.model}>
                    <td>{row.model}</td>
                    <td>{row.cameras}</td>
                    <td>{row.systems}</td>
                    <td>{row.ai}</td>
                    <td className="action-cell">
                      <button type="button" onClick={() => setCameraViewRow(row)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {cameraTableMessage ? <p className="table-feedback">{cameraTableMessage}</p> : null}
          {cameraViewRow ? (
            <div className="view-panel">
              <div className="view-head">
                <strong>Camera Model Details</strong>
                <button type="button" onClick={() => setCameraViewRow(null)}>Close</button>
              </div>
              <p><b>Model:</b> {cameraViewRow.model}</p>
              <p><b># of Cameras:</b> {cameraViewRow.cameras}</p>
              <p><b># of Systems with Camera:</b> {cameraViewRow.systems}</p>
              <p><b>AI + Analytics:</b> {cameraViewRow.ai}</p>
            </div>
          ) : null}
        </section>

        <section className="panel" id="trial-license-panel">
          <h2>VM Trial Licenses</h2>
          <div className="license-summary">
            <button
              type="button"
              className="license-summary-card interactive"
              onClick={() => handleViewDetails('multisite-license-panel', 'Opened Multisite License.')}
            >
              <b>20</b><span>View Details</span>
            </button>
            <div><b>14</b><span>Active (11%)</span></div>
            <div><b>2</b><span>Expires in 60-90 days</span></div>
            <div><b>3</b><span>Expires in 30-60 days</span></div>
            <div><b>1</b><span>Expires in 0-30 days</span></div>
            <div><b>2</b><span>Expired</span></div>
          </div>
          <div className="license-bar">
            <span className="g" />
            <span className="y1" />
            <span className="y2" />
            <span className="o" />
            <span className="r" />
          </div>
        </section>

        <section className="panel multisite" id="multisite-license-panel">
          <h2>Multisite License</h2>
          <div className="multi-body">
            <div className="seat-chart">
              <div className="seat-donut" style={seatChartStyle}>{totalLicenses}</div>
              <ul>
                <li><span className="dot active" />Active ({statusCounts.active})</li>
                <li><span className="dot soon" />Expiring Soon ({statusCounts.expiring})</li>
                <li><span className="dot exp" />Expired ({statusCounts.expired})</li>
              </ul>
            </div>
            <div className="multisite-table-panel">
              <div className="multisite-toolbar">
                <div className="multisite-label">Manage Multisite Users</div>
                <div className="add-license-form">
                  <input
                    type="text"
                    placeholder="Name"
                    value={licenseForm.name}
                    onChange={(e) => handleLicenseInput('name', e.target.value)}
                  />
                  <input
                    type="email"
                    placeholder="Email"
                    value={licenseForm.email}
                    onChange={(e) => handleLicenseInput('email', e.target.value)}
                  />
                  <select value={licenseForm.status} onChange={(e) => handleLicenseInput('status', e.target.value)}>
                    <option value="Active">Active</option>
                    <option value="Expiring">Expiring</option>
                    <option value="Expired">Expired</option>
                  </select>
                  <input
                    type="text"
                    placeholder="Expiration / Days Remaining"
                    value={licenseForm.expiry}
                    onChange={(e) => handleLicenseInput('expiry', e.target.value)}
                  />
                  <button type="button" onClick={handleAddLicense}>Add</button>
                </div>
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Email</th>
                      <th>Status</th>
                      <th>Expiration</th>
                      <th>Days Remaining</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pagedLicenses.map((row, index) => (
                      <tr key={`${row.id}-${index}`}>
                        <td>
                          {editingId === row.id ? (
                            <input
                              type="text"
                              value={editForm.name}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                            />
                          ) : (
                            row.name
                          )}
                        </td>
                        <td>
                          {editingId === row.id ? (
                            <input
                              type="email"
                              value={editForm.email}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, email: e.target.value }))}
                            />
                          ) : (
                            row.email
                          )}
                        </td>
                        <td>
                          {editingId === row.id ? (
                            <select
                              value={editForm.status}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, status: e.target.value }))}
                            >
                              <option value="Active">Active</option>
                              <option value="Expiring">Expiring</option>
                              <option value="Expired">Expired</option>
                            </select>
                          ) : (
                            <span className={`pill ${getLicenseStatus(row).toLowerCase()}`}>{getLicenseStatus(row)}</span>
                          )}
                        </td>
                        <td>
                          {editingId === row.id ? (
                            <input
                              type="text"
                              value={editForm.expiry}
                              onChange={(e) => setEditForm((prev) => ({ ...prev, expiry: e.target.value }))}
                            />
                          ) : (
                            row.expiry
                          )}
                        </td>
                        <td>{getDaysRemaining(editingId === row.id ? editForm.expiry : row.expiry)}</td>
                        <td className="action-cell">
                          {editingId === row.id ? (
                            <>
                              <button type="button" onClick={() => handleSaveEdit(row.id)}>Save</button>
                              <button type="button" onClick={() => setEditingId(null)}>Cancel</button>
                            </>
                          ) : (
                            <>
                              <button type="button" onClick={() => handleStartEdit(row)}>Edit</button>
                              <button type="button" onClick={() => setViewRow(row)}>View</button>
                              <button type="button" onClick={() => handleRemove(row.id)}>Remove</button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {tableMessage ? <p className="table-feedback">{tableMessage}</p> : null}
              {viewRow ? (
                <div className="view-panel">
                  <div className="view-head">
                    <strong>License Details</strong>
                    <button type="button" onClick={() => setViewRow(null)}>Close</button>
                  </div>
                  <p><b>Name:</b> {viewRow.name}</p>
                  <p><b>Email:</b> {viewRow.email}</p>
                  <p><b>Status:</b> {getLicenseStatus(viewRow)}</p>
                  <p><b>Expiration:</b> {viewRow.expiry}</p>
                  <p><b>Days Remaining:</b> {getDaysRemaining(viewRow.expiry)}</p>
                </div>
              ) : null}

              <div className="pagination-row">
                <span>
                  Showing {licenseRows.length === 0 ? 0 : startIndex + 1}-{Math.min(startIndex + pageSize, licenseRows.length)} of {licenseRows.length}
                </span>
                <div className="pagination-controls">
                  <button type="button" disabled={currentPage === 1} onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                    Previous
                  </button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                    <button
                      key={page}
                      type="button"
                      className={page === currentPage ? 'active-page' : ''}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}
                  <button type="button" disabled={currentPage === totalPages} onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}>
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}

export default App
