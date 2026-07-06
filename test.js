import { Fragment, jsx, jsxs } from "react/jsx-runtime";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { RecordStatus, OrderStatus, SystemRole, isSuperAgent } from "./types";
import SaleForm from "./components/SaleForm";
import ProduceForm from "./components/ProduceForm";
import WeatherWidget from "./components/WeatherWidget";
import WeatherCarousel from "./components/WeatherCarousel";
import AvailableProducts from "./components/AvailableProducts";
import ProductsPage from "./components/ProductsPage";
import OrderModal from "./components/OrderModal";
import HeroCarousel from "./components/HeroCarousel";
import AuditLogTable from "./components/AuditLogTable";
import CreateNewsForm from "./components/CreateNewsForm";
import AboutUsCarousel from "./components/AboutUsCarousel";
import AboutUsPage from "./components/AboutUsPage";
import { Leaderboard } from "./components/Leaderboard";
import LoginPage from "./page/LoginPage";
import AdminInvite from "./page/AdminInvite";
import PublicSupplierStats from "./components/PublicSupplierStats";
import Forum from "./components/Forum";
import FarmForms from "./components/FarmForms";
import FarmDataMap from "./components/FarmDataMap";
import FarmerDashboard from "./components/FarmerDashboard";
import HomesteadRegistration from "./components/HomesteadRegistration";
import TableBanking from "./components/TableBanking";
import PhysicalVoucherGenerator from "./components/PhysicalVoucherGenerator";
import { PROFIT_MARGIN, SYNC_POLLING_INTERVAL, TEN_PERCENT_COOPS, FOOD_COOPS } from "./constants";
import { supabase } from "./services/supabaseClient";
import { analyzeSalesData } from "./services/geminiService";
import { updateClusterCoordinates } from "./services/weatherService";
import {
  fetchRecords,
  saveRecord,
  deleteRecord,
  deleteAllRecords,
  fetchUsers,
  saveUser,
  deleteUser,
  deleteAllUsers,
  fetchOrders,
  saveOrder,
  deleteOrder,
  deleteAllOrders,
  fetchProduce,
  saveProduce,
  deleteProduce,
  deleteAllProduce,
  fetchForumPosts,
  saveNewsArticle,
  fetchNewsArticles
} from "./services/supabaseService";
import { getEnv } from "./services/env";
const APP_LOGO = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 512 512'%3E%3Cpath fill='none' stroke='%23000000' stroke-width='30' stroke-linecap='round' stroke-linejoin='round' d='M64 96h64l48 240h256l48-176H192'/%3E%3Ccircle fill='%23dc2626' cx='208' cy='432' r='40'/%3E%3Ccircle fill='%23000000' cx='208' cy='432' r='16'/%3E%3Ccircle fill='%23dc2626' cx='384' cy='432' r='40'/%3E%3Ccircle fill='%23000000' cx='384' cy='432' r='16'/%3E%3Cpath fill='%2316a34a' d='M256 128c0-50-40-90-90-90s-60 40-40 90c20 40 60 70 130 50z'/%3E%3Cpath fill='%2322c55e' d='M256 128c0-50 40-90 90-90s60 40 40 90c-20 40-60 70-130 50z'/%3E%3Ccircle fill='%23dc2626' cx='256' cy='224' r='48'/%3E%3Cpath fill='none' stroke='%23000000' stroke-width='8' stroke-linecap='round' d='M256 176v48'/%3E%3C/svg%3E";
const APP_VERSION = "1.2.5";
const persistence = {
  get: (key) => {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  set: (key, val) => {
    try {
      localStorage.setItem(key, val);
    } catch (e) {
    }
  },
  remove: (key) => {
    try {
      localStorage.removeItem(key);
    } catch (e) {
    }
  },
  clear: () => {
    try {
      localStorage.clear();
    } catch (e) {
    }
  }
};
const normalizePhone = (p) => {
  let s = String(p || "").trim();
  if (s.includes(".")) s = s.split(".")[0];
  const clean = s.replace(/\D/g, "");
  return clean.length >= 9 ? clean.slice(-9) : clean;
};
const computeHash = async (record) => {
  const normalizedUnits = Number(record.unitsSold).toString();
  const normalizedPrice = Number(record.unitPrice).toString();
  const pid = record.produceId || "null";
  const oid = record.orderId || "null";
  const msg = `${record.id || ""}|${record.date}|${normalizedUnits}|${normalizedPrice}|${pid}|${oid}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(msg);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").substring(0, 12);
};
const mergeData = (cloudItems, localItems) => {
  const cloudMap = new Map(cloudItems.map((i) => [i.id, i]));
  const merged = [...cloudItems];
  localItems.forEach((localItem) => {
    if (!cloudMap.has(localItem.id)) {
      merged.push(localItem);
    } else if (localItem.synced === false) {
      const index = merged.findIndex((i) => i.id === localItem.id);
      if (index !== -1) {
        merged[index] = localItem;
      }
    } else {
      const index = merged.findIndex((i) => i.id === localItem.id);
      if (index !== -1) {
        if (localItem.buyingPrice !== void 0 && (!merged[index].buyingPrice || merged[index].buyingPrice === 0)) {
          merged[index].buyingPrice = localItem.buyingPrice;
        }
        if (localItem.isAggregate === true && !merged[index].isAggregate) {
          merged[index].isAggregate = localItem.isAggregate;
        }
      }
    }
  });
  return merged.sort((a, b) => {
    const dateA = a.date || a.createdAt || "";
    const dateB = b.date || b.createdAt || "";
    return dateB.localeCompare(dateA);
  });
};
const INITIAL_NEWS_ARTICLES = [
  {
    id: "news-005",
    category: "Cooperative Movement",
    title: "Rabolo Food Cooperative Market and School",
    summary: "The Rabolo Food Cooperative is redefining how smallholder farmers and consumers connect by blending a streamlined digital ordering system with an integrated educational program.",
    content: `
      <p>The Rabolo Food Cooperative is redefining how smallholder farmers and consumers connect. By blending a streamlined digital ordering system with an integrated educational program, the cooperative is building a sustainable future.</p>
      <p>By establishing a direct link between smallholder producers and consumers, the cooperative is ensuring that fresh, local food is more accessible than ever before.</p>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">A Direct Link to the Local Market</h4>
      <p>The heartbeat of the Rabolo initiative is its weekly market, held every Sunday. The primary objective is to "capture the local market," creating a streamlined pipeline that bypasses unnecessary intermediaries to connect the person who grows the food directly with the person who eats it.</p>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">The Digital Market Hub: Efficiency by Design</h4>
      <p>The cooperative has recently moved away from labor-intensive manual processes toward a streamlined digital system. This shift has significantly reduced paperwork and simplified the calculation of profit margins.</p>
      <p>The market operates on a precise, order-based model to curb time wastage:</p>
      <ul class="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Advance Ordering:</strong> Three days before the Sunday market, members enter their orders into the KPL digital market hub.</li>
        <li><strong>Early Logistics:</strong> This lead time allows commodities to arrive early at the market site for organized packing.</li>
        <li><strong>Committee Oversight:</strong> Two hours before the market opens, the Food Coop Committee meets to confirm all supplies and begin the physical packing of orders.</li>
        <li><strong>Pure Order Picking:</strong> Because the administrative work is done via the portal, the physical market is dedicated strictly to efficient "order picking".</li>
      </ul>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">Financial Sustainability and Governance</h4>
      <p>The cooperative follows a transparent financial model guided by total sales. A 10% portion of total sales is channeled to a national treasury. This 10% is then distributed as follows:</p>
      <ul class="list-disc pl-5 mb-4 space-y-2">
        <li>60% is retained by the Rabolo Food Cooperative to fund local operations.</li>
        <li>40% remains with the national treasury.</li>
      </ul>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">The Rabolo Food Coop School</h4>
      <p>The cooperative's impact extends beyond commerce through its self-driven school. Immediately following the order-picking session, members engage in educational workshops to build the technical and leadership skills necessary for long-term success. Topics tackled include:</p>
      <ul class="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Order and Supply:</strong> Managing the flow of goods.</li>
        <li><strong>Committee Roles:</strong> Understanding the leadership structure and responsibilities within the coop.</li>
        <li><strong>Digital Data Entry:</strong> Ensuring all members are proficient in using the digital portal.</li>
      </ul>
    `,
    author: "Admin Desk",
    role: "Coop HQ",
    date: "Feb 28, 2026",
    image: "https://drive.google.com/thumbnail?id=1S7iSFoE_3cujLSL25ItheSEZMwrFpM7V&sz=w1000"
  },
  {
    id: "news-004",
    category: "Cooperative Movement",
    title: "The Rise of Kenya Peasant League Food Cooperatives",
    summary: "Within the Kenya Peasant League (KPL) movement, seven functional food cooperatives are spearheading a revolution in how smallholder produce reaches the plate.",
    content: `
      <p>Within the Kenya Peasant League (KPL) movement, seven functional food cooperatives\u2014Mulo, Mariwa, Rabolo, Kangemi, Kabarnet, Apuoyo, Sibembe, and Nyamagagana\u2014are spearheading a revolution in how smallholder produce reaches the plate. By integrating market logistics with grassroots education, these cooperatives are reclaiming the value chain from traditional intermediaries.</p>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">Direct Links and Market Objectives</h4>
      <p>The core mission of these cooperatives is to capture local markets. Historically, smallholder farmers have lost significant portions of their income to middlemen. The KPL cooperatives eliminate these third parties, creating a direct link between the producer and the consumer. This ensures that farmers receive a fair price while consumers access fresh, high-quality commodities.</p>
      <p>Each cooperative is guided by a committee of five dedicated individuals who oversee daily operations to ensure the market remains clean, transparent, and streamlined.</p>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">The Digital Market Hub: Efficiency Through Data</h4>
      <p>To manage the complexities of modern trade, the cooperatives have moved away from manual systems in favor of a digital portal system. This technological shift has yielded several key benefits:</p>
      <ul class="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Reduced Paperwork:</strong> The digital system automates record-keeping, allowing for more time spent on community growth.</li>
        <li><strong>Profit Accuracy:</strong> The portal simplifies the calculation of the 10% profit margin on total sales.</li>
        <li><strong>Sales Agent Integration:</strong> Each cluster school has a designated sales agent responsible for ensuring all orders and supplies are entered accurately into the portal.</li>
      </ul>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">The Order-Based Model</h4>
      <p>Efficiency is maintained through a strict "order-only" format. Recognizing that food is a universal necessity, members are encouraged to place their orders three days prior to the actual market day. This window allows the cooperative to coordinate logistics, ensuring that all ordered commodities reach the market in time for efficient packing and distribution.</p>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">Strategic Pricing and Value</h4>
      <p>Setting a fair price requires a deep understanding of the broader economy. The cooperative committees actively monitor weekly market trends. By confirming prevailing prices at the farm gate, wholesale, and retail levels across both local and terrestrial markets, they can:</p>
      <ol class="list-decimal pl-5 mb-4 space-y-2">
        <li>Establish standardized pricing for all commodities.</li>
        <li>Identify and react to price fluctuations in the wider market.</li>
      </ol>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">A Self-Driven School for Sustainable Growth</h4>
      <p>The cooperative's work does not end with a sale. Following the weekly market, the cooperatives transition into self-driven schools. These educational sessions cover varying topics designed to empower members with the technical and leadership skills needed to sustain the movement.</p>
      <p>Through this blend of digital innovation, strategic pricing, and continuous learning, the KPL food cooperatives are not just selling food\u2014they are building a resilient, farmer-led future.</p>
    `,
    author: "Admin Desk",
    role: "Coop HQ",
    date: "Feb 28, 2026",
    image: "https://drive.google.com/thumbnail?id=1s8X_bpqYlrOJ4MTIlNRzNI7BV0vRuBZG&sz=w1000"
  },
  {
    id: "news-003",
    category: "Sustainable Farming",
    title: "The Kenyan Peasant League\u2019s Composting Initiative",
    summary: "To strengthen local food cooperatives and ensure maximum agricultural production, the KPL has launched a strategic composting initiative.",
    content: `
      <p>To strengthen local food cooperatives and ensure maximum agricultural production, the Kenyan Peasant League (KPL) has launched a strategic composting initiative. This program is designed to build soil health and increase manure production by transforming common homestead waste into valuable organic resources, ultimately driving the community toward total food sovereignty.</p>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">A Hands-On Approach to Waste Management</h4>
      <p>The initiative is rooted in direct community engagement through homestead visits. During these visits, members undergo practical training that begins with a joint identification of the various types of waste generated within the home. Participants are then taught how this waste is currently managed and, more importantly, how it should be managed to benefit the farm.</p>
      <br/>
      <p>The core strategy revolves around systematic sorting to ensure every material is directed to its most productive use:</p>
      <ul class="list-disc pl-5 mb-4 space-y-2">
        <li><strong>Sink Composting:</strong> A dedicated "square sink" (typically 4 x 4 x 2 feet) is used for all animal remains and kitchen waste, including both raw and cooked food.</li>
        <li><strong>Open Composting:</strong> Dry leaves and other bulky leafy materials are diverted to larger open composting squares, often 10 x 10 feet, depending on the space available at the homestead.</li>
        <li><strong>Metal Recovery:</strong> Specific collection points are established for metal objects, which are later repurposed or sold to scrap dealers to generate supplemental income.</li>
        <li><strong>Plastic Management:</strong> Plastic waste is collected separately; some items are recycled for use on the farm, while others are sold as an additional source of homestead income.</li>
      </ul>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">Regional Impact and Reach</h4>
      <p>This initiative was successfully rolled out across the Southwestern region, specifically targeting four key food cooperative clusters:</p>
      <ul class="list-disc pl-5 mb-4">
        <li>Rabolo</li>
        <li>Mulo</li>
        <li>Mariwa</li>
        <li>Nyamagagana</li>
      </ul>
      <p>In total, 20 homesteads across these clusters were selected to lead the way in these improved waste management and soil-building practices. By turning "waste" into wealth, the KPL is ensuring that the foundation of their food system\u2014the soil\u2014remains fertile and productive for generations to come.</p>
    `,
    author: "Admin Desk",
    role: "Coop HQ",
    date: "Feb 27, 2026",
    image: "https://drive.google.com/thumbnail?id=1UD0M5Nh1BnsKiiTmbtq3S3WGC77AILrP&sz=w1000"
  },
  {
    id: "news-001",
    category: "Sustainable Farming",
    title: "Organic Fertilizer Training: Mulo & Rabolo",
    summary: "Specialists led by Director David Otieno and Manager Clifford Ochieng are touring clusters to educate farmers on organic fertilizer. Mulo visited, Rabolo next.",
    content: `
      <p>Trained specialists from the KPL Food Coop are currently touring all clusters to educate farmers on the preparation and application of organic fertilizer. This initiative aims to reduce input costs and improve soil health across the cooperative.</p>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">Mulo Food Coop Covered</h4>
      <p>We have successfully covered the <strong>Mulo Food Coop</strong>, which was the first stop on this educational tour. Farmers in Mulo participated actively and have started implementing organic compost techniques.</p>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">Next Stop: Rabolo Food Coop</h4>
      <p>The next visit, scheduled for next week, will be to the <strong>Rabolo Food Coop in Ranen</strong>. Farmers in this region are encouraged to attend to learn vital organic farming skills.</p>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">Leadership Support</h4>
      <p>The training team is led by the <strong>Director of Food Coop, David Otieno</strong>, and <strong>Manager Clifford Ochieng</strong>, demonstrating the cooperative's commitment to hands-on support for our farming community.</p>
    `,
    author: "Admin Desk",
    role: "Coop HQ",
    date: "Feb 12, 2026",
    // Image updated: Heap of dry leaves/organic waste for compost
    image: "https://images.unsplash.com/photo-1508500207392-7efc9076e0d3?auto=format&fit=crop&q=80&w=1000"
  },
  {
    id: "news-002",
    category: "Digital Innovation",
    title: "Digital Department & Platform Launch",
    summary: "Barack James, Head of Digital Innovations, tours the 7 clusters to unveil the new sales platform launching Feb 17th and the upcoming weather portal.",
    content: `
      <p>We are excited to announce the establishment of the <strong>Digital Innovation Department</strong>, headed by <strong>Barack James</strong>. This department is pivotal in modernizing our cooperative's operations.</p>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">Food Coop Tour & Platform Launch</h4>
      <p>Barack James is currently visiting all 7 clusters to introduce the new <strong>Food Coop Digital Platform</strong>. This state-of-the-art system is expected to be fully functional and live by <strong>February 17th</strong>. It will streamline operations, improve record-keeping transparency, and facilitate faster transactions.</p>
      <br/>
      <h4 class="text-lg font-bold text-black mb-2">Upcoming: Local Weather Portal</h4>
      <p>In addition to the sales platform, the Digital Innovations Department is tasked with developing a <strong>Local Weather Portal</strong>. This tool will provide hyper-local climate data to assist farmers in planning their production cycles effectively.</p>
    `,
    author: "Barack James",
    role: "Head of Digital Innovations",
    date: "Feb 12, 2026",
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?auto=format&fit=crop&q=80&w=1000"
  }
];
const MOCK_MISSING_RECORDS = [
  {
    id: "mock-missing-1",
    date: "2026-01-31",
    cropType: "Tomatoes",
    unitType: "Box",
    farmerName: "Food Coop",
    farmerPhone: "COOP-INTERNAL",
    customerName: "John Nyarienga",
    customerPhone: "0115371350",
    unitsSold: 2,
    unitPrice: 100,
    totalSale: 200,
    coopProfit: 20,
    status: RecordStatus.DRAFT,
    signature: "",
    createdAt: "2026-01-31T10:00:00.000Z",
    agentPhone: "0700043146",
    agentName: "Melanie Atieno",
    cluster: "Kangemi"
  },
  {
    id: "mock-missing-2",
    date: "2026-01-31",
    cropType: "Tomatoes",
    unitType: "Box",
    farmerName: "Food Coop",
    farmerPhone: "COOP-INTERNAL",
    customerName: "Judith Awori",
    customerPhone: "0799727980",
    unitsSold: 2,
    unitPrice: 100,
    totalSale: 200,
    coopProfit: 20,
    status: RecordStatus.DRAFT,
    signature: "",
    createdAt: "2026-01-31T10:05:00.000Z",
    agentPhone: "0700043146",
    agentName: "Melanie Atieno",
    cluster: "Kangemi"
  },
  {
    id: "mock-missing-3",
    date: "2026-01-31",
    cropType: "Onions",
    unitType: "Bag",
    farmerName: "Food coop",
    farmerPhone: "0759630461",
    customerName: "Judith Awori",
    customerPhone: "0799727980",
    unitsSold: 1,
    unitPrice: 22,
    totalSale: 22,
    coopProfit: 2.2,
    status: RecordStatus.DRAFT,
    signature: "",
    createdAt: "2026-01-31T10:10:00.000Z",
    agentPhone: "0700043146",
    agentName: "Melanie Atieno",
    cluster: "Kangemi"
  },
  {
    id: "mock-missing-4",
    date: "2026-01-31",
    cropType: "Onions",
    unitType: "Bag",
    farmerName: "Food coop",
    farmerPhone: "0759630461",
    customerName: "Catherine",
    customerPhone: "0717826150",
    unitsSold: 1,
    unitPrice: 22,
    totalSale: 22,
    coopProfit: 2.2,
    status: RecordStatus.DRAFT,
    signature: "",
    createdAt: "2026-01-31T10:15:00.000Z",
    agentPhone: "0700043146",
    agentName: "Melanie Atieno",
    cluster: "Kangemi"
  },
  {
    id: "mock-missing-5",
    date: "2026-01-30",
    cropType: "Fish",
    unitType: "Piece",
    farmerName: "Susan Owiti",
    farmerPhone: "0705518192",
    customerName: "Imaculate awino",
    customerPhone: "0712153732",
    unitsSold: 1,
    unitPrice: 330,
    totalSale: 330,
    coopProfit: 33,
    status: RecordStatus.DRAFT,
    signature: "",
    createdAt: "2026-01-30T10:00:00.000Z",
    agentPhone: "0700043146",
    agentName: "Melanie Atieno",
    cluster: "Kangemi"
  },
  {
    id: "mock-missing-6",
    date: "2026-01-30",
    cropType: "Tomatoes (nyanya)",
    unitType: "Bag",
    farmerName: "Food Coop",
    farmerPhone: "COOP-INTERNAL",
    customerName: "Susan owiti",
    customerPhone: "0705518192",
    unitsSold: 1,
    unitPrice: 100,
    totalSale: 100,
    coopProfit: 10,
    status: RecordStatus.DRAFT,
    signature: "",
    createdAt: "2026-01-30T10:05:00.000Z",
    agentPhone: "0700043146",
    agentName: "Melanie Atieno",
    cluster: "Kangemi"
  }
];
const App = () => {
  const [records, setRecords] = useState(() => {
    const saved = persistence.get("food_coop_data");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed;
        }
        return [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [marketOrders, setMarketOrders] = useState(() => {
    const saved = persistence.get("food_coop_orders");
    if (saved) {
      try {
        return Array.isArray(JSON.parse(saved)) ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [produceListings, setProduceListings] = useState(() => {
    const saved = persistence.get("food_coop_produce");
    if (saved) {
      try {
        return Array.isArray(JSON.parse(saved)) ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [forumPosts, setForumPosts] = useState(() => {
    const saved = persistence.get("food_coop_forum_posts");
    if (saved) {
      try {
        return Array.isArray(JSON.parse(saved)) ? JSON.parse(saved) : [];
      } catch (e) {
        return [];
      }
    }
    return [];
  });
  const [lastReadForumPost, setLastReadForumPost] = useState(() => {
    return persistence.get("last_read_forum_post") || "";
  });
  const [deletedProduceIds, setDeletedProduceIds] = useState(() => {
    const saved = persistence.get("deleted_produce_blacklist");
    return saved ? JSON.parse(saved) : [];
  });
  const [newsArticles, setNewsArticles] = useState(() => {
    const saved = persistence.get("food_coop_news");
    if (saved) {
      try {
        return Array.isArray(JSON.parse(saved)) ? JSON.parse(saved) : INITIAL_NEWS_ARTICLES;
      } catch (e) {
        return INITIAL_NEWS_ARTICLES;
      }
    }
    return INITIAL_NEWS_ARTICLES;
  });
  const [users, setUsers] = useState([]);
  const [customFoodCoops, setCustomFoodCoops] = useState([]);
  const [customCoordinates, setCustomCoordinates] = useState({});
  const [farmFormsData, setFarmFormsData] = useState([]);
  const [addCoopStatus, setAddCoopStatus] = useState({ status: "idle" });
  const loadFarmRecords = useCallback(async () => {
    try {
      const { data: baselines } = await supabase.from("farm_baselines").select("*");
      const { data: logs } = await supabase.from("farm_activity_logs").select("*");
      const { data: pageForms } = await supabase.from("pages").select("*").like("title", "FarmForm_%");
      const allFarmRecords = [];
      if (pageForms) {
        pageForms.forEach((p) => {
          try {
            const parsedContent = JSON.parse(p.content);
            allFarmRecords.push({
              ...parsedContent,
              id: p.id,
              dbRowId: p.id,
              formType: parsedContent.formType,
              farmerPhone: parsedContent.farmerPhone || parsedContent.homesteadContact || parsedContent.productionOfficerContact || "",
              farmId: p.id,
              submittedAt: parsedContent.submittedAt || p.created_at,
              fromPages: true
            });
          } catch (e) {
            console.warn("Failed to parse form content", e);
          }
        });
      }
      if (baselines) {
        baselines.forEach((b) => {
          allFarmRecords.push({
            ...b,
            id: b.id,
            farmerPhone: b.farmer_phone,
            farmName: b.farm_name,
            formType: "homestead",
            submittedAt: b.verified_at,
            agentCluster: b.cluster,
            location: { lat: b.latitude, lng: b.longitude },
            gpsVerified: true
          });
        });
      }
      if (logs) {
        logs.forEach((l) => {
          allFarmRecords.push({
            ...l.data,
            id: l.id,
            formType: l.form_type,
            farmerPhone: l.farmer_phone,
            farmId: l.farm_id,
            submittedAt: l.data.submittedAt || l.submitted_at
          });
        });
      }
      setFarmFormsData(allFarmRecords.sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()));
    } catch (e) {
      console.error("Failed to fetch farm forms manually:", e);
    }
  }, []);
  useEffect(() => {
    const fetchCustomData = async () => {
      const { data: coopsData } = await supabase.from("pages").select("content").eq("id", "system_food_coops").single();
      if (coopsData && coopsData.content) {
        try {
          setCustomFoodCoops(JSON.parse(coopsData.content));
        } catch (e) {
        }
      }
      const { data: coordsData } = await supabase.from("pages").select("content").eq("id", "system_food_coop_coords").single();
      if (coordsData && coordsData.content) {
        try {
          const parsed = JSON.parse(coordsData.content);
          setCustomCoordinates(parsed);
          updateClusterCoordinates(parsed);
        } catch (e) {
        }
      }
      await loadFarmRecords();
    };
    fetchCustomData();
  }, [loadFarmRecords]);
  const [agentIdentity, setAgentIdentity] = useState(() => {
    const saved = persistence.get("agent_session");
    return saved ? JSON.parse(saved) : null;
  });
  const combinedUsers = useMemo(() => {
    const allUsers = [...users];
    const existingPhones = new Set(users.map((u) => normalizePhone(u.phone)));
    records.forEach((r) => {
      const phone = normalizePhone(r.farmerPhone);
      if (phone && !existingPhones.has(phone)) {
        existingPhones.add(phone);
        allUsers.push({
          id: `supplier-${phone}`,
          name: r.farmerName || "Unknown Supplier",
          phone: r.farmerPhone,
          role: SystemRole.SUPPLIER,
          cluster: r.cluster,
          status: "ACTIVE",
          createdAt: r.createdAt || r.date
        });
      }
    });
    produceListings.forEach((p) => {
      const phone = normalizePhone(p.supplierPhone);
      if (phone && !existingPhones.has(phone)) {
        existingPhones.add(phone);
        allUsers.push({
          id: `supplier-${phone}`,
          name: p.supplierName || "Unknown Supplier",
          phone: p.supplierPhone,
          role: SystemRole.SUPPLIER,
          cluster: p.cluster,
          status: "ACTIVE",
          createdAt: p.date
        });
      }
    });
    return allUsers;
  }, [users, records, produceListings]);
  const [currentPortal, setCurrentPortal] = useState(() => {
    let path = window.location.pathname.split("/")[1] || "";
    if (!path) return "HOME";
    path = path.toUpperCase();
    const validPortals = ["MARKET", "FINANCE", "AUDIT", "BOARD", "SYSTEM", "HOME", "ABOUT", "CONTACT", "LOGIN", "NEWS", "INVITE", "FORUM", "WEATHER", "PRODUCTS", "FORMS", "FARM_DATA", "MY_FARM", "HOMESTEAD", "TABLE_BANKING", "VOUCHERS"];
    return validPortals.includes(path) ? path : "HOME";
  });
  useEffect(() => {
    const handlePopState = () => {
      let path = window.location.pathname.split("/")[1] || "";
      if (!path) {
        setCurrentPortal("HOME");
        return;
      }
      path = path.toUpperCase();
      const validPortals = ["MARKET", "FINANCE", "AUDIT", "BOARD", "SYSTEM", "HOME", "ABOUT", "CONTACT", "LOGIN", "NEWS", "INVITE", "FORUM", "WEATHER", "PRODUCTS", "FORMS", "FARM_DATA", "MY_FARM", "HOMESTEAD", "TABLE_BANKING", "VOUCHERS"];
      if (validPortals.includes(path)) {
        setCurrentPortal(path);
      } else {
        setCurrentPortal("HOME");
      }
    };
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);
  useEffect(() => {
    let newSearch = window.location.search;
    if (currentPortal !== "LOGIN" && newSearch.includes("mode=register")) {
      newSearch = "";
    }
    const expectedPath = currentPortal === "HOME" ? "/" : `/${currentPortal.toLowerCase()}`;
    if (window.location.pathname !== expectedPath || window.location.search !== newSearch) {
      window.history.pushState(null, "", expectedPath + newSearch);
    }
  }, [currentPortal]);
  useEffect(() => {
    if (currentPortal === "FORUM" && forumPosts.length > 0) {
      const latestPostId = forumPosts[0].id;
      if (latestPostId !== lastReadForumPost) {
        setLastReadForumPost(latestPostId);
        persistence.set("last_read_forum_post", latestPostId);
      }
    }
  }, [currentPortal, forumPosts, lastReadForumPost]);
  useEffect(() => {
    const hasSeededMissingOrders = persistence.get("seeded_missing_orders_v3");
    if (!hasSeededMissingOrders) {
      setRecords((prev) => {
        const newRecords = [...MOCK_MISSING_RECORDS, ...prev.filter((r) => !r.id.startsWith("mock-missing-"))];
        persistence.set("food_coop_data", JSON.stringify(newRecords));
        return newRecords;
      });
      persistence.set("seeded_missing_orders_v3", "true");
    }
  }, []);
  const [marketView, setMarketView] = useState(() => {
    const saved = persistence.get("agent_session");
    if (saved) {
      const agent = JSON.parse(saved);
      return agent.role === SystemRole.SUPPLIER ? "SUPPLIER" : "SALES";
    }
    return "SALES";
  });
  const [showPublicSupplierStats, setShowPublicSupplierStats] = useState(false);
  const [viewingNewsArticle, setViewingNewsArticle] = useState(null);
  const [isCreatingNews, setIsCreatingNews] = useState(false);
  const [editingNewsArticle, setEditingNewsArticle] = useState(null);
  useEffect(() => {
    const checkArticleInUrl = () => {
      const params = new URLSearchParams(window.location.search);
      const articleId = params.get("article");
      if (articleId && newsArticles.length > 0) {
        const article = newsArticles.find((a) => a.id === articleId);
        if (article) {
          setViewingNewsArticle(article);
        }
      } else {
        setViewingNewsArticle(null);
      }
    };
    checkArticleInUrl();
    window.addEventListener("popstate", checkArticleInUrl);
    return () => window.removeEventListener("popstate", checkArticleInUrl);
  }, [newsArticles]);
  const handleOpenNews = (article) => {
    window.history.pushState(null, "", `/news?article=${article.id}`);
    setViewingNewsArticle(article);
  };
  const handleCloseNews = () => {
    window.history.pushState(null, "", `/news`);
    setViewingNewsArticle(null);
  };
  const handleShareNews = (article) => {
    const url = `${window.location.origin}/news?article=${article.id}`;
    navigator.clipboard.writeText(url);
    alert("Link copied to clipboard!");
  };
  const [isSyncing, setIsSyncing] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const syncLock = useRef(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const hasSyncedLegacyData = useRef(false);
  const [fulfillmentData, setFulfillmentData] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const [isMarketMenuOpen, setIsMarketMenuOpen] = useState(false);
  const [orderingProduct, setOrderingProduct] = useState(null);
  const handleOrderNow = (product) => {
    if (!agentIdentity) {
      alert("Please login or register as a Customer to place an order.");
      setCurrentPortal("LOGIN");
      return;
    }
    if (agentIdentity.role !== SystemRole.CUSTOMER && agentIdentity.role !== SystemRole.SYSTEM_DEVELOPER && agentIdentity.role !== SystemRole.MANAGER) {
      alert("Only Customers can place direct orders.");
      return;
    }
    setOrderingProduct(product);
  };
  const handleClearTestOrder = async (orderId) => {
    if (window.confirm("Are you sure you want to clear this test record?")) {
      const success = await deleteOrder(orderId);
      if (success) {
        setMarketOrders((prev) => prev.filter((o) => o.id !== orderId));
      } else {
        alert("Failed to clear test record.");
      }
    }
  };
  const handleFulfillDirectOrder = (order) => {
    const product = produceListings.find((p) => p.id === order.produceId);
    const unitPrice = product ? product.sellingPrice : 0;
    setFulfillmentData({
      date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      cropType: order.cropType,
      unitType: order.unitType,
      farmerName: order.supplierName || "",
      farmerPhone: order.supplierPhone || "",
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      unitsSold: order.unitsRequested,
      unitPrice,
      cluster: order.cluster,
      orderId: order.id,
      produceId: order.produceId,
      deliveryFee: order.deliveryFee
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const directOrders = useMemo(() => {
    if (!agentIdentity) return [];
    return marketOrders.filter(
      (o) => o.isDirectOrder && o.status === OrderStatus.OPEN && (agentIdentity.role === SystemRole.MANAGER || agentIdentity.role === SystemRole.SYSTEM_DEVELOPER || o.cluster === agentIdentity.cluster)
    );
  }, [marketOrders, agentIdentity]);
  const [editingProduceId, setEditingProduceId] = useState(null);
  const [produceInitialData, setProduceInitialData] = useState(void 0);
  const [reportData, setReportData] = useState(null);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [boardTimeFilter, setBoardTimeFilter] = useState("all");
  useEffect(() => {
    const storedVersion = persistence.get("app_version");
    if (storedVersion !== APP_VERSION) {
      console.log("New Version Detected: Migrating Session & Ensuring Data Safety");
      persistence.remove("agent_session");
      persistence.set("app_version", APP_VERSION);
      setAgentIdentity(null);
      setCurrentPortal("LOGIN");
      supabase.auth.signOut().catch(() => {
      });
    }
  }, []);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("mode") === "register" && !agentIdentity) {
      setCurrentPortal("LOGIN");
    }
  }, [agentIdentity]);
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      console.log("Network restored. Initiating pending sync...");
      syncPendingData();
    };
    const handleOffline = () => setIsOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [records, produceListings, marketOrders]);
  const syncPendingData = useCallback(async () => {
    if (syncLock.current || !navigator.onLine) return;
    syncLock.current = true;
    setIsSyncing(true);
    try {
      const pendingRecords = records.filter((r) => r.synced === false || r.synced === void 0);
      if (pendingRecords.length > 0) {
        console.log(`Syncing ${pendingRecords.length} pending records...`);
        for (const record of pendingRecords) {
          const success = await saveRecord(record);
          if (success) {
            setRecords((prev) => {
              const updated = prev.map((r) => r.id === record.id ? { ...r, synced: true } : r);
              persistence.set("food_coop_data", JSON.stringify(updated));
              return updated;
            });
          }
        }
      }
      const pendingProduce = produceListings.filter((p) => p.synced === false || p.synced === void 0);
      if (pendingProduce.length > 0) {
        for (const item of pendingProduce) {
          const success = await saveProduce(item);
          if (success) {
            setProduceListings((prev) => {
              const updated = prev.map((p) => p.id === item.id ? { ...p, synced: true } : p);
              persistence.set("food_coop_produce", JSON.stringify(updated));
              return updated;
            });
          }
        }
      }
      const pendingOrders = marketOrders.filter((o) => o.synced === false || o.synced === void 0);
      if (pendingOrders.length > 0) {
        for (const order of pendingOrders) {
          const success = await saveOrder(order);
          if (success) {
            setMarketOrders((prev) => {
              const updated = prev.map((o) => o.id === order.id ? { ...o, synced: true } : o);
              persistence.set("food_coop_orders", JSON.stringify(updated));
              return updated;
            });
          }
        }
      }
      await loadCloudData();
    } catch (e) {
      console.error("Sync process interrupted:", e);
    } finally {
      setIsSyncing(false);
      syncLock.current = false;
    }
  }, [records, produceListings, marketOrders]);
  const syncPendingDataRef = useRef(syncPendingData);
  const currentPortalRef = useRef(currentPortal);
  useEffect(() => {
    syncPendingDataRef.current = syncPendingData;
  }, [syncPendingData]);
  useEffect(() => {
    currentPortalRef.current = currentPortal;
  }, [currentPortal]);
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error || !session) {
        setAgentIdentity(null);
        persistence.remove("agent_session");
        if (error) {
          console.warn("Session error detected, cleaning up:", error.message);
          supabase.auth.signOut().catch(() => {
          });
        }
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "INITIAL_SESSION" && !session) {
        setAgentIdentity(null);
        persistence.remove("agent_session");
      } else if ((event === "SIGNED_IN" || event === "PASSWORD_RECOVERY") && session?.user) {
        const meta = session.user.user_metadata || {};
        const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", session.user.id).maybeSingle();
        if (profile) {
          const localSessionStr = persistence.get("agent_session");
          let localSession = {};
          try {
            if (localSessionStr) localSession = JSON.parse(localSessionStr);
          } catch (e) {
          }
          const identity = {
            ...profile,
            homesteadName: profile.homesteadName || profile.homestead_name || localSession.homesteadName
          };
          setAgentIdentity(identity);
          persistence.set("agent_session", JSON.stringify(identity));
          if (currentPortalRef.current === "LOGIN") setCurrentPortal("HOME");
          if (navigator.onLine) {
            await supabase.from("profiles").update({
              last_sign_in_at: (/* @__PURE__ */ new Date()).toISOString()
            }).eq("id", session.user.id);
          }
        } else {
          if (meta.full_name && meta.role) {
            console.log("Auto-Creating Profile from Invite Metadata...");
            const url = `${getEnv("VITE_SUPABASE_URL")}/rest/v1/profiles`;
            const response = await fetch(url, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "apikey": getEnv("VITE_SUPABASE_ANON_KEY"),
                "Authorization": `Bearer ${session.access_token}`,
                "Prefer": "resolution=merge-duplicates"
              },
              body: JSON.stringify({
                id: session.user.id,
                name: meta.full_name,
                phone: meta.phone || session.user.phone || session.user.email,
                // Use phone from metadata if available
                role: meta.role,
                cluster: meta.cluster || "-",
                passcode: "0000",
                status: "ACTIVE",
                // REMOVED EMAIL to prevent PGRST204 error
                provider: "email_invite",
                created_at: (/* @__PURE__ */ new Date()).toISOString()
              })
            });
            if (response.ok) {
              const { data: newProfile } = await supabase.from("profiles").select("*").eq("id", session.user.id).single();
              if (newProfile) {
                const localSessionStr = persistence.get("agent_session");
                let localSession = {};
                try {
                  if (localSessionStr) localSession = JSON.parse(localSessionStr);
                } catch (e) {
                }
                const identity = {
                  ...newProfile,
                  homesteadName: newProfile.homesteadName || newProfile.homestead_name || localSession.homesteadName
                };
                setAgentIdentity(identity);
                persistence.set("agent_session", JSON.stringify(identity));
                if (currentPortalRef.current === "LOGIN") setCurrentPortal("HOME");
              }
              if (syncPendingDataRef.current) syncPendingDataRef.current();
            }
          } else {
            if (currentPortalRef.current !== "LOGIN") {
              setCurrentPortal("LOGIN");
            }
          }
        }
        setTimeout(() => {
          if (syncPendingDataRef.current) syncPendingDataRef.current();
        }, 1e3);
      } else if (event === "SIGNED_OUT") {
        setAgentIdentity(null);
        persistence.remove("agent_session");
        setCurrentPortal("HOME");
        hasSyncedLegacyData.current = false;
      }
    });
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  const handleLoginSuccess = (identity) => {
    setAgentIdentity(identity);
    persistence.set("agent_session", JSON.stringify(identity));
    setCurrentPortal("HOME");
    setTimeout(syncPendingData, 500);
  };
  const isSystemDev = agentIdentity?.role === SystemRole.SYSTEM_DEVELOPER;
  const canManageNews = isSystemDev || agentIdentity?.role === SystemRole.MANAGER || agentIdentity?.role === SystemRole.SALES_MANAGER || isSuperAgent(agentIdentity?.phone);
  const isPrivilegedRole = (agent) => {
    if (!agent) return false;
    return isSystemDev || agent.role === SystemRole.MANAGER || agent.role === SystemRole.FINANCE_OFFICER || agent.role === SystemRole.AUDITOR || agent.role === SystemRole.SALES_MANAGER || isSuperAgent(agent.phone);
  };
  const availablePortals = useMemo(() => {
    const guestPortals = ["HOME", "NEWS", "WEATHER", "ABOUT", "CONTACT", "PRODUCTS", "HOMESTEAD", "MY_FARM"];
    if (!agentIdentity) return guestPortals;
    if (agentIdentity.role === SystemRole.FARMER && agentIdentity.cluster === "Guest") {
      return ["HOME", "NEWS", "WEATHER", "ABOUT", "CONTACT", "PRODUCTS", "HOMESTEAD", "MY_FARM", "FARM_DATA"];
    }
    const loggedInBase = ["HOME", "NEWS", "WEATHER", "ABOUT", "CONTACT", "PRODUCTS", "MARKET", "FORMS", "FARM_DATA", "TABLE_BANKING", "FORUM", "HOMESTEAD", "MY_FARM"];
    if (isSystemDev) return [...loggedInBase, "FINANCE", "AUDIT", "BOARD", "SYSTEM", "VOUCHERS"];
    if (agentIdentity.role === SystemRole.SUPPLIER) return loggedInBase;
    let base = [...loggedInBase];
    if (agentIdentity.role === SystemRole.FINANCE_OFFICER) {
      base.push("FINANCE");
    } else if (agentIdentity.role === SystemRole.AUDITOR) {
      base.push("AUDIT");
    } else if (agentIdentity.role === SystemRole.MANAGER) {
      base.push("FINANCE", "AUDIT", "BOARD", "INVITE", "VOUCHERS");
    } else if (agentIdentity.role === SystemRole.SALES_MANAGER) {
      base.push("INVITE", "VOUCHERS");
    }
    return base;
  }, [agentIdentity, isSystemDev]);
  const loadCloudData = useCallback(async () => {
    if (!navigator.onLine) return;
    setIsSyncing(true);
    try {
      const sbUsers = await fetchUsers();
      if (sbUsers && sbUsers.length > 0) {
        setUsers(sbUsers);
        persistence.set("coop_users", JSON.stringify(sbUsers));
      }
      const sbRecords = await fetchRecords();
      if (sbRecords && sbRecords.length > 0) {
        setRecords((prev) => {
          const merged = mergeData(sbRecords, prev);
          persistence.set("food_coop_data", JSON.stringify(merged));
          return merged;
        });
      }
      const sbOrders = await fetchOrders();
      if (sbOrders && sbOrders.length > 0) {
        setMarketOrders((prev) => {
          const merged = mergeData(sbOrders, prev);
          persistence.set("food_coop_orders", JSON.stringify(merged));
          return merged;
        });
      }
      const sbProduce = await fetchProduce();
      if (sbProduce && sbProduce.length > 0) {
        setProduceListings((prev) => {
          const merged = mergeData(sbProduce, prev);
          persistence.set("food_coop_produce", JSON.stringify(merged));
          return merged;
        });
      }
      const sbForumPosts = await fetchForumPosts();
      if (sbForumPosts && sbForumPosts.length > 0) {
        setForumPosts((prev) => {
          const merged = mergeData(sbForumPosts, prev);
          persistence.set("food_coop_forum_posts", JSON.stringify(merged));
          return merged;
        });
      }
      const sbNewsArticles = await fetchNewsArticles();
      if (sbNewsArticles && sbNewsArticles.length > 0) {
        setNewsArticles((prev) => {
          const merged = mergeData(sbNewsArticles, prev);
          persistence.set("food_coop_news", JSON.stringify(merged));
          return merged;
        });
      }
      setLastSyncTime(/* @__PURE__ */ new Date());
    } catch (e) {
      console.error("Global Sync failed:", e);
    } finally {
      setIsSyncing(false);
    }
  }, []);
  useEffect(() => {
    const savedUsers = persistence.get("coop_users");
    if (savedUsers) {
      try {
        setUsers(JSON.parse(savedUsers));
      } catch (e) {
      }
    }
    if (navigator.onLine) loadCloudData();
  }, [loadCloudData]);
  useEffect(() => {
    const interval = setInterval(() => {
      if (navigator.onLine) {
        loadCloudData();
        syncPendingData();
      }
    }, SYNC_POLLING_INTERVAL);
    const channel = supabase.channel("global_changes").on("postgres_changes", { event: "*", schema: "public" }, () => {
      if (navigator.onLine) {
        console.log("Realtime update detected, refreshing data...");
        loadCloudData();
      }
    }).subscribe();
    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [loadCloudData]);
  const filteredRecords = useMemo(() => {
    let base = records.filter((r) => r.id && r.date);
    if (agentIdentity) {
      const isPrivileged = isSystemDev || agentIdentity.role === SystemRole.MANAGER || agentIdentity.role === SystemRole.FINANCE_OFFICER || agentIdentity.role === SystemRole.AUDITOR;
      if (!isPrivileged) {
        base = base.filter((r) => normalizePhone(r.agentPhone) === normalizePhone(agentIdentity.phone));
      }
    }
    return base;
  }, [records, isSystemDev, agentIdentity]);
  const stats = useMemo(() => {
    const relevantRecords = filteredRecords;
    const verifiedComm = relevantRecords.filter((r) => r.status === RecordStatus.VERIFIED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingAuditComm = relevantRecords.filter((r) => r.status === RecordStatus.VALIDATED).reduce((a, b) => a + Number(b.coopProfit), 0);
    const awaitingFinanceComm = relevantRecords.filter((r) => r.status === RecordStatus.PAID || r.status === RecordStatus.COMPLETE).reduce((a, b) => a + Number(b.coopProfit), 0);
    const dueComm = relevantRecords.filter((r) => r.status === RecordStatus.DRAFT || r.status === RecordStatus.PENDING).reduce((a, b) => a + Number(b.coopProfit), 0);
    return { awaitingAuditComm, awaitingFinanceComm, approvedComm: verifiedComm, dueComm };
  }, [filteredRecords]);
  const dynamicClusters = useMemo(() => {
    const fromUsers = users.map((u) => u.cluster).filter((c) => Boolean(c));
    const fromRecords = records.map((r) => r.cluster).filter((c) => Boolean(c));
    const fromProduce = produceListings.map((p) => p.cluster).filter((c) => Boolean(c));
    const fromOrders = marketOrders.map((o) => o.cluster).filter((c) => Boolean(c));
    return Array.from(/* @__PURE__ */ new Set([...FOOD_COOPS, ...customFoodCoops, ...fromUsers, ...fromRecords, ...fromProduce, ...fromOrders])).filter((c) => c !== "-");
  }, [users, records, produceListings, marketOrders, customFoodCoops]);
  const homeMetrics = useMemo(() => {
    const rLog = records;
    const clusterMap = dynamicClusters.reduce((acc, c) => {
      acc[c] = { volume: 0, profit: 0 };
      return acc;
    }, {});
    rLog.forEach((r) => {
      if (r.status === RecordStatus.COMPLETE || r.status === RecordStatus.PAID || r.status === RecordStatus.VERIFIED || r.status === RecordStatus.VALIDATED) {
        const cluster = r.cluster || "Unknown";
        if (!clusterMap[cluster]) clusterMap[cluster] = { volume: 0, profit: 0 };
        clusterMap[cluster].volume += Number(r.totalSale);
        clusterMap[cluster].profit += Number(r.coopProfit);
      }
    });
    const clusterPerformance = Object.entries(clusterMap).sort((a, b) => b[1].profit - a[1].profit);
    return { clusterPerformance };
  }, [records, dynamicClusters]);
  const boardMetrics = useMemo(() => {
    const now = /* @__PURE__ */ new Date();
    const rLog = records.filter((r) => {
      if (boardTimeFilter === "all") return true;
      const recordDate = new Date(r.createdAt || r.date);
      const diffTime = Math.abs(now.getTime() - recordDate.getTime());
      const diffDays = Math.ceil(diffTime / (1e3 * 60 * 60 * 24));
      return diffDays <= parseInt(boardTimeFilter);
    });
    const clusterMap = dynamicClusters.reduce((acc, c) => {
      acc[c] = { volume: 0, profit: 0 };
      return acc;
    }, {});
    rLog.forEach((r) => {
      if (r.status === RecordStatus.COMPLETE || r.status === RecordStatus.PAID || r.status === RecordStatus.VERIFIED || r.status === RecordStatus.VALIDATED) {
        const cluster = r.cluster || "Unknown";
        if (!clusterMap[cluster]) clusterMap[cluster] = { volume: 0, profit: 0 };
        clusterMap[cluster].volume += Number(r.totalSale);
        clusterMap[cluster].profit += Number(r.coopProfit);
      }
    });
    const clusterPerformance = Object.entries(clusterMap).sort((a, b) => b[1].profit - a[1].profit);
    return { clusterPerformance };
  }, [records, dynamicClusters, boardTimeFilter]);
  const grandTotalVolume = useMemo(() => homeMetrics.clusterPerformance.reduce((a, b) => a + b[1].volume, 0), [homeMetrics]);
  const grandTotalCommission = useMemo(() => homeMetrics.clusterPerformance.reduce((a, b) => a + b[1].profit, 0), [homeMetrics]);
  const pendingSyncCount = useMemo(() => {
    const pRecords = records.filter((r) => r.synced === false || r.synced === void 0).length;
    const pProduce = produceListings.filter((p) => p.synced === false || p.synced === void 0).length;
    const pOrders = marketOrders.filter((o) => o.synced === false || o.synced === void 0).length;
    return pRecords + pProduce + pOrders;
  }, [records, produceListings, marketOrders]);
  const handleEditProduce = (listing) => {
    setEditingProduceId(listing.id);
    setProduceInitialData(listing);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handleAddProduce = async (data) => {
    if (editingProduceId) {
      const existing = produceListings.find((p) => p.id === editingProduceId);
      if (existing) {
        const updated = {
          ...existing,
          date: data.date,
          cropType: data.cropType,
          unitType: data.unitType,
          unitsAvailable: data.unitsAvailable,
          sellingPrice: data.sellingPrice,
          wholesalePrice: data.wholesalePrice,
          supplierName: data.supplierName,
          supplierPhone: data.supplierPhone,
          images: data.images,
          cluster: data.cluster || existing.cluster,
          synced: false
        };
        setProduceListings((prev) => {
          const updatedList = prev.map((p) => p.id === editingProduceId ? updated : p);
          persistence.set("food_coop_produce", JSON.stringify(updatedList));
          return updatedList;
        });
        setEditingProduceId(null);
        setProduceInitialData(void 0);
        try {
          const success = await saveProduce(updated);
          if (success) {
            setProduceListings((prev) => prev.map((p) => p.id === updated.id ? { ...p, synced: true } : p));
          }
        } catch (err) {
          console.error("Update sync failed", err);
        }
        return;
      }
    }
    const clusterValue = data.cluster || (agentIdentity?.cluster && agentIdentity.cluster !== "-" ? agentIdentity.cluster : "Mariwa");
    const newListing = {
      id: "LST-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      date: data.date,
      cropType: data.cropType,
      unitsAvailable: data.unitsAvailable,
      unitType: data.unitType,
      sellingPrice: data.sellingPrice,
      wholesalePrice: data.wholesalePrice,
      supplierName: data.supplierName,
      supplierPhone: data.supplierPhone,
      cluster: clusterValue,
      status: "AVAILABLE",
      images: data.images,
      synced: false
      // Start as unsynced
    };
    setProduceListings((prev) => {
      const updated = [newListing, ...prev];
      persistence.set("food_coop_produce", JSON.stringify(updated));
      return updated;
    });
    try {
      const success = await saveProduce(newListing);
      if (success) {
        setProduceListings((prev) => {
          const updated = prev.map((p) => p.id === newListing.id ? { ...p, synced: true } : p);
          persistence.set("food_coop_produce", JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err) {
      console.error("Produce sync failed (saved locally):", err);
    }
  };
  const handleUpdateProduceStock = async (id, newUnits) => {
    const listing = produceListings.find((p) => p.id === id);
    if (!listing) return;
    const updated = {
      ...listing,
      unitsAvailable: newUnits,
      status: newUnits <= 0 ? "SOLD_OUT" : "AVAILABLE",
      synced: false
    };
    setProduceListings((prev) => {
      const updatedList = prev.map((p) => p.id === id ? updated : p);
      persistence.set("food_coop_produce", JSON.stringify(updatedList));
      return updatedList;
    });
    try {
      const success = await saveProduce(updated);
      if (success) {
        setProduceListings((prev) => prev.map((p) => p.id === id ? { ...p, synced: true } : p));
      }
    } catch (err) {
      console.error("Stock update sync failed:", err);
    }
  };
  const handleFulfillOrder = (order) => {
    const listing = produceListings.find((p) => p.cropType === order.cropType && p.cluster === order.cluster && p.status === "AVAILABLE");
    const isSelfOrder = normalizePhone(order.customerPhone) === normalizePhone(agentIdentity?.phone);
    setCurrentPortal("MARKET");
    setMarketView("SALES");
    setFulfillmentData({
      cropType: order.cropType,
      unitsSold: order.unitsRequested,
      unitType: order.unitType,
      // Conditional Auto-population
      customerName: isSelfOrder ? order.customerName : "",
      customerPhone: isSelfOrder ? order.customerPhone : "",
      orderId: order.id,
      produceId: listing?.id,
      farmerName: listing?.supplierName || "Food Coop",
      farmerPhone: listing?.supplierPhone || "COOP-INTERNAL",
      unitPrice: listing?.sellingPrice || 0,
      cluster: order.cluster
    });
    window.scrollTo({ top: 600, behavior: "smooth" });
  };
  const handleEditRecord = (record) => {
    setEditingId(record.id);
    setFulfillmentData({
      cropType: record.cropType,
      unitsSold: record.unitsSold,
      unitType: record.unitType,
      customerName: record.customerName,
      customerPhone: record.customerPhone,
      farmerName: record.farmerName,
      farmerPhone: record.farmerPhone,
      unitPrice: record.unitPrice,
      cluster: record.cluster,
      orderId: record.orderId,
      produceId: record.produceId
    });
    setCurrentPortal("MARKET");
    setMarketView("SALES");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };
  const handlePlaceOrder = async (listing) => {
    if (!agentIdentity) {
      alert("Authentication Required: Please login to place an order.");
      setCurrentPortal("LOGIN");
      return;
    }
    let targetName = agentIdentity.name;
    let targetPhone = agentIdentity.phone;
    if (agentIdentity.role === SystemRole.SALES_AGENT) {
      const isSelf = window.confirm(`Is this order for yourself (${agentIdentity.name})?

OK = Yes, for Me
Cancel = No, for a Customer`);
      if (!isSelf) {
        const cName = window.prompt("Enter Customer Name:");
        if (!cName) return;
        const cPhone = window.prompt("Enter Customer Phone Number:");
        if (!cPhone) return;
        targetName = cName;
        targetPhone = cPhone;
      }
    }
    const qty = window.prompt(`How many ${listing.unitType} of ${listing.cropType} would you like to order? (Available: ${listing.unitsAvailable})`, "1");
    if (qty === null) return;
    const units = parseFloat(qty);
    if (isNaN(units) || units <= 0 || units > listing.unitsAvailable) {
      alert("Invalid Quantity: Please enter a number between 1 and " + listing.unitsAvailable);
      return;
    }
    const newOrder = {
      id: "ORD-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
      date: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
      cropType: listing.cropType,
      unitsRequested: units,
      unitType: listing.unitType,
      customerName: targetName,
      customerPhone: targetPhone,
      status: OrderStatus.OPEN,
      agentPhone: "",
      // Agent phone is tracked via user session/creator usually, explicitly empty here as per schema default
      cluster: listing.cluster,
      synced: false
    };
    setMarketOrders((prev) => {
      const updated = [newOrder, ...prev];
      persistence.set("food_coop_orders", JSON.stringify(updated));
      return updated;
    });
    try {
      const success = await saveOrder(newOrder);
      if (success) {
        setMarketOrders((prev) => prev.map((o) => o.id === newOrder.id ? { ...o, synced: true } : o));
        alert("Order Successful: Your request for " + units + " " + listing.unitType + " of " + listing.cropType + " has been placed. Payment is on delivery.");
      } else {
        alert("Order Saved Locally (Offline): Will sync when connection is restored.");
      }
    } catch (err) {
      console.error("Order sync failed:", err);
    }
  };
  const handleDeleteProduce = async (id) => {
    if (!window.confirm("Action required: Permanent deletion of harvest listing ID: " + id + ". Continue?")) return;
    const newBlacklist = [...deletedProduceIds, id];
    setDeletedProduceIds(newBlacklist);
    persistence.set("deleted_produce_blacklist", JSON.stringify(newBlacklist));
    setProduceListings((prev) => {
      const updated = prev.filter((p) => p.id !== id);
      persistence.set("food_coop_produce", JSON.stringify(updated));
      return updated;
    });
    try {
      await deleteProduce(id);
    } catch (err) {
      console.error("Produce deletion sync failed:", err);
    }
  };
  const handleDeleteAllProduce = async () => {
    if (!window.confirm("CRITICAL ALERT: You are about to purge ALL produce listings from the entire system. This action is irreversible. Proceed?")) return;
    const currentIds = produceListings.map((p) => p.id);
    const newBlacklist = Array.from(/* @__PURE__ */ new Set([...deletedProduceIds, ...currentIds]));
    setDeletedProduceIds(newBlacklist);
    persistence.set("deleted_produce_blacklist", JSON.stringify(newBlacklist));
    setProduceListings([]);
    persistence.set("food_coop_produce", JSON.stringify([]));
    try {
      await deleteAllProduce();
      alert("System Repository Purged.");
    } catch (err) {
      console.error("Purge failed:", err);
    }
  };
  const handlePurgeUsers = async () => {
    if (!window.confirm("CRITICAL SECURITY ALERT: Purge ALL registered users? This cannot be undone. Proceed?")) return;
    setUsers([]);
    persistence.set("coop_users", JSON.stringify([]));
    try {
      await deleteAllUsers();
      alert("User Registry Purged.");
    } catch (err) {
      console.error("User purge failed:", err);
    }
  };
  const handlePurgeAuditLog = async () => {
    if (!window.confirm("CRITICAL AUDIT ALERT: You are about to wipe ALL transaction history records from the system. This action is permanent. Proceed?")) return;
    setRecords([]);
    persistence.set("food_coop_data", JSON.stringify([]));
    try {
      await deleteAllRecords();
      alert("Trade Ledger Purged Successfully.");
    } catch (err) {
      console.error("Trade ledger purge failed:", err);
    }
  };
  const handlePurgeOrders = async () => {
    if (!window.confirm("CRITICAL MARKET ALERT: You are about to purge ALL market demand orders (unfulfilled). This action is permanent. Proceed?")) return;
    setMarketOrders([]);
    persistence.set("food_coop_orders", JSON.stringify([]));
    try {
      await deleteAllOrders();
      alert("Order Repository Purged Successfully.");
    } catch (err) {
      console.error("Order purge failed:", err);
    }
  };
  const handleAddRecord = async (data) => {
    if (editingId) {
      const existing = records.find((r) => r.id === editingId);
      if (existing) {
        const cluster = data.cluster || agentIdentity?.cluster || "Unassigned";
        const totalSale = Number(data.unitsSold) * Number(data.unitPrice);
        let coopProfit = data.coopProfit !== void 0 ? data.coopProfit : totalSale * PROFIT_MARGIN;
        if (data.produceId) {
          const produce = produceListings.find((p) => p.id === data.produceId);
          if (produce && produce.wholesalePrice !== void 0) {
            const totalProfit = (Number(data.unitPrice) - produce.wholesalePrice) * Number(data.unitsSold);
            coopProfit = totalProfit * 0.1 + 1;
          }
        }
        const signature = await computeHash({ ...data, id: editingId });
        const updatedRecord = {
          ...existing,
          ...data,
          totalSale,
          coopProfit,
          signature,
          synced: false
          // mark for sync
        };
        setRecords((prev) => {
          const updated = prev.map((r) => r.id === editingId ? updatedRecord : r);
          persistence.set("food_coop_data", JSON.stringify(updated));
          return updated;
        });
        setEditingId(null);
        setFulfillmentData(null);
        try {
          const success = await saveRecord(updatedRecord);
          if (success) {
            setRecords((prev) => prev.map((r) => r.id === editingId ? { ...r, synced: true } : r));
          }
        } catch (e) {
        }
      }
    } else {
      const id = Math.random().toString(36).substring(2, 8).toUpperCase();
      const cluster = data.cluster || agentIdentity?.cluster || "Unassigned";
      const totalSale = Number(data.unitsSold) * Number(data.unitPrice);
      let coopProfit = data.coopProfit !== void 0 ? data.coopProfit : totalSale * PROFIT_MARGIN;
      if (data.produceId) {
        const produce = produceListings.find((p) => p.id === data.produceId);
        if (produce && produce.wholesalePrice !== void 0) {
          const totalProfit = (Number(data.unitPrice) - produce.wholesalePrice) * Number(data.unitsSold);
          coopProfit = totalProfit * 0.1 + 1;
        }
      }
      const signature = await computeHash({ ...data, id });
      const initialStatus = data.isAggregate ? RecordStatus.PENDING : RecordStatus.VERIFIED;
      const newRecord = {
        ...data,
        id,
        totalSale,
        coopProfit,
        status: initialStatus,
        signature,
        createdAt: (/* @__PURE__ */ new Date()).toISOString(),
        agentPhone: agentIdentity?.phone,
        agentName: agentIdentity?.name,
        cluster,
        synced: false
      };
      setRecords((prev) => {
        const updated = [newRecord, ...prev];
        persistence.set("food_coop_data", JSON.stringify(updated));
        return updated;
      });
      if (data.orderId) {
        const updatedOrders = marketOrders.map((o) => o.id === data.orderId ? { ...o, status: OrderStatus.FULFILLED, synced: false } : o);
        setMarketOrders(updatedOrders);
        persistence.set("food_coop_orders", JSON.stringify(updatedOrders));
        try {
          const order = marketOrders.find((o) => o.id === data.orderId);
          if (order) {
            const success = await saveOrder({ ...order, status: OrderStatus.FULFILLED });
            if (success) {
              setMarketOrders((prev) => prev.map((o) => o.id === data.orderId ? { ...o, synced: true } : o));
            }
          }
        } catch (err) {
          console.error("Order fulfillment sync failed:", err);
        }
      }
      if (data.produceId) {
        setProduceListings((prev) => {
          const target = prev.find((p) => p.id === data.produceId);
          if (target) {
            const remaining = Math.max(0, target.unitsAvailable - data.unitsSold);
            const updated = {
              ...target,
              unitsAvailable: remaining,
              status: remaining <= 0 ? "SOLD_OUT" : "AVAILABLE",
              synced: false
            };
            const newList = prev.map((p) => p.id === data.produceId ? updated : p);
            persistence.set("food_coop_produce", JSON.stringify(newList));
            saveProduce(updated).then((ok) => {
              if (ok) setProduceListings((cur) => cur.map((p) => p.id === updated.id ? { ...p, synced: true } : p));
            }).catch((e) => console.error("Inventory sync failed:", e));
            return newList;
          }
          return prev;
        });
      }
      setFulfillmentData(null);
      try {
        const success = await saveRecord(newRecord);
        if (success) {
          setRecords((prev) => prev.map((r) => r.id === id ? { ...r, synced: true } : r));
        }
      } catch (e) {
      }
    }
  };
  const handleUpdateStatus = async (id, newStatus) => {
    const record = records.find((r) => r.id === id);
    if (!record) return;
    const updated = { ...record, status: newStatus, synced: false };
    setRecords((prev) => {
      const updatedList = prev.map((r) => r.id === id ? updated : r);
      persistence.set("food_coop_data", JSON.stringify(updatedList));
      return updatedList;
    });
    const success = await saveRecord(updated);
    if (success) {
      setRecords((prev) => prev.map((r) => r.id === id ? { ...r, synced: true } : r));
    }
  };
  const handleConfirmClusterRemittance = async (clusterName, date) => {
    const pendingClusterRecords = records.filter(
      (r) => (r.status === RecordStatus.DRAFT || r.status === RecordStatus.PENDING) && (r.cluster || "Unassigned") === clusterName && (r.date || "Unknown Date") === date
    );
    if (pendingClusterRecords.length === 0) return;
    const totalComm = pendingClusterRecords.reduce((sum, r) => sum + Number(r.coopProfit), 0);
    if (!window.confirm(`CONFIRM REMITTANCE?

Food Coop: ${clusterName}
Date: ${date}
Total Commission: KSh ${totalComm.toLocaleString()}
Orders: ${pendingClusterRecords.length}

This confirms that the commission for this food coop on this date has been received. Proceed?`)) {
      return;
    }
    const updatedRecords = records.map((r) => {
      if ((r.status === RecordStatus.DRAFT || r.status === RecordStatus.PENDING) && (r.cluster || "Unassigned") === clusterName && (r.date || "Unknown Date") === date) {
        return { ...r, status: RecordStatus.COMPLETE, synced: false };
      }
      return r;
    });
    setRecords(updatedRecords);
    persistence.set("food_coop_data", JSON.stringify(updatedRecords));
    for (const r of pendingClusterRecords) {
      const updated = { ...r, status: RecordStatus.COMPLETE };
      const success = await saveRecord(updated);
      if (success) {
        setRecords((prev) => {
          const updatedList = prev.map((item) => item.id === r.id ? { ...item, status: RecordStatus.COMPLETE, synced: true } : item);
          persistence.set("food_coop_data", JSON.stringify(updatedList));
          return updatedList;
        });
      }
    }
    alert(`Remittance confirmation process completed for ${clusterName} on ${date}. Check the ledger for sync status.`);
  };
  const handleVerifyClusterRemittance = async (clusterName, date) => {
    const awaitingClusterRecords = records.filter(
      (r) => (r.status === RecordStatus.PAID || r.status === RecordStatus.COMPLETE) && (r.cluster || "Unassigned") === clusterName && (r.date || "Unknown Date") === date
    );
    if (awaitingClusterRecords.length === 0) return;
    const totalComm = awaitingClusterRecords.reduce((sum, r) => sum + Number(r.coopProfit), 0);
    if (!window.confirm(`VERIFY & SEAL?

Food Coop: ${clusterName}
Date: ${date}
Total Commission: KSh ${totalComm.toLocaleString()}
Orders: ${awaitingClusterRecords.length}

This confirms that the commission for this food coop on this date has been verified and sealed. Proceed?`)) {
      return;
    }
    const updatedRecords = records.map((r) => {
      if ((r.status === RecordStatus.PAID || r.status === RecordStatus.COMPLETE) && (r.cluster || "Unassigned") === clusterName && (r.date || "Unknown Date") === date) {
        return { ...r, status: RecordStatus.VERIFIED, synced: false };
      }
      return r;
    });
    setRecords(updatedRecords);
    persistence.set("food_coop_data", JSON.stringify(updatedRecords));
    for (const r of awaitingClusterRecords) {
      const updated = { ...r, status: RecordStatus.VERIFIED };
      const success = await saveRecord(updated);
      if (success) {
        setRecords((prev) => {
          const updatedList = prev.map((item) => item.id === r.id ? { ...item, status: RecordStatus.VERIFIED, synced: true } : item);
          persistence.set("food_coop_data", JSON.stringify(updatedList));
          return updatedList;
        });
      }
    }
    alert(`Verification process completed for ${clusterName} on ${date}. Check the ledger for sync status.`);
  };
  const handleDeleteRecord = async (id) => {
    if (!window.confirm("Action required: Permanent deletion of record ID: " + id + ". Continue?")) return;
    setRecords((prev) => {
      const updated = prev.filter((r) => r.id !== id);
      persistence.set("food_coop_data", JSON.stringify(updated));
      return updated;
    });
    try {
      await deleteRecord(id);
    } catch (e) {
    }
  };
  const handleToggleUserStatus = async (phone, currentStatus) => {
    const user = users.find((u) => u.phone === phone);
    if (!user) return;
    const newStatus = currentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE";
    const updatedUser = { ...user, status: newStatus };
    setUsers((prev) => {
      const updated = prev.map((u) => u.phone === phone ? updatedUser : u);
      persistence.set("coop_users", JSON.stringify(updated));
      return updated;
    });
    await saveUser(updatedUser);
  };
  const handleDeleteUser = async (phone) => {
    if (!window.confirm(`Action required: Permanent deletion of user with phone: ${phone}. Continue?`)) return;
    setUsers((prev) => {
      const updated = prev.filter((u) => normalizePhone(u.phone) !== normalizePhone(phone));
      persistence.set("coop_users", JSON.stringify(updated));
      return updated;
    });
    try {
      await deleteUser(phone);
    } catch (e) {
    }
  };
  const handleLogout = async () => {
    setAgentIdentity(null);
    persistence.remove("agent_session");
    setCurrentPortal("HOME");
    hasSyncedLegacyData.current = false;
    try {
      const { error } = await supabase.auth.signOut();
      if (error) console.warn("Logout warning:", error.message);
    } catch (e) {
      console.error("Logout critical error:", e);
    }
  };
  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    try {
      const report = await analyzeSalesData(filteredRecords);
      setReportData(report);
      setIsReportOpen(true);
    } catch (e) {
      alert("Failed to generate report");
    } finally {
      setIsGeneratingReport(false);
    }
  };
  const renderExportButtons = (showAiAudit = false) => /* @__PURE__ */ jsxs("div", { className: "flex gap-2", children: [
    showAiAudit && /* @__PURE__ */ jsxs(
      "button",
      {
        type: "button",
        onClick: handleGenerateReport,
        disabled: isGeneratingReport || !isOnline,
        className: `${!isOnline ? "bg-slate-300" : "bg-purple-600 hover:bg-purple-700"} text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest transition-colors shadow-md flex items-center gap-2`,
        children: [
          isGeneratingReport ? /* @__PURE__ */ jsx("i", { className: "fas fa-spinner fa-spin" }) : /* @__PURE__ */ jsx("i", { className: "fas fa-robot" }),
          "AI Audit"
        ]
      }
    ),
    /* @__PURE__ */ jsx("button", { type: "button", className: "bg-slate-100 text-black px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-colors", children: "Summary CSV" }),
    /* @__PURE__ */ jsxs("button", { type: "button", className: "bg-black text-white px-6 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest shadow-xl hover:bg-slate-800 transition-colors", children: [
      /* @__PURE__ */ jsx("i", { className: "fas fa-download mr-2" }),
      " Detailed CSV"
    ] })
  ] });
  const WelcomeCard = /* @__PURE__ */ jsxs("div", { className: "bg-white p-12 rounded-[3rem] shadow-none border-none flex flex-col md:flex-row gap-12 items-center h-full min-h-[400px]", children: [
    /* @__PURE__ */ jsxs("div", { className: "flex-1 space-y-6", children: [
      /* @__PURE__ */ jsx("h2", { className: "text-4xl font-black uppercase tracking-tight text-black leading-tight", children: "WELCOME TO THE KPL FOOD COOPERATIVE MARKET" }),
      /* @__PURE__ */ jsx("p", { className: "text-slate-600 font-medium leading-relaxed", children: "Our platform is designed to empower local farmers and consumers through a transparent, high-integrity marketplace. We leverage agroecological principles to ensure sustainable growth for our community." }),
      /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-4", children: [
        agentIdentity ? /* @__PURE__ */ jsx("button", { onClick: () => setCurrentPortal("MARKET"), className: "bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all", children: "Explore Market" }) : /* @__PURE__ */ jsx("button", { onClick: () => setCurrentPortal("LOGIN"), className: "bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all", children: "Get Started" }),
        /* @__PURE__ */ jsxs(
          "button",
          {
            onClick: () => setShowPublicSupplierStats(true),
            className: "bg-green-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-green-700 transition-all flex items-center gap-2",
            children: [
              /* @__PURE__ */ jsx("i", { className: "fas fa-chart-pie" }),
              " SUPPLIERS: CHECK YOUR SHARES"
            ]
          }
        )
      ] })
    ] }),
    /* @__PURE__ */ jsxs("div", { className: "flex-1 grid grid-cols-2 gap-4 w-full", children: [
      /* @__PURE__ */ jsxs("div", { className: "bg-green-50 p-8 rounded-3xl border border-green-100 text-center", children: [
        /* @__PURE__ */ jsx("p", { className: "text-3xl font-black text-green-600", children: combinedUsers.length }),
        /* @__PURE__ */ jsx("p", { className: "text-[9px] font-black uppercase tracking-widest text-slate-400", children: "Total Members" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-red-50 p-8 rounded-3xl border border-red-100 text-center", children: [
        /* @__PURE__ */ jsx("p", { className: "text-3xl font-black text-red-600", children: records.length }),
        /* @__PURE__ */ jsx("p", { className: "text-[9px] font-black uppercase tracking-widest text-slate-400", children: "Completed Trades" })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "bg-slate-900 p-8 rounded-3xl border border-black text-center col-span-2", children: [
        /* @__PURE__ */ jsxs("p", { className: "text-2xl font-black text-white", children: [
          "KSh ",
          homeMetrics.clusterPerformance.reduce((a, b) => a + b[1].volume, 0).toLocaleString()
        ] }),
        /* @__PURE__ */ jsx("p", { className: "text-[9px] font-black uppercase tracking-widest text-slate-500", children: "Total Trade Volume" })
      ] })
    ] })
  ] });
  return /* @__PURE__ */ jsxs("div", { className: "min-h-screen bg-[#F8FAFC] text-slate-900 pb-20", children: [
    /* @__PURE__ */ jsxs("header", { className: "bg-white text-black pt-10 pb-12 shadow-sm border-b border-slate-100 relative overflow-hidden", children: [
      /* @__PURE__ */ jsxs("div", { className: "container mx-auto px-6 relative z-10 flex flex-col lg:flex-row justify-between items-start mb-4 gap-6", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center space-x-5", children: [
          /* @__PURE__ */ jsx("div", { className: "bg-white w-16 h-16 rounded-3xl flex items-center justify-center border border-slate-100 shadow-sm overflow-hidden", children: /* @__PURE__ */ jsx("img", { src: APP_LOGO, alt: "KPL Logo", className: "w-10 h-10 object-contain" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("h1", { className: "text-3xl font-black uppercase tracking-tight leading-none text-black", children: "KPL Food Coop Market" }),
            /* @__PURE__ */ jsx("div", { className: "flex items-center space-x-2 mt-1.5", children: /* @__PURE__ */ jsxs("span", { className: "text-[9px] font-black uppercase tracking-[0.4em] italic", children: [
              "Connecting ",
              /* @__PURE__ */ jsx("span", { className: "text-green-600", children: "Producers" }),
              " with ",
              /* @__PURE__ */ jsx("span", { className: "text-red-600", children: "Consumers" })
            ] }) }),
            /* @__PURE__ */ jsx("p", { className: "text-slate-400 text-[10px] font-black uppercase tracking-[0.3em] mt-2", children: agentIdentity ? isSystemDev ? "Master Node Access" : `${agentIdentity.cluster} Food Coop` : "Guest Hub Access" })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col items-end gap-3 w-full lg:w-auto", children: [
          agentIdentity ? /* @__PURE__ */ jsxs("div", { className: `bg-slate-50 px-6 py-4 rounded-3xl border border-slate-100 text-right w-full lg:w-auto shadow-sm flex items-center justify-end space-x-6 ${!isOnline || pendingSyncCount > 0 ? "border-red-200 bg-red-50" : ""}`, children: [
            /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
              /* @__PURE__ */ jsx("p", { className: `text-[9px] font-black uppercase tracking-[0.2em] ${!isOnline || pendingSyncCount > 0 ? "text-red-600" : "text-slate-400"}`, children: isOnline ? pendingSyncCount > 0 ? `${pendingSyncCount} PENDING SYNC` : "Network Sync v1.2" : "OFFLINE MODE" }),
              /* @__PURE__ */ jsx("p", { className: "text-[10px] font-bold text-black", children: isSyncing ? "Syncing..." : !isOnline ? "Queued" : lastSyncTime?.toLocaleTimeString() || "Connected" })
            ] }),
            pendingSyncCount > 0 && isOnline && !isSyncing && /* @__PURE__ */ jsx(
              "button",
              {
                onClick: () => syncPendingData(),
                className: "w-8 h-8 rounded-xl bg-red-600 text-white flex items-center justify-center hover:bg-red-700 transition-all shadow-lg animate-pulse",
                title: "Sync Pending Data",
                children: /* @__PURE__ */ jsx("i", { className: "fas fa-sync-alt text-xs" })
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                type: "button",
                onClick: handleLogout,
                className: "w-10 h-10 rounded-2xl bg-red-50 text-red-600 flex items-center justify-center hover:bg-red-600 hover:text-white transition-all border border-red-100 cursor-pointer",
                children: /* @__PURE__ */ jsx("i", { className: "fas fa-power-off text-sm" })
              }
            )
          ] }) : /* @__PURE__ */ jsxs("button", { onClick: () => setCurrentPortal("LOGIN"), className: "bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center gap-3", children: [
            /* @__PURE__ */ jsx("i", { className: "fas fa-user-shield" }),
            " Member Login"
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex gap-4", children: [
            /* @__PURE__ */ jsx("button", { onClick: () => setCurrentPortal("HOME"), className: `text-[10px] font-black uppercase tracking-widest ${currentPortal === "HOME" ? "text-black border-b-2 border-black" : "text-slate-400 hover:text-black transition-colors"}`, children: "Home" }),
            /* @__PURE__ */ jsx("button", { onClick: () => setCurrentPortal("PRODUCTS"), className: `text-[10px] font-black uppercase tracking-widest ${currentPortal === "PRODUCTS" ? "text-black border-b-2 border-black" : "text-slate-400 hover:text-black transition-colors"}`, children: "Marketplace" }),
            !agentIdentity && /* @__PURE__ */ jsx("button", { onClick: () => setCurrentPortal("HOMESTEAD"), className: `text-[10px] font-black uppercase tracking-widest ${currentPortal === "HOMESTEAD" ? "text-black border-b-2 border-black" : "text-slate-400 hover:text-black transition-colors"}`, children: "Get Soil Data" }),
            /* @__PURE__ */ jsx("button", { onClick: () => setCurrentPortal("NEWS"), className: `text-[10px] font-black uppercase tracking-widest ${currentPortal === "NEWS" ? "text-black border-b-2 border-black" : "text-slate-400 hover:text-black transition-colors"}`, children: "News" }),
            /* @__PURE__ */ jsx("button", { onClick: () => setCurrentPortal("WEATHER"), className: `text-[10px] font-black uppercase tracking-widest ${currentPortal === "WEATHER" ? "text-black border-b-2 border-black" : "text-slate-400 hover:text-black transition-colors"}`, children: "Agro-Weather" }),
            /* @__PURE__ */ jsx("button", { onClick: () => setCurrentPortal("ABOUT"), className: `text-[10px] font-black uppercase tracking-widest ${currentPortal === "ABOUT" ? "text-black border-b-2 border-black" : "text-slate-400 hover:text-black transition-colors"}`, children: "About Us" }),
            /* @__PURE__ */ jsx("button", { onClick: () => setCurrentPortal("CONTACT"), className: `text-[10px] font-black uppercase tracking-widest ${currentPortal === "CONTACT" ? "text-black border-b-2 border-black" : "text-slate-400 hover:text-black transition-colors"}`, children: "Contact Us" })
          ] })
        ] })
      ] }),
      /* @__PURE__ */ jsx("nav", { className: "container mx-auto px-6 flex flex-wrap gap-3 mt-4 relative z-10", children: availablePortals.filter((p) => !["HOME", "ABOUT", "CONTACT", "NEWS", "LOGIN", "WEATHER", "PRODUCTS", "HOMESTEAD"].includes(p)).map((p) => {
        if (p === "MARKET") {
          return /* @__PURE__ */ jsxs("div", { className: "relative", children: [
            /* @__PURE__ */ jsxs("button", { type: "button", onClick: (e) => {
              e.stopPropagation();
              setCurrentPortal("MARKET");
              setIsMarketMenuOpen(!isMarketMenuOpen);
            }, className: `px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border flex items-center gap-2 ${currentPortal === "MARKET" ? "bg-black text-white border-black shadow-lg shadow-black/10 scale-105" : "bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-black"}`, children: [
              "Market ",
              /* @__PURE__ */ jsx("i", { className: `fas fa-chevron-down opacity-50 transition-transform ${isMarketMenuOpen ? "rotate-180" : ""}` })
            ] }),
            isMarketMenuOpen && /* @__PURE__ */ jsxs("div", { className: "absolute top-full left-0 mt-2 w-48 bg-white rounded-2xl shadow-2xl border border-slate-100 py-3 z-50 animate-in fade-in slide-in-from-top-2 duration-200", children: [
              /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => {
                setCurrentPortal("MARKET");
                setMarketView("SUPPLIER");
                setIsMarketMenuOpen(false);
              }, className: `w-full text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest ${marketView === "SUPPLIER" && currentPortal === "MARKET" ? "text-green-600" : "text-slate-500 hover:text-black hover:bg-slate-50"}`, children: [
                /* @__PURE__ */ jsx("i", { className: "fas fa-seedling mr-2" }),
                " Supplier Portal"
              ] }),
              /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => {
                setCurrentPortal("MARKET");
                setMarketView("SALES");
                setIsMarketMenuOpen(false);
              }, className: `w-full text-left px-6 py-3 text-[10px] font-black uppercase tracking-widest ${marketView === "SALES" && currentPortal === "MARKET" ? "text-green-600" : "text-slate-500 hover:text-black hover:bg-slate-50"}`, children: [
                /* @__PURE__ */ jsx("i", { className: "fas fa-shopping-cart mr-2" }),
                " Sales Portal"
              ] })
            ] })
          ] }, p);
        }
        if (p === "SYSTEM" && !isSystemDev) return null;
        const hasUnreadForum = p === "FORUM" && forumPosts.length > 0 && forumPosts[0].id !== lastReadForumPost;
        return /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => {
          setCurrentPortal(p);
          setIsMarketMenuOpen(false);
        }, className: `relative px-8 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] transition-all border ${currentPortal === p ? "bg-black text-white border-black shadow-lg shadow-black/10 scale-105" : "bg-white text-slate-400 border-slate-100 hover:border-slate-300 hover:text-black"}`, children: [
          p === "FARM_DATA" ? "FARM DATA" : p === "MY_FARM" ? "FARM DASHBOARD" : p === "TABLE_BANKING" ? "FOOD BANKING" : p,
          hasUnreadForum && /* @__PURE__ */ jsx("span", { className: "absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-pulse" })
        ] }, p);
      }) })
    ] }),
    /* @__PURE__ */ jsxs("main", { className: "container mx-auto px-6 -mt-8 relative z-20 space-y-12", onClick: () => setIsMarketMenuOpen(false), children: [
      showPublicSupplierStats && /* @__PURE__ */ jsx(PublicSupplierStats, { onBack: () => setShowPublicSupplierStats(false) }),
      currentPortal === "LOGIN" && !agentIdentity && /* @__PURE__ */ jsx(LoginPage, { onLoginSuccess: handleLoginSuccess, foodCoops: dynamicClusters }),
      currentPortal === "INVITE" && agentIdentity && /* @__PURE__ */ jsx("div", { className: "space-y-12 animate-in fade-in duration-300", children: /* @__PURE__ */ jsx(AdminInvite, { foodCoops: dynamicClusters }) }),
      currentPortal === "HOMESTEAD" && /* @__PURE__ */ jsx("div", { className: "space-y-12 animate-in fade-in duration-300", children: agentIdentity ? /* @__PURE__ */ jsxs("div", { className: "bg-white p-10 rounded-[2.5rem] shadow-xl border border-slate-100 text-center", children: [
        /* @__PURE__ */ jsx("i", { className: "fas fa-exclamation-triangle text-amber-500 text-6xl mb-6" }),
        /* @__PURE__ */ jsx("h2", { className: "text-2xl font-black text-black mb-4", children: "Access Restricted" }),
        /* @__PURE__ */ jsx("p", { className: "text-slate-500 mb-6 font-medium", children: "As a registered member, you cannot use this open-source portal. Please go to your Farm Dashboard to add a homestead or register farming lands." }),
        /* @__PURE__ */ jsx("button", { onClick: () => setCurrentPortal("MY_FARM"), className: "bg-black text-white px-8 py-3 rounded-xl font-bold uppercase tracking-widest text-xs", children: "Go to Farm Dashboard" })
      ] }) : /* @__PURE__ */ jsx(HomesteadRegistration, { onSuccess: () => setCurrentPortal("HOME") }) }),
      currentPortal === "HOME" && /* @__PURE__ */ jsxs("div", { className: "space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500", children: [
        /* @__PURE__ */ jsx(
          HeroCarousel,
          {
            welcomeCard: WelcomeCard,
            newsArticles,
            onReadNews: handleOpenNews
          }
        ),
        /* @__PURE__ */ jsx(WeatherCarousel, {}),
        /* @__PURE__ */ jsx(AvailableProducts, { produceListings, onViewAll: () => setCurrentPortal("PRODUCTS"), onOrderNow: handleOrderNow }),
        /* @__PURE__ */ jsx(Leaderboard, { clusterPerformance: homeMetrics.clusterPerformance }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-[2.5rem] p-12 shadow-xl border border-slate-100 flex flex-col items-center", children: [
          /* @__PURE__ */ jsx("h3", { className: "text-xl font-black uppercase tracking-widest mb-12 text-slate-800 text-center", children: "Our Partners in Agroecology Data" }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap justify-center gap-16 items-center w-full max-w-4xl mx-auto", children: [
            /* @__PURE__ */ jsxs("div", { className: "text-center group flex-1 min-w-[200px]", children: [
              /* @__PURE__ */ jsx("div", { className: "w-40 h-20 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-100 group-hover:border-blue-500 group-hover:shadow-lg group-hover:-translate-y-2 transition-all duration-300 px-4", children: /* @__PURE__ */ jsx("img", { src: "https://dataspace.copernicus.eu/themes/custom/copernicus/logonew.svg", alt: "Copernicus Data Space Ecosystem", className: "max-h-full max-w-full object-contain transition-all duration-300", onError: (e) => {
                e.currentTarget.style.display = "none";
              } }) }),
              /* @__PURE__ */ jsx("h4", { className: "font-black text-sm text-slate-700 tracking-wide", children: "Copernicus (CDSE) / openEO" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "text-center group flex-1 min-w-[200px]", children: [
              /* @__PURE__ */ jsx("div", { className: "w-40 h-20 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-100 group-hover:border-emerald-500 group-hover:shadow-lg group-hover:-translate-y-2 transition-all duration-300 px-4", children: /* @__PURE__ */ jsx("img", { src: "https://www.rcmrd.org/images/rcmrd-logo.png", alt: "RCMRD Logo", className: "max-h-full max-w-full object-contain transition-all duration-300", onError: (e) => {
                e.currentTarget.style.display = "none";
              } }) }),
              /* @__PURE__ */ jsx("h4", { className: "font-black text-sm text-slate-700 tracking-wide", children: "RCMRD" })
            ] }),
            /* @__PURE__ */ jsxs("div", { className: "text-center group flex-1 min-w-[200px]", children: [
              /* @__PURE__ */ jsx("div", { className: "w-40 h-20 bg-white rounded-xl flex items-center justify-center mx-auto mb-4 border border-slate-100 group-hover:border-amber-500 group-hover:shadow-lg group-hover:-translate-y-2 transition-all duration-300 px-4", children: /* @__PURE__ */ jsx("img", { src: "https://isric.euwest01.umbraco.io//media/sbeastdv/logo.svg", alt: "SoilGrids Logo", className: "max-h-full max-w-full object-contain transition-all duration-300", onError: (e) => {
                e.currentTarget.style.display = "none";
              } }) }),
              /* @__PURE__ */ jsx("h4", { className: "font-black text-sm text-slate-700 tracking-wide", children: "SoilGrids" })
            ] })
          ] })
        ] }),
        !agentIdentity && /* @__PURE__ */ jsx(AboutUsCarousel, {}),
        agentIdentity && /* @__PURE__ */ jsx(AuditLogTable, { data: records.filter((r) => r.isAggregate === true).slice(0, 10), title: "Latest Global Activity", isSystemDev, agentIdentity, currentPortal, marketView, handleDeleteRecord })
      ] }),
      currentPortal === "PRODUCTS" && /* @__PURE__ */ jsx(ProductsPage, { produceListings, onOrderNow: handleOrderNow }),
      currentPortal === "NEWS" && /* @__PURE__ */ jsxs("div", { className: "space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-center flex-col md:flex-row gap-4", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-3xl font-black uppercase tracking-tight text-black text-center md:text-left", children: "Cooperative News & Updates" }),
          canManageNews && !isCreatingNews && !editingNewsArticle && /* @__PURE__ */ jsxs(
            "button",
            {
              onClick: () => setIsCreatingNews(true),
              className: "bg-black text-white px-6 py-3 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all",
              children: [
                /* @__PURE__ */ jsx("i", { className: "fas fa-plus mr-2" }),
                " Create Post"
              ]
            }
          )
        ] }),
        isCreatingNews || editingNewsArticle ? /* @__PURE__ */ jsx(
          CreateNewsForm,
          {
            onCancel: () => {
              setIsCreatingNews(false);
              setEditingNewsArticle(null);
            },
            initialData: editingNewsArticle || void 0,
            onSubmit: async (article) => {
              const submitArticle = {
                ...article,
                id: editingNewsArticle ? editingNewsArticle.id : `news-${Date.now()}`,
                date: editingNewsArticle ? editingNewsArticle.date : (/* @__PURE__ */ new Date()).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
              };
              setNewsArticles((prev) => {
                let updated = [...prev];
                if (editingNewsArticle) {
                  updated = updated.map((a) => a.id === submitArticle.id ? submitArticle : a);
                } else {
                  updated = [submitArticle, ...updated];
                }
                persistence.set("food_coop_news", JSON.stringify(updated));
                return updated;
              });
              setIsCreatingNews(false);
              setEditingNewsArticle(null);
              try {
                await saveNewsArticle(submitArticle);
              } catch (e) {
                console.error("Failed to sync news article", e);
              }
            }
          }
        ) : /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8", children: newsArticles.map((article) => /* @__PURE__ */ jsxs(
          "div",
          {
            onClick: () => handleOpenNews(article),
            className: "bg-white rounded-3xl overflow-hidden shadow-lg border border-slate-100 flex flex-col cursor-pointer group hover:shadow-2xl transition-all hover:scale-[1.02]",
            children: [
              /* @__PURE__ */ jsxs("div", { className: "h-56 bg-slate-200 relative overflow-hidden", children: [
                /* @__PURE__ */ jsx("img", { src: article.image, alt: article.title, className: "w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" }),
                /* @__PURE__ */ jsx("div", { className: "absolute top-4 left-4 bg-black/70 backdrop-blur-md px-3 py-1 rounded-full border border-white/20", children: /* @__PURE__ */ jsx("span", { className: "text-[9px] font-black text-white uppercase tracking-widest", children: article.category }) })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "p-8 flex-1 flex flex-col justify-between", children: [
                /* @__PURE__ */ jsxs("div", { className: "space-y-4", children: [
                  /* @__PURE__ */ jsx("div", { className: "flex justify-between items-start", children: /* @__PURE__ */ jsx("h3", { className: "text-xl font-black text-black leading-tight group-hover:text-green-600 transition-colors", children: article.title }) }),
                  /* @__PURE__ */ jsx("p", { className: "text-sm text-slate-500 leading-relaxed line-clamp-3", children: article.summary })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "mt-8 pt-6 border-t border-slate-50 flex justify-between items-center", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                    /* @__PURE__ */ jsx("div", { className: "w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400", children: /* @__PURE__ */ jsx("i", { className: "fas fa-user-circle text-2xl" }) }),
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsx("p", { className: "text-[9px] font-black uppercase text-black", children: article.author }),
                      /* @__PURE__ */ jsx("p", { className: "text-[8px] font-bold text-slate-400", children: article.date })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("span", { className: "text-[9px] font-black uppercase text-slate-300 group-hover:text-green-500 transition-colors tracking-widest", children: [
                    "Read Story ",
                    /* @__PURE__ */ jsx("i", { className: "fas fa-arrow-right ml-1" })
                  ] })
                ] })
              ] })
            ]
          },
          article.id
        )) })
      ] }),
      currentPortal === "WEATHER" && /* @__PURE__ */ jsxs("div", { className: "space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500", children: [
        /* @__PURE__ */ jsxs("div", { className: "text-center max-w-2xl mx-auto space-y-4", children: [
          /* @__PURE__ */ jsx("div", { className: "w-16 h-16 bg-blue-50 rounded-3xl flex items-center justify-center mx-auto text-blue-500 shadow-sm border border-blue-100", children: /* @__PURE__ */ jsx("i", { className: "fas fa-cloud-sun-rain text-2xl" }) }),
          /* @__PURE__ */ jsx("h2", { className: "text-3xl font-black uppercase tracking-tight text-black", children: "Agro-Weather Department" }),
          /* @__PURE__ */ jsx("p", { className: "text-slate-500 font-medium leading-relaxed", children: "Access real-time hyperlocal weather data for all our agricultural food coops. This department provides essential climate insights to help farmers plan sowing, harvesting, and fertilizer application effectively." })
        ] }),
        /* @__PURE__ */ jsx(WeatherWidget, { defaultCluster: agentIdentity?.cluster && agentIdentity.cluster !== "-" ? agentIdentity.cluster : "Mariwa", clusters: dynamicClusters })
      ] }),
      currentPortal === "ABOUT" && /* @__PURE__ */ jsx(AboutUsPage, { currentUser: agentIdentity }),
      currentPortal === "CONTACT" && /* @__PURE__ */ jsx("div", { className: "space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500", children: /* @__PURE__ */ jsxs("div", { className: "bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 max-w-4xl mx-auto space-y-12", children: [
        /* @__PURE__ */ jsxs("div", { className: "space-y-8", children: [
          /* @__PURE__ */ jsx("h2", { className: "text-3xl font-black uppercase tracking-tight text-black text-center", children: "Get in Touch" }),
          /* @__PURE__ */ jsx("div", { className: "flex flex-col md:flex-row justify-center gap-8", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 bg-slate-50 p-6 rounded-2xl border border-slate-100", children: [
            /* @__PURE__ */ jsx("div", { className: "w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-red-600 border border-slate-100 shadow-sm", children: /* @__PURE__ */ jsx("i", { className: "fas fa-envelope" }) }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("p", { className: "text-[9px] font-black uppercase text-slate-400 tracking-widest", children: "Email Support" }),
              /* @__PURE__ */ jsx("p", { className: "text-sm font-black text-black", children: "info@kplfoodcoopmarket.co.ke" })
            ] })
          ] }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-slate-50 rounded-[2.5rem] p-8 md:p-12 border border-slate-100 relative overflow-hidden", children: [
          /* @__PURE__ */ jsx("div", { className: "absolute top-0 right-0 p-12 opacity-5 pointer-events-none", children: /* @__PURE__ */ jsx("i", { className: "fas fa-envelope-open-text text-9xl text-slate-300" }) }),
          /* @__PURE__ */ jsxs("div", { className: "text-center mb-8 relative z-10", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-2xl font-black text-black uppercase tracking-tight", children: "Contact The Team" }),
            /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2", children: "Partnerships \u2022 Support \u2022 Inquiries" })
          ] }),
          /* @__PURE__ */ jsxs("form", { className: "max-w-lg mx-auto space-y-5 relative z-10", onSubmit: (e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const btn = form.querySelector("button");
            if (btn) {
              const originalText = btn.innerHTML;
              btn.innerHTML = '<i class="fas fa-check"></i> Sent Successfully';
              btn.classList.remove("bg-black", "hover:bg-slate-800");
              btn.classList.add("bg-green-600", "hover:bg-green-700");
              setTimeout(() => {
                alert("Thank you! Your message has been received.");
                form.reset();
                btn.innerHTML = originalText;
                btn.classList.add("bg-black", "hover:bg-slate-800");
                btn.classList.remove("bg-green-600", "hover:bg-green-700");
              }, 500);
            }
          }, children: [
            /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-5", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3 mb-2 block", children: "Your Name" }),
                /* @__PURE__ */ jsx("input", { required: true, type: "text", placeholder: "Enter Full Name", className: "w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 font-bold text-black outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all text-sm shadow-sm" })
              ] }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("label", { className: "text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3 mb-2 block", children: "Contact Info" }),
                /* @__PURE__ */ jsx("input", { required: true, type: "text", placeholder: "Email or Phone", className: "w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 font-bold text-black outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all text-sm shadow-sm" })
              ] })
            ] }),
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("label", { className: "text-[9px] font-black text-slate-400 uppercase tracking-widest ml-3 mb-2 block", children: "Your Message" }),
              /* @__PURE__ */ jsx("textarea", { required: true, placeholder: "How can we help you today?", className: "w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 font-bold text-black outline-none focus:border-green-500 focus:ring-4 focus:ring-green-500/10 transition-all text-sm shadow-sm min-h-[140px] resize-none leading-relaxed" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "pt-2", children: /* @__PURE__ */ jsxs("button", { type: "submit", className: "w-full bg-black hover:bg-slate-800 text-white py-4 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2", children: [
              /* @__PURE__ */ jsx("i", { className: "fas fa-paper-plane" }),
              " Send Message"
            ] }) })
          ] })
        ] })
      ] }) }),
      currentPortal === "FORUM" && agentIdentity && /* @__PURE__ */ jsx(Forum, { currentUser: agentIdentity, posts: forumPosts, onPostsUpdated: loadCloudData }),
      currentPortal === "MY_FARM" && !agentIdentity && /* @__PURE__ */ jsx("div", { className: "flex h-[50vh] items-center justify-center animate-in fade-in duration-300 w-full", children: /* @__PURE__ */ jsxs("div", { className: "text-center space-y-6", children: [
        /* @__PURE__ */ jsx("div", { className: "w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mx-auto", children: /* @__PURE__ */ jsx("i", { className: "fas fa-lock text-3xl text-slate-400" }) }),
        /* @__PURE__ */ jsx("h2", { className: "text-3xl font-black text-slate-800", children: "Member Access Required" }),
        /* @__PURE__ */ jsx("p", { className: "text-slate-500 max-w-md mx-auto", children: "Please login to view and organize your Farm Dashboard." }),
        /* @__PURE__ */ jsx("button", { onClick: () => setCurrentPortal("LOGIN"), className: "px-8 py-4 bg-black text-white rounded-2xl font-black uppercase tracking-widest text-[11px] shadow-xl hover:bg-slate-800 transition-colors", children: "Login Now" })
      ] }) }),
      currentPortal === "MY_FARM" && agentIdentity && /* @__PURE__ */ jsx(
        FarmerDashboard,
        {
          agentIdentity,
          farmFormsData,
          dynamicClusters,
          onIdentityUpdate: (identity) => {
            setAgentIdentity(identity);
            persistence.set("agent_session", JSON.stringify(identity));
          }
        }
      ),
      currentPortal === "MARKET" && agentIdentity && /* @__PURE__ */ jsxs("div", { className: "space-y-8 animate-in fade-in duration-300", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm", children: [
          /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => setMarketView("SUPPLIER"), className: `flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${marketView === "SUPPLIER" ? "bg-black text-white shadow-lg" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`, children: [
            /* @__PURE__ */ jsx("i", { className: "fas fa-seedling" }),
            " Supplier Portal"
          ] }),
          /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => setMarketView("SALES"), className: `flex-1 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${marketView === "SALES" ? "bg-black text-white shadow-lg" : "bg-slate-50 text-slate-400 hover:bg-slate-100"}`, children: [
            /* @__PURE__ */ jsx("i", { className: "fas fa-shopping-cart" }),
            " Sales Portal"
          ] })
        ] }),
        marketView === "SALES" && /* @__PURE__ */ jsxs(Fragment, { children: [
          agentIdentity.role !== SystemRole.SUPPLIER && directOrders.length > 0 && /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-[2rem] p-8 border border-slate-100 shadow-sm mb-8", children: [
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3 mb-6", children: [
              /* @__PURE__ */ jsx("div", { className: "w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center", children: /* @__PURE__ */ jsx("i", { className: "fas fa-truck text-emerald-600" }) }),
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsx("h2", { className: "text-xl font-black text-slate-800 tracking-tight", children: "Customers Direct Orders" }),
                /* @__PURE__ */ jsx("p", { className: "text-xs font-bold text-slate-400 uppercase tracking-widest mt-1", children: "Pending Fulfillment" })
              ] })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-4", children: directOrders.map((order) => /* @__PURE__ */ jsxs("div", { className: "bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-between", children: [
              /* @__PURE__ */ jsxs("div", { children: [
                /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-start mb-3", children: [
                  /* @__PURE__ */ jsxs("div", { children: [
                    /* @__PURE__ */ jsx("h3", { className: "text-sm font-black text-slate-800", children: order.cropType }),
                    /* @__PURE__ */ jsxs("p", { className: "text-[10px] font-bold text-slate-500 uppercase tracking-widest mt-0.5", children: [
                      "Qty: ",
                      order.unitsRequested,
                      " ",
                      order.unitType,
                      "s"
                    ] })
                  ] }),
                  /* @__PURE__ */ jsx("span", { className: "px-3 py-1 bg-amber-100 text-amber-700 rounded-full text-[9px] font-black uppercase tracking-widest", children: "Pending" })
                ] }),
                /* @__PURE__ */ jsxs("div", { className: "space-y-2 text-xs font-bold text-slate-600 mb-4", children: [
                  /* @__PURE__ */ jsxs("p", { children: [
                    /* @__PURE__ */ jsx("i", { className: "fas fa-user w-4 text-slate-400" }),
                    " ",
                    order.customerName,
                    " (",
                    order.customerPhone,
                    ")"
                  ] }),
                  /* @__PURE__ */ jsxs("p", { children: [
                    /* @__PURE__ */ jsx("i", { className: "fas fa-map-marker-alt w-4 text-slate-400" }),
                    " ",
                    order.deliveryAddress
                  ] }),
                  /* @__PURE__ */ jsxs("p", { children: [
                    /* @__PURE__ */ jsx("i", { className: "fas fa-store w-4 text-slate-400" }),
                    " Supplier: ",
                    order.supplierName
                  ] }),
                  /* @__PURE__ */ jsxs("p", { children: [
                    /* @__PURE__ */ jsx("i", { className: "fas fa-truck w-4 text-slate-400" }),
                    " Delivery Fee: KSh ",
                    order.deliveryFee
                  ] })
                ] })
              ] }),
              /* @__PURE__ */ jsxs("div", { className: "flex flex-col gap-2", children: [
                /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: () => handleFulfillDirectOrder(order),
                    className: "w-full bg-black hover:bg-slate-800 text-white py-3 rounded-xl font-black uppercase text-[10px] tracking-[0.15em] shadow-md transition-all active:scale-95 flex items-center justify-center gap-2",
                    children: [
                      /* @__PURE__ */ jsx("i", { className: "fas fa-check-circle" }),
                      " Fulfill Order"
                    ]
                  }
                ),
                (agentIdentity.role === SystemRole.SYSTEM_DEVELOPER || agentIdentity.role === SystemRole.MANAGER) && /* @__PURE__ */ jsxs(
                  "button",
                  {
                    onClick: () => handleClearTestOrder(order.id),
                    className: "w-full bg-red-50 hover:bg-red-100 text-red-600 py-2 rounded-xl font-black uppercase text-[9px] tracking-[0.15em] transition-colors flex items-center justify-center gap-2",
                    children: [
                      /* @__PURE__ */ jsx("i", { className: "fas fa-trash" }),
                      " Clear Test Record"
                    ]
                  }
                )
              ] })
            ] }, order.id)) })
          ] }),
          agentIdentity.role !== SystemRole.SUPPLIER && /* @__PURE__ */ jsx(SaleForm, { clusters: dynamicClusters, produceListings, agentCluster: agentIdentity.cluster, userRole: agentIdentity.role, agentPhone: agentIdentity.phone, onSubmit: handleAddRecord, initialData: fulfillmentData || void 0 }),
          /* @__PURE__ */ jsx(AuditLogTable, { data: records.filter((r) => r.isAggregate === true), title: "Universal Ledger", onEdit: handleEditRecord, isSystemDev, agentIdentity, currentPortal, marketView, handleDeleteRecord })
        ] }),
        marketView === "SUPPLIER" && /* @__PURE__ */ jsxs("div", { className: "space-y-12", children: [
          agentIdentity.role !== SystemRole.FINANCE_OFFICER && agentIdentity.role !== SystemRole.AUDITOR && /* @__PURE__ */ jsx(
            ProduceForm,
            {
              userRole: agentIdentity.role,
              agentCluster: agentIdentity.cluster,
              clusters: dynamicClusters,
              agentPhone: agentIdentity.phone,
              defaultSupplierName: agentIdentity.role === SystemRole.SUPPLIER ? agentIdentity.name : void 0,
              defaultSupplierPhone: agentIdentity.role === SystemRole.SUPPLIER ? agentIdentity.phone : void 0,
              onSubmit: handleAddProduce,
              initialData: produceInitialData
            }
          ),
          /* @__PURE__ */ jsxs("div", { className: "bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden relative", children: [
            /* @__PURE__ */ jsx("div", { className: "absolute top-0 right-0 p-8 opacity-5", children: /* @__PURE__ */ jsx("i", { className: "fas fa-warehouse text-8xl text-black" }) }),
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-black text-black uppercase tracking-widest mb-8", children: "Available Products Repository" }),
            /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left", children: [
              /* @__PURE__ */ jsx("thead", { className: "text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4", children: /* @__PURE__ */ jsxs("tr", { children: [
                /* @__PURE__ */ jsx("th", { className: "pb-4", children: "Date Posted" }),
                /* @__PURE__ */ jsx("th", { className: "pb-4", children: "Supplier Identity" }),
                /* @__PURE__ */ jsx("th", { className: "pb-4", children: "Food Coop" }),
                /* @__PURE__ */ jsx("th", { className: "pb-4", children: "Commodity" }),
                /* @__PURE__ */ jsx("th", { className: "pb-4", children: "Qty Available" }),
                /* @__PURE__ */ jsx("th", { className: "pb-4", children: "Asking Price" }),
                /* @__PURE__ */ jsx("th", { className: "pb-4 text-right", children: "Action" })
              ] }) }),
              /* @__PURE__ */ jsx("tbody", { className: "divide-y", children: produceListings.map((p) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-slate-50/50 transition-colors", children: [
                /* @__PURE__ */ jsx("td", { className: "py-6", children: /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold text-slate-400 uppercase", children: p.date || "N/A" }) }),
                /* @__PURE__ */ jsxs("td", { className: "py-6", children: [
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] font-black uppercase text-black", children: p.supplierName || "Anonymous" }),
                  /* @__PURE__ */ jsx("p", { className: "text-[9px] text-slate-400 font-mono", children: p.supplierPhone || "N/A" })
                ] }),
                /* @__PURE__ */ jsx("td", { className: "py-6", children: /* @__PURE__ */ jsx("span", { className: "text-[10px] font-bold text-slate-500 uppercase", children: p.cluster || "N/A" }) }),
                /* @__PURE__ */ jsx("td", { className: "py-6", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-3", children: [
                  p.images && p.images.length > 0 && /* @__PURE__ */ jsx("img", { src: p.images[0], alt: "", className: "w-8 h-8 rounded-lg object-cover border border-slate-200" }),
                  /* @__PURE__ */ jsx("p", { className: "text-[11px] font-black uppercase text-green-600", children: p.cropType || "Other" })
                ] }) }),
                /* @__PURE__ */ jsx("td", { className: "py-6", children: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-black text-slate-700", children: [
                  p.unitsAvailable,
                  " ",
                  p.unitType
                ] }) }),
                /* @__PURE__ */ jsx("td", { className: "py-6", children: /* @__PURE__ */ jsxs("p", { className: "text-[11px] font-black text-black", children: [
                  "KSh ",
                  p.sellingPrice.toLocaleString(),
                  " / ",
                  p.unitType
                ] }) }),
                /* @__PURE__ */ jsx("td", { className: "py-6 text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-3", children: [
                  (isPrivilegedRole(agentIdentity) || agentIdentity.role === SystemRole.SALES_AGENT || agentIdentity.role === SystemRole.SUPPLIER && normalizePhone(agentIdentity.phone) === normalizePhone(p.supplierPhone)) && /* @__PURE__ */ jsxs(Fragment, { children: [
                    /* @__PURE__ */ jsx("button", { type: "button", onClick: () => handleEditProduce(p), className: "text-blue-500 hover:text-blue-700 transition-all p-2 bg-blue-50 hover:bg-blue-100 rounded-xl", children: /* @__PURE__ */ jsx("i", { className: "fas fa-pen text-[12px]" }) }),
                    /* @__PURE__ */ jsxs("button", { type: "button", onClick: () => {
                      const input = window.prompt(`Enter new stock quantity for ${p.cropType} (Available: ${p.unitsAvailable} ${p.unitType})`, String(p.unitsAvailable));
                      if (input !== null) {
                        const val = parseFloat(input);
                        if (!isNaN(val)) handleUpdateProduceStock(p.id, val);
                      }
                    }, className: "text-blue-500 hover:text-blue-700 transition-all p-2 bg-blue-50 hover:bg-blue-100 rounded-xl flex items-center gap-1.5 px-3", children: [
                      /* @__PURE__ */ jsx("i", { className: "fas fa-boxes-stacked text-[12px]" }),
                      /* @__PURE__ */ jsx("span", { className: "text-[9px] font-black uppercase tracking-tighter", children: "Update Stock" })
                    ] }),
                    /* @__PURE__ */ jsx("button", { type: "button", onClick: (e) => {
                      e.stopPropagation();
                      handleDeleteProduce(p.id);
                    }, className: "text-red-400 hover:text-red-700 transition-all p-2 bg-red-50 hover:bg-red-100 rounded-xl", children: /* @__PURE__ */ jsx("i", { className: "fas fa-trash-can text-[14px]" }) })
                  ] }),
                  /* @__PURE__ */ jsx("span", { className: "text-[8px] font-black uppercase text-green-500 bg-green-50 px-3 py-1 rounded-full border border-green-100", children: "Live Listing" })
                ] }) })
              ] }, p.id)) })
            ] }) })
          ] })
        ] })
      ] }),
      currentPortal === "FINANCE" && agentIdentity && /* @__PURE__ */ jsxs("div", { className: "space-y-8 animate-in fade-in duration-300", children: [
        /* @__PURE__ */ jsxs("div", { className: "bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:flex-row justify-between items-center mb-8 gap-4", children: [
            /* @__PURE__ */ jsxs("div", { children: [
              /* @__PURE__ */ jsx("h3", { className: "text-sm font-black text-black uppercase tracking-tighter border-l-4 border-red-600 pl-4", children: "Weekly Food Coop Remittances" }),
              /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1 ml-5", children: "Approve Total Commission per Food Coop" })
            ] }),
            renderExportButtons(false)
          ] }),
          /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: (() => {
            const pending = records.filter((r) => r.isAggregate === true && (r.status === RecordStatus.DRAFT || r.status === RecordStatus.PENDING));
            if (pending.length === 0) {
              return /* @__PURE__ */ jsxs("div", { className: "col-span-full py-12 text-center text-slate-400", children: [
                /* @__PURE__ */ jsx("i", { className: "fas fa-check-circle text-4xl mb-4 text-green-100" }),
                /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black uppercase tracking-widest", children: "All Remittances Cleared" })
              ] });
            }
            const groups = pending.reduce((acc, r) => {
              const key = `${r.cluster || "Unassigned"}|${r.date || "Unknown Date"}`;
              if (!acc[key]) acc[key] = [];
              acc[key].push(r);
              return acc;
            }, {});
            return Object.entries(groups).map(([key, clusterRecs]) => {
              const [clusterName, date] = key.split("|");
              const totalComm = clusterRecs.reduce((sum, r) => sum + Number(r.coopProfit), 0);
              const totalSales = clusterRecs.reduce((sum, r) => sum + Number(r.totalSale), 0);
              const txCount = clusterRecs.length;
              return /* @__PURE__ */ jsxs("div", { className: "bg-slate-50 rounded-[2rem] p-8 border border-slate-100 hover:shadow-lg transition-all relative overflow-hidden group", children: [
                /* @__PURE__ */ jsx("div", { className: "absolute top-0 right-0 p-6 opacity-5", children: /* @__PURE__ */ jsx("i", { className: "fas fa-coins text-8xl text-black" }) }),
                /* @__PURE__ */ jsxs("div", { className: "relative z-10", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-start mb-6", children: [
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsxs("span", { className: "px-3 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 inline-block", children: [
                        clusterName,
                        " \u2022 ",
                        date
                      ] }),
                      /* @__PURE__ */ jsxs("h4", { className: "text-3xl font-black text-black", children: [
                        "KSh ",
                        totalComm.toLocaleString()
                      ] }),
                      /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black text-green-600 uppercase tracking-widest", children: "Commission Due" })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
                      /* @__PURE__ */ jsx("p", { className: "text-2xl font-black text-slate-300", children: txCount }),
                      /* @__PURE__ */ jsx("p", { className: "text-[8px] font-black text-slate-400 uppercase tracking-widest", children: "Orders" })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "mb-8", children: [
                    /* @__PURE__ */ jsxs("p", { className: "text-[9px] font-bold text-slate-400 uppercase tracking-widest flex justify-between", children: [
                      /* @__PURE__ */ jsx("span", { children: "Total Sales Volume" }),
                      /* @__PURE__ */ jsxs("span", { className: "text-slate-600", children: [
                        "KSh ",
                        totalSales.toLocaleString()
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx("div", { className: "w-full bg-slate-200 h-1 mt-2 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "bg-green-500 h-full w-[10%]" }) }),
                    /* @__PURE__ */ jsx("p", { className: "text-[8px] text-slate-400 mt-1 text-right", children: "10% Margin" })
                  ] }),
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      onClick: () => handleConfirmClusterRemittance(clusterName, date),
                      className: "w-full bg-black text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-green-600 transition-all flex items-center justify-center gap-2",
                      children: [
                        /* @__PURE__ */ jsx("i", { className: "fas fa-check-double" }),
                        " Confirm Remittance"
                      ]
                    }
                  )
                ] })
              ] }, key);
            });
          })() })
        ] }),
        /* @__PURE__ */ jsx(AuditLogTable, { data: records.filter((r) => r.isAggregate === true && (r.status === RecordStatus.DRAFT || r.status === RecordStatus.PENDING)), title: "Pending Remittances Ledger", groupBy: "cluster_and_date", isSystemDev, agentIdentity, currentPortal, marketView, handleDeleteRecord })
      ] }),
      currentPortal === "AUDIT" && agentIdentity && /* @__PURE__ */ jsxs("div", { className: "space-y-8 animate-in fade-in duration-300", children: [
        /* @__PURE__ */ jsxs("div", { className: "bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:flex-row justify-between items-center mb-8 gap-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-black text-black uppercase tracking-tighter border-l-4 border-black pl-4", children: "Awaiting Approval & Verification" }),
            renderExportButtons(false)
          ] }),
          /* @__PURE__ */ jsx("div", { className: "grid grid-cols-1 lg:grid-cols-2 gap-8", children: (() => {
            const awaiting = records.filter((r) => r.isAggregate === true && (r.status === RecordStatus.PAID || r.status === RecordStatus.COMPLETE));
            if (awaiting.length === 0) {
              return /* @__PURE__ */ jsxs("div", { className: "col-span-full py-12 text-center text-slate-400", children: [
                /* @__PURE__ */ jsx("i", { className: "fas fa-check-circle text-4xl mb-4 text-green-100" }),
                /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black uppercase tracking-widest", children: "All Records Verified" })
              ] });
            }
            const groups = awaiting.reduce((acc, r) => {
              const key = `${r.cluster || "Unassigned"}|${r.date || "Unknown Date"}`;
              if (!acc[key]) acc[key] = [];
              acc[key].push(r);
              return acc;
            }, {});
            return Object.entries(groups).map(([key, clusterRecs]) => {
              const [clusterName, date] = key.split("|");
              const totalComm = clusterRecs.reduce((sum, r) => sum + Number(r.coopProfit), 0);
              const totalSales = clusterRecs.reduce((sum, r) => sum + Number(r.totalSale), 0);
              const txCount = clusterRecs.length;
              return /* @__PURE__ */ jsxs("div", { className: "bg-slate-50 rounded-[2rem] p-8 border border-slate-100 hover:shadow-lg transition-all relative overflow-hidden group", children: [
                /* @__PURE__ */ jsx("div", { className: "absolute top-0 right-0 p-6 opacity-5", children: /* @__PURE__ */ jsx("i", { className: "fas fa-stamp text-8xl text-black" }) }),
                /* @__PURE__ */ jsxs("div", { className: "relative z-10", children: [
                  /* @__PURE__ */ jsxs("div", { className: "flex justify-between items-start mb-6", children: [
                    /* @__PURE__ */ jsxs("div", { children: [
                      /* @__PURE__ */ jsxs("span", { className: "px-3 py-1 bg-white border border-slate-200 rounded-full text-[9px] font-black uppercase tracking-widest text-slate-500 mb-2 inline-block", children: [
                        clusterName,
                        " \u2022 ",
                        date
                      ] }),
                      /* @__PURE__ */ jsxs("h4", { className: "text-3xl font-black text-black", children: [
                        "KSh ",
                        totalComm.toLocaleString()
                      ] }),
                      /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black text-green-600 uppercase tracking-widest", children: "Commission Verified" })
                    ] }),
                    /* @__PURE__ */ jsxs("div", { className: "text-right", children: [
                      /* @__PURE__ */ jsx("p", { className: "text-2xl font-black text-slate-300", children: txCount }),
                      /* @__PURE__ */ jsx("p", { className: "text-[8px] font-black text-slate-400 uppercase tracking-widest", children: "Orders" })
                    ] })
                  ] }),
                  /* @__PURE__ */ jsxs("div", { className: "mb-8", children: [
                    /* @__PURE__ */ jsxs("p", { className: "text-[9px] font-bold text-slate-400 uppercase tracking-widest flex justify-between", children: [
                      /* @__PURE__ */ jsx("span", { children: "Total Sales Volume" }),
                      /* @__PURE__ */ jsxs("span", { className: "text-slate-600", children: [
                        "KSh ",
                        totalSales.toLocaleString()
                      ] })
                    ] }),
                    /* @__PURE__ */ jsx("div", { className: "w-full bg-slate-200 h-1 mt-2 rounded-full overflow-hidden", children: /* @__PURE__ */ jsx("div", { className: "bg-green-500 h-full w-[10%]" }) }),
                    /* @__PURE__ */ jsx("p", { className: "text-[8px] text-slate-400 mt-1 text-right", children: "10% Margin" })
                  ] }),
                  /* @__PURE__ */ jsxs(
                    "button",
                    {
                      onClick: () => handleVerifyClusterRemittance(clusterName, date),
                      className: "w-full bg-black text-white py-4 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-xl hover:bg-slate-800 transition-all flex items-center justify-center gap-2",
                      children: [
                        /* @__PURE__ */ jsx("i", { className: "fas fa-stamp" }),
                        " Verify & Seal"
                      ]
                    }
                  )
                ] })
              ] }, key);
            });
          })() })
        ] }),
        /* @__PURE__ */ jsx(AuditLogTable, { data: records.filter((r) => r.isAggregate === true && (r.status === RecordStatus.PAID || r.status === RecordStatus.COMPLETE)), title: "Verified Orders Ledger", groupBy: "cluster_and_date", isSystemDev, agentIdentity, currentPortal, marketView, handleDeleteRecord })
      ] }),
      currentPortal === "BOARD" && agentIdentity && /* @__PURE__ */ jsxs("div", { className: "space-y-8 animate-in fade-in duration-300", children: [
        /* @__PURE__ */ jsxs("div", { className: "grid grid-cols-1 md:grid-cols-2 gap-6", children: [
          /* @__PURE__ */ jsxs("div", { className: "bg-slate-900 rounded-[2.5rem] p-10 text-white shadow-xl relative overflow-hidden", children: [
            /* @__PURE__ */ jsxs("div", { className: "relative z-10", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2", children: "All Time Grand Total Sales Volume" }),
              /* @__PURE__ */ jsxs("p", { className: "text-4xl font-black text-white", children: [
                "KSh ",
                grandTotalVolume.toLocaleString()
              ] }),
              /* @__PURE__ */ jsx("p", { className: "text-[10px] font-bold text-slate-500 mt-2 uppercase", children: "All Food Coops Combined" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "absolute right-0 bottom-0 opacity-10 p-6", children: /* @__PURE__ */ jsx("i", { className: "fas fa-chart-line text-8xl" }) })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "bg-green-600 rounded-[2.5rem] p-10 text-white shadow-xl relative overflow-hidden", children: [
            /* @__PURE__ */ jsxs("div", { className: "relative z-10", children: [
              /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black text-green-200 uppercase tracking-[0.3em] mb-2", children: "All Time Grand Total Coop Commission" }),
              /* @__PURE__ */ jsxs("p", { className: "text-4xl font-black text-white", children: [
                "KSh ",
                grandTotalCommission.toLocaleString()
              ] }),
              /* @__PURE__ */ jsx("p", { className: "text-[10px] font-bold text-green-200 mt-2 uppercase", children: "Total Revenue Generated (10% Share)" })
            ] }),
            /* @__PURE__ */ jsx("div", { className: "absolute right-0 bottom-0 opacity-10 p-6", children: /* @__PURE__ */ jsx("i", { className: "fas fa-hand-holding-dollar text-8xl" }) })
          ] })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl overflow-hidden", children: [
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col sm:flex-row justify-between items-start sm:items-center mb-10 gap-4", children: [
            /* @__PURE__ */ jsx("h3", { className: "text-sm font-black text-black uppercase tracking-tighter border-l-4 border-green-500 pl-4", children: "Food Coop Performance Breakdown" }),
            /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
              /* @__PURE__ */ jsxs(
                "select",
                {
                  value: boardTimeFilter,
                  onChange: (e) => setBoardTimeFilter(e.target.value),
                  className: "bg-slate-50 border border-slate-200 text-slate-700 text-[10px] font-black uppercase tracking-widest rounded-xl px-4 py-2.5 outline-none focus:border-green-500 transition-all cursor-pointer",
                  children: [
                    /* @__PURE__ */ jsx("option", { value: "7", children: "Last 7 Days" }),
                    /* @__PURE__ */ jsx("option", { value: "14", children: "Last 14 Days" }),
                    /* @__PURE__ */ jsx("option", { value: "28", children: "Last 28 Days" }),
                    /* @__PURE__ */ jsx("option", { value: "all", children: "All Time" })
                  ]
                }
              ),
              renderExportButtons(true)
            ] })
          ] }),
          /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left", children: [
            /* @__PURE__ */ jsx("thead", { className: "text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-50", children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { className: "pb-6", children: "Food Coops" }),
              /* @__PURE__ */ jsx("th", { className: "pb-6", children: "Total Sales Volume (Ksh)" }),
              /* @__PURE__ */ jsx("th", { className: "pb-6", children: "Coop Commission (10%)" })
            ] }) }),
            /* @__PURE__ */ jsxs("tbody", { className: "divide-y divide-slate-50", children: [
              boardMetrics.clusterPerformance.map(([cluster, stats2]) => /* @__PURE__ */ jsxs("tr", { className: "hover:bg-slate-50/50", children: [
                /* @__PURE__ */ jsx("td", { className: "py-6 font-black text-black uppercase text-[11px]", children: cluster }),
                /* @__PURE__ */ jsxs("td", { className: "py-6 font-black text-slate-900 text-[11px]", children: [
                  "KSh ",
                  stats2.volume.toLocaleString()
                ] }),
                /* @__PURE__ */ jsxs("td", { className: "py-6 font-black text-green-600 text-[11px]", children: [
                  "KSh ",
                  stats2.profit.toLocaleString()
                ] })
              ] }, cluster)),
              /* @__PURE__ */ jsxs("tr", { className: "bg-slate-900 text-white rounded-3xl overflow-hidden shadow-xl", children: [
                /* @__PURE__ */ jsx("td", { className: "py-6 px-8 font-black uppercase text-[11px] rounded-l-3xl", children: "Aggregate Performance" }),
                /* @__PURE__ */ jsxs("td", { className: "py-6 font-black text-[11px]", children: [
                  "KSh ",
                  boardMetrics.clusterPerformance.reduce((a, b) => a + b[1].volume, 0).toLocaleString()
                ] }),
                /* @__PURE__ */ jsxs("td", { className: "py-6 px-8 font-black text-green-400 text-[11px] rounded-r-3xl", children: [
                  "KSh ",
                  boardMetrics.clusterPerformance.reduce((a, b) => a + b[1].profit, 0).toLocaleString()
                ] })
              ] })
            ] })
          ] }) })
        ] }),
        /* @__PURE__ */ jsx(AuditLogTable, { data: records.filter((r) => r.isAggregate === true), title: "Universal Ledger", isSystemDev, agentIdentity, currentPortal, marketView, handleDeleteRecord })
      ] }),
      currentPortal === "FORMS" && agentIdentity && /* @__PURE__ */ jsx("div", { className: "animate-in fade-in duration-300", children: /* @__PURE__ */ jsx(FarmForms, { agentIdentity, dynamicClusters, users: combinedUsers, onFormSubmitted: loadFarmRecords }) }),
      currentPortal === "FARM_DATA" && agentIdentity && /* @__PURE__ */ jsx("div", { className: "animate-in fade-in duration-300", children: /* @__PURE__ */ jsx(
        FarmDataMap,
        {
          data: farmFormsData,
          isSystemDev,
          onRefresh: () => {
            window.location.reload();
          }
        }
      ) }),
      currentPortal === "TABLE_BANKING" && agentIdentity && /* @__PURE__ */ jsxs("div", { className: "animate-in fade-in duration-300 space-y-12", children: [
        /* @__PURE__ */ jsx(TableBanking, { agentIdentity, clusters: dynamicClusters, onAddLedgerRecord: handleAddRecord }),
        /* @__PURE__ */ jsxs("div", { className: "mt-12 bg-white/50 backdrop-blur-sm p-8 rounded-[2.5rem] border border-slate-200", children: [
          /* @__PURE__ */ jsx("h3", { className: "text-xl font-black mb-6 text-slate-800", children: "Finance & Banking Ledger" }),
          /* @__PURE__ */ jsx(AuditLogTable, { data: records.filter((r) => r.isAggregate === true), title: "Universal Ledger", isSystemDev, agentIdentity, currentPortal, marketView, handleDeleteRecord })
        ] })
      ] }),
      currentPortal === "VOUCHERS" && agentIdentity && /* @__PURE__ */ jsx("div", { className: "animate-in fade-in duration-300", children: /* @__PURE__ */ jsx(PhysicalVoucherGenerator, {}) }),
      currentPortal === "SYSTEM" && isSystemDev && agentIdentity && /* @__PURE__ */ jsxs("div", { className: "space-y-12 animate-in fade-in duration-300", children: [
        /* @__PURE__ */ jsxs("div", { className: "bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-xl", children: [
          /* @__PURE__ */ jsx("h3", { className: "text-sm font-black text-black uppercase tracking-tighter border-l-4 border-blue-500 pl-4 mb-6", children: "Food Coop Management" }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-col md:flex-row gap-4", children: [
            /* @__PURE__ */ jsx(
              "input",
              {
                type: "text",
                id: "newFoodCoopInput",
                placeholder: "Enter new Food Coop name",
                className: "flex-1 bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-blue-400 transition-all min-w-[200px]"
              }
            ),
            /* @__PURE__ */ jsx(
              "button",
              {
                disabled: addCoopStatus.status === "loading",
                onClick: async () => {
                  try {
                    setAddCoopStatus({ status: "loading" });
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Request timed out")), 15e3));
                    const input = document.getElementById("newFoodCoopInput");
                    if (!input || !input.value.trim()) {
                      setAddCoopStatus({ status: "warning", message: "Enter Name" });
                      setTimeout(() => setAddCoopStatus({ status: "idle" }), 3e3);
                      return;
                    }
                    const newCoop = input.value.trim();
                    if (dynamicClusters.includes(newCoop)) {
                      setAddCoopStatus({ status: "warning", message: "Already Exists" });
                      setTimeout(() => setAddCoopStatus({ status: "idle" }), 3e3);
                      return;
                    }
                    const newCoops = [...customFoodCoops, newCoop];
                    setCustomFoodCoops(newCoops);
                    const coopsPromise = supabase.from("pages").upsert({ id: "system_food_coops", title: "Food Coops", content: JSON.stringify(newCoops) });
                    const { error: coopsError } = await Promise.race([coopsPromise, timeoutPromise]);
                    if (coopsError) throw coopsError;
                    input.value = "";
                    setAddCoopStatus({ status: "success", message: "Added Successfully" });
                    setTimeout(() => setAddCoopStatus({ status: "idle" }), 3e3);
                  } catch (err) {
                    console.error("Error adding Food Coop:", err);
                    const errorMsg = err?.message || "Error occurred";
                    setAddCoopStatus({ status: "error", message: errorMsg.slice(0, 30) });
                    setTimeout(() => setAddCoopStatus({ status: "idle" }), 5e3);
                  }
                },
                className: `text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-xl whitespace-nowrap transition-all ${addCoopStatus.status === "success" ? "bg-green-600" : addCoopStatus.status === "error" ? "bg-red-600" : addCoopStatus.status === "warning" ? "bg-orange-500" : "bg-blue-600 hover:bg-blue-700"}`,
                children: addCoopStatus.status === "loading" ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("i", { className: "fas fa-spinner fa-spin mr-2" }),
                  " Processing..."
                ] }) : addCoopStatus.status === "success" ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("i", { className: "fas fa-check mr-2" }),
                  " ",
                  addCoopStatus.message
                ] }) : addCoopStatus.status === "error" ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("i", { className: "fas fa-times mr-2" }),
                  " ",
                  addCoopStatus.message
                ] }) : addCoopStatus.status === "warning" ? /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("i", { className: "fas fa-exclamation-circle mr-2" }),
                  " ",
                  addCoopStatus.message
                ] }) : /* @__PURE__ */ jsxs(Fragment, { children: [
                  /* @__PURE__ */ jsx("i", { className: "fas fa-plus mr-2" }),
                  " Add Food Coop"
                ] })
              }
            )
          ] }),
          /* @__PURE__ */ jsx("div", { className: "mt-6 flex flex-wrap gap-2", children: dynamicClusters.map((c) => /* @__PURE__ */ jsx("span", { className: "px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest", children: c }, c)) })
        ] }),
        /* @__PURE__ */ jsx(AdminInvite, { foodCoops: dynamicClusters }),
        /* @__PURE__ */ jsx(WeatherWidget, { defaultCluster: "Mariwa", clusters: dynamicClusters }),
        /* @__PURE__ */ jsx("div", { className: "bg-slate-900 text-white rounded-[2.5rem] p-10 border border-black shadow-2xl relative overflow-hidden", children: /* @__PURE__ */ jsxs("div", { className: "relative z-10 flex flex-col md:flex-row justify-between items-center gap-8", children: [
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black uppercase tracking-[0.4em] text-green-500 mb-2", children: "Cloud Storage Node" }),
            /* @__PURE__ */ jsx("h4", { className: "text-2xl font-black uppercase tracking-tight", children: "Master Database Repository" })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "flex flex-wrap gap-4", children: [
            /* @__PURE__ */ jsxs("button", { onClick: handleDeleteAllProduce, className: "bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-700 shadow-xl flex items-center gap-2", children: [
              /* @__PURE__ */ jsx("i", { className: "fas fa-warehouse" }),
              " Purge Repository"
            ] }),
            /* @__PURE__ */ jsxs("button", { onClick: handlePurgeAuditLog, className: "bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-700 shadow-xl flex items-center gap-2", children: [
              /* @__PURE__ */ jsx("i", { className: "fas fa-file-invoice-dollar" }),
              " Purge Ledger"
            ] }),
            /* @__PURE__ */ jsxs("button", { onClick: handlePurgeOrders, className: "bg-red-600 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-700 shadow-xl flex items-center gap-2", children: [
              /* @__PURE__ */ jsx("i", { className: "fas fa-shopping-basket" }),
              " Purge Orders"
            ] }),
            /* @__PURE__ */ jsxs("button", { onClick: handlePurgeUsers, className: "bg-red-600/80 text-white px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-red-700 shadow-xl flex items-center gap-2", children: [
              /* @__PURE__ */ jsx("i", { className: "fas fa-users-slash" }),
              " Purge Users"
            ] })
          ] })
        ] }) }),
        /* @__PURE__ */ jsxs("div", { className: "bg-white rounded-[2.5rem] p-10 border border-slate-200 shadow-xl", children: [
          /* @__PURE__ */ jsx("h3", { className: "text-sm font-black text-black uppercase tracking-tighter mb-8 border-l-4 border-red-600 pl-4", children: "Agent Activation & Security" }),
          /* @__PURE__ */ jsx("div", { className: "overflow-x-auto", children: /* @__PURE__ */ jsxs("table", { className: "w-full text-left", children: [
            /* @__PURE__ */ jsx("thead", { className: "text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-4", children: /* @__PURE__ */ jsxs("tr", { children: [
              /* @__PURE__ */ jsx("th", { className: "pb-4", children: "User Identity" }),
              /* @__PURE__ */ jsx("th", { className: "pb-4", children: "Role / Node" }),
              /* @__PURE__ */ jsx("th", { className: "pb-4", children: "Metadata" }),
              /* @__PURE__ */ jsx("th", { className: "pb-4", children: "Status" }),
              /* @__PURE__ */ jsx("th", { className: "pb-4 text-right", children: "Access Control" })
            ] }) }),
            /* @__PURE__ */ jsx("tbody", { className: "divide-y", children: combinedUsers.map((u) => /* @__PURE__ */ jsxs("tr", { className: "group hover:bg-slate-50/50", children: [
              /* @__PURE__ */ jsxs("td", { className: "py-6", children: [
                /* @__PURE__ */ jsx("p", { className: "text-sm font-black uppercase text-black", children: u.name }),
                /* @__PURE__ */ jsx("p", { className: "text-[10px] font-bold text-slate-400", children: u.phone }),
                u.email && /* @__PURE__ */ jsx("p", { className: "text-[9px] font-medium text-blue-500", children: u.email })
              ] }),
              /* @__PURE__ */ jsxs("td", { className: "py-6", children: [
                /* @__PURE__ */ jsx("p", { className: "text-[11px] font-black text-black uppercase", children: u.role }),
                /* @__PURE__ */ jsx("p", { className: "text-[9px] text-slate-400 font-bold", children: u.role === SystemRole.SYSTEM_DEVELOPER || u.role === SystemRole.FINANCE_OFFICER || u.role === SystemRole.AUDITOR || u.role === SystemRole.MANAGER ? "-" : u.cluster })
              ] }),
              /* @__PURE__ */ jsx("td", { className: "py-6", children: /* @__PURE__ */ jsxs("div", { className: "space-y-1", children: [
                u.lastSignInAt && /* @__PURE__ */ jsxs("p", { className: "text-[9px] font-bold text-slate-500 uppercase", children: [
                  "Last Seen: ",
                  /* @__PURE__ */ jsx("span", { className: "text-black", children: new Date(u.lastSignInAt).toLocaleDateString() })
                ] }),
                u.provider && /* @__PURE__ */ jsxs("span", { className: "px-2 py-0.5 rounded bg-slate-100 text-[8px] font-black uppercase text-slate-400 tracking-wider", children: [
                  "via ",
                  u.provider
                ] })
              ] }) }),
              /* @__PURE__ */ jsx("td", { className: "py-6", children: /* @__PURE__ */ jsx("span", { className: `px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${u.status === "ACTIVE" ? "bg-green-100 text-green-700" : "bg-red-50 text-red-600"}`, children: u.status || "AWAITING" }) }),
              /* @__PURE__ */ jsx("td", { className: "py-6 text-right", children: /* @__PURE__ */ jsxs("div", { className: "flex items-center justify-end gap-3", children: [
                u.status === "ACTIVE" ? /* @__PURE__ */ jsx("button", { type: "button", onClick: (e) => {
                  e.stopPropagation();
                  handleToggleUserStatus(u.phone, "ACTIVE");
                }, className: "bg-white border border-red-200 text-red-600 px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-sm", children: "Deactivate" }) : /* @__PURE__ */ jsx("button", { type: "button", onClick: (e) => {
                  e.stopPropagation();
                  handleToggleUserStatus(u.phone);
                }, className: "bg-green-500 text-white px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase shadow-md", children: "Reactivate" }),
                /* @__PURE__ */ jsx("button", { type: "button", onClick: (e) => {
                  e.stopPropagation();
                  handleDeleteUser(u.phone);
                }, className: "text-slate-300 hover:text-red-600 p-2", children: /* @__PURE__ */ jsx("i", { className: "fas fa-trash-alt text-[12px]" }) })
              ] }) })
            ] }, u.phone)) })
          ] }) })
        ] }),
        /* @__PURE__ */ jsx(AuditLogTable, { data: records.filter((r) => r.isAggregate === true), title: "Universal Ledger", isSystemDev, agentIdentity, currentPortal, marketView, handleDeleteRecord })
      ] })
    ] }),
    orderingProduct && agentIdentity && /* @__PURE__ */ jsx(
      OrderModal,
      {
        product: orderingProduct,
        agentIdentity,
        onClose: () => setOrderingProduct(null),
        onSubmit: async (order) => {
          const newOrders = [...marketOrders, order];
          setMarketOrders(newOrders);
          persistence.set("food_coop_orders", JSON.stringify(newOrders));
          setOrderingProduct(null);
          alert("Order placed successfully! You pay on delivery.");
          if (navigator.onLine) {
            const success = await saveOrder(order);
            if (success) {
              setMarketOrders((prev) => {
                const updated = prev.map((o) => o.id === order.id ? { ...o, synced: true } : o);
                persistence.set("food_coop_orders", JSON.stringify(updated));
                return updated;
              });
            }
          }
        }
      }
    ),
    isReportOpen && reportData && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200", onClick: () => setIsReportOpen(false), children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-4xl max-h-[80vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxs("div", { className: "p-8 border-b border-slate-100 flex justify-between items-center bg-slate-50", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4", children: [
          /* @__PURE__ */ jsx("div", { className: "w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center", children: /* @__PURE__ */ jsx("i", { className: "fas fa-robot text-xl" }) }),
          /* @__PURE__ */ jsx("div", { children: /* @__PURE__ */ jsx("h3", { className: "text-xl font-black text-black uppercase tracking-tight", children: "AI Market Audit" }) })
        ] }),
        /* @__PURE__ */ jsx("button", { onClick: () => setIsReportOpen(false), className: "w-10 h-10 rounded-full bg-slate-200 hover:bg-red-50 hover:text-red-600 transition-colors flex items-center justify-center", children: /* @__PURE__ */ jsx("i", { className: "fas fa-times" }) })
      ] }),
      /* @__PURE__ */ jsx("div", { className: "p-8 overflow-y-auto flex-1 bg-white font-medium text-slate-600 leading-relaxed text-sm whitespace-pre-wrap", children: reportData }),
      /* @__PURE__ */ jsx("div", { className: "p-6 border-t border-slate-100 bg-slate-50 flex justify-end", children: /* @__PURE__ */ jsx("button", { onClick: () => setIsReportOpen(false), className: "bg-black text-white px-8 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800", children: "Close Report" }) })
    ] }) }),
    viewingNewsArticle && /* @__PURE__ */ jsx("div", { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200", onClick: handleCloseNews, children: /* @__PURE__ */ jsxs("div", { className: "bg-white w-full max-w-3xl max-h-[85vh] rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col", onClick: (e) => e.stopPropagation(), children: [
      /* @__PURE__ */ jsxs("div", { className: "relative h-64 shrink-0", children: [
        /* @__PURE__ */ jsx("img", { src: viewingNewsArticle.image, alt: viewingNewsArticle.title, className: "w-full h-full object-cover" }),
        /* @__PURE__ */ jsx("div", { className: "absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" }),
        /* @__PURE__ */ jsxs("div", { className: "absolute top-4 right-4 flex gap-2", children: [
          canManageNews && /* @__PURE__ */ jsx(
            "button",
            {
              onClick: () => {
                setEditingNewsArticle(viewingNewsArticle);
                setCurrentPortal("NEWS");
                setViewingNewsArticle(null);
              },
              title: "Edit Post",
              className: "w-10 h-10 rounded-full bg-white/20 hover:bg-white text-white hover:text-black backdrop-blur-md flex items-center justify-center transition-all",
              children: /* @__PURE__ */ jsx("i", { className: "fas fa-edit" })
            }
          ),
          /* @__PURE__ */ jsx("button", { onClick: () => handleShareNews(viewingNewsArticle), title: "Copy Link", className: "w-10 h-10 rounded-full bg-white/20 hover:bg-white text-white hover:text-black backdrop-blur-md flex items-center justify-center transition-all", children: /* @__PURE__ */ jsx("i", { className: "fas fa-link" }) }),
          /* @__PURE__ */ jsx("button", { onClick: handleCloseNews, className: "w-10 h-10 rounded-full bg-white/20 hover:bg-white text-white hover:text-black backdrop-blur-md flex items-center justify-center transition-all", children: /* @__PURE__ */ jsx("i", { className: "fas fa-times" }) })
        ] }),
        /* @__PURE__ */ jsxs("div", { className: "absolute bottom-6 left-8 right-8", children: [
          /* @__PURE__ */ jsx("span", { className: "px-3 py-1 bg-green-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest mb-3 inline-block", children: viewingNewsArticle.category }),
          /* @__PURE__ */ jsx("h2", { className: "text-2xl md:text-3xl font-black text-white leading-tight", children: viewingNewsArticle.title })
        ] })
      ] }),
      /* @__PURE__ */ jsxs("div", { className: "p-8 md:p-12 overflow-y-auto flex-1 bg-white", children: [
        /* @__PURE__ */ jsxs("div", { className: "flex items-center gap-4 mb-8 pb-8 border-b border-slate-100", children: [
          /* @__PURE__ */ jsx("div", { className: "w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400", children: /* @__PURE__ */ jsx("i", { className: "fas fa-user-circle text-2xl" }) }),
          /* @__PURE__ */ jsxs("div", { children: [
            /* @__PURE__ */ jsx("p", { className: "text-sm font-black text-black uppercase", children: viewingNewsArticle.author }),
            /* @__PURE__ */ jsx("p", { className: "text-xs text-slate-500 font-medium", children: viewingNewsArticle.role })
          ] }),
          /* @__PURE__ */ jsxs("div", { className: "ml-auto text-right", children: [
            /* @__PURE__ */ jsx("p", { className: "text-[10px] font-black text-slate-400 uppercase tracking-widest", children: "Published" }),
            /* @__PURE__ */ jsx("p", { className: "text-xs font-bold text-black", children: viewingNewsArticle.date })
          ] })
        ] }),
        /* @__PURE__ */ jsx(
          "div",
          {
            className: "prose prose-slate max-w-none font-medium text-slate-600 leading-relaxed",
            dangerouslySetInnerHTML: { __html: String(viewingNewsArticle.content) }
          }
        )
      ] })
    ] }) }),
    /* @__PURE__ */ jsx("footer", { className: "container mx-auto px-6 py-8 mt-12 border-t border-slate-100 text-center relative z-20", children: /* @__PURE__ */ jsxs("p", { className: "text-slate-400 text-xs font-medium", children: [
      "\xA9 ",
      (/* @__PURE__ */ new Date()).getFullYear(),
      " Kenyan Peasants League (KPL) Food Coop Market. All rights reserved."
    ] }) })
  ] });
};
var App_default = App;
export {
  App_default as default
};
