import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { MongoClient, ObjectId } from 'mongodb'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const app = express()
const PORT = Number(process.env.PORT || 4000)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017'
const MONGODB_DB = process.env.MONGODB_DB || 'clickitai'
const LICENSES_COLLECTION = process.env.MONGODB_COLLECTION || 'licenses'
const CAMERA_MODELS_COLLECTION = process.env.MONGODB_CAMERA_COLLECTION || 'cameraModels'
const SYSTEM_STATUS_COLLECTION = process.env.MONGODB_SYSTEM_STATUS_COLLECTION || 'systemStatus'
const ACTION_ITEMS_COLLECTION = process.env.MONGODB_ACTION_ITEMS_COLLECTION || 'actionItems'
const SYSTEMS_COLLECTION = process.env.MONGODB_SYSTEMS_COLLECTION || 'systems'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const licensesSeedFile = path.join(__dirname, '..', 'data', 'multisite-licenses.json')
const cameraModelsSeedFile = path.join(__dirname, '..', 'data', 'ip-camera-models.json')
const systemStatusSeedFile = path.join(__dirname, '..', 'data', 'system-status.json')
const actionItemsSeedFile = path.join(__dirname, '..', 'data', 'action-items.json')

app.use(cors())
app.use(express.json())

const client = new MongoClient(MONGODB_URI)
let licensesCollection
let cameraModelsCollection
let systemStatusCollection
let actionItemsCollection
let systemsCollection

const getStatusFromExpiry = (expiry, fallbackStatus = 'Active') => {
  const text = String(expiry || '').trim()
  const parsed = new Date(text.split('(')[0].trim())
  if (Number.isNaN(parsed.getTime())) return fallbackStatus

  const now = new Date()
  const msPerDay = 1000 * 60 * 60 * 24
  const diff = Math.ceil((parsed.setHours(0, 0, 0, 0) - now.setHours(0, 0, 0, 0)) / msPerDay)

  if (diff < 0) return 'Expired'
  if (diff <= 30) return 'Expiring'
  return 'Active'
}

const normalizeLicense = (doc) => ({
  id: doc._id.toString(),
  name: doc.name,
  email: doc.email,
  status: getStatusFromExpiry(doc.expiry, doc.status),
  expiry: doc.expiry,
})

const syncJsonSnapshot = async () => {
  const rows = await licensesCollection.find({}).sort({ createdAt: 1, _id: 1 }).toArray()
  const normalizedRows = rows.map(normalizeLicense)
  await fs.writeFile(licensesSeedFile, `${JSON.stringify(normalizedRows, null, 2)}\n`, 'utf8')
}

const normalizeCameraModel = (doc) => ({
  id: doc._id.toString(),
  model: doc.model,
  cameras: doc.cameras,
  systems: doc.systems,
  ai: doc.ai,
})

const syncCameraModelsSnapshot = async () => {
  const rows = await cameraModelsCollection.find({}).sort({ createdAt: 1, _id: 1 }).toArray()
  const normalizedRows = rows.map(normalizeCameraModel)
  await fs.writeFile(cameraModelsSeedFile, `${JSON.stringify(normalizedRows, null, 2)}\n`, 'utf8')
}

const normalizeSystemStatus = (doc) => {
  const systemsOnline = Number(doc.systemsOnline || 0)
  const systemsOffline = Number(doc.systemsOffline || 0)
  const totalSystems = doc.totalSystems !== undefined ? Number(doc.totalSystems) : systemsOnline + systemsOffline

  return {
    id: doc._id.toString(),
    totalSystems,
    systemsOnline,
    systemsOffline,
  }
}

