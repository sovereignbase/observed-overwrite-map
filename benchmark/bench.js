import {
  CRStruct,
  __acknowledge,
  __create,
  __delete,
  __garbageCollect,
  __merge,
  __read,
  __snapshot,
  __update,
} from '../dist/index.js'

const HISTORY_DEPTH = 5_000
const OPS = 250

const BENCHMARKS = [
  {
    group: 'crud',
    name: 'create / hydrate snapshot',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'read / primitive field',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'read / object field',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'update / overwrite string',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'update / overwrite object',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'delete / reset single field',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'crud',
    name: 'delete / reset all fields',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  { group: 'mags', name: 'snapshot', n: HISTORY_DEPTH, ops: OPS },
  { group: 'mags', name: 'acknowledge', n: HISTORY_DEPTH, ops: OPS },
  { group: 'mags', name: 'garbage collect', n: HISTORY_DEPTH, ops: OPS },
  {
    group: 'mags',
    name: 'merge ordered deltas',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'mags',
    name: 'merge direct successor',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'mags',
    name: 'merge shuffled gossip',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'mags',
    name: 'merge stale conflict',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'constructor / hydrate snapshot',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'property read / primitive',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'property read / object',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'property write / string',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'property write / object',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'delete property',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  { group: 'class', name: 'clear()', n: HISTORY_DEPTH, ops: OPS },
  { group: 'class', name: 'snapshot', n: HISTORY_DEPTH, ops: OPS },
  { group: 'class', name: 'acknowledge', n: HISTORY_DEPTH, ops: OPS },
  { group: 'class', name: 'garbage collect', n: HISTORY_DEPTH, ops: OPS },
  {
    group: 'class',
    name: 'merge ordered deltas',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'merge direct successor',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
  {
    group: 'class',
    name: 'merge shuffled gossip',
    n: HISTORY_DEPTH,
    ops: OPS,
  },
]

const fields = ['name', 'count', 'meta', 'tags']

function createDefaults() {
  return {
    name: '',
    count: 0,
    meta: { enabled: false },
    tags: [],
  }
}

function random(seed) {
  let state = seed >>> 0
  return () => {
    state = (Math.imul(state, 1_664_525) + 1_013_904_223) >>> 0
    return state / 0x1_0000_0000
  }
}

function shuffledIndices(length, seed) {
  const indices = Array.from({ length }, (_, index) => index)
  const rand = random(seed)
  for (let index = indices.length - 1; index > 0; index--) {
    const nextIndex = Math.floor(rand() * (index + 1))
    ;[indices[index], indices[nextIndex]] = [indices[nextIndex], indices[index]]
  }
  return indices
}

function nextValue(field, step, prefix = 'value') {
  switch (field) {
    case 'name':
      return `${prefix}-name-${step}`
    case 'count':
      return step
    case 'meta':
      return { enabled: step % 2 === 0 }
    case 'tags':
      return [`${prefix}-tag-${step}`, `${prefix}-${step}`]
    default:
      throw new Error(`unknown field: ${field}`)
  }
}

function createSeededState(depth) {
  const state = __create(createDefaults())
  for (let step = 0; step < depth; step++) {
    const field = fields[step % fields.length]
    const result = __update(field, nextValue(field, step, 'seed'), state)
    if (!result) throw new Error(`seed update failed at step ${step}`)
  }
  return state
}

function createSnapshot(depth) {
  return __snapshot(createSeededState(depth))
}

function createSeededStruct(depth) {
  return new CRStruct(createDefaults(), createSnapshot(depth))
}

function readClassDelta(replica, action) {
  let delta
  replica.addEventListener(
    'delta',
    (event) => {
      delta = event.detail
    },
    { once: true }
  )
  action()
  return delta
}

function readClassSnapshot(replica) {
  let snapshot
  replica.addEventListener(
    'snapshot',
    (event) => {
      snapshot = event.detail
    },
    { once: true }
  )
  replica.snapshot()
  return snapshot
}

function readClassAck(replica) {
  let ack
  replica.addEventListener(
    'ack',
    (event) => {
      ack = event.detail
    },
    { once: true }
  )
  replica.acknowledge()
  return ack
}

function collectOrderedCoreDeltas(source, amount, offset) {
  const deltas = []
  for (let index = 0; index < amount; index++) {
    const field = fields[index % fields.length]
    const result = __update(
      field,
      nextValue(field, offset + index, 'delta'),
      source
    )
    if (!result) throw new Error(`ordered core delta failed at ${index}`)
    deltas.push(result.delta)
  }
  return deltas
}

function collectMixedCoreDeltas(source, amount, offset) {
  const deltas = []
  const rand = random(0xc0ffee)
  for (let index = 0; index < amount; index++) {
    let result
    if (index % 9 === 0) result = __delete(source)
    else if (index % 4 === 0) {
      const field = fields[Math.floor(rand() * fields.length)]
      result = __delete(source, field)
    } else {
      const field = fields[Math.floor(rand() * fields.length)]
      result = __update(
        field,
        nextValue(field, offset + index, 'mixed'),
        source
      )
    }
    if (!result) throw new Error(`mixed core delta failed at ${index}`)
    deltas.push(result.delta)
  }
  return deltas
}

function collectOrderedClassDeltas(source, amount, offset) {
  const deltas = []
  for (let index = 0; index < amount; index++) {
    const field = fields[index % fields.length]
    const delta = readClassDelta(source, () => {
      source[field] = nextValue(field, offset + index, 'delta')
    })
    if (!delta) throw new Error(`ordered class delta failed at ${index}`)
    deltas.push(delta)
  }
  return deltas
}

function collectMixedClassDeltas(source, amount, offset) {
  const deltas = []
  const rand = random(0xc0ffee)
  for (let index = 0; index < amount; index++) {
    let delta
    if (index % 9 === 0) delta = readClassDelta(source, () => source.clear())
    else if (index % 4 === 0) {
      const field = fields[Math.floor(rand() * fields.length)]
      delta = readClassDelta(source, () => {
        delete source[field]
      })
    } else {
      const field = fields[Math.floor(rand() * fields.length)]
      delta = readClassDelta(source, () => {
        source[field] = nextValue(field, offset + index, 'mixed')
      })
    }
    if (!delta) throw new Error(`mixed class delta failed at ${index}`)
    deltas.push(delta)
  }
  return deltas
}

function time(fn) {
  const start = process.hrtime.bigint()
  const ops = fn()
  const end = process.hrtime.bigint()
  return { ms: Number(end - start) / 1_000_000, ops }
}

function runBenchmark(definition) {
  switch (`${definition.group}:${definition.name}`) {
    case 'crud:create / hydrate snapshot': {
      const snapshot = createSnapshot(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          __create(createDefaults(), snapshot)
        }
        return definition.ops
      })
    }
    case 'crud:read / primitive field': {
      const state = createSeededState(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++)
          __read('name', state)
        return definition.ops
      })
    }
    case 'crud:read / object field': {
      const state = createSeededState(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++)
          __read('meta', state)
        return definition.ops
      })
    }
    case 'crud:update / overwrite string': {
      const state = __create(createDefaults(), createSnapshot(definition.n))
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          __update('name', `bench-name-${index}`, state)
        }
        return definition.ops
      })
    }
    case 'crud:update / overwrite object': {
      const state = __create(createDefaults(), createSnapshot(definition.n))
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          __update('meta', { enabled: index % 2 === 0 }, state)
        }
        return definition.ops
      })
    }
    case 'crud:delete / reset single field': {
      const state = __create(createDefaults(), createSnapshot(definition.n))
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          __delete(state, 'name')
        }
        return definition.ops
      })
    }
    case 'crud:delete / reset all fields': {
      const state = __create(createDefaults(), createSnapshot(definition.n))
      return time(() => {
        for (let index = 0; index < definition.ops; index++) __delete(state)
        return definition.ops
      })
    }
    case 'mags:snapshot': {
      const state = createSeededState(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) __snapshot(state)
        return definition.ops
      })
    }
    case 'mags:acknowledge': {
      const state = createSeededState(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++)
          __acknowledge(state)
        return definition.ops
      })
    }
    case 'mags:garbage collect': {
      const snapshot = createSnapshot(definition.n)
      const frontiers = Array.from({ length: 3 }, () =>
        __acknowledge(__create(createDefaults(), snapshot))
      )
      const states = Array.from({ length: definition.ops }, () =>
        __create(createDefaults(), snapshot)
      )
      return time(() => {
        for (const state of states) __garbageCollect(frontiers, state)
        return states.length
      })
    }
    case 'mags:merge ordered deltas': {
      const source = __create(createDefaults(), createSnapshot(definition.n))
      const target = __create(createDefaults(), createSnapshot(definition.n))
      const deltas = collectOrderedCoreDeltas(
        source,
        definition.ops,
        definition.n
      )
      return time(() => {
        for (const delta of deltas) __merge(delta, target)
        return deltas.length
      })
    }
    case 'mags:merge direct successor': {
      const baseSnapshot = readClassSnapshot(new CRStruct(createDefaults()))
      const source = __create(createDefaults(), baseSnapshot)
      const successor = __update('name', 'alice', source)
      if (!successor) throw new Error('direct successor delta missing')
      const states = Array.from({ length: definition.ops }, () =>
        __create(createDefaults(), baseSnapshot)
      )
      return time(() => {
        for (const state of states) __merge(successor.delta, state)
        return states.length
      })
    }
    case 'mags:merge stale conflict': {
      const baseSnapshot = readClassSnapshot(new CRStruct(createDefaults()))
      const older = __create(createDefaults(), baseSnapshot)
      const incoming = __update('name', 'older', older)
      if (!incoming) throw new Error('stale incoming delta missing')
      const newer = __create(createDefaults(), baseSnapshot)
      __update('name', 'newer', newer)
      const targetSnapshot = __snapshot(newer)
      const states = Array.from({ length: definition.ops }, () =>
        __create(createDefaults(), targetSnapshot)
      )
      return time(() => {
        for (const state of states) __merge(incoming.delta, state)
        return states.length
      })
    }
    case 'mags:merge shuffled gossip': {
      const source = __create(createDefaults(), createSnapshot(definition.n))
      const target = __create(createDefaults(), createSnapshot(definition.n))
      const deltas = collectMixedCoreDeltas(
        source,
        definition.ops,
        definition.n
      )
      const order = shuffledIndices(deltas.length, 0xbeef)
      return time(() => {
        for (const index of order) __merge(deltas[index], target)
        return order.length
      })
    }
    case 'class:constructor / hydrate snapshot': {
      const snapshot = createSnapshot(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          new CRStruct(createDefaults(), snapshot)
        }
        return definition.ops
      })
    }
    case 'class:property read / primitive': {
      const replica = createSeededStruct(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) void replica.name
        return definition.ops
      })
    }
    case 'class:property read / object': {
      const replica = createSeededStruct(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++) void replica.meta
        return definition.ops
      })
    }
    case 'class:property write / string': {
      const replica = new CRStruct(
        createDefaults(),
        createSnapshot(definition.n)
      )
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          replica.name = `bench-name-${index}`
        }
        return definition.ops
      })
    }
    case 'class:property write / object': {
      const replica = new CRStruct(
        createDefaults(),
        createSnapshot(definition.n)
      )
      return time(() => {
        for (let index = 0; index < definition.ops; index++) {
          replica.meta = { enabled: index % 2 === 0 }
        }
        return definition.ops
      })
    }
    case 'class:delete property': {
      const replica = new CRStruct(
        createDefaults(),
        createSnapshot(definition.n)
      )
      return time(() => {
        for (let index = 0; index < definition.ops; index++) delete replica.name
        return definition.ops
      })
    }
    case 'class:clear()': {
      const replica = new CRStruct(
        createDefaults(),
        createSnapshot(definition.n)
      )
      return time(() => {
        for (let index = 0; index < definition.ops; index++) replica.clear()
        return definition.ops
      })
    }
    case 'class:snapshot': {
      const replica = createSeededStruct(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++)
          readClassSnapshot(replica)
        return definition.ops
      })
    }
    case 'class:acknowledge': {
      const replica = createSeededStruct(definition.n)
      return time(() => {
        for (let index = 0; index < definition.ops; index++)
          readClassAck(replica)
        return definition.ops
      })
    }
    case 'class:garbage collect': {
      const snapshot = createSnapshot(definition.n)
      const frontiers = Array.from({ length: 3 }, () =>
        readClassAck(new CRStruct(createDefaults(), snapshot))
      )
      const replicas = Array.from(
        { length: definition.ops },
        () => new CRStruct(createDefaults(), snapshot)
      )
      return time(() => {
        for (const replica of replicas) replica.garbageCollect(frontiers)
        return replicas.length
      })
    }
    case 'class:merge ordered deltas': {
      const source = new CRStruct(
        createDefaults(),
        createSnapshot(definition.n)
      )
      const target = new CRStruct(
        createDefaults(),
        createSnapshot(definition.n)
      )
      const deltas = collectOrderedClassDeltas(
        source,
        definition.ops,
        definition.n
      )
      return time(() => {
        for (const delta of deltas) target.merge(delta)
        return deltas.length
      })
    }
    case 'class:merge direct successor': {
      const baseSnapshot = readClassSnapshot(new CRStruct(createDefaults()))
      const source = new CRStruct(createDefaults(), baseSnapshot)
      const successor = readClassDelta(source, () => {
        source.name = 'alice'
      })
      const replicas = Array.from(
        { length: definition.ops },
        () => new CRStruct(createDefaults(), baseSnapshot)
      )
      return time(() => {
        for (const replica of replicas) replica.merge(successor)
        return replicas.length
      })
    }
    case 'class:merge shuffled gossip': {
      const source = new CRStruct(
        createDefaults(),
        createSnapshot(definition.n)
      )
      const target = new CRStruct(
        createDefaults(),
        createSnapshot(definition.n)
      )
      const deltas = collectMixedClassDeltas(
        source,
        definition.ops,
        definition.n
      )
      const order = shuffledIndices(deltas.length, 0xbeef)
      return time(() => {
        for (const index of order) target.merge(deltas[index])
        return order.length
      })
    }
    default:
      throw new Error(
        `unknown benchmark: ${definition.group}:${definition.name}`
      )
  }
}

