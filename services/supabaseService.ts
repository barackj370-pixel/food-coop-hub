import { supabase } from './supabaseClient';
import { SaleRecord, AgentIdentity, MarketOrder, ProduceListing, ForumPost } from '../types';

const isClientReady = (): boolean => {
  if (!supabase) {
    console.warn("Supabase client not initialized.");
    return false;
  }
  return true;
};

// HELPER: Get current User ID
const getCurrentUserId = async (): Promise<string | undefined> => {
  const { data: { session } } = await supabase.auth.getSession();
  return session?.user?.id;
};

// HELPER: Error Handler
const handleSupabaseError = (context: string, err: any) => {
  const msg = (err.message || err.toString() || '').toLowerCase();
  
  // Ignore common network/fetch errors that might be transient or expected during reload
  if (
    msg.includes('failed to fetch') || 
    msg.includes('networkerror') || 
    msg.includes('network request failed') || 
    msg.includes('connection error') ||
    msg.includes('load failed') || 
    msg.includes('abort') || // Ignore AbortError
    msg.includes('signal is aborted')
  ) {
    return;
  }
  
  // Ignore specific PostgREST errors that are handled or expected
  // PGRST205: Schema cache issue / Missing column
  if (err.code !== 'PGRST205' && err.code !== '42P01') {
    console.error(`${context}:`, err);
  }
};

// HELPER: Map camelCase (Frontend) <-> snake_case (Backend)

const mapRecordToDb = (r: SaleRecord) => ({
  id: r.id,
  date: r.date,
  crop_type: r.cropType,
  unit_type: r.unitType,
  farmer_name: r.farmerName,
  farmer_phone: r.farmerPhone,
  customer_name: r.customerName,
  customer_phone: r.customerPhone,
  units_sold: r.unitsSold,
  unit_price: r.unitPrice,
  total_sale: r.totalSale,
  coop_profit: r.coopProfit,
  status: r.status,
  signature: r.signature,
  created_at: r.createdAt,
  agent_phone: r.agentPhone,
  agent_name: r.agentName,
  cluster: r.cluster,
  synced: r.synced,
  order_id: r.orderId,
  produce_id: r.produceId
});

const mapDbToRecord = (db: any): SaleRecord => ({
  id: db.id,
  date: db.date,
  cropType: db.crop_type || db.cropType,
  unitType: db.unit_type || db.unitType,
  farmerName: db.farmer_name || db.farmerName,
  farmerPhone: db.farmer_phone || db.farmerPhone,
  customerName: db.customer_name || db.customerName,
  customerPhone: db.customer_phone || db.customerPhone,
  unitsSold: Number(db.units_sold || db.unitsSold || 0),
  unitPrice: Number(db.unit_price || db.unitPrice || 0),
  totalSale: Number(db.total_sale || db.totalSale || 0),
  coopProfit: Number(db.coop_profit || db.coopProfit || 0),
  status: db.status,
  signature: db.signature,
  createdAt: db.created_at || db.createdAt || new Date().toISOString(),
  agentPhone: db.agent_phone || db.agentPhone,
  agentName: db.agent_name || db.agentName,
  cluster: db.cluster,
  synced: true,
  orderId: db.order_id || db.orderId,
  produceId: db.produce_id || db.produceId
});

/* SALE RECORDS */
export const saveRecord = async (record: SaleRecord): Promise<boolean> => {
  if (!isClientReady()) return false;
  try {
    const userId = await getCurrentUserId();
    
    const dbPayload = mapRecordToDb(record);
    const payload = { ...dbPayload, synced: true };
    
    if (userId) {
      (payload as any).agent_id = userId;
    }
    
    let { error } = await supabase.from('records').upsert(payload, { onConflict: 'id' });
    
    // Auto-fix for schema mismatch (missing columns like order_id, produce_id, agent_id)
    if (error && error.code === '42703') {
      console.warn("Schema mismatch in records. Retrying with safe payload.");
      const { order_id, produce_id, agent_id, ...safePayload } = payload as any;
      const retry = await supabase.from('records').upsert(safePayload, { onConflict: 'id' });
      error = retry.error;
    }

    // RETRY LOGIC: Foreign Key Violation (Profile Missing in DB)
    if (error && error.code === '23503' && userId) {
       console.log("Self-Healing: User profile missing in DB (FK Error). Recreating...");
       await supabase.from('profiles').upsert({
         id: userId,
         name: record.agentName || 'Unknown',
         phone: record.agentPhone || 'Unknown',
         role: 'Sales Agent', // Default fallback
         cluster: record.cluster || 'Unassigned',
         status: 'ACTIVE',
         created_at: new Date().toISOString()
       });
       
       // Always retry without agent_id to ensure the record is saved
       const { agent_id, ...safePayload } = payload as any;
       const retry = await supabase.from('records').upsert(safePayload, { onConflict: 'id' });
       error = retry.error;
    }

    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError('saveRecord', err);
    return false;
  }
};

