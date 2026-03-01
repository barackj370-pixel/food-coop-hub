export enum RecordStatus {
  DRAFT = 'DRAFT', // Legacy
  PENDING = 'Pending Order',
  PAID = 'PAID', // Legacy
  COMPLETE = 'Order Complete',
  VALIDATED = 'VALIDATED',
  VERIFIED = 'VERIFIED'
}

export enum OrderStatus {
  OPEN = 'OPEN',
  FULFILLED = 'FULFILLED',
  CANCELLED = 'CANCELLED'
}

export enum SystemRole {
  SALES_AGENT = 'Sales Agent',
  SALES_MANAGER = 'Sales Manager',
  FINANCE_OFFICER = 'Finance Officer',
  AUDITOR = 'Audit Officer',
  MANAGER = 'Director',
  SYSTEM_DEVELOPER = 'System Developer',
  SUPPLIER = 'Supplier',
  CUSTOMER = 'Customer'
}

export type AccountStatus = 'ACTIVE' | 'SUSPENDED' | 'AWAITING_ACTIVATION';

export interface AgentIdentity {
  id?: string;
  name: string;
  phone: string;
  role: SystemRole;
  passcode: string;
  cluster: string;
  warnings?: number;
  lastCheckWeek?: string;
  status?: AccountStatus;
  // Enhanced User Metadata
  email?: string;
  lastSignInAt?: string;
  provider?: string;
  createdAt?: string;
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
  synced?: boolean;
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
  images?: string[]; // Array of Base64 strings
  synced?: boolean;
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
  orderId?: string;
  produceId?: string;
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorRole: string;
  authorCluster: string;
  authorPhone: string; // Used for permission checks on delete
  createdAt: string;
}

export interface ClusterMetric {
  volume: number;
  profit: number;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  content: string; // can contain HTML breaks <br/>
  author: string;
  role: string;
  date: string;
  category: string;
  image: string;
}
