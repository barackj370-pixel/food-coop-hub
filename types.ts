export enum RecordStatus {
  DRAFT = 'DRAFT',
  PAID = 'PAID',
  VALIDATED = 'VALIDATED',
  VERIFIED = 'VERIFIED'
}

export enum SystemRole {
  FIELD_AGENT = 'Field Agent',
  FINANCE_OFFICER = 'Finance Officer',
  AUDITOR = 'Auditor(Audit Portal)',
  MANAGER = 'Coop Manager',
  SYSTEM_DEVELOPER = 'System Developer'
}

export interface AgentIdentity {
  name: string;
  phone: string;
  role: SystemRole;
  passcode: string;
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
  synced?: boolean; // Track if record is in Google Sheets
}