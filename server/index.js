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
const MONGODB_COLLECTION = process.env.MONGODB_COLLECTION || 'licenses'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const seedFile = path.join(__dirname, '..', 'data', 'multisite-licenses.json')

app.use(cors())
app.use(express.json())

const client = new MongoClient(MONGODB_URI)
let licensesCollection

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
  await fs.writeFile(seedFile, `${JSON.stringify(normalizedRows, null, 2)}\n`, 'utf8')
}

const loadSeedLicenses = async () => {
  const file = await fs.readFile(seedFile, 'utf8')
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

const isValidId = (id) => ObjectId.isValid(id)

app.get('/', (_req, res) => {
  res.json({
    message: 'ClickItAI API is running',
    endpoints: ['/api/licenses'],
    database: MONGODB_DB,
    collection: MONGODB_COLLECTION,
  })
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

const start = async () => {
  try {
    await client.connect()
    const db = client.db(MONGODB_DB)
    licensesCollection = db.collection(MONGODB_COLLECTION)
    await ensureSeedData()

    app.listen(PORT, () => {
      console.log(`API running on http://localhost:${PORT}`)
      console.log(`MongoDB connected: ${MONGODB_URI}/${MONGODB_DB}.${MONGODB_COLLECTION}`)
    })
  } catch (error) {
    console.error('Failed to start API server', error)
    process.exit(1)
  }
}

start()