export const fetchRecords = async (): Promise<SaleRecord[]> => {
  if (!isClientReady()) return [];
  try {
    const { data, error } = await supabase.from('records').select('*').order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapDbToRecord);
  } catch (err: any) {
    handleSupabaseError('fetchRecords', err);
    return [];
  }
};

export const deleteRecord = async (id: string): Promise<boolean> => {
  if (!isClientReady()) return false;
  try {
    const { error } = await supabase.from('records').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError('deleteRecord', err);
    return false;
  }
};

export const deleteAllRecords = async (): Promise<boolean> => {
  if (!isClientReady()) return false;
  try {
    const { error } = await supabase.from('records').delete().neq('id', '0');
    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError('deleteAllRecords', err);
    return false;
  }
};

/* USERS / PROFILES */
export const saveUser = async (user: AgentIdentity): Promise<boolean> => {
  if (!isClientReady()) return false;
  try {
    // Exclude 'email' as the column might be missing in older schemas
    const payload = {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      passcode: user.passcode,
      cluster: user.cluster,
      status: user.status,
      last_sign_in_at: user.lastSignInAt,
      provider: user.provider,
      created_at: user.createdAt
    };

    const { error } = await supabase.from('profiles').upsert(payload, { onConflict: 'phone' });
    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError('saveUser', err);
    return false;
  }
};

export const fetchUsers = async (): Promise<AgentIdentity[]> => {
  if (!isClientReady()) return [];
  try {
    const { data, error } = await supabase.from('profiles').select('*');
    if (error) throw error;
    return (data || []).map((u: any) => ({
      id: u.id,
      name: u.name,
      phone: u.phone,
      role: u.role,
      passcode: u.passcode,
      cluster: u.cluster,
      status: u.status,
      email: u.email,
      lastSignInAt: u.last_sign_in_at,
      provider: u.provider,
      createdAt: u.created_at
    }));
  } catch (err: any) {
    handleSupabaseError('fetchUsers', err);
    return [];
  }
};

export const deleteUser = async (phone: string): Promise<boolean> => {
  if (!isClientReady()) return false;
  try {
    const { error } = await supabase.from('profiles').delete().eq('phone', phone);
    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError('deleteUser', err);
    return false;
  }
};

export const deleteAllUsers = async (): Promise<boolean> => {
  if (!isClientReady()) return false;
  try {
    const { error } = await supabase.from('profiles').delete().neq('phone', '0');
    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError('deleteAllUsers', err);
    return false;
  }
};

/* MARKET ORDERS */
const mapOrderToDb = (o: MarketOrder) => ({
  id: o.id,
  date: o.date,
  crop_type: o.cropType,
  units_requested: o.unitsRequested,
  unit_type: o.unitType,
  customer_name: o.customerName,
  customer_phone: o.customerPhone,
  status: o.status,
  agent_phone: o.agentPhone,
  cluster: o.cluster
});

const mapDbToOrder = (db: any): MarketOrder => ({
  id: db.id,
  date: db.date,
  cropType: db.crop_type || db.cropType,
  unitsRequested: Number(db.units_requested || db.unitsRequested || 0),
  unitType: db.unit_type || db.unitType,
  customerName: db.customer_name || db.customerName,
  customerPhone: db.customer_phone || db.customerPhone,
  status: db.status,
  agentPhone: db.agent_phone || db.agentPhone,
  cluster: db.cluster,
  synced: true
});

