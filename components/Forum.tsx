
import React, { useState, useEffect } from 'react';
import { AgentIdentity, ForumPost, SystemRole } from '../types';
import { fetchForumPosts, saveForumPost, deleteForumPost } from '../services/supabaseService';

interface ForumProps {
  currentUser: AgentIdentity;
}

const Forum: React.FC<ForumProps> = ({ currentUser }) => {
  const [posts, setPosts] = useState<ForumPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  
  const [newTitle, setNewTitle] = useState('');
  const [newContent, setNewContent] = useState('');

  const loadPosts = async () => {
    setLoading(true);
    const data = await fetchForumPosts();
    setPosts(data);
    setLoading(false);
  };

  useEffect(() => {
    loadPosts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim() || !newContent.trim()) return;

    setCreating(true);
    const success = await saveForumPost({
      title: newTitle,
      content: newContent,
      authorName: currentUser.name,
      authorRole: currentUser.role,
      authorCluster: currentUser.cluster,
      authorPhone: currentUser.phone
    });

    if (success) {
      setNewTitle('');
      setNewContent('');
      setShowForm(false);
      await loadPosts();
    } else {
      alert("Failed to post message.");
    }
    setCreating(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Are you sure you want to delete this post?")) return;
    const success = await deleteForumPost(id);
    if (success) {
      setPosts(prev => prev.filter(p => p.id !== id));
    } else {
      alert("Could not delete post. You may not have permission.");
    }
  };

  const canDelete = (post: ForumPost) => {
    // Admins (Dev, Manager, Director) can delete anything
    const isAdmin = [SystemRole.SYSTEM_DEVELOPER, SystemRole.MANAGER, SystemRole.MANAGER].includes(currentUser.role as SystemRole); // Director is usually MANAGER role key
    // Users can delete their own
    const isAuthor = post.authorPhone === currentUser.phone;
    return isAdmin || isAuthor;
  };

  const getRoleBadgeColor = (role: string) => {
    if (role === SystemRole.SYSTEM_DEVELOPER) return 'bg-purple-100 text-purple-700 border-purple-200';
    if (role === SystemRole.MANAGER) return 'bg-black text-white border-black'; // Director
    if (role === SystemRole.FINANCE_OFFICER || role === SystemRole.AUDITOR) return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-slate-100 text-slate-600 border-slate-200';
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex flex-col md:flex-row justify-between items-center bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl gap-6">
        <div>
          <h3 className="text-xl font-black text-black uppercase tracking-tighter">Internal Forum</h3>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mt-1">Official Communications & Updates</p>
        </div>
        <button 
          onClick={() => setShowForm(!showForm)}
          className={`px-8 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg flex items-center gap-2 ${showForm ? 'bg-slate-100 text-slate-500' : 'bg-purple-600 text-white hover:bg-purple-700'}`}
        >
          {showForm ? <><i className="fas fa-times"></i> Cancel</> : <><i className="fas fa-pen"></i> New Post</>}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-2xl animate-in slide-in-from-top-4 duration-300">
          <div className="space-y-6">
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-2 block">Subject / Title</label>
              <input 
                type="text" 
                value={newTitle}
                onChange={e => setNewTitle(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-bold text-black outline-none focus:bg-white focus:border-green-400 transition-all text-lg"
                placeholder="Brief summary of the announcement..."
                required
              />
            </div>
            <div>
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-2 block">Message Details</label>
              <textarea 
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-6 py-4 font-medium text-slate-700 outline-none focus:bg-white focus:border-green-400 transition-all min-h-[150px] resize-none leading-relaxed"
                placeholder="Type your message here..."
                required
              />
            </div>
            <div className="flex justify-end pt-4 border-t border-slate-50">
              <button 
                type="submit" 
                disabled={creating}
                className="bg-green-600 hover:bg-green-700 text-white px-8 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-xl transition-all flex items-center gap-2"
              >
                {creating ? <i className="fas fa-spinner fa-spin"></i> : <i className="fas fa-paper-plane"></i>}
                Publish to Forum
              </button>
            </div>
          </div>
        </form>
      )}

      {loading ? (
        <div className="text-center py-20 opacity-50 animate-pulse">
          <i className="fas fa-circle-notch fa-spin text-3xl text-slate-300"></i>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mt-4">Loading Feed...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[2.5rem] border border-slate-200 border-dashed">
          <i className="fas fa-comments text-4xl text-slate-200 mb-4"></i>
          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">No updates posted yet.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map(post => (
            <div key={post.id} className="bg-white p-8 md:p-10 rounded-[2.5rem] border border-slate-200 shadow-md hover:shadow-xl transition-shadow group relative overflow-hidden">
              <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-4 relative z-10">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-400 font-black text-xl shadow-sm shrink-0">
                    {post.authorName.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-black leading-tight">{post.title}</h4>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      <span className="text-[10px] font-black text-black uppercase">
                        {post.authorName}
                      </span>
                      <span className={`px-2 py-0.5 rounded-md border text-[8px] font-black uppercase tracking-wider ${getRoleBadgeColor(post.authorRole)}`}>
                        {post.authorRole}
                      </span>
                      {post.authorCluster && post.authorCluster !== '-' && (
                        <span className="px-2 py-0.5 rounded-md bg-slate-50 text-slate-500 border border-slate-100 text-[8px] font-bold uppercase tracking-wider">
                          <i className="fas fa-map-marker-alt mr-1"></i> {post.authorCluster}
                        </span>
                      )}
                      <span className="text-[8px] font-bold text-slate-400 uppercase ml-1">
                        • {new Date(post.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                {canDelete(post) && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleDelete(post.id); }}
                    className="text-slate-300 hover:text-red-500 transition-colors p-2"
                    title="Delete Post"
                  >
                    <i className="fas fa-trash-alt"></i>
                  </button>
                )}
              </div>
              
              <div className="pl-0 md:pl-16 relative z-10">
                <p className="text-sm font-medium text-slate-600 leading-relaxed whitespace-pre-wrap">
                  {post.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Forum;