const getDaysUntil = (dateText) => {
  const parsed = new Date(String(dateText || '').trim())
  if (Number.isNaN(parsed.getTime())) return null

  const today = new Date()
  const msPerDay = 1000 * 60 * 60 * 24
  return Math.ceil((parsed.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / msPerDay)
}

const hasOlderClickitVersion = (doc) => String(doc.clickitVersion || '').trim() !== String(doc.latestClickitVersion || '').trim()

const hasExpiringSsl = (doc) => {
  const days = getDaysUntil(doc.sslExpiry)
  return typeof days === 'number' && days >= 0 && days <= 30
}

const hasPendingSecurityPatch = (doc) => String(doc.securityPatchStatus || '').trim().toLowerCase() === 'pending'

const normalizeSystem = (doc) => ({
  id: doc._id.toString(),
  systemName: doc.systemName,
  storeCode: doc.storeCode,
  region: doc.region,
  status: doc.status,
  clickitVersion: doc.clickitVersion,
  latestClickitVersion: doc.latestClickitVersion,
  sslExpiry: doc.sslExpiry,
  securityPatchStatus: doc.securityPatchStatus,
  lastSeen: doc.lastSeen,
  olderClickitVersion: hasOlderClickitVersion(doc),
  sslExpiringSoon: hasExpiringSsl(doc),
})

const buildSystemStatus = (rows) => {
  const totalSystems = rows.length
  const systemsOnline = rows.filter((row) => String(row.status).toLowerCase() === 'online').length
  const systemsOffline = totalSystems - systemsOnline

  return {
    totalSystems,
    systemsOnline,
    systemsOffline,
  }
}

const buildActionItems = (rows) => {
  const totalSystems = rows.length || 1
  const olderSystems = rows.filter(hasOlderClickitVersion).length
  const sslSystems = rows.filter(hasExpiringSsl).length
  const securityPatchSystems = rows.filter(hasPendingSecurityPatch).length
  const olderLevel = Math.round((olderSystems / totalSystems) * 100)

  return [
    {
      key: 'older-clickit-versions',
      label: 'Systems with Older ClickIt Software Versions',
      value: `${olderSystems}`,
      meta: `/ ${rows.length} systems`,
      level: olderLevel,
    },
    {
      key: 'ssl-certificates-expiring-soon',
      label: 'SSL Certificates Expiring Soon',
      value: `${sslSystems}`,
      unit: 'systems',
      note: sslSystems > 0 ? 'Review and renew certificates before expiry.' : 'All SSL certificates are healthy.',
      link: 'View Details',
      level: rows.length ? Math.round((sslSystems / rows.length) * 100) : 0,
    },
    {
      key: 'security-patch-updates',
      label: 'Security Patch Updates',
      value: `${securityPatchSystems}`,
      unit: 'systems',
      note: securityPatchSystems > 0 ? 'Pending OS or ClickIt security patch installation.' : 'All systems are patched.',
      link: 'View Details',
      level: rows.length ? Math.round((securityPatchSystems / rows.length) * 100) : 0,
    },
  ]
}

const getLiveSystemStatus = async () => {
  const rows = await systemsCollection.find({}).toArray()
  return buildSystemStatus(rows)
}

const getLiveActionItems = async () => {
  const rows = await systemsCollection.find({}).toArray()
  return buildActionItems(rows)
}

const validateSystemPayload = (payload, { partial = false } = {}) => {
  const requiredFields = [
    'systemName',
    'storeCode',
    'region',
    'status',
    'clickitVersion',
    'latestClickitVersion',
    'sslExpiry',
    'securityPatchStatus',
    'lastSeen',
  ]

  if (!partial) {
    const missingField = requiredFields.find((field) => payload[field] === undefined || payload[field] === null || payload[field] === '')
    if (missingField) return `${missingField} is required`
  }

  if (payload.status !== undefined) {
    const normalizedStatus = String(payload.status).trim().toLowerCase()
    if (!['online', 'offline'].includes(normalizedStatus)) {
      return 'status must be Online or Offline'
    }
  }

  if (payload.securityPatchStatus !== undefined) {
    const normalizedPatchStatus = String(payload.securityPatchStatus).trim().toLowerCase()
    if (!['pending', 'current'].includes(normalizedPatchStatus)) {
      return 'securityPatchStatus must be Pending or Current'
    }
  }

  if (payload.sslExpiry !== undefined) {
    const parsed = new Date(String(payload.sslExpiry).trim())
    if (Number.isNaN(parsed.getTime())) {
      return 'sslExpiry must be a valid date'
    }
  }

  return null
}

const syncSystemStatusSnapshot = async () => {
  const row = await systemStatusCollection.findOne({})
  if (!row) return
  await fs.writeFile(systemStatusSeedFile, `${JSON.stringify(normalizeSystemStatus(row), null, 2)}\n`, 'utf8')
}

const normalizeActionItem = (doc) => ({
  id: doc._id.toString(),
  key: doc.key,
  label: doc.label,
  value: doc.value,
  meta: doc.meta,
  level: doc.level,
  unit: doc.unit,
  note: doc.note,
  link: doc.link,
})

const syncActionItemsSnapshot = async () => {
  const rows = await systemsCollection.find({}).sort({ createdAt: 1, _id: 1 }).toArray()
  const normalizedRows = buildActionItems(rows)
  await fs.writeFile(actionItemsSeedFile, `${JSON.stringify(normalizedRows, null, 2)}\n`, 'utf8')
}

const syncSystemsSnapshot = async () => {
  return Promise.resolve()
}

const loadSeedLicenses = async () => {
  const file = await fs.readFile(licensesSeedFile, 'utf8')
  return JSON.parse(file).map((entry) => {
    const { id, ...row } = entry
    void id
    return row
  })
}

const loadSeedCameraModels = async () => {
  const file = await fs.readFile(cameraModelsSeedFile, 'utf8')
  return JSON.parse(file).map((entry) => {
    const { id, ...row } = entry
    void id
    return row
  })
}

const ensureSeedData = async () => {
  const count = await licensesCollection.countDocuments()
  if (count > 0) {
    const existingRows = await licensesCollection.find({}).toArray()
    await Promise.all(
      existingRows.map((row) => {
        const nextStatus = getStatusFromExpiry(row.expiry, row.status)
        if (nextStatus === row.status) return Promise.resolve()

        return licensesCollection.updateOne(
          { _id: row._id },
          { $set: { status: nextStatus, updatedAt: new Date() } }
        )
      })
    )
    await syncJsonSnapshot()
    return
  }

  const rows = await loadSeedLicenses()
  if (rows.length > 0) {
    await licensesCollection.insertMany(
      rows.map((row) => ({
        ...row,
        status: getStatusFromExpiry(row.expiry, row.status),
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    )
  }
  await syncJsonSnapshot()
}

const ensureCameraModelsSeedData = async () => {
  const count = await cameraModelsCollection.countDocuments()
  if (count > 0) {
    await syncCameraModelsSnapshot()
    return
  }

  const rows = await loadSeedCameraModels()
  if (rows.length > 0) {
    await cameraModelsCollection.insertMany(
      rows.map((row) => ({
        ...row,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    )
  }
  await syncCameraModelsSnapshot()
}

const ensureSystemStatusSeedData = async () => {
  const rows = await systemsCollection.find({}).toArray()
  const nextStatus = buildSystemStatus(rows)
  await systemStatusCollection.deleteMany({})
  await systemStatusCollection.insertOne({
    ...nextStatus,
    createdAt: new Date(),
    updatedAt: new Date(),
  })
  await syncSystemStatusSnapshot()
}

const ensureActionItemsSeedData = async () => {
  const rows = await systemsCollection.find({}).toArray()
  const nextItems = buildActionItems(rows)
  await actionItemsCollection.deleteMany({})
  if (nextItems.length > 0) {
    await actionItemsCollection.insertMany(
      nextItems.map((row) => ({
        ...row,
        createdAt: new Date(),
        updatedAt: new Date(),
      }))
    )
  }
  await syncActionItemsSnapshot()
}

const rebuildDerivedDashboardCollections = async () => {
  await ensureSystemStatusSeedData()
  await ensureActionItemsSeedData()
}

const isValidId = (id) => ObjectId.isValid(id)

app.get('/', (_req, res) => {
  res.json({
    message: 'ClickItAI API is running',
    endpoints: [
      '/api/licenses',
      '/api/camera-models',
      '/api/systems',
      '/api/system-status',
      '/api/action-items',
      '/api/admin/reset-dashboard-data',
    ],
    database: MONGODB_DB,
    collections: {
      licenses: LICENSES_COLLECTION,
      cameraModels: CAMERA_MODELS_COLLECTION,
      systems: SYSTEMS_COLLECTION,
      systemStatus: SYSTEM_STATUS_COLLECTION,
      actionItems: ACTION_ITEMS_COLLECTION,
    },
  })
})

app.get('/api/systems', async (_req, res) => {
  try {
    const rows = await systemsCollection.find({}).sort({ createdAt: 1, _id: 1 }).toArray()
    res.json(rows.map(normalizeSystem))
  } catch (error) {
    console.error('Failed to read systems', error)
    res.status(500).json({ message: 'Failed to read systems' })
  }
})

app.post('/api/systems', async (req, res) => {
  try {
    const validationError = validateSystemPayload(req.body)
    if (validationError) return res.status(400).json({ message: validationError })

    const newRow = {
      systemName: req.body.systemName,
      storeCode: req.body.storeCode,
      region: req.body.region,
      status: req.body.status,
      clickitVersion: req.body.clickitVersion,
      latestClickitVersion: req.body.latestClickitVersion,
      sslExpiry: req.body.sslExpiry,
      securityPatchStatus: req.body.securityPatchStatus,
      lastSeen: req.body.lastSeen,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await systemsCollection.insertOne(newRow)
    const created = await systemsCollection.findOne({ _id: result.insertedId })
    await syncSystemsSnapshot()
    await rebuildDerivedDashboardCollections()
    res.status(201).json(normalizeSystem(created))
  } catch (error) {
    console.error('Failed to create system', error)
    res.status(500).json({ message: 'Failed to create system' })
  }
})

app.put('/api/systems/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidId(id)) return res.status(400).json({ message: 'Invalid system id' })

    const validationError = validateSystemPayload(req.body, { partial: true })
    if (validationError) return res.status(400).json({ message: validationError })

    const update = {
      ...(req.body.systemName !== undefined ? { systemName: req.body.systemName } : {}),
      ...(req.body.storeCode !== undefined ? { storeCode: req.body.storeCode } : {}),
      ...(req.body.region !== undefined ? { region: req.body.region } : {}),
      ...(req.body.status !== undefined ? { status: req.body.status } : {}),
      ...(req.body.clickitVersion !== undefined ? { clickitVersion: req.body.clickitVersion } : {}),
      ...(req.body.latestClickitVersion !== undefined ? { latestClickitVersion: req.body.latestClickitVersion } : {}),
      ...(req.body.sslExpiry !== undefined ? { sslExpiry: req.body.sslExpiry } : {}),
      ...(req.body.securityPatchStatus !== undefined ? { securityPatchStatus: req.body.securityPatchStatus } : {}),
      ...(req.body.lastSeen !== undefined ? { lastSeen: req.body.lastSeen } : {}),
      updatedAt: new Date(),
    }

    const result = await systemsCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    )

    if (!result) return res.status(404).json({ message: 'System not found' })
    await syncSystemsSnapshot()
    await rebuildDerivedDashboardCollections()
    res.json(normalizeSystem(result))
  } catch (error) {
    console.error('Failed to update system', error)
    res.status(500).json({ message: 'Failed to update system' })
  }
})

app.delete('/api/systems/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidId(id)) return res.status(400).json({ message: 'Invalid system id' })

    const result = await systemsCollection.deleteOne({ _id: new ObjectId(id) })
    if (!result.deletedCount) return res.status(404).json({ message: 'System not found' })

    await syncSystemsSnapshot()
    await rebuildDerivedDashboardCollections()
    res.status(204).send()
  } catch (error) {
    console.error('Failed to delete system', error)
    res.status(500).json({ message: 'Failed to delete system' })
  }
})

app.get('/api/licenses', async (_req, res) => {
  try {
    const rows = await licensesCollection.find({}).sort({ createdAt: 1, _id: 1 }).toArray()
    res.json(rows.map(normalizeLicense))
  } catch (error) {
    console.error('Failed to read licenses', error)
    res.status(500).json({ message: 'Failed to read licenses' })
  }
})

app.post('/api/licenses', async (req, res) => {
  try {
    const { name, email, status, expiry } = req.body
    if (!name || !email || !status || !expiry) {
      return res.status(400).json({ message: 'name, email, status, and expiry are required' })
    }

    const newRow = {
      name,
      email,
      status: getStatusFromExpiry(expiry, status),
      expiry,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await licensesCollection.insertOne(newRow)
    const created = await licensesCollection.findOne({ _id: result.insertedId })
    await syncJsonSnapshot()
    res.status(201).json(normalizeLicense(created))
  } catch (error) {
    console.error('Failed to create license', error)
    res.status(500).json({ message: 'Failed to create license' })
  }
})

app.put('/api/licenses/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidId(id)) return res.status(400).json({ message: 'Invalid license id' })

    const { name, email, status, expiry } = req.body
    const existing = await licensesCollection.findOne({ _id: new ObjectId(id) })
    if (!existing) return res.status(404).json({ message: 'License not found' })

    const nextExpiry = expiry !== undefined ? expiry : existing.expiry
    const nextStatus = getStatusFromExpiry(nextExpiry, status ?? existing.status)
    const update = {
      ...(name !== undefined ? { name } : {}),
      ...(email !== undefined ? { email } : {}),
      ...(expiry !== undefined ? { expiry } : {}),
      status: nextStatus,
      updatedAt: new Date(),
    }

    const result = await licensesCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    )

    await syncJsonSnapshot()
    res.json(normalizeLicense(result))
  } catch (error) {
    console.error('Failed to update license', error)
    res.status(500).json({ message: 'Failed to update license' })
  }
})

app.delete('/api/licenses/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidId(id)) return res.status(400).json({ message: 'Invalid license id' })

    const result = await licensesCollection.deleteOne({ _id: new ObjectId(id) })
    if (!result.deletedCount) return res.status(404).json({ message: 'License not found' })

    await syncJsonSnapshot()
    res.status(204).send()
  } catch (error) {
    console.error('Failed to delete license', error)
    res.status(500).json({ message: 'Failed to delete license' })
  }
})

