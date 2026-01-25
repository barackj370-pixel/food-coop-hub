import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { SaleRecord, RecordStatus, OrderStatus, SystemRole, AgentIdentity, AccountStatus, MarketOrder, ProduceListing } from './types.ts';
import SaleForm from './components/SaleForm.tsx';
import ProduceForm from './components/ProduceForm.tsx';
import StatCard from './components/StatCard.tsx';
import { PROFIT_MARGIN, SYNC_POLLING_INTERVAL, GOOGLE_SHEET_VIEW_URL, COMMODITY_CATEGORIES, CROP_CONFIG } from './constants.ts';
import { 
  syncToGoogleSheets, 
  fetchFromGoogleSheets, 
  syncUserToCloud, 
  fetchUsersFromCloud, 
  deleteRecordFromCloud, 
  deleteUserFromCloud,
  deleteAllUsersFromCloud,
  deleteProduceFromCloud,
  deleteAllProduceFromCloud,
  syncOrderToCloud,
  fetchOrdersFromCloud,
  syncProduceToCloud,
  fetchProduceFromCloud,
  deleteAllOrdersFromCloud,
  deleteAllRecordsFromCloud
} from './services/googleSheetsService.ts';

type PortalType = 'MARKET' | 'FINANCE' | 'AUDIT' | 'BOARD' | 'SYSTEM' | 'HOME' | 'ABOUT' | 'CONTACT' | 'LOGIN';
type MarketView = 'SALES' | 'SUPPLIER';

export const CLUSTERS = ['Mariwa', 'Mulo', 'Rabolo', 'Kangemi', 'Kabarnet', 'Apuoyo', 'Nyamagagana'];

const APP_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23000000' d='M160 96c0-17.7-14.3-32-32-32H32C14.3 64 0 78.3 0 96s14.3 32 32 32h73.4l57.1 240.1c5.3 22.3 25.3 37.9 48.2 37.9H436c22.9 0 42.9-15.6 48.2-37.9l39.1-164.2c4.2-17.8-7-35.7-24.9-39.9s-35.7 7-39.9 24.9l-33.9 142.2H198.5l-57.1-240c-2.7-11.2-12.7-19-24.1-19H32z'/%3E%3Ccircle fill='%23dc2626' cx='208' cy='448' r='48'/%3E%3Ccircle fill='%23dc2626' cx='416' cy='448' r='48'/%3E%3Cpath fill='%2322c55e' d='M340 120 C 340 120, 260 140, 260 220 C 260 300, 340 320, 340 320 S 420 300, 420 220 C 420 140, 340 120, 340 120 Z' transform='translate(0, -30)'/%3E%3Cpath fill='none' stroke='%2322c55e' stroke-width='12' stroke-linecap='round' d='M340 320 L 340 360' transform='translate(0, -30)'/%3E%3Cpath fill='white' d='M340 150 L 340 290' stroke='white' stroke-width='4' stroke-linecap='round' transform='translate(0, -30)'/%3E%3C/svg%3E";

const persistence = {
  get: (key: string): string | null => {
    try { return localStorage.getItem(key); } catch (e) { return null; }
  },
  set: (key: string, val: string) => {
    try { localStorage.setItem(key, val); } catch (e) { }
  },
  remove: (key: string) => {
    try { localStorage.removeItem(key); } catch (e) { }
  }
};

// Global robust normalization function
const normalizePhone = (p: any) => {
  let s = String(p || '').trim();
  // Strip decimals (e.g. "123.0" -> "123")
  if (s.includes('.')) s = s.split('.')[0];
  const clean = s.replace(/\D/g, '');
  return clean.length >= 9 ? clean.slice(-9) : clean;
};

// Robust passcode normalization
const normalizePasscode = (p: any) => {
  let s = String(p || '').trim();
  // Strip decimals (e.g. "7890.0" -> "7890")
  if (s.includes('.')) s = s.split('.')[0];
  return s.replace(/\D/g, '');
};

