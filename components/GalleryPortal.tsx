import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AgentIdentity, GalleryItem, GalleryMediaType, SystemRole, isSuperAgent } from '../types';
import { FOOD_COOPS } from '../constants';
import { uploadGalleryMedia } from '../services/supabaseService';
import {
  Camera,
  Film,
  Youtube,
  Plus,
  Search,
  X,
  Play,
  Trash2,
  Edit3,
  ChevronLeft,
  ChevronRight,
  Upload,
  Check,
  Share2,
  Calendar,
  MapPin,
  User,
  ExternalLink,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface GalleryPortalProps {
  items: GalleryItem[];
  agentIdentity: AgentIdentity | null;
  clusters: string[];
  onSaveItem: (item: GalleryItem) => Promise<void> | void;
  onDeleteItem: (id: string) => Promise<void> | void;
  onNavigateLogin?: () => void;
}

const GALLERY_CATEGORIES = [
  'Field Exchange',
  'Labour Solidarity',
  'Counter COP 31',
  'Agroecology & Seed Saving',
  'Harvest & Market Day',
  'Exchange Documentary',
  'Community Training & Youth',
  'Food Coop Life'
];

const NATIONAL_COOP_OPTION = 'All Food Coops / National';

// Extract 11-char YouTube ID from watch, youtu.be, shorts, embed, live URLs
export function extractYouTubeId(rawUrl: string): string | null {
  const input = (rawUrl || '').trim();
  if (!input) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(input)) return input;

  try {
    const url = new URL(input.startsWith('http') ? input : `https://${input}`);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    if (host === 'youtu.be') {
      const seg = url.pathname.split('/').filter(Boolean)[0];
      return seg && /^[a-zA-Z0-9_-]{11}$/.test(seg) ? seg : null;
    }
    if (host.includes('youtube.com') || host.includes('youtube-nocookie.com')) {
      const v = url.searchParams.get('v');
      if (v && /^[a-zA-Z0-9_-]{11}$/.test(v)) return v;
      const parts = url.pathname.split('/').filter(Boolean);
      for (const prefix of ['embed', 'shorts', 'live', 'v']) {
        const idx = parts.indexOf(prefix);
        if (idx !== -1 && parts[idx + 1] && /^[a-zA-Z0-9_-]{11}$/.test(parts[idx + 1])) {
          return parts[idx + 1];
        }
      }
    }
  } catch {
    // Fallback regex
  }

  const fallbackMatch = input.match(/(?:v=|\/embed\/|\/shorts\/|\/live\/|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
  return fallbackMatch ? fallbackMatch[1] : null;
}

const formatDuration = (seconds: number): string => {
  if (!isFinite(seconds) || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatDateLabel = (dateStr?: string): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-KE', { day: 'numeric', month: 'short', year: 'numeric' });
};

const normalizePhone9 = (p?: string) => (p || '').replace(/\D/g, '').slice(-9);

// Compress image client-side for rapid uploads on rural mobile networks
const compressImageToBlob = (file: File, maxWidth = 1400, quality = 0.8): Promise<{ blob: Blob; previewUrl: string }> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob) {
              resolve({ blob, previewUrl: canvas.toDataURL('image/jpeg', 0.72) });
            } else {
              reject(new Error('Image compression failed'));
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Could not decode image file'));
      img.src = src;
    };
    reader.onerror = () => reject(new Error('Could not read image file'));
    reader.readAsDataURL(file);
  });
};

// Extract video duration and first clean poster frame from a short video file
const extractVideoMetadata = (file: File): Promise<{ durationLabel: string; posterBlob: Blob | null; posterPreview: string | null }> => {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const objectUrl = URL.createObjectURL(file);
    video.preload = 'metadata';
    video.muted = true;
    video.playsInline = true;
    video.src = objectUrl;

    let settled = false;
    const finish = (durationLabel: string, posterBlob: Blob | null, posterPreview: string | null) => {
      if (settled) return;
      settled = true;
      URL.revokeObjectURL(objectUrl);
      resolve({ durationLabel, posterBlob, posterPreview });
    };

    const timeout = setTimeout(() => finish('', null, null), 4500);

    video.onloadedmetadata = () => {
      const dur = formatDuration(video.duration);
      const seekTo = isFinite(video.duration) && video.duration > 1 ? Math.min(1, video.duration / 3) : 0;
      video.currentTime = seekTo;

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          const scale = Math.min(1, 960 / (video.videoWidth || 960));
          canvas.width = Math.max(320, Math.round((video.videoWidth || 640) * scale));
          canvas.height = Math.max(180, Math.round((video.videoHeight || 360) * scale));
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);
          const preview = canvas.toDataURL('image/jpeg', 0.75);
          canvas.toBlob(
            (blob) => {
              clearTimeout(timeout);
              finish(dur, blob, preview);
            },
            'image/jpeg',
            0.78
          );
        } catch {
          clearTimeout(timeout);
          finish(dur, null, null);
        }
      };
    };

    video.onerror = () => {
      clearTimeout(timeout);
      finish('', null, null);
    };
  });
};