function formatNumber(number) {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 }).format(
    number
  )
}

function pad(value, width) {
  return String(value).padEnd(width, ' ')
}

function printTable(rows) {
  const columns = [
    ['group', (row) => row.group],
    ['scenario', (row) => row.name],
    ['n', (row) => formatNumber(row.n)],
    ['ops', (row) => formatNumber(row.ops)],
    ['ms', (row) => formatNumber(row.ms)],
    ['ms/op', (row) => formatNumber(row.msPerOp)],
    ['ops/sec', (row) => formatNumber(row.opsPerSecond)],
  ]
  const widths = columns.map(([header, getter]) =>
    Math.max(header.length, ...rows.map((row) => getter(row).length))
  )
  console.log(
    columns.map(([header], index) => pad(header, widths[index])).join('  ')
  )
  console.log(widths.map((width) => '-'.repeat(width)).join('  '))
  for (const row of rows) {
    console.log(
      columns
        .map(([, getter], index) => pad(getter(row), widths[index]))
        .join('  ')
    )
  }
}

const rows = BENCHMARKS.map((definition) => {
  const result = runBenchmark(definition)
  return {
    ...definition,
    ops: result.ops,
    ms: result.ms,
    msPerOp: result.ms / result.ops,
    opsPerSecond: result.ops / (result.ms / 1_000),
  }
})

console.log('CRStruct benchmark')
console.log(
  `node=${process.version} platform=${process.platform} arch=${process.arch}`
)
console.log('')
printTable(rows)
