import { appSchema, tableSchema } from '@nozbe/watermelondb'

export default appSchema({
  version: 3,
  tables: [
    tableSchema({
      name: 'farm_baselines',
      columns: [
        { name: 'farmer_phone', type: 'string', isIndexed: true },
        { name: 'farmer_name', type: 'string' },
        { name: 'farm_name', type: 'string' },
        { name: 'cluster', type: 'string' },
        { name: 'latitude', type: 'number' },
        { name: 'longitude', type: 'number' },
        { name: 'size_in_acres', type: 'number', isOptional: true },
        { name: 'verified_at', type: 'string' },
        { name: 'is_synced', type: 'boolean', isIndexed: true },
        { name: 'ai_profile', type: 'string', isOptional: true },
      ]
    }),
    tableSchema({
      name: 'activity_logs',
      columns: [
        { name: 'farmer_phone', type: 'string', isIndexed: true },
        { name: 'farm_id', type: 'string', isOptional: true },
        { name: 'form_type', type: 'string' },
        { name: 'data', type: 'string' }, // JSON string
        { name: 'submitted_at', type: 'string' },
        { name: 'is_synced', type: 'boolean', isIndexed: true },
      ]
    }),
  ]
})
