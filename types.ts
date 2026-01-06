
export enum RecordStatus {
  DRAFT = 'DRAFT',
  PAID = 'PAID',
  VALIDATED = 'VALIDATED',
  FLAGGED = 'FLAGGED'
}

export type UserRole = 'agent' | 'analyst' | 'management' | 'developer' | 'accounts';

export interface UserProfile {
  name: string;
  phone: string;
  role: UserRole;
  pin: string;
}

export interface SaleRecord {
  id: string;
  date: string;
  cropType: string;
  unitType: string;
  farmerName: string;
  farmerPhone: string;
  customerName: string;
  customerPhone: string;
  unitsSold: number;
  unitPrice: number;
  totalSale: number;
  coopProfit: number;
  status: RecordStatus;
  signature: string;
  createdBy: string;
  agentPhone: string;
  confirmedBy?: string; // Name of accounts officer
  createdAt: string;
}

export interface CoopStats {
  totalSales: number;
  totalProfit: number;
  totalUnits: number;
  recordCount: number;
}
