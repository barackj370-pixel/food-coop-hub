
export enum RecordStatus {
  DRAFT = 'DRAFT', // Legacy
  PENDING = 'Order Fulfilled',
  PAID = 'PAID', // Legacy
  COMPLETE = 'Receipt Confirmed',
  VALIDATED = 'VALIDATED',
  VERIFIED = 'Order Complete'
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
  CUSTOMER = 'Customer',
  FARMER = 'Farmer',
  YOUTH_AGENT = 'Youth Agent'
}

export const SUPER_AGENT_PHONES = ['+254726838526', '0726838526', '254726838526', '+254768750668', '0768750668', '254768750668', '+254726051308', '0726051308', '254726051308'];

export function isSuperAgent(phone?: string): boolean {
  if (!phone) return false;
  const normalized = phone.startsWith('+') ? phone : (phone.startsWith('254') ? '+' + phone : (phone.startsWith('0') ? '+254' + phone.substring(1) : phone));
  return SUPER_AGENT_PHONES.some(p => {
    const normalizedSuper = p.startsWith('+') ? p : (p.startsWith('254') ? '+' + p : (p.startsWith('0') ? '+254' + p.substring(1) : p));
    return normalized === normalizedSuper;
  });
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
  homesteadName?: string;
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
  deliveryAddress?: string;
  deliveryFee?: number;
  supplierName?: string;
  supplierPhone?: string;
  produceId?: string;
  isDirectOrder?: boolean;
  customerFoodCoop?: string;
}

export interface ProduceListing {
  id: string;
  date: string;
  cropType: string;
  unitsAvailable: number;
  unitType: string;
  sellingPrice: number;
  wholesalePrice?: number;
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
  isAggregate?: boolean;
  buyingPrice?: number;
}

export interface ForumComment {
  id: string;
  content: string;
  authorName: string;
  authorRole: string;
  authorPhone: string;
  createdAt: string;
}

export interface ForumPost {
  id: string;
  title: string;
  content: string;
  authorName: string;
  authorRole: string;
  authorFoodCoop: string;
  authorPhone: string; // Used for permission checks on delete
  createdAt: string;
  likes?: string[];
  comments?: ForumComment[];
}

export interface FoodCoopMetric {
  volume: number;
  profit: number;
}

export interface Page {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  orderIndex?: number;
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
