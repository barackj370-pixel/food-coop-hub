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
  fetchProduceFromCloud
} from './services/googleSheetsService.ts';

type PortalType = 'HOME' | 'MARKET' | 'FINANCE' | 'AUDIT' | 'BOARD' | 'SYSTEM' | 'ABOUT' | 'CONTACT' | 'NEWS';
type MarketView = 'SALES' | 'SUPPLIER';

const CLUSTERS = ['Mariwa', 'Mulo', 'Rabolo', 'Kangemi', 'Kabarnet', 'Apuoyo', 'Nyamagagana'];
const APP_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='%23000000' d='M160 96c0-17.7-14.3-32-32-32H32C14.3 64 0 78.3 0 96s14.3 32 32 32h73.4l57.1 240.1c5.3 22.3 25.3 37.9 48.2 37.9H436c22.9 0 42.9-15.6 48.2-37.9l39.1-164.2c4.2-17.8-7-35.7-24.9-39.9s-35.7 7-39.9 24.9l-33.9 142.2H198.5l-57.1-240c-2.7-11.2-12.7-19-24.1-19H32z'/%3E%3Ccircle fill='%23dc2626' cx='208' cy='448' r='48'/%3E%3Ccircle fill='%23dc2626' cx='416' cy='448' r='48'/%3E%3Cpath fill='%2322c55e' d='M448 32c-60 0-120 40-140 100-5-20-20-40-40-50 20 60 10 120-60 150 70 0 130-40 150-100 5 20 20 40 40 50-20-60-10-120 50-150z'/%3E%3C/svg%3E";

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
      return agent.role === SystemRole.SUPPLIER ? 'SUPPLIER' : 'SALES';
    }
    return 'SALES';
  });
  const [isAuthLoading, setIsAuthLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncLock = useRef(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);
  const [isRegisterMode, setIsRegisterMode] = useState(false);
  const [fulfillmentData, setFulfillmentData] = useState<any>(null);
  const [isMarketMenuOpen, setIsMarketMenuOpen] = useState(false);

  // Contact Form State
  const [contactForm, setContactForm] = useState({ name: '', email: '', message: '' });
  const [isContactSent, setIsContactSent] = useState(false);

  const [authForm, setAuthForm] = useState({
    name: '',
    phone: '',
    passcode: '',
    role: SystemRole.FIELD_AGENT,
    cluster: ''
  });

  const [demandForm, setDemandForm] = useState({
    cropType: 'Maize',
    unitsRequested: 0,
    unitType: '2kg Tin',
    customerName: '',
    customerPhone: ''
  });

  const normalizePhone = (p: string) => {
    const clean = p.replace(/\D/g, '');
    return clean.length >= 9 ? clean.slice(-9) : clean;
  };

  const isSystemDev = agentIdentity?.role === SystemRole.SYSTEM_DEVELOPER || agentIdentity?.name === 'Barack James';

  const isPrivilegedRole = (agent: AgentIdentity | null) => {
    if (!agent) return false;
    return isSystemDev || 
           agent.role === SystemRole.MANAGER || 
           agent.role === SystemRole.FINANCE_OFFICER || 
           agent.role === SystemRole.AUDITOR;
  };

  const availablePortals = useMemo<PortalType[]>(() => {
    if (!agentIdentity) return [];
    const portals: PortalType[] = ['MARKET'];
    if (isSystemDev) portals.push('FINANCE', 'AUDIT', 'BOARD', 'SYSTEM');
    else {
      if (agentIdentity.role === SystemRole.FINANCE_OFFICER) portals.push('FINANCE');
      else if (agentIdentity.role === SystemRole.AUDITOR) portals.push('AUDIT');
      else if (agentIdentity.role === SystemRole.MANAGER) portals.push('FINANCE', 'AUDIT', 'BOARD');
    }
    return portals;
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
      
      if (cloudUsers) {
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
    } catch (e) {
      console.error("Global Sync failed:", e);
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, [deletedProduceIds]);

  useEffect(() => {
    const savedUsers = persistence.get('coop_users');
    if (savedUsers) {
      try { setUsers(JSON.parse(savedUsers)); } catch (e) { }
    }
    loadCloudData();
  }, [loadCloudData]);

  useEffect(() => {
    const interval = setInterval(() => {
      loadCloudData();
    }, SYNC_POLLING_INTERVAL);
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

  const filteredOrders = useMemo(() => {
    let base = marketOrders;
    if (agentIdentity && !isSystemDev && agentIdentity.role === SystemRole.FIELD_AGENT) {
      base = base.filter(o => normalizePhone(o.agentPhone) === normalizePhone(agentIdentity.phone));
    }
    return base;
  }, [marketOrders, isSystemDev, agentIdentity]);

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

    const commodityMap = rLog.reduce((acc: Record<string, number>, r) => {
      acc[r.cropType] = (acc[r.cropType] || 0) + Number(r.unitsSold);
      return acc;
    }, {} as Record<string, number>);
    const commodityTrends = Object.entries(commodityMap).sort((a: any, b: any) => b[1] - a[1]) as [string, number][];

    return { clusterPerformance, commodityTrends };
  }, [filteredRecords]);

  const handleAddOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!demandForm.customerName || demandForm.unitsRequested <= 0) {
      alert("Please enter customer name and quantity.");
      return;
    }
    const newOrder: MarketOrder = {
      id: 'ORD-' + Math.random().toString(36).substring(2, 6).toUpperCase(),
      date: new Date().toISOString().split('T')[0],
      cropType: demandForm.cropType,
      unitsRequested: demandForm.unitsRequested,
      unitType: demandForm.unitType,
      customerName: demandForm.customerName,
      customerPhone: demandForm.customerPhone,
      status: OrderStatus.OPEN,
      agentPhone: agentIdentity?.phone || '',
      cluster: agentIdentity?.cluster || 'Unassigned'
    };
    setMarketOrders(prev => {
        const updated = [newOrder, ...prev];
        persistence.set('food_coop_orders', JSON.stringify(updated));
        return updated;
    });
    setDemandForm({ ...demandForm, customerName: '', customerPhone: '', unitsRequested: 0 });
    try { await syncOrderToCloud(newOrder); } catch (err) { console.error("Order sync failed:", err); }
  };

  const handleAddProduce = async (data: any) => {
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

  const handleFulfillOrderClick = (order: MarketOrder) => {
    setMarketView('SALES');
    setFulfillmentData({
      cropType: order.cropType,
      unitsSold: order.unitsRequested,
      unitType: order.unitType,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      orderId: order.id,
      farmerName: '',
      farmerPhone: '',
      unitPrice: 0
    });
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleUseProduceListing = (listing: ProduceListing) => {
    setMarketView('SALES');
    setFulfillmentData({
      cropType: listing.cropType,
      unitType: listing.unitType,
      farmerName: listing.supplierName,
      farmerPhone: listing.supplierPhone,
      unitPrice: listing.sellingPrice,
      produceId: listing.id,
      unitsSold: 0,
      customerName: '',
      customerPhone: ''
    });
    window.scrollTo({ top: 400, behavior: 'smooth' });
  };

  const handleDeleteProduce = async (id: string) => {
    if (!window.confirm("Action required: Permanent deletion of listing ID: " + id + ". Continue?")) return;
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

  const handleAddRecord = async (data: any) => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    const totalSale = Number(data.unitsSold) * Number(data.unitPrice);
    const coopProfit = totalSale * PROFIT_MARGIN;
    const signature = await computeHash({ ...data, id });
    const cluster = agentIdentity?.cluster || 'Unassigned';
    
    const newRecord: SaleRecord = {
      ...data,
      id,
      totalSale,
      coopProfit,
      status: RecordStatus.DRAFT,
      signature,
      createdAt: new Date().toISOString(),
      agentPhone: agentIdentity?.phone,
      agentName: agentIdentity?.name,
      cluster: cluster,
      synced: false
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
      try { await deleteProduceFromCloud(data.produceId); } catch (e) { console.error("Produce removal failed:", e); }
    }
    setFulfillmentData(null);
    try {
      const success = await syncToGoogleSheets(newRecord);
      if (success) setRecords(prev => prev.map(r => r.id === id ? { ...r, synced: true } : r));
    } catch (e) { console.error("Sync error:", e); }
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
    try { await deleteRecordFromCloud(id); } catch (e) { console.error("Cloud deletion failed:", e); }
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
    if (!window.confirm(`Action required: Permanent deletion of user: ${phone}. Continue?`)) return;
    setUsers(prev => {
        const updated = prev.filter(u => normalizePhone(u.phone) !== normalizePhone(phone));
        persistence.set('coop_users', JSON.stringify(updated));
        return updated;
    });
    try { await deleteUserFromCloud(phone); } catch (e) { console.error("Cloud user deletion failed:", e); }
  };

  const handleLogout = () => {
    setAgentIdentity(null);
    persistence.remove('agent_session');
    setCurrentPortal('HOME');
  };

  const handleContactSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) {
      alert("Please fill in all fields.");
      return;
    }
    setIsContactSent(true);
    setContactForm({ name: '', email: '', message: '' });
    setTimeout(() => setIsContactSent(false), 5000);
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsAuthLoading(true);
    const targetPhoneNormalized = normalizePhone(authForm.phone);
    const targetPasscode = authForm.passcode.replace(/\D/g, '');
    try {
      const latestCloudUsers = await fetchUsersFromCloud();
      let currentUsers = latestCloudUsers ? [...latestCloudUsers] : [...users];
      if (latestCloudUsers) {
        const cloudPhones = new Set(latestCloudUsers.map(u => normalizePhone(u.phone)));
        users.forEach(u => { if (!cloudPhones.has(normalizePhone(u.phone))) currentUsers.push(u); });
      }
      if (isRegisterMode) {
        if (authForm.role !== SystemRole.SYSTEM_DEVELOPER && !authForm.cluster) {
            alert("Please select a cluster.");
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
        const updatedUsersList = [...currentUsers.filter(u => normalizePhone(u.phone) !== normalizePhone(newUser.phone)), newUser];
        setUsers(updatedUsersList);
        persistence.set('coop_users', JSON.stringify(updatedUsersList));
        await syncUserToCloud(newUser);
        setAgentIdentity(newUser);
        persistence.set('agent_session', JSON.stringify(newUser));
      } else {
        const user = currentUsers.find(u => normalizePhone(u.phone) === targetPhoneNormalized && String(u.passcode).replace(/\D/g, '') === targetPasscode);
        if (user) {
          setAgentIdentity(user);
          persistence.set('agent_session', JSON.stringify(user));
        } else { alert("Authentication failed. Ensure your phone and PIN are correct."); }
      }
    } catch (err) { alert("System Auth Error."); } finally { setIsAuthLoading(false); }
  };

  const AuditLogTable = ({ data, title, onDelete }: { data: SaleRecord[], title: string, onDelete?: (id: string) => void }) => {
    const groupedData = useMemo(() => {
      return data.reduce((acc: Record<string, SaleRecord[]>, r) => {
        const cluster = r.cluster || 'Unassigned';
        if (!acc[cluster]) acc[cluster] = [];
        acc[cluster].push(r);
        return acc;
      }, {} as Record<string, SaleRecord[]>);
    }, [data]);

    return (
      <div className="space-y-12">
        <h3 className="text-sm font-black text-black uppercase tracking-tighter ml-2">{title} ({data.length})</h3>
        {(Object.entries(groupedData) as [string, SaleRecord[]][]).map(([cluster, records]) => {
          return (
            <div key={cluster} className="bg-white rounded-[2rem] p-8 border border-slate-200 shadow-lg overflow-x-auto">
              <h4 className="text-[11px] font-black text-red-600 uppercase tracking-widest mb-6 border-b border-red-50 pb-3 flex items-center justify-between">
                <span><i className="fas fa-map-marker-alt mr-2"></i> Cluster: {cluster}</span>
                <span className="text-slate-400 font-bold">{records.length} Transactions</span>
              </h4>
              <table className="w-full text-left">
                <thead className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                  <tr>
                    <th className="pb-6">Date</th>
                    <th className="pb-6">Participants</th>
                    <th className="pb-6">Commodity</th>
                    <th className="pb-6">Gross Sale</th>
                    <th className="pb-6">Commission</th>
                    <th className="pb-6 text-right">Status</th>
                  </tr>
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
                        <p className="text-[8px] text-slate-300 mt-1 uppercase">ID: {r.id}</p>
                      </td>
                      <td className="py-6 text-black uppercase">{r.cropType}</td>
                      <td className="py-6 font-black text-black">KSh {Number(r.totalSale).toLocaleString()}</td>
                      <td className="py-6 font-black text-green-600">KSh {Number(r.coopProfit).toLocaleString()}</td>
                      <td className="py-6 text-right">
                        <div className="flex items-center justify-end gap-3">
                          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${r.status === 'VERIFIED' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'}`}>
                            {r.status}
                          </span>
                          {onDelete && (
                            <button onClick={(e) => { e.stopPropagation(); onDelete(r.id); }} className="text-slate-300 hover:text-red-600 transition-colors p-1" title="Delete record">
                               <i className="fas fa-trash-alt text-[10px]"></i>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        })}
      </div>
    );
  };

  if (!agentIdentity) {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative">
        <div className="mb-8 text-center z-10">
           <div className="inline-flex items-center justify-center w-20 h-20 bg-white rounded-3xl mb-4 border border-slate-100 shadow-md overflow-hidden">
              <img src={APP_LOGO} className="w-12 h-12 object-contain" alt="KPL Logo" />
           </div>
           <h1 className="text-3xl font-black text-black uppercase tracking-tighter">KPL Food Coop Market</h1>
           <p className="text-[10px] font-black uppercase tracking-[0.4em] mt-2 italic">Connecting <span className="text-red-600">Consumers</span> with <span className="text-green-600">Suppliers</span></p>
        </div>
        <div className="w-full max-w-[360px] bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl p-10 space-y-6 z-10">
            <div className="flex justify-between items-end mb-2">
              <h2 className="text-2xl font-black text-black uppercase tracking-tight">{isRegisterMode ? 'Register' : 'Login'}</h2>
              <button onClick={() => { setIsRegisterMode(!isRegisterMode); setAuthForm({...authForm, cluster: CLUSTERS[0]})}} className="text-[10px] font-black uppercase text-red-600 hover:text-red-700">{isRegisterMode ? 'Back' : 'Create New Account'}</button>
            </div>
            <form onSubmit={handleAuth} className="space-y-4">
              {isRegisterMode && <input type="text" placeholder="Full Name" required value={authForm.name} onChange={e => setAuthForm({...authForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none transition-all" />}
              <input type="tel" placeholder="Phone Number" required value={authForm.phone} onChange={e => setAuthForm({...authForm, phone: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none transition-all" />
              <input type="password" placeholder="4-Digit Pin" required value={authForm.passcode} onChange={e => setAuthForm({...authForm, passcode: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black text-center outline-none transition-all" />
              {isRegisterMode && (
                <>
                  <select value={authForm.role} onChange={e => setAuthForm({...authForm, role: e.target.value as any})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none">
                    {Object.values(SystemRole).map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                  {authForm.role !== SystemRole.SYSTEM_DEVELOPER && authForm.role !== SystemRole.FINANCE_OFFICER && authForm.role !== SystemRole.AUDITOR && authForm.role !== SystemRole.MANAGER && (
                    <select required value={authForm.cluster} onChange={e => setAuthForm({...authForm, cluster: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4.5 font-bold text-black outline-none">
                      <option value="" disabled>Select Cluster</option>
                      {CLUSTERS.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                </>
              )}
              <button disabled={isAuthLoading} className="w-full bg-black hover:bg-slate-900 text-white py-5 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95">{isAuthLoading ? <i className="fas fa-spinner fa-spin"></i> : (isRegisterMode ? 'Register Account' : 'Authenticate')}</button>
            </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 pb-20">
      <header className="bg-white text-black pt-10 pb-12 shadow-sm border-b border-slate-100 relative overflow-hidden">
        <div className="container mx-auto px-6 relative z-10 flex flex-col lg:flex-row justify-between items-start mb-6 gap-6">
          <div className="flex items-center space-x-5 cursor-pointer" onClick={() => setCurrentPortal('HOME')}>
            <div className="bg-white w-16 h-16 rounded-3xl flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden">
               <img src={APP_LOGO} className="w-10 h-10 object-contain" alt="KPL Logo" />
            </div>
            <div>
              <h1 className="text-3xl font-black uppercase tracking-tight leading-none text-black">KPL Food Coop Market</h1>
              <div className="flex items-center space-x-2 mt-1.5">
                <span className="text-[9px] font-black uppercase tracking-[0.4em] italic">Connecting <span className="text-red-600">Consumers</span> with <span className="text-green-600">Suppliers</span></span>
                <span className="w-1.5 h-1.5 rounded-full bg-green-500"></span>
                <span className="text-black text-[9px] font-black uppercase tracking-[0.4em]">{agentIdentity.role}</span>
              </div>
            </div>
          </div>
          <div className="bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100 text-right w-full lg:w-auto shadow-sm flex flex-col justify-center">
            <div className="flex items-center justify-end space-x-6">
               <div className="text-right">
                  <p className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-400">Security Sync</p>
                  <p className="text-[10px] font-bold text-black">{isSyncing ? 'Syncing...' : lastSyncTime?.toLocaleTimeString() || '...'}</p>
               </div>
               <button onClick={handleLogout} className="w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-100 shadow-sm"><i className="fas fa-power-off text-sm"></i></button>
            </div>
            {/* Informational Menu */}
            <div className="flex justify-end gap-4 mt-3 pt-3 border-t border-slate-200/50">
               {['HOME', 'ABOUT', 'CONTACT', 'NEWS'].map((item) => (
                 <button 
                  key={item} 
                  onClick={() => setCurrentPortal(item as PortalType)}
                  className={`text-[9px] font-black uppercase tracking-widest transition-colors ${currentPortal === item ? 'text-green-600' : 'text-slate-400 hover:text-black'}`}
                 >
                   {item === 'ABOUT' ? 'About Us' : item === 'CONTACT' ? 'Contact Us' : item}
                 </button>
               ))}
            </div>
          </div>
        </div>
        <nav className="container mx-auto px-6 flex flex-wrap gap-3 mt-4 relative z-10">
          {availablePortals.map(p => {
            if (p === 'MARKET') {
              return (
                <div key={p} className="relative">
                  <button 
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setCurrentPortal('MARKET'); setIsMarketMenuOpen(!isMarketMenuOpen); }}
                    className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border flex items-center gap-2 ${currentPortal === 'MARKET' ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:text-black'}`}>
                    Market <i className={`fas fa-chevron-down opacity-50 ${isMarketMenuOpen ? 'rotate-180' : ''}`}></i>
                  </button>
                  {isMarketMenuOpen && (
                    <div className="absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 z-50">
                      <button type="button" onClick={() => { setCurrentPortal('MARKET'); setMarketView('SALES'); setIsMarketMenuOpen(false); }} className={`w-full text-left px-6 py-3 text-[10px] font-black uppercase ${marketView === 'SALES' && currentPortal === 'MARKET' ? 'text-green-600' : 'text-slate-500 hover:bg-slate-50'}`}>Sales Portal</button>
                      <button type="button" onClick={() => { setCurrentPortal('MARKET'); setMarketView('SUPPLIER'); setIsMarketMenuOpen(false); }} className={`w-full text-left px-6 py-3 text-[10px] font-black uppercase ${marketView === 'SUPPLIER' && currentPortal === 'MARKET' ? 'text-green-600' : 'text-slate-500 hover:bg-slate-50'}`}>Supplier Portal</button>
                    </div>
                  )}
                </div>
              );
            }
            return (
              <button 
                key={p} 
                onClick={() => { setCurrentPortal(p); setIsMarketMenuOpen(false); }}
                className={`px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${currentPortal === p ? 'bg-black text-white border-black shadow-lg' : 'bg-white text-slate-400 border-slate-100 hover:text-black'}`}
              >
                {p}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="container mx-auto px-6 -mt-8 relative z-20 space-y-12" onClick={() => setIsMarketMenuOpen(false)}>
        
        {/* HOME PORTAL */}
        {currentPortal === 'HOME' && (
          <div className="space-y-12 animate-in fade-in duration-500">
             <div className="bg-slate-900 text-white rounded-[3rem] p-12 lg:p-20 relative overflow-hidden shadow-2xl border border-black">
                <div className="absolute top-0 right-0 p-12 opacity-10"><i className="fas fa-seedling text-[12rem]"></i></div>
                <div className="relative z-10 max-w-2xl">
                   <p className="text-[10px] font-black uppercase tracking-[0.4em] text-red-600 mb-4">Central Hub Node</p>
                   <h2 className="text-4xl lg:text-6xl font-black uppercase tracking-tighter leading-[0.9] mb-8">Empowering <br/><span className="text-green-500">Local Agriculture</span> through technology.</h2>
                   <p className="text-slate-400 font-bold text-lg mb-10 leading-relaxed">Welcome back, {agentIdentity.name}. You are connected to the KPL Digital Network. Access market demand, track harvests, and manage cluster transactions with real-time audit integrity.</p>
                   <div className="flex gap-4">
                      <button onClick={() => setCurrentPortal('MARKET')} className="bg-white text-black px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-100 transition-all">Go to Market</button>
                      <button onClick={() => setCurrentPortal('NEWS')} className="border border-slate-700 text-white px-10 py-5 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-800 transition-all">Latest News</button>
                   </div>
                </div>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                   <div className="w-12 h-12 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-6 text-xl"><i className="fas fa-bolt"></i></div>
                   <h4 className="font-black uppercase text-sm mb-4">Market Trends</h4>
                   <p className="text-slate-500 text-xs font-bold leading-relaxed">View live price fluctuations across all clusters. Currently, Maize and Beans show high demand in Mariwa and Mulo.</p>
                </div>
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                   <div className="w-12 h-12 bg-green-50 text-green-600 rounded-2xl flex items-center justify-center mb-6 text-xl"><i className="fas fa-shield-alt"></i></div>
                   <h4 className="font-black uppercase text-sm mb-4">Audit Integrity</h4>
                   <p className="text-slate-500 text-xs font-bold leading-relaxed">Every transaction is hashed and signed. Our multi-layer validation ensures 100% financial transparency for the coop.</p>
                </div>
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-100 shadow-sm">
                   <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-6 text-xl"><i className="fas fa-users"></i></div>
                   <h4 className="font-black uppercase text-sm mb-4">Cluster Network</h4>
                   <p className="text-slate-500 text-xs font-bold leading-relaxed">Connecting 7 active clusters. Join community discussions and trade events hosted at our central hubs.</p>
                </div>
             </div>
          </div>
        )}

        {/* ABOUT US PORTAL */}
        {currentPortal === 'ABOUT' && (
          <div className="max-w-4xl mx-auto space-y-12 animate-in fade-in duration-500">
             <div className="text-center">
                <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Our Commitment</h2>
                <div className="w-20 h-1 bg-red-600 mx-auto rounded-full"></div>
             </div>
             <div className="bg-white p-12 lg:p-16 rounded-[3rem] shadow-xl border border-slate-100 leading-relaxed text-slate-600 font-bold">
                <p className="text-xl text-black font-black mb-8 italic">"Bridging the gap between rural harvest and urban demand through transparency and technology."</p>
                <p className="mb-6">KPL Food Coop Market is a community-driven agricultural hub dedicated to empowering local farmers and providing consumers with high-quality, traceable produce. Established as a response to market inefficiencies, we leverage digital tools to provide farmers with fair pricing and consumers with fresh commodities.</p>
                <p className="mb-8">Our platform serves as a central node for 7 regional clusters, managing everything from initial demand intake to final audit verification. By ensuring every sale is documented and verified, we build trust within our cooperative network.</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-12 pt-12 border-t border-slate-100">
                   <div>
                      <h4 className="text-black font-black uppercase text-xs mb-4 tracking-widest">Our Vision</h4>
                      <p className="text-sm">To be the leading digital marketplace for agricultural cooperatives in East Africa, setting the standard for traceability and farmer profitability.</p>
                   </div>
                   <div>
                      <h4 className="text-black font-black uppercase text-xs mb-4 tracking-widest">Our Mission</h4>
                      <p className="text-sm">To provide a robust, transparent, and efficient trade infrastructure that empowers small-scale producers through cluster-based logistical support.</p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {/* CONTACT US PORTAL */}
        {currentPortal === 'CONTACT' && (
          <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-12 animate-in fade-in duration-500">
             <div className="space-y-8">
                <div>
                   <h2 className="text-4xl font-black uppercase tracking-tighter mb-4">Get In Touch</h2>
                   <p className="text-slate-500 font-bold">Have questions about cluster registration or market orders? Our support team is here to help.</p>
                </div>
                <div className="bg-black text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden">
                   <div className="absolute -right-10 -bottom-10 opacity-10"><i className="fas fa-envelope text-9xl"></i></div>
                   <div className="space-y-6 relative z-10">
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Official Email</p>
                         <p className="text-lg font-black tracking-tight">info@kplfoocoopmarket.co.ke</p>
                      </div>
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Central Hub</p>
                         <p className="text-lg font-black tracking-tight">Mariwa Market Complex, Block A</p>
                      </div>
                      <div>
                         <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Operations</p>
                         <p className="text-lg font-black tracking-tight">Mon - Sat: 08:00 - 18:00</p>
                      </div>
                   </div>
                </div>
             </div>
             <div className="bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100">
                {isContactSent ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 animate-in zoom-in duration-300">
                     <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center text-2xl"><i className="fas fa-check"></i></div>
                     <h3 className="text-xl font-black uppercase">Message Sent!</h3>
                     <p className="text-slate-500 text-sm font-bold">We will get back to you within 24 hours.</p>
                  </div>
                ) : (
                  <form onSubmit={handleContactSubmit} className="space-y-5">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Your Name</label>
                       <input type="text" required value={contactForm.name} onChange={e => setContactForm({...contactForm, name: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none focus:bg-white focus:border-red-600 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Email Address</label>
                       <input type="email" required value={contactForm.email} onChange={e => setContactForm({...contactForm, email: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none focus:bg-white focus:border-red-600 transition-all" />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-2">Your Message</label>
                       <textarea rows={4} required value={contactForm.message} onChange={e => setContactForm({...contactForm, message: e.target.value})} className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-4 font-bold outline-none focus:bg-white focus:border-red-600 transition-all resize-none"></textarea>
                    </div>
                    <button className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[11px] tracking-widest py-5 rounded-2xl shadow-xl transition-all active:scale-95">Send Dispatch</button>
                  </form>
                )}
             </div>
          </div>
        )}

        {/* NEWS PORTAL */}
        {currentPortal === 'NEWS' && (
          <div className="space-y-8 animate-in fade-in duration-500">
             <div className="flex justify-between items-end mb-4 px-4">
                <h2 className="text-4xl font-black uppercase tracking-tighter">Cluster Bulletin</h2>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Updated Daily</p>
             </div>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-md group hover:shadow-xl transition-all cursor-pointer">
                   <div className="flex items-center gap-4 mb-6">
                      <span className="bg-red-50 text-red-600 px-3 py-1 rounded-full text-[9px] font-black uppercase">Update</span>
                      <span className="text-slate-400 text-[10px] font-bold">24 Oct 2024</span>
                   </div>
                   <h3 className="text-xl font-black uppercase mb-4 group-hover:text-red-600 transition-colors">New Cluster Added: Kabarnet joins the Network</h3>
                   <p className="text-slate-500 text-sm font-bold leading-relaxed mb-6">We are excited to welcome the Kabarnet farmers cluster to the KPL platform. This addition expands our network's capacity for honey and seasonal fruits by 15%.</p>
                   <button className="text-[10px] font-black uppercase tracking-widest border-b-2 border-black pb-1">Read Article</button>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-md group hover:shadow-xl transition-all cursor-pointer">
                   <div className="flex items-center gap-4 mb-6">
                      <span className="bg-green-50 text-green-600 px-3 py-1 rounded-full text-[9px] font-black uppercase">Market</span>
                      <span className="text-slate-400 text-[10px] font-bold">22 Oct 2024</span>
                   </div>
                   <h3 className="text-xl font-black uppercase mb-4 group-hover:text-green-600 transition-colors">Maize Price Stabilization Across Clusters</h3>
                   <p className="text-slate-500 text-sm font-bold leading-relaxed mb-6">Analysis from the last 7 days shows that Maize prices have stabilized at KSh 140 per 2kg tin across Mariwa and Mulo. Supply remains steady.</p>
                   <button className="text-[10px] font-black uppercase tracking-widest border-b-2 border-black pb-1">View Data</button>
                </div>
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-md group hover:shadow-xl transition-all cursor-pointer">
                   <div className="flex items-center gap-4 mb-6">
                      <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-full text-[9px] font-black uppercase">Award</span>
                      <span className="text-slate-400 text-[10px] font-bold">18 Oct 2024</span>
                   </div>
                   <h3 className="text-xl font-black uppercase mb-4 group-hover:text-blue-600 transition-colors">KPL Recognized for Agricultural Innovation</h3>
                   <p className="text-slate-500 text-sm font-bold leading-relaxed mb-6">The regional board has awarded KPL for our implementation of the digital audit registry, significantly reducing transaction friction for our agents.</p>
                   <button className="text-[10px] font-black uppercase tracking-widest border-b-2 border-black pb-1">Full Report</button>
                </div>
             </div>
          </div>
        )}

        {currentPortal === 'MARKET' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col sm:flex-row gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
                <button type="button" onClick={() => setMarketView('SALES')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${marketView === 'SALES' ? 'bg-black text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                    <i className="fas fa-shopping-cart"></i> Sales Portal
                </button>
                <button type="button" onClick={() => setMarketView('SUPPLIER')} className={`flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${marketView === 'SUPPLIER' ? 'bg-black text-white shadow-lg' : 'bg-slate-50 text-slate-400 hover:bg-slate-100'}`}>
                    <i className="fas fa-seedling"></i> Supplier Portal
                </button>
            </div>
            {marketView === 'SALES' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <StatCard label="Pending Payment" icon="fa-clock" value={`KSh ${stats.dueComm.toLocaleString()}`} color="bg-white" accent="text-red-600" />
                  <StatCard label="Processing" icon="fa-spinner" value={`KSh ${stats.awaitingFinanceComm.toLocaleString()}`} color="bg-white" accent="text-black" />
                  <StatCard label="Awaiting Audit" icon="fa-clipboard-check" value={`KSh ${stats.awaitingAuditComm.toLocaleString()}`} color="bg-white" accent="text-slate-500" />
                  <StatCard label="Verified Profit" icon="fa-check-circle" value={`KSh ${stats.approvedComm.toLocaleString()}`} color="bg-white" accent="text-green-600" />
                </div>
                <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 border border-black shadow-2xl relative overflow-hidden">
                   <div className="relative z-10">
                      <h3 className="text-sm font-black uppercase tracking-widest text-red-500 mb-6">Market Demand Intake</h3>
                      {agentIdentity.role !== SystemRole.SUPPLIER && (
                        <form onSubmit={handleAddOrder} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                          <select value={demandForm.cropType} onChange={e => setDemandForm({...demandForm, cropType: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none">
                               {Object.values(COMMODITY_CATEGORIES).flat().map(c => <option key={c} value={c}>{c}</option>)}
                          </select>
                          <div className="flex gap-2">
                              <input type="number" placeholder="Qty" value={demandForm.unitsRequested || ''} onChange={e => setDemandForm({...demandForm, unitsRequested: parseFloat(e.target.value) || 0})} className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none" />
                              <select value={demandForm.unitType} onChange={e => setDemandForm({...demandForm, unitType: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-[10px] font-black text-white outline-none">
                                 {CROP_CONFIG[demandForm.cropType as keyof typeof CROP_CONFIG]?.map(u => <option key={u} value={u}>{u}</option>) || <option value="Kg">Kg</option>}
                              </select>
                          </div>
                          <input type="text" placeholder="Buyer Name" value={demandForm.customerName} onChange={e => setDemandForm({...demandForm, customerName: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none" />
                          <input type="tel" placeholder="Buyer Phone" value={demandForm.customerPhone} onChange={e => setDemandForm({...demandForm, customerPhone: e.target.value})} className="bg-slate-800 border border-slate-700 rounded-xl p-3 text-xs font-bold text-white outline-none" />
                          <button type="submit" className="bg-red-600 hover:bg-red-700 text-white font-black uppercase text-[10px] py-4 rounded-xl shadow-lg transition-all active:scale-95">Log Demand</button>
                        </form>
                      )}
                   </div>
                   <div className="mt-10 overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="text-[9px] font-black text-slate-500 uppercase border-b border-slate-800">
                          <tr><th className="pb-4">Order ID</th><th className="pb-4">Consumer</th><th className="pb-4">Demand</th><th className="pb-4">Action</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800">
                           {filteredOrders.filter(o => o.status === OrderStatus.OPEN).map(o => (
                             <tr key={o.id} className="hover:bg-slate-800/50">
                               <td className="py-4 font-mono text-[10px] text-slate-500">{o.id}</td>
                               <td className="py-4"><p className="text-[11px] font-black uppercase">{o.customerName}</p></td>
                               <td className="py-4 text-[11px] font-black text-green-400">{o.cropType} ({o.unitsRequested})</td>
                               <td className="py-4">
                                  {agentIdentity.role !== SystemRole.SUPPLIER && (
                                    <button type="button" onClick={(e) => { e.stopPropagation(); handleFulfillOrderClick(o); }} className="bg-white text-black px-4 py-1.5 rounded-lg text-[9px] font-black uppercase hover:bg-slate-200 shadow-md">Fulfill</button>
                                  )}
                               </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                   </div>
                </div>
                {agentIdentity.role !== SystemRole.SUPPLIER && (
                  <SaleForm onSubmit={handleAddRecord} initialData={fulfillmentData} />
                )}
                <AuditLogTable 
                  data={isPrivilegedRole(agentIdentity) ? filteredRecords : filteredRecords.slice(0, 10)} 
                  title={isPrivilegedRole(agentIdentity) ? "System Universal Audit Log" : "Recent Integrity Logs"} 
                  onDelete={isSystemDev ? handleDeleteRecord : undefined} 
                />
              </>
            )}
            {marketView === 'SUPPLIER' && (
              <div className="space-y-12">
                {agentIdentity.role !== SystemRole.FINANCE_OFFICER && agentIdentity.role !== SystemRole.AUDITOR && (
                  <ProduceForm 
                    userRole={agentIdentity.role}
                    defaultSupplierName={agentIdentity.role === SystemRole.SUPPLIER ? agentIdentity.name : undefined}
                    defaultSupplierPhone={agentIdentity.role === SystemRole.SUPPLIER ? agentIdentity.phone : undefined}
                    onSubmit={handleAddProduce}
                  />
                )}
                <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden relative">
                   <h3 className="text-sm font-black text-black uppercase tracking-widest mb-8">Products Repository</h3>
                   <div className="overflow-x-auto">
                     <table className="w-full text-left">
                        <thead className="text-[10px] font-black text-slate-400 uppercase border-b pb-4">
                          <tr><th className="pb-4">Date</th><th className="pb-4">Supplier</th><th className="pb-4">Cluster</th><th className="pb-4">Commodity</th><th className="pb-4">Qty</th><th className="pb-4">Price</th><th className="pb-4 text-right">Action</th></tr>
                        </thead>
                        <tbody className="divide-y">
                           {produceListings.map(p => (
                             <tr key={p.id} className="hover:bg-slate-50/50">
                               <td className="py-6 text-[10px] font-bold text-slate-400">{p.date}</td>
                               <td className="py-6 text-[11px] font-black">{p.supplierName}</td>
                               <td className="py-6 text-[10px] font-bold uppercase">{p.cluster}</td>
                               <td className="py-6 text-[11px] font-black text-green-600 uppercase">{p.cropType}</td>
                               <td className="py-6 text-[11px] font-black">{p.unitsAvailable} {p.unitType}</td>
                               <td className="py-6 text-[11px] font-black">KSh {p.sellingPrice}</td>
                               <td className="py-6 text-right">
                                  <div className="flex items-center justify-end gap-3">
                                    {agentIdentity.role !== SystemRole.SUPPLIER && (
                                      <button type="button" onClick={() => handleUseProduceListing(p)} className="bg-black text-white px-4 py-2 rounded-xl text-[9px] font-black uppercase hover:bg-slate-800 shadow-md">Initiate Sale</button>
                                    )}
                                    {(isPrivilegedRole(agentIdentity) || (agentIdentity.role === SystemRole.SUPPLIER && normalizePhone(agentIdentity.phone) === normalizePhone(p.supplierPhone))) && (
                                      <button onClick={() => handleDeleteProduce(p.id)} className="text-red-400 p-2"><i className="fas fa-trash-alt"></i></button>
                                    )}
                                  </div>
                               </td>
                             </tr>
                           ))}
                        </tbody>
                     </table>
                   </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentPortal === 'FINANCE' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
               <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-red-600 pl-4">Awaiting Confirmation</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-xs font-bold">
                    <tbody className="divide-y">
                      {filteredRecords.filter(r => r.status === RecordStatus.DRAFT).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="py-6">{r.date}</td>
                          <td className="py-6 uppercase">{r.cropType}</td>
                          <td className="py-6 font-black">KSh {Number(r.totalSale).toLocaleString()}</td>
                          <td className="py-6 text-right">
                             <button onClick={() => handleUpdateStatus(r.id, RecordStatus.PAID)} className="bg-green-500 text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase">Confirm Payment</button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
            <AuditLogTable data={filteredRecords} title="Financial Audit Log" onDelete={isPrivilegedRole(agentIdentity) ? handleDeleteRecord : undefined} />
          </div>
        )}

        {currentPortal === 'AUDIT' && (
          <div className="space-y-8 animate-in fade-in duration-500">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl">
               <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-black pl-4">Verification Queue</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left text-xs font-bold">
                    <tbody className="divide-y">
                      {filteredRecords.filter(r => r.status === RecordStatus.PAID || r.status === RecordStatus.VALIDATED).map(r => (
                        <tr key={r.id} className="hover:bg-slate-50/50">
                          <td className="py-6">{r.cropType}</td>
                          <td className="py-6 font-black">KSh {Number(r.totalSale).toLocaleString()}</td>
                          <td className="py-6 text-right">
                             {r.status === RecordStatus.PAID ? (
                               <button onClick={() => handleUpdateStatus(r.id, RecordStatus.VALIDATED)} className="bg-black text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase">Verify</button>
                             ) : (
                               <button onClick={() => handleUpdateStatus(r.id, RecordStatus.VERIFIED)} className="bg-red-600 text-white px-6 py-2.5 rounded-xl text-[9px] font-black uppercase">Seal Audit</button>
                             )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
            <AuditLogTable data={filteredRecords} title="System Integrity Log" onDelete={isPrivilegedRole(agentIdentity) ? handleDeleteRecord : undefined} />
          </div>
        )}

        {currentPortal === 'BOARD' && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden">
               <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-10 border-l-4 border-green-500 pl-4">Cluster Summary Trade Report</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <thead className="text-[10px] font-black text-slate-400 uppercase border-b border-slate-50">
                      <tr><th className="pb-6">Cluster</th><th className="pb-6">Volume</th><th className="pb-6">Profit</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {boardMetrics.clusterPerformance.map(([cluster, stats]: any) => (
                        <tr key={cluster} className="hover:bg-slate-50/50">
                          <td className="py-6 font-black text-black uppercase text-[11px]">{cluster}</td>
                          <td className="py-6 font-black text-slate-900 text-[11px]">KSh {stats.volume.toLocaleString()}</td>
                          <td className="py-6 font-black text-green-600 text-[11px]">KSh {stats.profit.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}

        {currentPortal === 'SYSTEM' && isSystemDev && (
          <div className="space-y-12 animate-in fade-in duration-500">
            <div className="bg-slate-900 text-white rounded-[2.5rem] p-10 border border-black shadow-2xl relative overflow-hidden">
               <div className="relative z-10 flex flex-col md:flex-row justify-between items-center gap-8">
                  <div><h4 className="text-2xl font-black uppercase tracking-tight">Master Database Node</h4></div>
                  <div className="flex flex-wrap gap-4">
                    <a href={GOOGLE_SHEET_VIEW_URL} target="_blank" rel="noopener noreferrer" className="bg-green-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-xl flex items-center"><i className="fas fa-table mr-3"></i> Ledger</a>
                    <button onClick={() => { if(confirm("Purge ALL harvest data?")) deleteAllProduceFromCloud(); }} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-xl">Purge Produce</button>
                    <button onClick={() => { if(confirm("Purge ALL users?")) deleteAllUsersFromCloud(); }} className="bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase shadow-xl">Purge Users</button>
                  </div>
               </div>
            </div>
            <div className="bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-xl">
               <h3 className="text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-red-600 pl-4">Registered Agents</h3>
               <div className="overflow-x-auto">
                 <table className="w-full text-left">
                    <tbody className="divide-y">
                      {users.map(u => (
                        <tr key={u.phone} className="hover:bg-slate-50/50">
                          <td className="py-6"><p className="text-sm font-black uppercase text-black">{u.name}</p><p className="text-[10px] font-bold text-slate-400">{u.phone}</p></td>
                          <td className="py-6"><p className="text-[11px] font-black text-black uppercase">{u.role}</p><p className="text-[9px] text-slate-400 font-bold">{u.cluster}</p></td>
                          <td className="py-6 text-right">
                             <div className="flex items-center justify-end gap-3">
                                <button onClick={() => handleToggleUserStatus(u.phone, u.status as any)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase border ${u.status === 'ACTIVE' ? 'border-red-200 text-red-600' : 'bg-green-500 text-white'}`}>{u.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}</button>
                                <button onClick={() => handleDeleteUser(u.phone)} className="text-slate-300 hover:text-red-600 p-2"><i className="fas fa-trash-alt"></i></button>
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                 </table>
               </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;