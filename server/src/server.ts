import 'dotenv/config'
// Import the Express application using the ESM-compatible file extension.
import app from './app.js'

// Refuse to start a live shop with settings that would put money or
// accounts at risk. Only applies when NODE_ENV=production.
function checkProductionSettings() {
  if (process.env.NODE_ENV !== 'production') return

  const problems: string[] = []
  if ((process.env.JWT_SECRET ?? '').length < 32) {
    problems.push('JWT_SECRET must be at least 32 random characters.')
  }
  if (process.env.PAYMENT_PROVIDER === 'simulator' && process.env.ALLOW_PAYMENT_SIMULATOR !== 'true') {
    problems.push(
      'PAYMENT_PROVIDER=simulator marks orders as paid without real money. ' +
        'Use "gateway" or leave it empty (set ALLOW_PAYMENT_SIMULATOR=true only on a test server).',
    )
  }
  if (process.env.PAYMENT_PROVIDER === 'gateway' && !process.env.PAYMENT_WEBHOOK_SECRET) {
    problems.push('PAYMENT_WEBHOOK_SECRET is required with PAYMENT_PROVIDER=gateway.')
  }
  if (!process.env.CORS_ORIGINS) problems.push('CORS_ORIGINS must list your live website address.')

  if (problems.length) {
    console.error('Not starting: fix these settings in server/.env first:\n- ' + problems.join('\n- '))
    process.exit(1)
  }
}

checkProductionSettings()

// Use the configured port, or default to 4000 locally.
const PORT = Number(process.env.PORT) || 4000

// Start listening for incoming API requests.
app.listen(PORT, () => {
  console.log(`Vana Power Mart API running at http://localhost:${PORT}`)
})
