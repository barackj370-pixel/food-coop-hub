import { Model } from '@nozbe/watermelondb'
import { field } from '@nozbe/watermelondb/decorators'

export default class ActivityLog extends Model {
  static table = 'activity_logs'

  @field('farmer_phone') farmerPhone!: string
  @field('farm_id') farmId?: string
  @field('form_type') formType!: string
  @field('data') data!: string
  @field('submitted_at') submittedAt!: string
  @field('is_synced') isSynced!: boolean
}
