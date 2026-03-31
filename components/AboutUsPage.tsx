import React, { useState, useEffect, useRef } from 'react';
import { ABOUT_US_DATA } from '../constants';
import { Page, AgentIdentity, SystemRole } from '../types';
import { fetchPages, savePage, uploadPageImage } from '../services/supabaseService';

interface AboutUsPageProps {
  currentUser?: AgentIdentity | null;
}

const AboutUsPage: React.FC<AboutUsPageProps> = ({ currentUser }) => {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<string>('');
  
  // Editing state
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editImageUrl, setEditImageUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isManager = currentUser?.role === SystemRole.MANAGER || currentUser?.role === SystemRole.SYSTEM_DEVELOPER || currentUser?.role === SystemRole.SALES_MANAGER;

  useEffect(() => {
    loadPages();
  }, []);

  const loadPages = async () => {
    setLoading(true);
    let fetchedPages = await fetchPages();
    
    // Fallback to constants if DB is empty
    if (fetchedPages.length === 0) {
      fetchedPages = ABOUT_US_DATA.map((item, index) => ({
        id: item.id,
        title: item.title,
        content: item.content,
        orderIndex: index
      }));
    }
    
    setPages(fetchedPages);
    
    const params = new URLSearchParams(window.location.search);
    const section = params.get('section');
    if (section && fetchedPages.some(s => s.id === section)) {
      setActiveSection(section);
    } else if (fetchedPages.length > 0) {
      setActiveSection(fetchedPages[0].id);
    }
    
    setLoading(false);
  };

  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const section = params.get('section');
      if (section && pages.some(s => s.id === section)) {
        setActiveSection(section);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [pages]);

  const handleSectionClick = (id: string) => {
    if (isEditing) {
      if (!window.confirm("You have unsaved changes. Discard?")) return;
      setIsEditing(false);
    }
    setActiveSection(id);
    const params = new URLSearchParams(window.location.search);
    params.set('section', id);
    window.history.replaceState(null, '', window.location.pathname + '?' + params.toString());
  };

  const startEditing = () => {
    const currentPage = pages.find(p => p.id === activeSection);
    if (currentPage) {
      setEditTitle(currentPage.title);
      setEditContent(currentPage.content);
      setEditImageUrl(currentPage.imageUrl || '');
      setIsEditing(true);
    }
  };

  const handleSave = async () => {
    const currentPage = pages.find(p => p.id === activeSection);
    if (!currentPage) return;

    setSaving(true);
    const updatedPage: Page = {
      ...currentPage,
      title: editTitle,
      content: editContent,
      imageUrl: editImageUrl
    };

    const success = await savePage(updatedPage);
    if (success) {
      setPages(pages.map(p => p.id === activeSection ? updatedPage : p));
      setIsEditing(false);
    } else {
      alert("Failed to save changes.");
    }
    setSaving(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSaving(true);
    const url = await uploadPageImage(file);
    if (url) {
      setEditImageUrl(url);
    } else {
      alert("Failed to upload image.");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <i className="fas fa-spinner fa-spin text-4xl text-green-600"></i>
      </div>
    );
  }

  const activePage = pages.find(p => p.id === activeSection);

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white p-12 rounded-[3rem] shadow-xl border border-slate-100 max-w-6xl mx-auto flex flex-col md:flex-row gap-12">
        
        {/* Sidebar Navigation */}
        <div className="w-full md:w-1/3 border-r border-slate-100 pr-0 md:pr-8">
          <h2 className="text-3xl font-black uppercase tracking-tight text-black mb-8">About Us</h2>
          <nav className="flex flex-col gap-2">
            {pages.map((section) => (
              <button
                key={section.id}
                onClick={() => handleSectionClick(section.id)}
                className={`text-left px-6 py-4 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all ${
                  activeSection === section.id
                    ? 'bg-black text-white shadow-lg scale-105'
                    : 'bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-black'
                }`}
              >
                {section.title}
              </button>
            ))}
          </nav>
        </div>

        {/* Content Area */}
        <div className="w-full md:w-2/3">
          {activePage && (
            <div className="animate-in fade-in slide-in-from-right-4 duration-300">
              <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4">
                {isEditing ? (
                  <input 
                    type="text" 
                    value={editTitle}
                    onChange={e => setEditTitle(e.target.value)}
                    className="text-3xl font-black uppercase tracking-tight text-green-600 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 w-full mr-4 outline-none focus:border-green-400"
                  />
                ) : (
                  <h3 className="text-3xl font-black uppercase tracking-tight text-green-600">
                    {activePage.title}
                  </h3>
                )}
                
                {isManager && !isEditing && (
                  <button onClick={startEditing} className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2 shrink-0">
                    <i className="fas fa-edit"></i> Edit
                  </button>
                )}
              </div>

              {isEditing ? (
                <div className="space-y-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-2 block">Page Image</label>
                    <div className="flex items-center gap-4">
                      {editImageUrl && (
                        <img src={editImageUrl} alt="Preview" className="w-32 h-32 object-cover rounded-2xl border border-slate-200" />
                      )}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        ref={fileInputRef}
                        onChange={handleImageUpload}
                      />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={saving}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-2"
                      >
                        <i className="fas fa-upload"></i> {saving ? 'Uploading...' : 'Upload Image'}
                      </button>
                      {editImageUrl && (
                        <button 
                          onClick={() => setEditImageUrl('')}
                          className="text-red-500 hover:text-red-600 text-[10px] font-black uppercase tracking-widest px-4"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-2 block">Content</label>
                    <textarea 
                      value={editContent}
                      onChange={e => setEditContent(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 font-medium text-slate-700 outline-none focus:bg-white focus:border-green-400 transition-all min-h-[300px] resize-y leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end gap-4 pt-4 border-t border-slate-100">
                    <button 
                      onClick={() => setIsEditing(false)}
                      disabled={saving}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-600 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-green-600 hover:bg-green-700 text-white px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg transition-colors flex items-center gap-2"
                    >
                      {saving ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-save"></i>}
                      Save Changes
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-8">
                  {activePage.imageUrl && (
                    <img src={activePage.imageUrl} alt={activePage.title} className="w-full max-h-96 object-cover rounded-3xl shadow-md border border-slate-100" />
                  )}
                  <div className="text-slate-600 font-medium leading-relaxed space-y-4 whitespace-pre-line text-lg">
                    {activePage.content}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default AboutUsPage;
