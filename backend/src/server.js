import express from 'express'
import cors from 'cors'
import { PORT } from './config/constants.js'
import routes from './routes/index.js'
import { globalLimiter } from './middleware/security/rateLimit.js'
import { startAuthDataCleanup } from './services/authCleanup.js'

const app = express()

app.use(cors())
app.use(express.json())
app.use(globalLimiter)
app.use('/api', routes)

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})

startAuthDataCleanup()
