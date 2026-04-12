import * as api from '../../dist/index.js'
import {
  ensurePassing,
  printResults,
  runCRStructSuite,
} from '../e2e/shared/suite.mjs'

setTimeout(() => {
  console.error('integration stress watchdog timeout')
  process.exit(124)
}, 8_000).unref()

const results = await runCRStructSuite(api, {
  label: 'integration stress',
  stressRounds: Number.parseInt(process.env.CRSTRUCT_STRESS_ROUNDS ?? '6', 10),
  includeStress: true,
  verbose: process.env.CRSTRUCT_STRESS_VERBOSE === '1',
})

printResults(results)
ensurePassing(results)
