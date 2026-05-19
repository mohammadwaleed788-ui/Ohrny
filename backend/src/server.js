import { createServer } from 'node:http'
import express from 'express'
import cors from 'cors'
import { PORT } from './config/constants.js'
import routes from './routes/index.js'
import { globalLimiter } from './middleware/security/rateLimit.js'
import { initSocket } from './socket/index.js'
import { startEphemeralCleanup } from './jobs/ephemeralCleanup.js'

const app = express()
const server = createServer(app)

app.use(cors())
app.use(express.json())
app.use(globalLimiter)
app.use('/api', routes)

initSocket(server)
startEphemeralCleanup()

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