const computeHash = async (record: any): Promise<string> => {
  const normalizedUnits = Number(record.unitsSold).toString();
  const normalizedPrice = Number(record.unitPrice).toString();
  const msg = `${record.id}-${record.date}-${normalizedUnits}-${normalizedPrice}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(msg);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 12);
};

const App: React.FC = () => {
  const [records, setRecords] = useState<SaleRecord[]>(() => {
    const saved = persistence.get('food_coop_data');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [marketOrders, setMarketOrders] = useState<MarketOrder[]>(() => {
    const saved = persistence.get('food_coop_orders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [produceListings, setProduceListings] = useState<ProduceListing[]>(() => {
    const saved = persistence.get('food_coop_produce');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return Array.isArray(parsed) ? parsed : [];
      } catch (e) { return []; }
    }
    return [];
  });

  const [deletedProduceIds, setDeletedProduceIds] = useState<string[]>(() => {
    const saved = persistence.get('deleted_produce_blacklist');
    return saved ? JSON.parse(saved) : [];
  });

  const [users, setUsers] = useState<AgentIdentity[]>([]);
  const [agentIdentity, setAgentIdentity] = useState<AgentIdentity | null>(() => {
    const saved = persistence.get('agent_session');
    return saved ? JSON.parse(saved) : null;
  });
  
  const [currentPortal, setCurrentPortal] = useState<PortalType>('HOME');
  const [marketView, setMarketView] = useState<MarketView>(() => {
    const saved = persistence.get('agent_session');
    if (saved) {
      const agent = JSON.parse(saved);
      return agent.role === SystemRole.SUPPLIER ? 'SUPPLIER' : 'SUPPLIER';
    }
    return 'SUPPLIER';
  });
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncLock = useRef(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [fulfillmentData, setFulfillmentData] = useState<any>(null);
  const [isMarketMenuOpen, setIsMarketMenuOpen] = useState(false);

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });

  const [authForm, setAuthForm] = useState({
    name: '',
    phone: '',
    passcode: '',
    role: SystemRole.FIELD_AGENT,
    cluster: ''
  });

  const isSystemDev = agentIdentity?.role === SystemRole.SYSTEM_DEVELOPER || agentIdentity?.name === 'Barack James';

  const isPrivilegedRole = (agent: AgentIdentity | null) => {
    if (!agent) return false;
    return isSystemDev || 
           agent.role === SystemRole.MANAGER || 
           agent.role === SystemRole.FINANCE_OFFICER || 
           agent.role === SystemRole.AUDITOR;
  };

  const availablePortals = useMemo<PortalType[]>(() => {
    const guestPortals: PortalType[] = ['HOME', 'ABOUT', 'CONTACT'];
    if (!agentIdentity) return guestPortals;
    
    const loggedInBase: PortalType[] = ['HOME', 'ABOUT', 'MARKET', 'CONTACT'];
    if (isSystemDev) return [...loggedInBase, 'FINANCE', 'AUDIT', 'BOARD', 'SYSTEM'];
    if (agentIdentity.role === SystemRole.SUPPLIER) return loggedInBase;
    
    let base = [...loggedInBase];
    if (agentIdentity.role === SystemRole.FINANCE_OFFICER) base.splice(3, 0, 'FINANCE');
    else if (agentIdentity.role === SystemRole.AUDITOR) base.splice(3, 0, 'AUDIT');
    else if (agentIdentity.role === SystemRole.MANAGER) base.splice(3, 0, 'FINANCE', 'AUDIT', 'BOARD');
    return base;
  }, [agentIdentity, isSystemDev]);

  const loadCloudData = useCallback(async () => {
    if (syncLock.current) return;
    syncLock.current = true;
    setIsSyncing(true);
    try {
      const [cloudUsers, cloudRecords, cloudOrders, cloudProduce] = await Promise.all([
        fetchUsersFromCloud(),
        fetchFromGoogleSheets(),
        fetchOrdersFromCloud(),
        fetchProduceFromCloud()
      ]);
      
      if (cloudUsers && cloudUsers.length > 0) {
        setUsers(prev => {
          const userMap = new Map<string, AgentIdentity>();
          cloudUsers.forEach(u => { userMap.set(normalizePhone(u.phone), u); });
          prev.forEach(u => {
            const key = normalizePhone(u.phone);
            if (!userMap.has(key)) userMap.set(key, u);
          });
          const combined = Array.from(userMap.values());
          persistence.set('coop_users', JSON.stringify(combined));
          return combined;
        });
      }

      if (cloudRecords !== null) {
        setRecords(prev => {
          const cloudIds = new Set(cloudRecords.map(r => r.id));
          const localOnly = prev.filter(r => r.id && !cloudIds.has(r.id));
          const combined = [...localOnly, ...cloudRecords];
          persistence.set('food_coop_data', JSON.stringify(combined));
          return combined;
        });
      }

      if (cloudOrders !== null) {
        setMarketOrders(prev => {
          const cloudIds = new Set(cloudOrders.map(o => o.id));
          const localOnly = prev.filter(o => o.id && !cloudIds.has(o.id));
          const combined = [...localOnly, ...cloudOrders];
          persistence.set('food_coop_orders', JSON.stringify(combined));
          return combined;
        });
      }

      if (cloudProduce !== null) {
        setProduceListings(prev => {
          const blacklist = new Set(deletedProduceIds);
          const filteredCloud = cloudProduce.filter(cp => !blacklist.has(cp.id));
          const cloudIds = new Set(filteredCloud.map(p => p.id));
          const localOnly = prev.filter(p => p.id && !cloudIds.has(p.id) && !blacklist.has(p.id));
          const merged = filteredCloud.map(cp => {
            const localMatch = prev.find(p => p.id === cp.id);
            if (localMatch) {
              const isInvalid = (val: any) => !val || String(val).toLowerCase() === 'undefined' || String(val).toLowerCase() === 'null';
              return {
                ...cp,
                unitsAvailable: cp.unitsAvailable > 0 ? cp.unitsAvailable : localMatch.unitsAvailable,
                sellingPrice: cp.sellingPrice > 0 ? cp.sellingPrice : localMatch.sellingPrice,
                supplierName: isInvalid(cp.supplierName) ? localMatch.supplierName : cp.supplierName,
                supplierPhone: isInvalid(cp.supplierPhone) ? localMatch.supplierPhone : cp.supplierPhone,
                cluster: cp.cluster || localMatch.cluster,
                unitType: cp.unitType || localMatch.unitType
              };
            }
            return cp;
          });
          const combined = [...localOnly, ...merged];
          persistence.set('food_coop_produce', JSON.stringify(combined));
          return combined;
        });
      }
      setLastSyncTime(new Date());
    } catch (e) { console.error("Global Sync failed:", e); } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, [deletedProduceIds]);

  useEffect(() => {
    const savedUsers = persistence.get('coop_users');
    if (savedUsers) { try { setUsers(JSON.parse(savedUsers)); } catch (e) { } }
    loadCloudData();
  }, [loadCloudData]);

  useEffect(() => {
    const interval = setInterval(() => { loadCloudData(); }, SYNC_POLLING_INTERVAL);
    return () => clearInterval(interval);
  }, [loadCloudData]);

  const filteredRecords = useMemo(() => {
    let base = records.filter(r => r.id && r.date);
    if (agentIdentity) {
      const isPrivileged = isSystemDev || 
                           agentIdentity.role === SystemRole.MANAGER || 
                           agentIdentity.role === SystemRole.FINANCE_OFFICER ||
                           agentIdentity.role === SystemRole.AUDITOR;
      if (!isPrivileged) {
        base = base.filter(r => normalizePhone(r.agentPhone || '') === normalizePhone(agentIdentity.phone || ''));
      }
    }
    return base;
  }, [records, isSystemDev, agentIdentity]);

  const stats = useMemo(() => {
    const relevantRecords = filteredRecords;
    const verifiedComm = relevantRecords.filter(r => r.status === RecordStatus.VERIFIED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingAuditComm = relevantRecords.filter(r => r.status === RecordStatus.VALIDATED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingFinanceComm = relevantRecords.filter(r => r.status === RecordStatus.PAID).reduce((a, b) => a + Number(b.coopProfit), 0);
    const dueComm = relevantRecords.filter(r => r.status === RecordStatus.DRAFT).reduce((a, b) => a + Number(b.coopProfit), 0);
    return { awaitingAuditComm, awaitingFinanceComm, approvedComm: verifiedComm, dueComm };
  }, [filteredRecords]);

  const boardMetrics = useMemo(() => {
    const rLog = filteredRecords;
    const clusterMap = rLog.reduce((acc: Record<string, { volume: number, profit: number }>, r) => {
      const cluster = r.cluster || 'Unknown';
      if (!acc[cluster]) acc[cluster] = { volume: 0, profit: 0 };
      acc[cluster].volume += Number(r.totalSale);
      acc[cluster].profit += Number(r.coopProfit);
      return acc;
    }, {} as Record<string, { volume: number, profit: number }>);
    const clusterPerformance = Object.entries(clusterMap).sort((a: any, b: any) => b[1].profit - a[1].profit) as [string, { volume: number, profit: number }][];
    return { clusterPerformance };
  }, [filteredRecords]);

  const handleAddProduce = async (data: {
    date: string; cropType: string; unitType: string; unitsAvailable: number; sellingPrice: number; supplierName: string; supplierPhone: string;
  }) => {
    const clusterValue = agentIdentity?.cluster && agentIdentity.cluster !== '-' ? agentIdentity.cluster : 'Mariwa';
    const newListing: ProduceListing = {
      id: 'LST-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      date: data.date,
      cropType: data.cropType,
      unitsAvailable: data.unitsAvailable,
      unitType: data.unitType,
      sellingPrice: data.sellingPrice,
      supplierName: data.supplierName,
      supplierPhone: data.supplierPhone,
      cluster: clusterValue,
      status: 'AVAILABLE'
    };
    setProduceListings(prev => {
        const updated = [newListing, ...prev];
        persistence.set('food_coop_produce', JSON.stringify(updated));
        return updated;
    });
    try { await syncProduceToCloud(newListing); } catch (err) { console.error("Produce sync failed:", err); }
  };

  const handleUseProduceListing = (listing: ProduceListing) => {
    setCurrentPortal('MARKET');
    setMarketView('SALES');
    setFulfillmentData({
      cropType: listing.cropType, unitType: listing.unitType, farmerName: listing.supplierName,
      farmerPhone: listing.supplierPhone, unitPrice: listing.sellingPrice, produceId: listing.id,
      cluster: listing.cluster
    });
    window.scrollTo({ top: 600, behavior: 'smooth' });
  };

  const handleDeleteProduce = async (id: string) => {
    if (!window.confirm("Action required: Permanent deletion of harvest listing ID: " + id + ". Continue?")) return;
    const newBlacklist = [...deletedProduceIds, id];
    setDeletedProduceIds(newBlacklist);
    persistence.set('deleted_produce_blacklist', JSON.stringify(newBlacklist));
    setProduceListings(prev => {
        const updated = prev.filter(p => p.id !== id);
        persistence.set('food_coop_produce', JSON.stringify(updated));
        return updated;
    });
    try { await deleteProduceFromCloud(id); } catch (err) { console.error("Produce deletion sync failed:", err); }
  };

  const handleDeleteAllProduce = async () => {
    if (!window.confirm("CRITICAL ALERT: You are about to purge ALL produce listings from the entire system. This action is irreversible. Proceed?")) return;
    const currentIds = produceListings.map(p => p.id);
    const newBlacklist = Array.from(new Set([...deletedProduceIds, ...currentIds]));
    setDeletedProduceIds(newBlacklist);
    persistence.set('deleted_produce_blacklist', JSON.stringify(newBlacklist));
    setProduceListings([]);
    persistence.set('food_coop_produce', JSON.stringify([]));
    try { await deleteAllProduceFromCloud(); alert("System Repository Purged."); } catch (err) { console.error("Purge failed:", err); }
  };

  const handlePurgeUsers = async () => {
    if (!window.confirm("CRITICAL SECURITY ALERT: Purge ALL registered users? This cannot be undone. Proceed?")) return;
    setUsers([]);
    persistence.set('coop_users', JSON.stringify([]));
    try { await deleteAllUsersFromCloud(); alert("User Registry Purged."); } catch (err) { console.error("User purge failed:", err); }
  };

  const handlePurgeAuditLog = async () => {
    if (!window.confirm("CRITICAL AUDIT ALERT: You are about to wipe ALL transaction history records from the system. This action is permanent. Proceed?")) return;
    setRecords([]);
    persistence.set('food_coop_data', JSON.stringify([]));
    try { await deleteAllRecordsFromCloud(); alert("Trade Ledger Purged Successfully."); } catch (err) { console.error("Trade ledger purge failed:", err); }
  };

  const handlePurgeOrders = async () => {
    if (!window.confirm("CRITICAL MARKET ALERT: You are about to purge ALL market demand orders (unfulfilled). This action is permanent. Proceed?")) return;
    setMarketOrders([]);
    persistence.set('food_coop_orders', JSON.stringify([]));
    try { await deleteAllOrdersFromCloud(); alert("Order Repository Purged Successfully."); } catch (err) { console.error("Order purge failed:", err); }
  };

  const handleAddRecord = async (data: any) => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const totalSale = Number(data.unitsSold) * Number(data.unitPrice);
    const coopProfit = totalSale * PROFIT_MARGIN;
    const signature = await computeHash({ ...data, id });
    // Use the cluster provided from the form (customer's cluster) or fallback to agent's cluster
    const cluster = data.cluster || agentIdentity?.cluster || 'Unassigned';
    const newRecord: SaleRecord = {
      ...data, id, totalSale, coopProfit, status: RecordStatus.DRAFT, signature,
      createdAt: new Date().toISOString(), agentPhone: agentIdentity?.phone, agentName: agentIdentity?.name, cluster, synced: false
    };
    setRecords(prev => {
        const updated = [newRecord, ...prev];
        persistence.set('food_coop_data', JSON.stringify(updated));
        return updated;
    });
    if (data.orderId) {
      setMarketOrders(prev => {
        const updated = prev.map(o => o.id === data.orderId ? { ...o, status: OrderStatus.FULFILLED } : o);
        persistence.set('food_coop_orders', JSON.stringify(updated));
        return updated;
      });
      try {
        const order = marketOrders.find(o => o.id === data.orderId);
        if (order) await syncOrderToCloud({ ...order, status: OrderStatus.FULFILLED });
      } catch (err) { console.error("Order fulfillment sync failed:", err); }
    }
    if (data.produceId) {
      const newBlacklist = [...deletedProduceIds, data.produceId];
      setDeletedProduceIds(newBlacklist);
      persistence.set('deleted_produce_blacklist', JSON.stringify(newBlacklist));
      setProduceListings(prev => {
        const updated = prev.filter(p => p.id !== data.produceId);
        persistence.set('food_coop_produce', JSON.stringify(updated));
        return updated;
      });
      try { await deleteProduceFromCloud(data.produceId); } catch (e) { }
    }
    setFulfillmentData(null);
    try {
      const success = await syncToGoogleSheets(newRecord);
      if (success) setRecords(prev => prev.map(r => r.id === id ? { ...r, synced: true } : r));
    } catch (e) { }
  };

  const handleUpdateStatus = async (id: string, newStatus: RecordStatus) => {
    const record = records.find(r => r.id === id);
    if (!record) return;
    const updated = { ...record, status: newStatus };
    setRecords(prev => {
        const updatedList = prev.map(r => r.id === id ? updated : r);
        persistence.set('food_coop_data', JSON.stringify(updatedList));
        return updatedList;
    });
    await syncToGoogleSheets(updated);
  };

  const handleDeleteRecord = async (id: string) => {
    if (!window.confirm("Action required: Permanent deletion of record ID: " + id + ". Continue?")) return;
    setRecords(prev => {
        const updated = prev.filter(r => r.id !== id);
        persistence.set('food_coop_data', JSON.stringify(updated));
        return updated;
    });
    try { await deleteRecordFromCloud(id); } catch (e) { }
  };

  const handleToggleUserStatus = async (phone: string, currentStatus?: AccountStatus) => {
    const user = users.find(u => u.phone === phone);
    if (!user) return;
    const newStatus: AccountStatus = (currentStatus === 'ACTIVE') ? 'SUSPENDED' : 'ACTIVE';
    const updatedUser = { ...user, status: newStatus };
    setUsers(prev => {
      const updated = prev.map(u => u.phone === phone ? updatedUser : u);
      persistence.set('coop_users', JSON.stringify(updated));
      return updated;
    });
    await syncUserToCloud(updatedUser);
  };

  const handleDeleteUser = async (phone: string) => {
    if (!window.confirm(`Action required: Permanent deletion of user with phone: ${phone}. Continue?`)) return;
    setUsers(prev => {
        const updated = prev.filter(u => normalizePhone(u.phone) !== normalizePhone(phone));
        persistence.set('coop_users', JSON.stringify(updated));
        return updated;
    });
    try { await deleteUserFromCloud(phone); } catch (e) { }
  };

  const handleLogout = () => {
    setAgentIdentity(null);
    persistence.remove('agent_session');
    setCurrentPortal('HOME');
  };

  const handleExportSummaryCsv = () => {
    if (boardMetrics.clusterPerformance.length === 0) { alert("No summary data."); return; }
    const headers = ["Food Coop Clusters", "Total Volume of Sales (Ksh)", "Total Gross Profit (Ksh)"];
    const rows = boardMetrics.clusterPerformance.map(([cluster, stats]: [string, any]) => [cluster, stats.volume, stats.profit]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `kpl_coop_summary_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const handleExportDetailedCsv = () => {
    if (filteredRecords.length === 0) { alert("No detailed records."); return; }
    const headers = ["ID", "Date", "Cluster", "Agent", "Agent Phone", "Supplier", "Supplier Phone", "Buyer", "Buyer Phone", "Commodity", "Units", "Unit Price", "Gross Total", "Coop Profit", "Status"];
    const rows = filteredRecords.map(r => [r.id, r.date, r.cluster, r.agentName, r.agentPhone, r.farmerName, r.farmerPhone, r.customerName, r.customerPhone, r.cropType, `${r.unitsSold} ${r.unitType}`, r.unitPrice, r.totalSale, r.coopProfit, r.status]);
    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", `kpl_detailed_audit_${new Date().toISOString().split('T')[0]}.csv`);
    link.click();
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    alert("Thank you for your message. Our team will get back to you shortly at info@kplfoodcoopmarket.co.ke");
    setContactForm({ name: '', email: '', subject: '', message: '' });
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    
    // Normalize user input immediately using robust helper
    const targetPhoneNormalized = normalizePhone(authForm.phone);
    const targetPasscode = normalizePasscode(authForm.passcode);
    
    if (targetPhoneNormalized.length < 8) {
      alert("Invalid Phone: Please enter a valid phone number.");
      setIsAuthLoading(false);
      return;
    }

    try {
      // Force a fresh fetch from cloud database
      const latestCloudUsers = await fetchUsersFromCloud();
      
      // Update local cache if cloud data is valid
      if (latestCloudUsers && latestCloudUsers.length > 0) {
        setUsers(latestCloudUsers);
        persistence.set('coop_users', JSON.stringify(latestCloudUsers));
      }

      // Determine the set of users to authenticate against
      const authPool = (latestCloudUsers && latestCloudUsers.length > 0) ? latestCloudUsers : users;

      if (isRegisterMode) {
        if (authForm.role !== SystemRole.SYSTEM_DEVELOPER && !authForm.cluster) { 
          alert("Registration Error: Cluster selection is mandatory."); 
          setIsAuthLoading(false); 
          return; 
        }
        
        const newUser: AgentIdentity = { 
          name: authForm.name.trim(), 
          phone: authForm.phone.trim(), 
          passcode: targetPasscode, 
          role: authForm.role, 
          cluster: (authForm.role === SystemRole.SYSTEM_DEVELOPER || authForm.role === SystemRole.FINANCE_OFFICER || authForm.role === SystemRole.AUDITOR || authForm.role === SystemRole.MANAGER) ? '-' : (authForm.cluster || 'System'), 
          status: 'ACTIVE' 
        };
        
        // Prevent duplicate registration in local state
        const updatedUsersList = [...authPool.filter(u => normalizePhone(u.phone) !== normalizePhone(newUser.phone)), newUser];
        setUsers(updatedUsersList);
        persistence.set('coop_users', JSON.stringify(updatedUsersList));
        
        const syncSuccess = await syncUserToCloud(newUser);
        if (!syncSuccess) {
           alert("Warning: Account created locally, but failed to sync with cloud. Please ensure you have an active internet connection.");
        }
        
        setAgentIdentity(newUser);
        persistence.set('agent_session', JSON.stringify(newUser));
        setCurrentPortal('HOME');
      } else {
        // High-Integrity Matching using robust normalization on both target and pool
        const matchedUser = authPool.find(u => {
          const cloudPhoneNorm = normalizePhone(u.phone);
          const cloudPassNorm = normalizePasscode(u.passcode);
          return cloudPhoneNorm === targetPhoneNormalized && cloudPassNorm === targetPasscode;
        });
        
        if (matchedUser) { 
          setAgentIdentity(matchedUser); 
          persistence.set('agent_session', JSON.stringify(matchedUser)); 
          setCurrentPortal('HOME');
        } else {
          let errMsg = "Authentication Failed: Account not found or passcode is incorrect.";
          if (latestCloudUsers === null && users.length === 0) {
            errMsg = "Connectivity Error: Unable to reach the member database. Please check your internet connection and try again.";
          } else if (latestCloudUsers && latestCloudUsers.length === 0 && users.length === 0) {
            errMsg = "System Notice: No registered accounts found in the repository. If you are new, please use the Register option.";
          }
          alert(errMsg); 
        }
      }
    } catch (err) { 
      console.error("Critical Auth Error:", err);
      alert("System Error: A failure occurred during authentication. Please refresh the page and try again."); 
    } finally { 
      setIsAuthLoading(false); 
    }
  };

  const AuditLogTable = ({ data, title, onDelete }: { data: SaleRecord[], title: string, onDelete?: (id: string) => void }) => {
    const groupedData = useMemo(() => data.reduce((acc: Record<string, SaleRecord[]>, r) => {
        const cluster = r.cluster || 'Unassigned';
        if (!acc[cluster]) acc[cluster] = [];
        acc[cluster].push(r);
        return acc;
      }, {} as Record<string, SaleRecord[]>), [data]);
    
    const grandTotals = useMemo(() => data.reduce((acc, r) => ({ gross: acc.gross + Number(r.totalSale), comm: acc.comm + Number(r.coopProfit) }), { gross: 0, comm: 0 }), [data]);
    
    return (
      <div className="space-y-12">
        <h3 className="text-sm font-black text-black uppercase tracking-tighter ml-2">{title} ({data.length})</h3>
        {(Object.entries(groupedData) as [string, SaleRecord[]][]).map(([cluster, records]) => {
          const clusterTotalGross = records.reduce((sum, r) => sum + Number(r.totalSale), 0);
          const clusterTotalComm = records.reduce((sum, r) => sum + Number(r.coopProfit), 0);

          return (
            <div key={cluster} className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-lg overflow-x-auto">
              <h4 className="text-[11px] font-black text-red-600 uppercase tracking-widest mb-6 border-b border-red-50 pb-3 flex items-center justify-between">
                <span><i className="fas fa-map-marker-alt mr-2"></i> Cluster: {cluster}</span>
                <span className="text-slate-400 font-bold">{records.length} Transactions</span>
              </h4>
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  <tr><th className="pb-6">Date</th><th className="pb-6">Participants</th><th className="pb-6">Commodity</th><th className="pb-6">Gross Sale</th><th className="pb-6">Commission</th><th className="pb-6 text-right">Status</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {records.map(r => (
                    <tr key={r.id} className="text-[11px] font-bold group hover:bg-slate-50/50">
                      <td className="py-6 text-slate-400">{r.date}</td>
                      <td className="py-6">
                        <div className="space-y-1">
                          <p className="text-black font-black uppercase text-[10px]">Agent: {r.agentName} ({r.agentPhone})</p>
                          <p className="text-slate-500 font-bold text-[9px]">Supplier: {r.farmerName} ({r.farmerPhone})</p>
                          <p className="text-slate-500 font-bold text-[9px]">Buyer: {r.customerName} ({r.customerPhone})</p>
                        </div>
                      </td>
                      <td className="py-6 text-black uppercase">{r.cropType}</td>
                      <td className="py-6 font-black text-black">KSh {Number(r.totalSale).toLocaleString()}</td>
                      <td className="py-6 font-black text-green-600">KSh {Number(r.coopProfit).toLocaleString()}</td>
                      <td className="py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${r.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>{r.status}</span>
                          {onDelete && <button onClick={(e) => { e.stopPropagation(); onDelete(r.id); }} className="text-slate-300 hover:text-red-600 transition-colors p-1"><i className="fas fa-trash-alt text-[10px]"></i></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="mt-8 pt-6 border-t border-slate-100 flex flex-col sm:flex-row justify-end items-center gap-8">
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cluster Volume</p>
                  <p className="text-sm font-black text-black">KSh {clusterTotalGross.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mb-1">Cluster Commission</p>
                  <p className="text-sm font-black text-green-600">KSh {clusterTotalComm.toLocaleString()}</p>
                </div>
              </div>
            </div>
          );
        })}
        {data.length > 0 && (
          <div className="bg-slate-900 text-white rounded-[2rem] p-10 border border-black shadow-2xl relative overflow-hidden">
             <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                <div><p className="text-[10px] font-black uppercase tracking-tight text-red-500 mb-2">Aggregate System Audit</p><h4 className="text-2xl font-black uppercase tracking-tight">Combined Universal Grand Totals</h4></div>
                <div className="flex gap-12"><div className="text-center md:text-right"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Trade Volume</p><p className="text-2xl font-black text-white leading-none">KSh {grandTotals.gross.toLocaleString()}</p></div><div className="text-center md:text-right"><p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Gross Commission</p><p className="text-2xl font-black text-green-400 leading-none">KSh {grandTotals.comm.toLocaleString()}</p></div></div>
             </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      <header className="bg-white text-black pt-10 pb-12 shadow-sm border-b border-slate-100 relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10 flex flex-col lg:flex-row justify-between items-start mb-4 gap-6">
          <div className="flex items-center space-x-5">
            <div className="bg-white w-16 h-16 rounded-3xl flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden"><img src={APP_LOGO} alt="KPL Logo" className="w-10 h-10 object-contain" /></div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight leading-none text-black">KPL Food Coop Market</h1>
              <div className="flex items-center space-x-2 mt-1.5"><span className="text-[9px] font-black uppercase tracking-[0.4em] italic">Connecting <span className="text-red-600">Consumers</span> with <span className="text-green-600">Suppliers</span></span></div>
              <p className="text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2">{agentIdentity ? (isSystemDev ? 'Master Node Access' : `${agentIdentity.name} - ${agentIdentity.cluster} Cluster`) : 'Guest Hub Access'}</p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3 w-full lg:w-auto">
            {agentIdentity ? (
              <div className="bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100 text-right w-full lg:w-auto shadow-sm flex items-center justify-end space-x-6">
                   <div className="text-right"><p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Security Sync</p><p className="text-[10px] font-bold text-black">{isSyncing ? 'Syncing...' : lastSyncTime?.toLocaleTimeString() || '...'}</p></div>
                   <button onClick={handleLogout} className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-100"><i className="fas fa-power-off text-sm"></i></button>
              </div>
            ) : (
              <button onClick={() => setCurrentPortal('LOGIN')} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center gap-3">
                <i className="fas fa-user-shield"></i> Member Login
              </button>
            )}
            <div className="flex gap-4">
              <button onClick={() => setCurrentPortal('HOME')} className={`text-[10px] font-black uppercase tracking-widest ${currentPortal === 'HOME' ? 'text-black border-b-2 border-black' : 'text-slate-400 hover:text-black transition-colors'}`}>Home</button>
              <button onClick={() => setCurrentPortal('ABOUT')} className={`text-[10px] font-black uppercase tracking-widest ${currentPortal === 'ABOUT' ? 'text-black border-b-2 border-black' : 'text-slate-400 hover:text-black transition-colors'}`}>About Us</button>
              <button onClick={() => setCurrentPortal('CONTACT')} className={`text-[10px] font-black uppercase tracking-widest ${currentPortal === 'CONTACT' ? 'text-black border-b-2 border-black' : 'text-slate-400 hover:text-black transition-colors'}`}>Contact Us</button>
            </div>
          </div>
        </div>
        <nav className="container mx-auto px-6 flex flex-wrap gap-3 mt-4 relative z-10">
          {availablePortals.filter(p => !['HOME', 'ABOUT', 'CONTACT'].includes(p)).map(p => {
            if (p === 'MARKET') {
              return (
                <div key={p} className="relative">
                  <button type="button" onClick={(e) => { e.stopPropagation(); setCurrentPortal('MARKET'); setIsMarketMenuOpen(!isMarketMenuOpen); }} className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border flex items-center gap-2 ${currentPortal === 'MARKET' ? 'bg-black text-white border-black shadow-lg shadow-black/10 scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-black'}`}>Market <i className={`fas fa-chevron-down opacity-50 transition-transform ${isMarketMenuOpen ? 'rotate-180' : ''}`}></i></button>
                  {isMarketMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                      <button type="button" onClick={() => { setCurrentPortal('MARKET'); setMarketView('SUPPLIER'); setIsMarketMenuOpen(false); }} className={`w-full text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest ${marketView === 'SUPPLIER' && currentPortal === 'MARKET' ? 'text-green-600' : 'text-slate-500 hover:text-black hover:bg-slate-50'}`}><i className="fas fa-seedling mr-2"></i> Supplier Portal</button>
                      <button type="button" onClick={() => { setCurrentPortal('MARKET'); setMarketView('SALES'); setIsMarketMenuOpen(false); }} className={`w-full text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest ${marketView === 'SALES' && currentPortal === 'MARKET' ? 'text-green-600' : 'text-slate-500 hover:text-black hover:bg-slate-50'}`}><i className="fas fa-shopping-cart mr-2"></i> Sales Portal</button>
                    </div>
                  )}
                </div>
              );
            }
            return (<button key={p} type="button" onClick={() => { setCurrentPortal(p); setIsMarketMenuOpen(false); }} className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${currentPortal === p ? 'bg-black text-white border-black shadow-lg shadow-black/10 scale-105' : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-black'}`}>{p}</button>);
          })}
        </nav>
      </header>

      <main className="container mx-auto px-6 -mt-8 relative z-20 space-y-12" onClick={() => setIsMarketMenuOpen(false)}>
        {currentPortal === 'LOGIN' && !agentIdentity && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 flex flex-col items-center py-12">
            <div className="w-full max-w-[400px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-10 space-y-6">
              <div className="flex justify-between items-end mb-2">
                <h2 className="text-2xl font-black text-black uppercase tracking-tight">{isRegisterMode ? 'Register' : 'Login'}</h2>
                <button onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthForm({...authForm, cluster: CLUSTERS[0]})}} className="text-[10px] font-black uppercase text-red-600 hover:text-red-700">{isRegisterMode ? 'Back to Login' : 'Create Account'}</button>
              </div>
              <form onSubmit={handleAuth} className="space-y-4 text-center">
                {isRegisterMode && <input type="text" placeholder="Full Name" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none transition-all" />}
                <input type="tel" placeholder="Phone Number" required value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none transition-all" />
                <input type="password" placeholder="4-Digit Pin" required value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black text-center outline-none transition-all" />
                {isRegisterMode && (
                  <><select value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value as any})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none">{Object.values(SystemRole).map(r => <option key={r} value={r}>{r}</option>)}</select>
                  {authForm.role !== SystemRole.SYSTEM_DEVELOPER && authForm.role !== SystemRole.FINANCE_OFFICER && authForm.role !== SystemRole.AUDITOR && authForm.role !== SystemRole.MANAGER && (<select required value={authForm.cluster} onChange={e => setAuthForm({...authForm, cluster: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none"><option value="" disabled>Select Cluster</option>{CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}</select>)}</>
                )}
                <button disabled={isAuthLoading} className="w-full bg-black hover:bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95">{isAuthLoading ? <i className="fas fa-spinner fa-spin"></i> : (isRegisterMode ? 'Register Account' : 'Authenticate')}</button>
                <div className="flex justify-center gap-1.5 mt-8 opacity-40">
                  <div className="w-12 h-1 rounded-full bg-red-600"></div>
                  <div className="w-12 h-1 rounded-full bg-black"></div>
                  <div className="w-12 h-1 rounded-full bg-green-500"></div>
                </div>
              </form>
            </div>
          </div>
        )}

        {currentPortal === 'HOME' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 flex flex-col md:flex-row gap-12 items-center">
              <div className="flex-1 space-y-6">
                <h2 className="text-4xl font-black uppercase tracking-tight text-black leading-tight">Welcome to the KPL Cooperative Hub</h2>
                <p className="text-slate-600 font-medium leading-relaxed">
                  Our platform is designed to empower local farmers and consumers through a transparent, high-integrity marketplace. We leverage agroecological principles to ensure sustainable growth for our community.
                </p>
                <div className="flex gap-4">
                  {agentIdentity ? (
                    <button onClick={() => setCurrentPortal('MARKET')} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all">Explore Market</button>
                  ) : (
                    <button onClick={() => setCurrentPortal('LOGIN')} className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all">Get Started</button>
                  )}
                  <button onClick={() => setCurrentPortal('ABOUT')} className="bg-slate-100 text-black px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-200 transition-all">Learn More</button>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-2 gap-4">
                <div className="bg-green-50 p-8 rounded-3xl border border-green-100 text-center">
                  <p className="text-3xl font-black text-green-600">{users.length}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Total Members</p>
                </div>
                <div className="bg-red-50 p-8 rounded-3xl border border-red-100 text-center">
                  <p className="text-3xl font-black text-red-600">{records.length}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-400">Completed Trades</p>
                </div>
                <div className="bg-slate-900 p-8 rounded-3xl border border-black text-center col-span-2">
                  <p className="text-2xl font-black text-white">KSh {boardMetrics.clusterPerformance.reduce((a, b: any) => a + b[1].volume, 0).toLocaleString()}</p>
                  <p className="text-[9px] font-black uppercase tracking-widest text-slate-500">Total Trade Volume</p>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <i className="fas fa-bullhorn text-2xl text-red-600"></i>
                <h4 className="text-lg font-black uppercase tracking-tight">Cooperative News</h4>
                <p className="text-xs text-slate-500 font-medium">New harvest cycles starting in Mariwa cluster. Members are encouraged to list their produce early.</p>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <i className="fas fa-hand-holding-heart text-2xl text-green-600"></i>
                <h4 className="text-lg font-black uppercase tracking-tight">Community Pulse</h4>
                <p className="text-xs text-slate-500 font-medium">98% customer satisfaction rate across all clusters this month. Quality of maize has reached record highs.</p>
              </div>
              <div className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                <i className="fas fa-shield-halved text-2xl text-slate-900"></i>
                <h4 className="text-lg font-black uppercase tracking-tight">Audit Updates</h4>
                <p className="text-xs text-slate-500 font-medium">All financial systems synchronized. High-integrity trade signatures verified for 1,200+ transactions.</p>
              </div>
            </div>
          </div>
        )}

        {currentPortal === 'ABOUT' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 max-w-4xl mx-auto space-y-8">
              <h2 className="text-4xl font-black uppercase tracking-tight text-black text-center">Connecting <span className="text-red-600">Consumers</span> with <span className="text-green-600">Suppliers</span></h2>
              <div className="space-y-6 text-slate-600 font-medium leading-relaxed">
                <p>
                  KPL Food Coop Market was founded with a singular vision: to bridge the gap between rural agricultural productivity and urban consumer demand through a model built on transparency, fairness, and mutual growth.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 py-8 border-y border-slate-100">
                  <div className="space-y-4">
                    <h4 className="text-black font-black uppercase tracking-widest text-[11px]">Our Mission</h4>
                    <p className="text-sm">To empower smallholder farmers by providing direct access to premium markets while ensuring consumers receive high-quality, eco-friendly food products at fair prices.</p>
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-black font-black uppercase tracking-widest text-[11px]">The Agroecology Core</h4>
                    <p className="text-sm">We believe in farming that works with nature. Our green leaf symbol represents our commitment to agroecological practices that preserve soil health and biodiversity.</p>
                  </div>
                </div>
                <p>
                  Every transaction on our platform is secured by high-integrity digital signatures and verified by a multi-tier audit process, ensuring that every cent of profit reaches the intended recipients.
                </p>
              </div>
            </div>
          </div>
        )}

        {currentPortal === 'CONTACT' && (
          <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 max-w-4xl mx-auto flex flex-col md:flex-row gap-12">
              <div className="flex-1 space-y-8">
                <h2 className="text-3xl font-black uppercase tracking-tight text-black">Get in Touch</h2>
                <p className="text-slate-500 font-medium text-sm">Have questions about our marketplace or want to join as a supplier? Reach out to us directly.</p>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-red-600 border border-slate-100"><i className="fas fa-envelope"></i></div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Email Support</p>
                      <p className="text-sm font-black text-black">info@kplfoodcoopmarket.co.ke</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-green-600 border border-slate-100"><i className="fas fa-map-marker-alt"></i></div>
                    <div>
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Headquarters</p>
                      <p className="text-sm font-black text-black">KPL Central Hub, Nairobi, Kenya</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex-1 bg-slate-50 p-8 rounded-[2rem] border border-slate-100">
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <input type="text" placeholder="Your Name" required value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:border-black transition-all" />
                  <input type="email" placeholder="Email Address" required value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:border-black transition-all" />
                  <input type="text" placeholder="Subject" required value={contactForm.subject} onChange={e => setContactForm({...contactForm, subject: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:border-black transition-all" />
                  <textarea placeholder="Your Message..." required rows={4} value={contactForm.message} onChange={e => setContactForm({...contactForm, message: e.target.value})} className="w-full bg-white border border-slate-200 rounded-xl p-4 text-sm font-bold outline-none focus:border-black transition-all resize-none"></textarea>
                  <button type="submit" className="w-full bg-black text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-lg hover:bg-slate-800 transition-all">Send Message</button>
                </form>
              </div>
            </div>
          </div>
        )}

        {currentPortal === 'MARKET' && agentIdentity && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <button type="button" onClick={() => setMarketView('SUPPLIER')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${marketView === 'SUPPLIER' ? 'bg-black text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><i className="fas fa-seedling"></i> Supplier Portal</button>
                <button type="button" onClick={() => setMarketView('SALES')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${marketView === 'SALES' ? 'bg-black text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}><i className="fas fa-shopping-cart"></i> Sales Portal</button>
            </div>
            {marketView === 'SALES' && (
              <><div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"><StatCard label="Pending Payment" icon="fa-clock" value={`KSh ${stats.dueComm.toLocaleString()}`} color="bg-white" accent="text-red-600" /><StatCard label="Processing" icon="fa-spinner" value={`KSh ${stats.awaitingFinanceComm.toLocaleString()}`} color="bg-white" accent="text-black" /><StatCard label="Awaiting Audit" icon="fa-clipboard-check" value={`KSh ${stats.awaitingAuditComm.toLocaleString()}`} color="bg-white" accent="text-slate-500" /><StatCard label="Verified Profit" icon="fa-check-circle" value={`KSh ${stats.approvedComm.toLocaleString()}`} color="bg-white" accent="text-green-600" /></div>
                {agentIdentity.role !== SystemRole.SUPPLIER && <SaleForm clusters={CLUSTERS} produceListings={produceListings} onSubmit={handleAddRecord} initialData={fulfillmentData} />}
                <AuditLogTable data={isPrivilegedRole(agentIdentity) ? filteredRecords : filteredRecords.slice(0, 10)} title={isPrivilegedRole(agentIdentity) ? "System Universal Audit Log" : "Recent Integrity Logs"} onDelete={isSystemDev ? handleDeleteRecord : undefined} />
              </>
            )}
            {marketView === 'SUPPLIER' && (
              <div className="space-y-12">
                {agentIdentity.role !== SystemRole.FINANCE_OFFICER && agentIdentity.role !== SystemRole.AUDITOR && (<ProduceForm userRole={agentIdentity.role} defaultSupplierName={agentIdentity.role === SystemRole.SUPPLIER ? agentIdentity.name : undefined} defaultSupplierPhone={agentIdentity.role === SystemRole.SUPPLIER ? agentIdentity.phone : undefined} onSubmit={handleAddProduce} />)}
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden relative"><div className="absolute top-0 right-0 p-8 opacity-5"><i className="fas fa-warehouse text-8xl text-black"></i></div><h3 className="text-sm font-black text-black uppercase tracking-widest mb-8">Available Products Repository</h3><div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4"><tr><th className="pb-4">Date Posted</th><th className="pb-4">Supplier Identity</th><th className="pb-4">Cluster</th><th className="pb-4">Commodity</th><th className="pb-4">Qty Available</th><th className="pb-4">Asking Price</th><th className="pb-4 text-right">Action</th></tr></thead><tbody className="divide-y">
                  {produceListings.map(p => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors"><td className="py-6"><span className="text-[10px] font-bold text-slate-400 uppercase">{p.date || 'N/A'}</span></td><td className="py-6"><p className="text-[11px] font-black uppercase text-black">{p.supplierName || 'Anonymous'}</p><p className="text-[9px] text-slate-400 font-mono">{p.supplierPhone || 'N/A'}</p></td><td className="py-6"><span className="text-[10px] font-bold text-slate-500 uppercase">{p.cluster || 'N/A'}</span></td><td className="py-6"><p className="text-[11px] font-black uppercase text-green-600">{p.cropType || 'Other'}</p></td><td className="py-6"><p className="text-[11px] font-black text-slate-700">{p.unitsAvailable} {p.unitType}</p></td><td className="py-6"><p className="text-[11px] font-black text-black">KSh {p.sellingPrice.toLocaleString()} / {p.unitType}</p></td><td className="py-6 text-right"><div className="flex items-center justify-end gap-3">{(isPrivilegedRole(agentIdentity) || (agentIdentity.role === SystemRole.SUPPLIER && normalizePhone(agentIdentity.phone) === normalizePhone(p.supplierPhone))) && (<button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteProduce(p.id); }} className="text-red-400 hover:text-red-700 transition-all p-2 bg-red-50 hover:bg-red-100 rounded-xl"><i className="fas fa-trash-can text-[14px]"></i></button>)}{agentIdentity.role !== SystemRole.SUPPLIER ? (<button type="button" onClick={() => handleUseProduceListing(p)} className="bg-black text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-md flex items-center justify-end gap-2"><i className="fas fa-plus"></i> Initiate Sale</button>) : (<span className="text-[8px] font-black uppercase text-green-500 bg-green-50 px-3 py-1 rounded-full border border-green-100">Live Listing</span>)}</div></td></tr>
                  ))}
                </tbody></table></div></div>
              </div>
            )}
          </div>
        )}

        {currentPortal === 'FINANCE' && agentIdentity && (
          <div className="space-y-8 animate-in fade-in duration-300">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
              <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-red-600 pl-4">Transactions Waiting Confirmation</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4">
                    <tr>
                      <th className="pb-4">Date</th>
                      <th className="pb-4">Participants</th>
                      <th className="pb-4">Commodity</th>
                      <th className="pb-4">Commission</th>
                      <th className="pb-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredRecords.filter(r => r.status === RecordStatus.DRAFT).map(r => (
                      <tr key={r.id} className="hover:bg-slate-50/50">
                        <td className="py-6 font-bold">{r.date}</td>
                        <td className="py-6">
                          <div className="text-[9px] space-y-1 uppercase font-bold text-slate-500">
                            <p className="text-black">Agent: {r.agentName} ({r.agentPhone})</p>
                            <p>Supplier: {r.farmerName} ({r.farmerPhone})</p>
                            <p>Buyer: {r.customerName} ({r.customerPhone})</p>
                          </div>
                        </td>
                        <td className="py-6 uppercase font-bold">{r.cropType}</td>
                        <td className="py-6 font-black text-green-600">KSh {Number(r.coopProfit).toLocaleString()}</td>
                        <td className="py-6 text-right">
                          <button type="button" onClick={() => handleUpdateStatus(r.id, RecordStatus.PAID)} className="bg-green-500 text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-green-600 shadow-md flex items-center justify-end gap-2 ml-auto">
                            <i className="fas fa-check"></i> Confirm Receipt
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <AuditLogTable data={filteredRecords} title="Full Financial Audit Log" onDelete={isPrivilegedRole(agentIdentity) ? handleDeleteRecord : undefined} />
          </div>
        )}

        {currentPortal === 'AUDIT' && agentIdentity && (
          <div className="space-y-8 animate-in fade-in duration-300"><div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl"><h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-black pl-4">Awaiting Approval & Verification</h3><div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4"><tr><th className="pb-4">Details</th><th className="pb-4">Participants</th><th className="pb-4">Financials</th><th className="pb-4 text-right">Action</th></tr></thead><tbody className="divide-y">
            {filteredRecords.filter(r => r.status === RecordStatus.PAID || r.status === RecordStatus.VALIDATED).map(r => (
              <tr key={r.id} className="hover:bg-slate-800/50"><td className="py-6"><p className="font-bold uppercase text-black">{r.cropType}</p><p className="text-[9px] text-slate-400">{r.unitsSold} {r.unitType}</p></td><td className="py-6"><div className="text-[9px] space-y-1 uppercase font-bold text-slate-500"><p className="text-black">Agent: {r.agentName} ({r.agentPhone})</p><p>Supplier: {r.farmerName} ({r.farmerPhone})</p><p>Buyer: {r.customerName} ({r.customerPhone})</p></div></td><td className="py-6 font-black text-black"><p>Gross: KSh {Number(r.totalSale).toLocaleString()}</p><p className="text-green-600">Comm: KSh {Number(r.coopProfit).toLocaleString()}</p></td><td className="py-6 text-right">{r.status === RecordStatus.PAID ? (<button type="button" onClick={() => handleUpdateStatus(r.id, RecordStatus.VALIDATED)} className="bg-black text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 shadow-md ml-auto flex items-center gap-2"><i className="fas fa-search"></i> Verify</button>) : (<button type="button" onClick={() => handleUpdateStatus(r.id, RecordStatus.VERIFIED)} className="bg-red-600 text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-700 shadow-md ml-auto flex items-center gap-2"><i className="fas fa-stamp"></i> Audit Seal</button>)}</td></tr>
            ))}
          </tbody></table></div></div><AuditLogTable data={filteredRecords} title="System Integrity Log" onDelete={isPrivilegedRole(agentIdentity) ? handleDeleteRecord : undefined} /></div>
        )}

        {currentPortal === 'BOARD' && agentIdentity && (
          <div className="space-y-12 animate-in fade-in duration-300"><div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden"><div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4"><h3 className="text-sm font-black text-black uppercase tracking-tighter border-l-4 border-green-500 pl-4">Coops Summary Report</h3><div className="flex gap-2"><button type="button" onClick={handleExportSummaryCsv} className="bg-slate-100 text-black px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest">Summary CSV</button><button type="button" onClick={handleExportDetailedCsv} className="bg-black text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl"><i className="fas fa-download mr-2"></i> Detailed CSV</button></div></div><div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50"><tr><th className="pb-6">Food Coop Clusters</th><th className="pb-6">Total Sales (Ksh)</th><th className="pb-6">Gross Profit (Ksh)</th></tr></thead><tbody className="divide-y divide-slate-50">
            {boardMetrics.clusterPerformance.map(([cluster, stats]: any) => (
              <tr key={cluster} className="hover:bg-slate-50/50"><td className="py-6 font-black text-black uppercase text-[11px]">{cluster}</td><td className="py-6 font-black text-slate-900 text-[11px]">KSh {stats.volume.toLocaleString()}</td><td className="py-6 font-black text-green-600 text-[11px]">KSh {stats.profit.toLocaleString()}</td></tr>
            ))}
            <tr className="bg-slate-900 text-white rounded-3xl overflow-hidden shadow-xl"><td className="py-6 px-8 font-black uppercase text-[11px] rounded-l-3xl">Aggregate Performance</td><td className="py-6 font-black text-[11px]">KSh {boardMetrics.clusterPerformance.reduce((a: number, b: any) => a + b[1].volume, 0).toLocaleString()}</td><td className="py-6 px-8 font-black text-green-400 text-[11px] rounded-r-3xl">KSh {boardMetrics.clusterPerformance.reduce((a: number, b: any) => a + b[1].profit, 0).toLocaleString()}</td></tr>
          </tbody></table></div></div><AuditLogTable data={filteredRecords} title="Universal Trade Log" onDelete={isPrivilegedRole(agentIdentity) ? handleDeleteRecord : undefined} /></div>
        )}

        {currentPortal === 'SYSTEM' && isSystemDev && agentIdentity && (
          <div className="space-y-12 animate-in fade-in duration-300">
            <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 border border-black shadow-2xl relative overflow-hidden">
              <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.4em] text-green-500 mb-2">Cloud Storage Node</p>
                  <h4 className="text-2xl font-black uppercase tracking-tight">Master Database Repository</h4>
                </div>
                <div className="flex flex-wrap gap-4">
                  <a href={GOOGLE_SHEET_VIEW_URL} target="_blank" rel="noopener noreferrer" className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.2em] shadow-xl flex items-center"><i className="fas fa-table mr-3 text-lg"></i> Launch Ledger</a>
                  <button onClick={handleDeleteAllProduce} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-700 shadow-xl flex items-center gap-2">
                    <i className="fas fa-warehouse"></i> Purge Repository
                  </button>
                  <button onClick={handlePurgeAuditLog} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-700 shadow-xl flex items-center gap-2">
                    <i className="fas fa-file-invoice-dollar"></i> Purge Ledger
                  </button>
                  <button onClick={handlePurgeOrders} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-700 shadow-xl flex items-center gap-2">
                    <i className="fas fa-shopping-basket"></i> Purge Orders
                  </button>
                  <button onClick={handlePurgeUsers} className="bg-red-600/80 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-700 shadow-xl flex items-center gap-2">
                    <i className="fas fa-users-slash"></i> Purge Users
                  </button>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-xl"><h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-red-600 pl-4">Agent Activation & Security</h3><div className="overflow-x-auto"><table className="w-full text-left"><thead className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4"><tr><th className="pb-4">Name & Contact</th><th className="pb-4">Role / Node</th><th className="pb-4">Status</th><th className="pb-4 text-right">Access Control</th></tr></thead><tbody className="divide-y">
            {users.map(u => (
              <tr key={u.phone} className="group hover:bg-slate-50/50"><td className="py-6"><p className="text-sm font-black uppercase text-black">{u.name}</p><p className="text-[10px] font-bold text-slate-400">{u.phone}</p></td><td className="py-6"><p className="text-[11px] font-black text-black uppercase">{u.role}</p><p className="text-[9px] text-slate-400 font-bold">{(u.role === SystemRole.SYSTEM_DEVELOPER || u.role === SystemRole.FINANCE_OFFICER || u.role === SystemRole.AUDITOR || u.role === SystemRole.MANAGER) ? '-' : u.cluster}</p></td><td className="py-6"><span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>{u.status || 'AWAITING'}</span></td><td className="py-6 text-right"><div className="flex items-center justify-end gap-3">{u.status === 'ACTIVE' ? (<button type="button" onClick={(e) => { e.stopPropagation(); handleToggleUserStatus(u.phone, 'ACTIVE'); }} className="bg-white border border-red-200 text-red-600 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-sm">Deactivate</button>) : (<button type="button" onClick={(e) => { e.stopPropagation(); handleToggleUserStatus(u.phone); }} className="bg-green-500 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-md">Reactivate</button>)}<button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteUser(u.phone); }} className="text-slate-300 hover:text-red-600 p-2"><i className="fas fa-trash-alt text-[12px]"></i></button></div></td></tr>
            ))}
          </tbody></table></div></div><AuditLogTable data={filteredRecords} title="System-Wide Audit Log" onDelete={handleDeleteRecord} /></div>
        )}
      </main>
    </div>
  );
};

export default App;