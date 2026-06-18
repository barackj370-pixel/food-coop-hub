import { Database } from '@nozbe/watermelondb'
import LokiJSAdapter from '@nozbe/watermelondb/adapters/lokijs'

import schema from './schema'
import FarmBaseline from './models/FarmBaseline'
import ActivityLog from './models/ActivityLog'

const adapter = new LokiJSAdapter({
  schema,
  useWebWorker: false, // Performance improvement, but simpler without for now
  useIncrementalIndexedDB: true,
  // dbName: 'watermelon', // Optional custom name
})

export const database = new Database({
  adapter,
  modelClasses: [FarmBaseline, ActivityLog],
})