app.get('/api/camera-models', async (_req, res) => {
  try {
    const rows = await cameraModelsCollection.find({}).sort({ createdAt: 1, _id: 1 }).toArray()
    res.json(rows.map(normalizeCameraModel))
  } catch (error) {
    console.error('Failed to read camera models', error)
    res.status(500).json({ message: 'Failed to read camera models' })
  }
})

app.post('/api/camera-models', async (req, res) => {
  try {
    const { model, cameras, systems, ai } = req.body
    if (!model || !cameras || !systems || ai === undefined) {
      return res.status(400).json({ message: 'model, cameras, systems, and ai are required' })
    }

    const newRow = {
      model,
      cameras,
      systems,
      ai,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = await cameraModelsCollection.insertOne(newRow)
    const created = await cameraModelsCollection.findOne({ _id: result.insertedId })
    await syncCameraModelsSnapshot()
    res.status(201).json(normalizeCameraModel(created))
  } catch (error) {
    console.error('Failed to create camera model', error)
    res.status(500).json({ message: 'Failed to create camera model' })
  }
})

app.put('/api/camera-models/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidId(id)) return res.status(400).json({ message: 'Invalid camera model id' })

    const { model, cameras, systems, ai } = req.body
    const update = {
      ...(model !== undefined ? { model } : {}),
      ...(cameras !== undefined ? { cameras } : {}),
      ...(systems !== undefined ? { systems } : {}),
      ...(ai !== undefined ? { ai } : {}),
      updatedAt: new Date(),
    }

    const result = await cameraModelsCollection.findOneAndUpdate(
      { _id: new ObjectId(id) },
      { $set: update },
      { returnDocument: 'after' }
    )

    if (!result) return res.status(404).json({ message: 'Camera model not found' })
    await syncCameraModelsSnapshot()
    res.json(normalizeCameraModel(result))
  } catch (error) {
    console.error('Failed to update camera model', error)
    res.status(500).json({ message: 'Failed to update camera model' })
  }
})

