import { useEffect, useState } from 'react'
import './App.css'

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
  'Live View',
  'Video Playback',
  'POS Exceptions',
  'Operating System',
  'Web Users',
  'SSL Certificates',
  'System Scanner',
  'ServiceChannel',
]

const actionItems = [
  { label: 'Systems with Older ClickIt Software Versions', value: '3,102 (33%) / 10,971', level: 33 },
  { label: 'SSL Certificates Expiring Soon', value: '2 certificates', level: 9 },
  { label: 'Security Patch Updates', value: '1,371 systems', level: 52 },
]

const cameraRows = [
  { model: 'CAM225', cameras: '9,233', systems: '9,142', ai: '5,520' },
  { model: 'CAM1100', cameras: '8,318', systems: '8,253', ai: '2,556' },
  { model: 'CAM360', cameras: '7,259', systems: '7,152', ai: '4,897' },
  { model: 'CAM5000IR', cameras: '5,000', systems: '4,876', ai: '0' },
  { model: 'CAM5000BX', cameras: '4,104', systems: '4,000', ai: '0' },
  { model: 'CAM400WA', cameras: '3,791', systems: '3,450', ai: '3,450' },
]

const API_BASE = 'http://localhost:4000/api/licenses'

function App() {
  const [openMenus, setOpenMenus] = useState({})
  const [licenseRows, setLicenseRows] = useState([])
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
      const res = await fetch(API_BASE)
      if (!res.ok) throw new Error('Failed to fetch data')
      const rows = await res.json()
      setLicenseRows(rows)
      setTableMessage('')
    } catch {
      setTableMessage('Unable to load license data. Make sure API server is running.')
    }
  }

  const handleAddLicense = async () => {
    if (!licenseForm.name.trim() || !licenseForm.email.trim() || !licenseForm.expiry.trim()) return

    try {
      const res = await fetch(API_BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...licenseForm,
          name: licenseForm.name.trim(),
          email: licenseForm.email.trim(),
          expiry: licenseForm.expiry.trim(),
        }),
      })
      if (!res.ok) throw new Error('create failed')
      const created = await res.json()
      setLicenseRows((prev) => [...prev, created])
      setCurrentPage(Math.ceil((licenseRows.length + 1) / pageSize))
      setLicenseForm({
        name: '',
        email: '',
        status: 'Active',
        expiry: '',
      })
      setTableMessage('')
    } catch {
      setTableMessage('Failed to add license row.')
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

    try {
      const res = await fetch(`${API_BASE}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editForm.name.trim(),
          email: editForm.email.trim(),
          status: editForm.status,
          expiry: editForm.expiry.trim(),
        }),
      })
      if (!res.ok) throw new Error('update failed')
      const updated = await res.json()
      setLicenseRows((prev) => prev.map((row) => (row.id === id ? updated : row)))
      setEditingId(null)
      setTableMessage('')
    } catch {
      setTableMessage('Failed to save changes.')
    }
  }

  const handleRemove = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('delete failed')
      setLicenseRows((prev) => prev.filter((row) => row.id !== id))
      if (editingId === id) setEditingId(null)
      if (viewRow?.id === id) setViewRow(null)
      setTableMessage('')
    } catch {
      setTableMessage('Failed to remove row.')
    }
  }

  const handleTopSearch = () => {
    const query = topSearch.trim().toLowerCase()
    if (!query) {
      setSearchFeedback('Enter text to search.')
      return
    }

    const panelTargets = [
      { id: 'my-tools-panel', terms: ['my tools', ...tools] },
      { id: 'status-panel', terms: ['status', 'systems', 'action items'] },
      { id: 'camera-models-panel', terms: ['ip camera models', 'camera models', 'cameras'] },
      { id: 'trial-license-panel', terms: ['vm trial licenses', 'trial licenses'] },
      { id: 'multisite-license-panel', terms: ['multisite license', 'multisite', 'license'] },
    ]

    const panelHit = panelTargets.find((panel) => panel.terms.some((term) => term.toLowerCase().includes(query)))
    if (panelHit) {
      document.getElementById(panelHit.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setSearchFeedback(`Navigated to ${panelHit.terms[0]}.`)
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
        row.status.toLowerCase().includes(query)
    )

    if (licenseIndex >= 0) {
      const page = Math.floor(licenseIndex / pageSize) + 1
      setCurrentPage(page)
      document.getElementById('multisite-license-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      setSearchFeedback(`Found result in Multisite License (page ${page}).`)
      return
    }

    setSearchFeedback('No matching result found.')
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

  useEffect(() => {
    fetchLicenses()
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
                      <button key={child} className="sub-btn">{child}</button>
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
              <article key={tool} className="tool-card">
                <div className="tool-icon">+</div>
                <h3>{tool}</h3>
              </article>
            ))}
            <article className="tool-card add-tool">
              <div className="tool-icon">+</div>
              <h3>Add Widget</h3>
            </article>
          </div>
        </section>

        <section className="panel status-panel" id="status-panel">
          <div className="status-left">
            <h2>Status</h2>
            <div className="status-card">
              <div className="status-radial-chart" aria-label="Systems status radial chart">
                <div className="status-radial-track" />
                <div className="status-radial-green" />
                <div className="status-radial-red" />
              </div>
              <ul className="status-legend">
                <li className="total">
                  <span>Total Systems</span>
                  <b>11,349</b>
                </li>
                <li className="online">
                  <span>Systems Online</span>
                  <b>10,351</b>
                </li>
                <li className="offline">
                  <span>System Offline</span>
                  <b>72</b>
                </li>
              </ul>
            </div>
          </div>

          <div className="status-right">
            <h2>Action Items</h2>
            {actionItems.map((item) => (
              <div className="action-card" key={item.label}>
                <p>{item.label}</p>
                <div className="meter">
                  <span style={{ width: `${item.level}%` }} />
                </div>
                <strong>{item.value}</strong>
              </div>
            ))}
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
                  <tr key={row.model}>
                    <td>{row.model}</td>
                    <td>{row.cameras}</td>
                    <td>{row.systems}</td>
                    <td>{row.ai}</td>
                    <td>Open</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="panel" id="trial-license-panel">
          <h2>VM Trial Licenses</h2>
          <div className="license-summary">
            <div><b>20</b><span>View Details</span></div>
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
              <div className="seat-donut">52</div>
              <ul>
                <li><span className="dot active" />Active (75%)</li>
                <li><span className="dot soon" />Expiring Soon (20%)</li>
                <li><span className="dot exp" />Expired (5%)</li>
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
                            <span className={`pill ${row.status.toLowerCase()}`}>{row.status}</span>
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
                  <p><b>Status:</b> {viewRow.status}</p>
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