const GalleryPortal: React.FC<GalleryPortalProps> = ({
  items,
  agentIdentity,
  clusters,
  onSaveItem,
  onDeleteItem,
  onNavigateLogin
}) => {
  // STRICT PERMISSION RULE: Any logged-in account EXCEPT Customer can post/upload updates
  const canContribute = Boolean(agentIdentity && agentIdentity.role !== SystemRole.CUSTOMER);

  const isModerator = Boolean(
    agentIdentity &&
      (agentIdentity.role === SystemRole.SYSTEM_DEVELOPER ||
        agentIdentity.role === SystemRole.MANAGER ||
        agentIdentity.role === SystemRole.SALES_MANAGER ||
        isSuperAgent(agentIdentity.phone))
  );

  const canModifyItem = (item: GalleryItem): boolean => {
    if (!canContribute || !agentIdentity) return false;
    if (isModerator) return true;
    const myPhone = normalizePhone9(agentIdentity.phone);
    const authorPhone = normalizePhone9(item.authorPhone);
    return Boolean(myPhone && authorPhone && myPhone === authorPhone);
  };

  // All 53+ Food Coops sorted cleanly
  const allCoops = useMemo(() => {
    return Array.from(new Set([...FOOD_COOPS, ...clusters]))
      .filter((c) => c && c !== '-' && c !== 'Unassigned')
      .sort((a, b) => a.localeCompare(b));
  }, [clusters]);

  // Filters
  const [mediaFilter, setMediaFilter] = useState<'ALL' | GalleryMediaType>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [coopFilter, setCoopFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Featured documentary inline play toggle
  const [playingSpotlightId, setPlayingSpotlightId] = useState<string | null>(null);

  // Lightbox viewer
  const [activeLightboxId, setActiveLightboxId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Publish / Edit Modal state
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GalleryItem | null>(null);
  const [composerTab, setComposerTab] = useState<GalleryMediaType>('PHOTO');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(GALLERY_CATEGORIES[0]);
  const [selectedCoop, setSelectedCoop] = useState(agentIdentity?.cluster && agentIdentity.cluster !== '-' ? agentIdentity.cluster : NATIONAL_COOP_OPTION);
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [durationLabel, setDurationLabel] = useState('');

  // File upload states
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [videoPosterBlob, setVideoPosterBlob] = useState<Blob | null>(null);
  const [youtubeInput, setYoutubeInput] = useState('');

  // Submission state
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStepText, setUploadStepText] = useState('');
  const [composerError, setComposerError] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const parsedYoutubeId = useMemo(() => extractYouTubeId(youtubeInput), [youtubeInput]);

  // Sort items newest first
  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const tA = new Date(a.createdAt || a.eventDate || 0).getTime();
      const tB = new Date(b.createdAt || b.eventDate || 0).getTime();
      return tB - tA;
    });
  }, [items]);

  // Metrics
  const counts = useMemo(() => {
    const photos = sortedItems.filter((i) => i.mediaType === 'PHOTO').length;
    const videos = sortedItems.filter((i) => i.mediaType === 'VIDEO').length;
    const documentaries = sortedItems.filter((i) => i.mediaType === 'YOUTUBE').length;
    const coopsRepresented = new Set(sortedItems.map((i) => i.cluster).filter(Boolean)).size;
    return { total: sortedItems.length, photos, videos, documentaries, coopsRepresented };
  }, [sortedItems]);

  // Featured documentary spotlight (latest YouTube documentary)
  const featuredDocumentary = useMemo(() => {
    return sortedItems.find((i) => i.mediaType === 'YOUTUBE' && i.youtubeId) || null;
  }, [sortedItems]);

  // Filtered list
  const filteredItems = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedItems.filter((item) => {
      if (mediaFilter !== 'ALL' && item.mediaType !== mediaFilter) return false;
      if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
      if (coopFilter !== 'ALL' && item.cluster !== coopFilter) return false;
      if (q) {
        const hay = `${item.title} ${item.description} ${item.cluster} ${item.category} ${item.authorName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [sortedItems, mediaFilter, categoryFilter, coopFilter, searchQuery]);

  const activeLightboxIndex = useMemo(
    () => (activeLightboxId ? filteredItems.findIndex((i) => i.id === activeLightboxId) : -1),
    [activeLightboxId, filteredItems]
  );
  const activeLightboxItem = activeLightboxIndex >= 0 ? filteredItems[activeLightboxIndex] : null;

  // Keyboard navigation in lightbox
  useEffect(() => {
    if (!activeLightboxId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setActiveLightboxId(null);
      } else if (e.key === 'ArrowRight' && activeLightboxIndex < filteredItems.length - 1) {
        setActiveLightboxId(filteredItems[activeLightboxIndex + 1].id);
      } else if (e.key === 'ArrowLeft' && activeLightboxIndex > 0) {
        setActiveLightboxId(filteredItems[activeLightboxIndex - 1].id);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeLightboxId, activeLightboxIndex, filteredItems]);

  // Open deep-linked gallery item (?media=id) if present
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const mediaId = params.get('media');
    if (mediaId && sortedItems.some((i) => i.id === mediaId)) {
      setActiveLightboxId(mediaId);
    }
  }, [sortedItems]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const resetComposer = () => {
    setEditingItem(null);
    setTitle('');
    setDescription('');
    setCategory(GALLERY_CATEGORIES[0]);
    setSelectedCoop(agentIdentity?.cluster && agentIdentity.cluster !== '-' ? agentIdentity.cluster : NATIONAL_COOP_OPTION);
    setEventDate(new Date().toISOString().split('T')[0]);
    setDurationLabel('');
    setSelectedFile(null);
    setFilePreviewUrl(null);
    setVideoPosterBlob(null);
    setYoutubeInput('');
    setComposerError(null);
    setUploadStepText('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const openCreateModal = (initialTab: GalleryMediaType = 'PHOTO') => {
    if (!canContribute) return;
    resetComposer();
    setComposerTab(initialTab);
    if (initialTab === 'YOUTUBE') {
      setCategory('Exchange Documentary');
    }
    setIsComposerOpen(true);
  };

  const openEditModal = (item: GalleryItem) => {
    if (!canModifyItem(item)) return;
    resetComposer();
    setEditingItem(item);
    setComposerTab(item.mediaType);
    setTitle(item.title);
    setDescription(item.description);
    setCategory(item.category || GALLERY_CATEGORIES[0]);
    setSelectedCoop(item.cluster || NATIONAL_COOP_OPTION);
    setEventDate(item.eventDate || new Date().toISOString().split('T')[0]);
    setDurationLabel(item.durationLabel || '');
    setYoutubeInput(item.youtubeUrl || (item.youtubeId ? `https://www.youtube.com/watch?v=${item.youtubeId}` : ''));
    setFilePreviewUrl(item.thumbnailUrl || item.mediaUrl || null);
    setActiveLightboxId(null);
    setIsComposerOpen(true);
  };

  const handleFileSelected = async (file: File | null) => {
    if (!file) return;
    setComposerError(null);

    if (composerTab === 'PHOTO') {
      if (!file.type.startsWith('image/')) {
        setComposerError('Please select a valid image file (JPG, PNG, or WebP).');
        return;
      }
      if (file.size > 20 * 1024 * 1024) {
        setComposerError('Photo is too large (max 20 MB).');
        return;
      }
      setSelectedFile(file);
      const url = URL.createObjectURL(file);
      setFilePreviewUrl(url);
    } else if (composerTab === 'VIDEO') {
      if (!file.type.startsWith('video/')) {
        setComposerError('Please select a short video file (MP4, WebM, or MOV).');
        return;
      }
      if (file.size > 35 * 1024 * 1024) {
        setComposerError(
          'Short videos must be under 35 MB for fast mobile playback. For longer documentaries (e.g. KPL exchanges), please upload to YouTube and paste the link in the YouTube tab.'
        );
        return;
      }
      setSelectedFile(file);
      setUploadStepText('Reading video preview...');
      const meta = await extractVideoMetadata(file);
      setUploadStepText('');
      if (meta.durationLabel) setDurationLabel(meta.durationLabel);
      setVideoPosterBlob(meta.posterBlob);
      setFilePreviewUrl(meta.posterPreview || URL.createObjectURL(file));
    }
  };

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canContribute || !agentIdentity) return;

    setComposerError(null);

    if (!title.trim()) {
      setComposerError('Please enter a clear title.');
      return;
    }
    if (!description.trim()) {
      setComposerError('Please describe what is happening in this photo or video.');
      return;
    }

    if (composerTab === 'YOUTUBE') {
      const ytId = extractYouTubeId(youtubeInput);
      if (!ytId) {
        setComposerError('Please paste a valid YouTube link (e.g. https://www.youtube.com/watch?v=... or https://youtu.be/...).');
        return;
      }
      setIsUploading(true);
      setUploadStepText('Publishing YouTube video...');
      try {
        const nowIso = new Date().toISOString();
        const item: GalleryItem = {
          id: editingItem ? editingItem.id : `gallery_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          title: title.trim(),
          description: description.trim(),
          mediaType: 'YOUTUBE',
          mediaUrl: `https://www.youtube-nocookie.com/embed/${ytId}`,
          youtubeUrl: youtubeInput.trim(),
          youtubeId: ytId,
          thumbnailUrl: `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`,
          durationLabel: durationLabel.trim() || 'YouTube Documentary',
          category,
          cluster: selectedCoop || NATIONAL_COOP_OPTION,
          eventDate,
          authorName: editingItem ? editingItem.authorName : agentIdentity.name,
          authorPhone: editingItem ? editingItem.authorPhone : agentIdentity.phone,
          authorRole: editingItem ? editingItem.authorRole : agentIdentity.role,
          createdAt: editingItem ? editingItem.createdAt : nowIso,
          synced: false
        };
        await onSaveItem(item);
        setIsComposerOpen(false);
        resetComposer();
        showToast(editingItem ? 'Gallery entry updated.' : 'YouTube documentary embedded to gallery.');
      } catch (err: any) {
        setComposerError(err?.message || 'Could not publish video. Please try again.');
      } finally {
        setIsUploading(false);
        setUploadStepText('');
      }
      return;
    }

    // PHOTO or VIDEO
    if (!editingItem && !selectedFile) {
      setComposerError(composerTab === 'PHOTO' ? 'Please choose a photo to upload.' : 'Please choose a short video to upload.');
      return;
    }

    setIsUploading(true);
    try {
      let finalMediaUrl = editingItem?.mediaUrl || '';
      let finalThumbnailUrl = editingItem?.thumbnailUrl;

      if (composerTab === 'PHOTO' && selectedFile) {
        setUploadStepText('Optimizing photo for fast loading...');
        const { blob } = await compressImageToBlob(selectedFile, 1400, 0.8);
        setUploadStepText('Uploading photo to KPL cloud...');
        const uploadedUrl = await uploadGalleryMedia(blob, 'jpg', 'image/jpeg');
        if (!uploadedUrl) {
          throw new Error('Photo upload failed. Please check your internet connection and try again.');
        }
        finalMediaUrl = uploadedUrl;
        finalThumbnailUrl = uploadedUrl;
      } else if (composerTab === 'VIDEO' && selectedFile) {
        setUploadStepText('Uploading short video clip...');
        const ext = selectedFile.name.split('.').pop()?.toLowerCase() || 'mp4';
        const mime = selectedFile.type || 'video/mp4';
        const [videoUrl, posterUrl] = await Promise.all([
          uploadGalleryMedia(selectedFile, ext, mime),
          videoPosterBlob ? uploadGalleryMedia(videoPosterBlob, 'jpg', 'image/jpeg') : Promise.resolve(null)
        ]);
        if (!videoUrl) {
          throw new Error('Video upload failed. If the file is large, try a shorter clip or upload to YouTube and embed the link.');
        }
        finalMediaUrl = videoUrl;
        if (posterUrl) finalThumbnailUrl = posterUrl;
      }

      setUploadStepText('Saving gallery entry...');
      const nowIso = new Date().toISOString();
      const item: GalleryItem = {
        id: editingItem ? editingItem.id : `gallery_item_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: title.trim(),
        description: description.trim(),
        mediaType: composerTab,
        mediaUrl: finalMediaUrl,
        thumbnailUrl: finalThumbnailUrl,
        durationLabel: composerTab === 'VIDEO' ? (durationLabel.trim() || 'Short Clip') : undefined,
        category,
        cluster: selectedCoop || NATIONAL_COOP_OPTION,
        eventDate,
        authorName: editingItem ? editingItem.authorName : agentIdentity.name,
        authorPhone: editingItem ? editingItem.authorPhone : agentIdentity.phone,
        authorRole: editingItem ? editingItem.authorRole : agentIdentity.role,
        createdAt: editingItem ? editingItem.createdAt : nowIso,
        synced: false
      };

      await onSaveItem(item);
      setIsComposerOpen(false);
      resetComposer();
      showToast(
        editingItem
          ? 'Gallery entry updated.'
          : composerTab === 'PHOTO'
          ? 'Photo published to the KPL Gallery.'
          : 'Short video published to the KPL Gallery.'
      );
    } catch (err: any) {
      setComposerError(err?.message || 'Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadStepText('');
    }
  };

  const handleDelete = async (item: GalleryItem) => {
    if (!canModifyItem(item)) return;
    if (!window.confirm(`Remove "${item.title}" from the KPL Gallery?`)) return;
    if (activeLightboxId === item.id) setActiveLightboxId(null);
    await onDeleteItem(item.id);
    showToast('Gallery entry removed.');
  };

  const handleCopyShareLink = (item: GalleryItem) => {
    const shareUrl = `${window.location.origin}/gallery?media=${encodeURIComponent(item.id)}`;
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-10 animate-in fade-in duration-300">
      {/* Subtle non-blocking toast */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-950 text-white px-5 py-3.5 rounded-2xl shadow-2xl border border-slate-800 flex items-center gap-3 text-xs font-semibold">
          <Check className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* EDITORIAL PORTAL HEADER */}
      <section className="bg-white rounded-[2rem] border border-slate-200/90 p-7 sm:p-10">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
          <div className="max-w-2xl space-y-2.5">
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-emerald-700">
              KPL Media &amp; Documentary Archive
            </p>
            <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950 leading-[1.1]">
              Field Stories, Solidarity Moments &amp; Exchange Documentaries
            </h2>
            <p className="text-sm sm:text-[15px] text-slate-600 leading-relaxed">
              Visual documentation from Kenyan Peasants League food cooperatives — field photos with stories, short clips from farm solidarity days, and full-length YouTube exchange documentaries.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {canContribute ? (
              <>
                <button
                  type="button"
                  onClick={() => openCreateModal('PHOTO')}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3.5 rounded-xl font-bold text-xs tracking-wide transition-colors flex items-center gap-2 whitespace-nowrap shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  <span>Upload Photo / Video</span>
                </button>
                <button
                  type="button"
                  onClick={() => openCreateModal('YOUTUBE')}
                  className="bg-slate-950 hover:bg-slate-800 text-white px-5 py-3.5 rounded-xl font-bold text-xs tracking-wide transition-colors flex items-center gap-2 whitespace-nowrap"
                >
                  <Youtube className="w-4 h-4 text-red-400" />
                  <span>Embed YouTube Documentary</span>
                </button>
              </>
            ) : !agentIdentity && onNavigateLogin ? (
              <button
                type="button"
                onClick={onNavigateLogin}
                className="border border-slate-300 hover:border-slate-900 text-slate-800 px-5 py-3 rounded-xl font-bold text-xs tracking-wide transition-colors whitespace-nowrap"
              >
                Member Login to Contribute
              </button>
            ) : null}
          </div>
        </div>

        {/* Single-row typographic metrics strip (zero pill clutter) */}
        <div className="mt-7 pt-6 border-t border-slate-200 grid grid-cols-2 sm:grid-cols-4 gap-6">
          <div>
            <p className="text-2xl font-black text-slate-950 tracking-tight">{counts.photos}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Field Photos</p>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-950 tracking-tight">{counts.videos}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Short Video Clips</p>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-950 tracking-tight">{counts.documentaries}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">YouTube Documentaries</p>
          </div>
          <div>
            <p className="text-2xl font-black text-slate-950 tracking-tight">{counts.coopsRepresented}</p>
            <p className="text-xs font-medium text-slate-500 mt-0.5">Food Coops Featured</p>
          </div>
        </div>
      </section>

      {/* FEATURED YOUTUBE DOCUMENTARY CINEMA SPOTLIGHT */}
      {featuredDocumentary && (mediaFilter === 'ALL' || mediaFilter === 'YOUTUBE') && !searchQuery.trim() && (
        <section className="bg-[#0B0F14] text-white rounded-[2rem] overflow-hidden border border-slate-800">
          <div className="grid grid-cols-1 lg:grid-cols-12">
            {/* 16:9 Cinema Stage */}
            <div className="lg:col-span-7 bg-black relative aspect-video lg:aspect-auto lg:min-h-[380px]">
              {playingSpotlightId === featuredDocumentary.id && featuredDocumentary.youtubeId ? (
                <iframe
                  src={`https://www.youtube-nocookie.com/embed/${featuredDocumentary.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                  title={featuredDocumentary.title}
                  className="w-full h-full min-h-[300px] lg:min-h-[380px]"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
              ) : (
                <button
                  type="button"
                  onClick={() => setPlayingSpotlightId(featuredDocumentary.id)}
                  className="w-full h-full relative group block text-left focus:outline-none"
                  aria-label={`Play ${featuredDocumentary.title}`}
                >
                  <img
                    src={featuredDocumentary.thumbnailUrl || `https://img.youtube.com/vi/${featuredDocumentary.youtubeId}/hqdefault.jpg`}
                    alt={featuredDocumentary.title}
                    className="w-full h-full object-cover min-h-[300px] lg:min-h-[380px] opacity-85 group-hover:opacity-100 group-hover:scale-[1.02] transition-all duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent flex items-center justify-center">
                    <span className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-emerald-600 group-hover:bg-emerald-500 text-white flex items-center justify-center shadow-2xl transition-transform group-hover:scale-105">
                      <Play className="w-7 h-7 sm:w-8 sm:h-8 fill-current ml-1" />
                    </span>
                  </div>
                  {featuredDocumentary.durationLabel && (
                    <span className="absolute bottom-4 left-4 text-xs font-bold tracking-wide text-white/95 bg-black/75 px-3 py-1 rounded-lg backdrop-blur-sm">
                      {featuredDocumentary.durationLabel}
                    </span>
                  )}
                </button>
              )}
            </div>

            {/* Documentary Editorial Copy */}
            <div className="lg:col-span-5 p-7 sm:p-10 flex flex-col justify-between gap-6">
              <div className="space-y-4">
                <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-emerald-400">
                  Featured Documentary · YouTube
                </p>
                <h3 className="text-2xl sm:text-3xl font-black tracking-tight text-white leading-tight">
                  {featuredDocumentary.title}
                </h3>
                <p className="text-sm text-slate-300 leading-relaxed line-clamp-5">
                  {featuredDocumentary.description}
                </p>
              </div>

              <div className="space-y-4 pt-4 border-t border-white/10">
                <p className="text-xs text-slate-400 font-medium">
                  {featuredDocumentary.category} · {featuredDocumentary.cluster} · {formatDateLabel(featuredDocumentary.eventDate)}
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setPlayingSpotlightId(featuredDocumentary.id)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-colors flex items-center gap-2"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    <span>{playingSpotlightId === featuredDocumentary.id ? 'Playing Now' : 'Watch Documentary'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveLightboxId(featuredDocumentary.id)}
                    className="border border-white/20 hover:border-white/50 text-white px-4 py-2.5 rounded-xl text-xs font-bold tracking-wide transition-colors"
                  >
                    Cinema View
                  </button>
                  {featuredDocumentary.youtubeUrl && (
                    <a
                      href={featuredDocumentary.youtubeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs font-semibold text-slate-400 hover:text-white flex items-center gap-1.5 ml-auto"
                    >
                      <span>YouTube</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* FILTER & SEARCH BAR */}
      <section className="bg-white rounded-2xl border border-slate-200/90 p-4 sm:p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Media Type Underline Tabs */}
          <div className="flex items-center gap-1 border-b border-slate-200 lg:border-b-0 overflow-x-auto pb-1 lg:pb-0">
            {[
              { id: 'ALL' as const, label: `All (${counts.total})`, icon: null },
              { id: 'PHOTO' as const, label: `Photos (${counts.photos})`, icon: Camera },
              { id: 'VIDEO' as const, label: `Short Videos (${counts.videos})`, icon: Film },
              { id: 'YOUTUBE' as const, label: `YouTube Documentaries (${counts.documentaries})`, icon: Youtube }
            ].map((tab) => {
              const Icon = tab.icon;
              const active = mediaFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMediaFilter(tab.id)}
                  className={`px-3.5 py-2 rounded-lg text-xs font-bold whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                    active
                      ? 'bg-slate-950 text-white'
                      : 'text-slate-600 hover:text-slate-950 hover:bg-slate-100'
                  }`}
                >
                  {Icon && <Icon className="w-3.5 h-3.5" />}
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          {/* Search + Dropdowns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 lg:w-auto">
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search stories, coops..."
                className="w-full pl-9 pr-3 py-2 text-xs font-medium bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500"
              />
            </div>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500"
            >
              <option value="ALL">All Categories</option>
              {GALLERY_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>

            <select
              value={coopFilter}
              onChange={(e) => setCoopFilter(e.target.value)}
              className="px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500"
            >
              <option value="ALL">All Food Coops ({allCoops.length})</option>
              <option value={NATIONAL_COOP_OPTION}>{NATIONAL_COOP_OPTION}</option>
              {allCoops.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* GALLERY GRID */}
      {filteredItems.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-slate-200/90 py-16 px-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <Camera className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-1.5">
            <h3 className="text-lg font-black text-slate-900">
              {sortedItems.length === 0 ? 'The KPL Gallery Is Ready for Your First Story' : 'No Matching Gallery Items'}
            </h3>
            <p className="text-sm text-slate-500">
              {sortedItems.length === 0
                ? 'Upload field photos with descriptions of what is happening, share short farm solidarity clips, or embed full-length YouTube exchange documentaries.'
                : 'Try adjusting your category, Food Coop, or search filter.'}
            </p>
          </div>
          {canContribute && (
            <div className="flex flex-wrap justify-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => openCreateModal('PHOTO')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-3 rounded-xl text-xs font-bold tracking-wide flex items-center gap-2"
              >
                <Camera className="w-4 h-4" />
                <span>Upload First Photo</span>
              </button>
              <button
                type="button"
                onClick={() => openCreateModal('VIDEO')}
                className="bg-slate-100 hover:bg-slate-200 text-slate-900 px-5 py-3 rounded-xl text-xs font-bold tracking-wide flex items-center gap-2"
              >
                <Film className="w-4 h-4" />
                <span>Upload Short Video</span>
              </button>
              <button
                type="button"
                onClick={() => openCreateModal('YOUTUBE')}
                className="bg-slate-950 hover:bg-slate-800 text-white px-5 py-3 rounded-xl text-xs font-bold tracking-wide flex items-center gap-2"
              >
                <Youtube className="w-4 h-4 text-red-400" />
                <span>Embed YouTube Documentary</span>
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredItems.map((item) => {
            const isVideo = item.mediaType === 'VIDEO';
            const isYoutube = item.mediaType === 'YOUTUBE';
            const thumb =
              item.thumbnailUrl ||
              (isYoutube && item.youtubeId ? `https://img.youtube.com/vi/${item.youtubeId}/hqdefault.jpg` : item.mediaUrl);
            const editable = canModifyItem(item);

            return (
              <article
                key={item.id}
                className="bg-white rounded-2xl border border-slate-200/90 overflow-hidden flex flex-col group hover:border-slate-300 hover:shadow-lg transition-all duration-300"
              >
                {/* Media Frame */}
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => setActiveLightboxId(item.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      setActiveLightboxId(item.id);
                    }
                  }}
                  className="relative aspect-[16/10] bg-slate-950 overflow-hidden cursor-pointer"
                >
                  {isVideo && !item.thumbnailUrl ? (
                    <video
                      src={item.mediaUrl}
                      muted
                      playsInline
                      preload="metadata"
                      className="w-full h-full object-cover opacity-90 group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : thumb ? (
                    <img
                      src={thumb}
                      alt={item.title}
                      loading="lazy"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 p-4 text-center">
                      <Film className="w-8 h-8 mb-2" />
                      <span className="text-xs font-semibold">{item.title}</span>
                    </div>
                  )}

                  {/* Scrim + Play indicator for videos & YouTube */}
                  {(isVideo || isYoutube) && (
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent flex items-center justify-center">
                      <span className="w-12 h-12 rounded-full bg-black/70 border border-white/30 text-white flex items-center justify-center group-hover:bg-emerald-600 group-hover:border-emerald-500 group-hover:scale-110 transition-all shadow-lg">
                        <Play className="w-5 h-5 fill-current ml-0.5" />
                      </span>
                    </div>
                  )}

                  {/* Subtle corner format label */}
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-[11px] font-bold text-white pointer-events-none">
                    <span className="bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-md flex items-center gap-1.5">
                      {isYoutube ? (
                        <>
                          <Youtube className="w-3.5 h-3.5 text-red-400" />
                          <span>YouTube</span>
                        </>
                      ) : isVideo ? (
                        <>
                          <Film className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Short Video</span>
                        </>
                      ) : (
                        <>
                          <Camera className="w-3.5 h-3.5 text-emerald-400" />
                          <span>Photo</span>
                        </>
                      )}
                    </span>
                    {item.durationLabel && (
                      <span className="bg-black/70 backdrop-blur-sm px-2.5 py-1 rounded-md">
                        {item.durationLabel}
                      </span>
                    )}
                  </div>
                </div>

                {/* Editorial Card Body */}
                <div className="p-5 flex-1 flex flex-col justify-between gap-4">
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold text-emerald-700 truncate">
                      {item.category} · {item.cluster}
                    </p>
                    <h3
                      onClick={() => setActiveLightboxId(item.id)}
                      className="text-base font-black text-slate-950 leading-snug tracking-tight cursor-pointer group-hover:text-emerald-700 transition-colors line-clamp-2"
                    >
                      {item.title}
                    </h3>
                    <p className="text-xs sm:text-[13px] text-slate-600 leading-relaxed line-clamp-3">
                      {item.description}
                    </p>
                  </div>

                  {/* Clean footer attribution */}
                  <div className="pt-3.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px] text-slate-500">
                    <span className="truncate font-medium">
                      {item.authorName} · {formatDateLabel(item.eventDate)}
                    </span>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleCopyShareLink(item)}
                        title="Copy Share Link"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      >
                        {copiedId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5" />}
                      </button>
                      {editable && (
                        <>
                          <button
                            type="button"
                            onClick={() => openEditModal(item)}
                            title="Edit Entry"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(item)}
                            title="Delete Entry"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* FULLSCREEN CINEMA LIGHTBOX MODAL */}
      {activeLightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-black/95 backdrop-blur-sm flex items-center justify-center p-4 sm:p-8"
          onClick={() => setActiveLightboxId(null)}
        >
          <div
            className="w-full max-w-5xl max-h-[92vh] bg-[#0F141A] border border-white/10 rounded-3xl overflow-hidden flex flex-col shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Lightbox Top Controls */}
            <div className="px-5 py-3.5 border-b border-white/10 flex items-center justify-between gap-4 text-white">
              <div className="text-xs text-slate-300 font-medium truncate">
                {activeLightboxItem.category} · {activeLightboxItem.cluster} · {formatDateLabel(activeLightboxItem.eventDate)}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleCopyShareLink(activeLightboxItem)}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors flex items-center gap-1.5"
                >
                  {copiedId === activeLightboxItem.id ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Share2 className="w-3.5 h-3.5" />}
                  <span>{copiedId === activeLightboxItem.id ? 'Copied' : 'Share'}</span>
                </button>
                {canModifyItem(activeLightboxItem) && (
                  <>
                    <button
                      type="button"
                      onClick={() => openEditModal(activeLightboxItem)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10 transition-colors flex items-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(activeLightboxItem)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold text-red-400 hover:bg-red-500/20 transition-colors flex items-center gap-1.5"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={() => setActiveLightboxId(null)}
                  className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
                  aria-label="Close lightbox"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Media Viewport */}
            <div className="relative bg-black flex items-center justify-center flex-1 min-h-[280px] overflow-hidden">
              {activeLightboxIndex > 0 && (
                <button
                  type="button"
                  onClick={() => setActiveLightboxId(filteredItems[activeLightboxIndex - 1].id)}
                  className="absolute left-3 z-10 w-10 h-10 rounded-full bg-black/70 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors"
                  aria-label="Previous item"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}

              {activeLightboxItem.mediaType === 'YOUTUBE' && activeLightboxItem.youtubeId ? (
                <div className="w-full aspect-video max-h-[60vh]">
                  <iframe
                    src={`https://www.youtube-nocookie.com/embed/${activeLightboxItem.youtubeId}?autoplay=1&rel=0&modestbranding=1`}
                    title={activeLightboxItem.title}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : activeLightboxItem.mediaType === 'VIDEO' ? (
                <video
                  src={activeLightboxItem.mediaUrl}
                  poster={activeLightboxItem.thumbnailUrl}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[60vh] w-full object-contain bg-black"
                />
              ) : (
                <img
                  src={activeLightboxItem.mediaUrl}
                  alt={activeLightboxItem.title}
                  className="max-h-[60vh] w-auto max-w-full object-contain"
                />
              )}

              {activeLightboxIndex >= 0 && activeLightboxIndex < filteredItems.length - 1 && (
                <button
                  type="button"
                  onClick={() => setActiveLightboxId(filteredItems[activeLightboxIndex + 1].id)}
                  className="absolute right-3 z-10 w-10 h-10 rounded-full bg-black/70 hover:bg-emerald-600 text-white flex items-center justify-center transition-colors"
                  aria-label="Next item"
                >
                  <ChevronRight className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Full Narrative Description Panel */}
            <div className="p-6 sm:p-7 bg-[#0F141A] text-white overflow-y-auto max-h-[30vh] border-t border-white/10 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <h3 className="text-xl sm:text-2xl font-black tracking-tight">{activeLightboxItem.title}</h3>
                {activeLightboxItem.youtubeUrl && (
                  <a
                    href={activeLightboxItem.youtubeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5"
                  >
                    <span>Open on YouTube</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
              <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-line">
                {activeLightboxItem.description}
              </p>
              <div className="pt-2 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-slate-400">
                <span className="flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-emerald-400" />
                  {activeLightboxItem.authorName} ({activeLightboxItem.authorRole})
                </span>
                <span className="flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {activeLightboxItem.cluster}
                </span>
                <span className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                  {formatDateLabel(activeLightboxItem.eventDate)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PUBLISH / UPLOAD MODAL (ONLY FOR LOGGED-IN NON-CUSTOMER MEMBERS) */}
      {isComposerOpen && canContribute && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => !isUploading && setIsComposerOpen(false)}
        >
          <div
            className="bg-white rounded-3xl w-full max-w-2xl max-h-[92vh] overflow-hidden shadow-2xl border border-slate-200 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-6 py-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950 tracking-tight">
                  {editingItem ? 'Edit Gallery Story' : 'Publish to KPL Gallery'}
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Posting as {agentIdentity?.name} · {agentIdentity?.role}
                </p>
              </div>
              <button
                type="button"
                disabled={isUploading}
                onClick={() => setIsComposerOpen(false)}
                className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition-colors disabled:opacity-50"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handlePublish} className="p-6 overflow-y-auto space-y-5">
              {/* Media Type Selector (disabled when editing existing entry's type) */}
              {!editingItem && (
                <div className="grid grid-cols-3 gap-2 bg-slate-100 p-1.5 rounded-2xl">
                  {[
                    { id: 'PHOTO' as const, label: 'Upload Photo', icon: Camera },
                    { id: 'VIDEO' as const, label: 'Short Video', icon: Film },
                    { id: 'YOUTUBE' as const, label: 'YouTube Video', icon: Youtube }
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const active = composerTab === tab.id;
                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          setComposerTab(tab.id);
                          setSelectedFile(null);
                          setFilePreviewUrl(null);
                          setVideoPosterBlob(null);
                          setComposerError(null);
                          if (tab.id === 'YOUTUBE') setCategory('Exchange Documentary');
                        }}
                        className={`py-2.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 ${
                          active ? 'bg-white text-slate-950 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        <Icon className={`w-4 h-4 ${active && tab.id === 'YOUTUBE' ? 'text-red-600' : active ? 'text-emerald-600' : ''}`} />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>
              )}

              {composerError && (
                <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-semibold flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{composerError}</span>
                </div>
              )}

              {/* Media Input Zone */}
              {composerTab === 'YOUTUBE' ? (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    YouTube Link (Long Documentaries, Exchanges, Training Videos)
                  </label>
                  <input
                    type="url"
                    required
                    value={youtubeInput}
                    onChange={(e) => setYoutubeInput(e.target.value)}
                    placeholder="https://www.youtube.com/watch?v=... or https://youtu.be/..."
                    className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 font-medium"
                  />
                  {parsedYoutubeId ? (
                    <div className="rounded-2xl overflow-hidden border border-slate-200 bg-black aspect-video relative">
                      <img
                        src={`https://img.youtube.com/vi/${parsedYoutubeId}/hqdefault.jpg`}
                        alt="YouTube preview"
                        className="w-full h-full object-cover opacity-90"
                      />
                      <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                        <span className="px-3.5 py-2 rounded-xl bg-black/80 text-white text-xs font-bold flex items-center gap-2">
                          <Check className="w-4 h-4 text-emerald-400" />
                          YouTube Video Ready to Embed ({parsedYoutubeId})
                        </span>
                      </div>
                    </div>
                  ) : youtubeInput.trim() ? (
                    <p className="text-xs text-amber-700 font-medium">
                      Paste a full YouTube video link (for example: https://youtu.be/dQw4w9WgXcQ).
                    </p>
                  ) : null}

                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1.5">
                      Video Length / Runtime Label (Optional)
                    </label>
                    <input
                      type="text"
                      value={durationLabel}
                      onChange={(e) => setDurationLabel(e.target.value)}
                      placeholder="e.g. 48 min Exchange Documentary"
                      className="w-full px-4 py-2.5 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <label className="block text-xs font-bold text-slate-700">
                    {composerTab === 'PHOTO' ? 'Select Photo (Auto-compressed for fast upload)' : 'Select Short Video Clip (MP4 / WebM / MOV, up to 35 MB)'}
                  </label>

                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-2xl p-6 text-center cursor-pointer transition-colors bg-slate-50/70"
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={composerTab === 'PHOTO' ? 'image/*' : 'video/mp4,video/webm,video/quicktime,video/*'}
                      onChange={(e) => handleFileSelected(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                    {filePreviewUrl ? (
                      <div className="space-y-3">
                        {composerTab === 'PHOTO' || filePreviewUrl.startsWith('data:image') ? (
                          <img
                            src={filePreviewUrl}
                            alt="Upload preview"
                            className="max-h-56 mx-auto rounded-xl object-contain"
                          />
                        ) : (
                          <video src={filePreviewUrl} controls className="max-h-56 mx-auto rounded-xl" />
                        )}
                        <p className="text-xs font-semibold text-emerald-700">
                          {selectedFile ? `${selectedFile.name} (${(selectedFile.size / (1024 * 1024)).toFixed(1)} MB)` : 'Current media attached'} — Click to replace
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2 py-3">
                        <Upload className="w-8 h-8 text-slate-400 mx-auto" />
                        <p className="text-sm font-bold text-slate-800">
                          {composerTab === 'PHOTO' ? 'Click to choose a field photo' : 'Click to choose a short video clip'}
                        </p>
                        <p className="text-xs text-slate-500">
                          {composerTab === 'PHOTO'
                            ? 'JPG, PNG or WebP — automatically resized for quick mobile upload'
                            : 'Ideal for 10s–90s solidarity clips. For long documentaries, use the YouTube Video tab.'}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={
                    composerTab === 'YOUTUBE'
                      ? 'e.g. KPL Farmers Exchange Documentary — Migori to Siaya'
                      : 'e.g. Mariwa Food Coop Collective Weeding Day'
                  }
                  className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 font-semibold"
                />
              </div>

              {/* Description of what is happening */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">
                  Description of What Is Happening *
                </label>
                <textarea
                  required
                  rows={4}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the activity, the farmers or cooperative involved, agroecological practices shown, and why this moment matters..."
                  className="w-full px-4 py-3 text-sm bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500 leading-relaxed resize-y"
                />
              </div>

              {/* Metadata Row */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500"
                  >
                    {GALLERY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Food Coop</label>
                  <select
                    value={selectedCoop}
                    onChange={(e) => setSelectedCoop(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500"
                  >
                    <option value={NATIONAL_COOP_OPTION}>{NATIONAL_COOP_OPTION}</option>
                    {allCoops.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-700">Event Date</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:bg-white focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Submit Footer */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={isUploading}
                  onClick={() => setIsComposerOpen(false)}
                  className="px-5 py-3 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isUploading}
                  className="px-6 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold tracking-wide transition-colors flex items-center gap-2 disabled:opacity-60 shadow-sm"
                >
                  {isUploading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{uploadStepText || 'Publishing...'}</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>{editingItem ? 'Save Changes' : 'Publish to Gallery'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default GalleryPortal;