export const saveOrder = async (order: MarketOrder): Promise<boolean> => {
  if (!isClientReady()) return false;
  try {
    const userId = await getCurrentUserId();
    const payload = mapOrderToDb(order);
    if (userId) {
      (payload as any).agent_id = userId;
    }
    let { error } = await supabase.from('orders').upsert(payload, { onConflict: 'id' });
    
    // Auto-fix for schema mismatch
    if (error && error.code === '42703') {
      console.warn("Schema mismatch in orders. Retrying with safe payload.");
      const { agent_id, ...safePayload } = payload as any;
      const retry = await supabase.from('orders').upsert(safePayload, { onConflict: 'id' });
      error = retry.error;
    }

    // RETRY LOGIC: Foreign Key Violation (Profile Missing in DB)
    if (error && error.code === '23503' && userId) {
       console.log("Self-Healing: User profile missing in DB (FK Error). Recreating...");
       await supabase.from('profiles').upsert({
         id: userId,
         name: order.customerName || 'Unknown',
         phone: order.customerPhone || 'Unknown',
         role: 'Sales Agent', // Default fallback
         cluster: order.cluster || 'Unassigned',
         status: 'ACTIVE',
         created_at: new Date().toISOString()
       });
       
       // Always retry without agent_id to ensure the record is saved
       const { agent_id, ...safePayload } = payload as any;
       const retry = await supabase.from('orders').upsert(safePayload, { onConflict: 'id' });
       error = retry.error;
    }

    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError('saveOrder', err);
    return false;
  }
};

export const fetchOrders = async (): Promise<MarketOrder[]> => {
  if (!isClientReady()) return [];
  try {
    const { data, error } = await supabase.from('orders').select('*').order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapDbToOrder);
  } catch (err: any) {
    handleSupabaseError('fetchOrders', err);
    return [];
  }
};

export const deleteAllOrders = async (): Promise<boolean> => {
  if (!isClientReady()) return false;
  try {
    const { error } = await supabase.from('orders').delete().neq('id', '0');
    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError('deleteAllOrders', err);
    return false;
  }
};

/* PRODUCE LISTINGS */
const mapProduceToDb = (p: ProduceListing) => ({
  id: p.id,
  date: p.date,
  crop_type: p.cropType,
  units_available: p.unitsAvailable,
  unit_type: p.unitType,
  selling_price: p.sellingPrice,
  supplier_name: p.supplierName,
  supplier_phone: p.supplierPhone,
  cluster: p.cluster,
  status: p.status,
  images: p.images ? JSON.stringify(p.images) : null
});

const mapDbToProduce = (db: any): ProduceListing => ({
  id: db.id,
  date: db.date,
  cropType: db.crop_type || db.cropType,
  unitsAvailable: Number(db.units_available || db.unitsAvailable || 0),
  unitType: db.unit_type || db.unitType,
  sellingPrice: Number(db.selling_price || db.sellingPrice || 0),
  supplierName: db.supplier_name || db.supplierName,
  supplierPhone: db.supplier_phone || db.supplierPhone,
  cluster: db.cluster,
  status: db.status,
  images: db.images ? JSON.parse(db.images) : [],
  synced: true
});

export const saveProduce = async (produce: ProduceListing): Promise<boolean> => {
  if (!isClientReady()) return false;
  try {
    const userId = await getCurrentUserId();
    const payload = mapProduceToDb(produce);
    if (userId) {
      (payload as any).agent_id = userId;
    }
    let { error } = await supabase.from('produce').upsert(payload, { onConflict: 'id' });
    
    // Auto-fix for schema mismatch (missing images or agent_id column in DB)
    const msg = error?.message?.toLowerCase() || '';
    if (error && (error.code === 'PGRST204' || error.code === '42703')) {
      console.warn("Schema mismatch detected in produce. Retrying with safe payload.");
      const { images, agent_id, ...safePayload } = payload as any;
      const retry = await supabase.from('produce').upsert(safePayload, { onConflict: 'id' });
      error = retry.error;
    }

    // RETRY LOGIC: Foreign Key Violation (Profile Missing in DB)
    if (error && error.code === '23503' && userId) {
       console.log("Self-Healing: User profile missing in DB (FK Error). Recreating...");
       await supabase.from('profiles').upsert({
         id: userId,
         name: produce.supplierName || 'Unknown',
         phone: produce.supplierPhone || 'Unknown',
         role: 'Supplier', // Default fallback
         cluster: produce.cluster || 'Unassigned',
         status: 'ACTIVE',
         created_at: new Date().toISOString()
       });
       
       // Always retry without agent_id to ensure the record is saved
       const { agent_id, ...safePayload } = payload as any;
       const retry = await supabase.from('produce').upsert(safePayload, { onConflict: 'id' });
       error = retry.error;
    }

    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError('saveProduce', err);
    return false;
  }
};

