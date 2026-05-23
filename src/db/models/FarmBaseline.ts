import { Model } from '@nozbe/watermelondb'
import { field, readonly, date } from '@nozbe/watermelondb/decorators'

export default class FarmBaseline extends Model {
  static table = 'farm_baselines'

  @field('farmer_phone') farmerPhone!: string
  @field('farmer_name') farmerName!: string
  @field('farm_name') farmName!: string
  @field('cluster') cluster!: string
  @field('latitude') latitude!: number
  @field('longitude') longitude!: number
  @field('size_in_acres') sizeInAcres?: number
  @field('verified_at') verifiedAt!: string
  @field('is_synced') isSynced!: boolean
  @field('ai_profile') aiProfile?: string
}
