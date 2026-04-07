import express from 'express'
import cors from 'cors'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const app = express()
const PORT = 4000

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const dataFile = path.join(__dirname, '..', 'data', 'multisite-licenses.json')

app.use(cors())
app.use(express.json())

app.get('/', (_req, res) => {
  res.json({
    message: 'ClickItAI API is running',
    endpoints: ['/api/licenses'],
  })
})

const readLicenses = async () => {
  const file = await fs.readFile(dataFile, 'utf8')
  return JSON.parse(file)
}

const writeLicenses = async (rows) => {
  await fs.writeFile(dataFile, `${JSON.stringify(rows, null, 2)}\n`, 'utf8')
}

app.get('/api/licenses', async (_req, res) => {
  try {
    const rows = await readLicenses()
    res.json(rows)
  } catch {
    res.status(500).json({ message: 'Failed to read licenses' })
  }
})

app.post('/api/licenses', async (req, res) => {
  try {
    const { name, email, status, expiry } = req.body
    if (!name || !email || !status || !expiry) {
      return res.status(400).json({ message: 'name, email, status, and expiry are required' })
    }

    const rows = await readLicenses()
    const nextId = rows.reduce((max, row) => Math.max(max, row.id || 0), 0) + 1
    const newRow = { id: nextId, name, email, status, expiry }
    rows.push(newRow)
    await writeLicenses(rows)
    res.status(201).json(newRow)
  } catch {
    res.status(500).json({ message: 'Failed to create license' })
  }
})

app.put('/api/licenses/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const { name, email, status, expiry } = req.body
    const rows = await readLicenses()
    const index = rows.findIndex((row) => row.id === id)
    if (index < 0) return res.status(404).json({ message: 'License not found' })

    rows[index] = {
      ...rows[index],
      name: name ?? rows[index].name,
      email: email ?? rows[index].email,
      status: status ?? rows[index].status,
      expiry: expiry ?? rows[index].expiry,
    }
    await writeLicenses(rows)
    res.json(rows[index])
  } catch {
    res.status(500).json({ message: 'Failed to update license' })
  }
})

app.delete('/api/licenses/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    const rows = await readLicenses()
    const nextRows = rows.filter((row) => row.id !== id)
    if (nextRows.length === rows.length) return res.status(404).json({ message: 'License not found' })
    await writeLicenses(nextRows)
    res.status(204).send()
  } catch {
    res.status(500).json({ message: 'Failed to delete license' })
  }
})

app.listen(PORT, () => {
  console.log(`API running on http://localhost:${PORT}`)
})
