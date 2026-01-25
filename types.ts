export enum RecordStatus {
  DRAFT = 'DRAFT',
  PAID = 'PAID',
  VALIDATED = 'VALIDATED',
  VERIFIED = 'VERIFIED'
}

export enum OrderStatus {
  OPEN = 'OPEN',
  FULFILLED = 'FULFILLED',
  CANCELLED = 'CANCELLED'
}

export enum SystemRole {
  FIELD_AGENT = 'Field Agent',
  FINANCE_OFFICER = 'Finance Officer',
  AUDITOR = 'Audit Officer',
  MANAGER = 'Director',
  SYSTEM_DEVELOPER = 'System Developer',
  SUPPLIER = 'Supplier'
}

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'AWAITING_ACTIVATION';

export interface AgentIdentity {
  name: string;
  phone: string;
  role: SystemRole;
  passcode: string;
  cluster: string;
  warnings?: number;
  lastCheckWeek?: string;
  status?: AccountStatus;
}

export interface MarketOrder {
  id: string;
  date: string;
  cropType: string;
  unitsRequested: number;
  unitType: string;
  customerName: string;
  customerPhone: string;
  status: OrderStatus;
  agentPhone: string;
  cluster: string;
}

export interface ProduceListing {
  id: string;
  date: string;
  cropType: string;
  unitsAvailable: number;
  unitType: string;
  sellingPrice: number;
  supplierName: string;
  supplierPhone: string;
  cluster: string;
  status: 'AVAILABLE' | 'SOLD_OUT';
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
  createdAt: string;
  createdBy?: string;
  confirmedBy?: string;
  agentPhone?: string;
  agentName?: string;
  cluster?: string;
  synced?: boolean;
}