export const fetchProduce = async (): Promise<ProduceListing[]> => {
  if (!isClientReady()) return [];
  try {
    const { data, error } = await supabase.from('produce').select('*').order('date', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapDbToProduce);
  } catch (err: any) {
    handleSupabaseError('fetchProduce', err);
    return [];
  }
};

export const deleteProduce = async (id: string): Promise<boolean> => {
  if (!isClientReady()) return false;
  try {
    const { error } = await supabase.from('produce').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError('deleteProduce', err);
    return false;
  }
};

export const deleteAllProduce = async (): Promise<boolean> => {
  if (!isClientReady()) return false;
  try {
    const { error } = await supabase.from('produce').delete().neq('id', '0');
    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError('deleteAllProduce', err);
    return false;
  }
};

/* FORUM POSTS */
const mapDbToForumPost = (db: any): ForumPost => ({
  id: db.id,
  title: db.title,
  content: db.content,
  authorName: db.author_name,
  authorRole: db.author_role,
  authorCluster: db.author_cluster,
  authorPhone: db.author_phone,
  createdAt: db.created_at,
});

export const fetchForumPosts = async (): Promise<ForumPost[]> => {
  if (!isClientReady()) return [];
  try {
    const { data, error } = await supabase.from('forum_posts').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []).map(mapDbToForumPost);
  } catch (err: any) {
    // Suppress missing table error (42P01) and Schema Cache error (PGRST205) to avoid console noise
    if (err.code !== '42P01' && err.code !== 'PGRST205') handleSupabaseError('fetchForumPosts', err);
    return [];
  }
};

// Updated signature to return specific error message
export const saveForumPost = async (post: Omit<ForumPost, 'id' | 'createdAt'>): Promise<{ success: boolean; message?: string }> => {
  if (!isClientReady()) return { success: false, message: "System offline" };
  try {
    const userId = await getCurrentUserId();
    if (!userId) return { success: false, message: "Session expired. Please re-login." };

    // CLIENT-SIDE UUID: Generate ID here to avoid 'uuid-ossp' extension issues in DB
    const newId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : undefined;

    const payload = {
      id: newId, // If undefined, DB will use default (if configured)
      title: post.title,
      content: post.content,
      author_name: post.authorName,
      author_role: post.authorRole,
      author_cluster: post.authorCluster,
      author_phone: post.authorPhone,
      agent_id: userId
    };

    // ATTEMPT 1: Optimistic Insert (Fast Path)
    // We do NOT use .select() here to reduce response overhead on slow connections
    let { error } = await supabase.from('forum_posts').insert(payload);
    
    // RETRY LOGIC: Foreign Key Violation (Profile Missing in DB)
    // Code 23503: insert or update on table "forum_posts" violates foreign key constraint "forum_posts_agent_id_fkey"
    if (error && error.code === '23503') {
       console.log("Self-Healing: User profile missing in DB (FK Error). Recreating...");
       
       // Create Profile to fix FK
       const { error: healError } = await supabase.from('profiles').upsert({
         id: userId,
         name: post.authorName,
         phone: post.authorPhone,
         role: post.authorRole,
         cluster: post.authorCluster,
         status: 'ACTIVE',
         created_at: new Date().toISOString()
       });

       if (healError) {
         console.warn("Self-Healing failed:", healError.message);
         return { success: false, message: "Account profile missing. Please log out and back in." };
       }

       // ATTEMPT 2: Retry Insert after healing
       const retry = await supabase.from('forum_posts').insert(payload);
       error = retry.error;
    }

    if (error) {
       // Check for "Relation does not exist" (42P01) OR "Schema cache out of date" (PGRST205)
       if (error.code === '42P01' || error.code === 'PGRST205') {
          return { success: false, message: "Forum table missing. Please run the SQL setup script." };
       }
       // Check for RLS policy violation
       if (error.code === '42501') {
          return { success: false, message: "Permission denied. You are not authorized to post." };
       }
       throw error;
    }
    return { success: true };
  } catch (err: any) {
    handleSupabaseError('saveForumPost', err);
    return { success: false, message: err.message || "Database Error" };
  }
};

export const deleteForumPost = async (id: string): Promise<boolean> => {
  if (!isClientReady()) return false;
  try {
    const { error } = await supabase.from('forum_posts').delete().eq('id', id);
    if (error) throw error;
    return true;
  } catch (err: any) {
    handleSupabaseError('deleteForumPost', err);
    return false;
  }
};
