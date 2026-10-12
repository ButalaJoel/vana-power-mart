
import 'dotenv/config'
// Import the Express application using the ESM-compatible file extension.
import app from './app.js'

// Use the configured port, or default to 4000 locally.
const PORT = Number(process.env.PORT) || 4000

// Start listening for incoming API requests.
app.listen(PORT, () => {
  console.log(`Vana Power Mart API running at http://localhost:${PORT}`)
})