app.delete('/api/camera-models/:id', async (req, res) => {
  try {
    const { id } = req.params
    if (!isValidId(id)) return res.status(400).json({ message: 'Invalid camera model id' })

    const result = await cameraModelsCollection.deleteOne({ _id: new ObjectId(id) })
    if (!result.deletedCount) return res.status(404).json({ message: 'Camera model not found' })

    await syncCameraModelsSnapshot()
    res.status(204).send()
  } catch (error) {
    console.error('Failed to delete camera model', error)
    res.status(500).json({ message: 'Failed to delete camera model' })
  }
})

app.get('/api/system-status', async (_req, res) => {
  try {
    const liveStatus = await getLiveSystemStatus()
    res.json({
      id: 'live-system-status',
      ...liveStatus,
    })
  } catch (error) {
    console.error('Failed to read system status', error)
    res.status(500).json({ message: 'Failed to read system status' })
  }
})

app.put('/api/system-status', async (req, res) => {
  try {
    await rebuildDerivedDashboardCollections()
    const liveStatus = await getLiveSystemStatus()
    res.json({
      id: 'live-system-status',
      ...liveStatus,
    })
  } catch (error) {
    console.error('Failed to update system status', error)
    res.status(500).json({ message: 'Failed to update system status' })
  }
})

app.get('/api/action-items', async (_req, res) => {
  try {
    const liveItems = await getLiveActionItems()
    res.json(
      liveItems.map((item, index) => ({
        id: `live-action-item-${index + 1}`,
        ...item,
      }))
    )
  } catch (error) {
    console.error('Failed to read action items', error)
    res.status(500).json({ message: 'Failed to read action items' })
  }
})

app.put('/api/action-items/:id', async (req, res) => {
  try {
    await rebuildDerivedDashboardCollections()
    const liveItems = await getLiveActionItems()
    res.json(
      liveItems.map((item, index) => ({
        id: `live-action-item-${index + 1}`,
        ...item,
      }))
    )
  } catch (error) {
    console.error('Failed to update action item', error)
    res.status(500).json({ message: 'Failed to update action item' })
  }
})

app.post('/api/admin/reset-dashboard-data', async (_req, res) => {
  try {
    await systemsCollection.deleteMany({})
    await rebuildDerivedDashboardCollections()

    const systemStatus = await systemStatusCollection.findOne({})
    const actionItems = await actionItemsCollection.find({}).sort({ createdAt: 1, _id: 1 }).toArray()
    const systems = await systemsCollection.find({}).sort({ createdAt: 1, _id: 1 }).toArray()

    res.json({
      message: 'Dashboard seed data reset successfully',
      systems: systems.map(normalizeSystem),
      systemStatus: normalizeSystemStatus(systemStatus),
      actionItems: actionItems.map(normalizeActionItem),
    })
  } catch (error) {
    console.error('Failed to reset dashboard data', error)
    res.status(500).json({ message: 'Failed to reset dashboard data' })
  }
})

const start = async () => {
  try {
    await client.connect()
    const db = client.db(MONGODB_DB)
    licensesCollection = db.collection(LICENSES_COLLECTION)
    cameraModelsCollection = db.collection(CAMERA_MODELS_COLLECTION)
    systemsCollection = db.collection(SYSTEMS_COLLECTION)
    systemStatusCollection = db.collection(SYSTEM_STATUS_COLLECTION)
    actionItemsCollection = db.collection(ACTION_ITEMS_COLLECTION)
    await ensureSeedData()
    await ensureCameraModelsSeedData()
    await rebuildDerivedDashboardCollections()

    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`)
      console.log(`MongoDB connected: ${MONGODB_URI}/${MONGODB_DB}`)
    })
  } catch (error) {
    console.error('Failed to start API server', error)
    process.exit(1)
  }
}

start()
