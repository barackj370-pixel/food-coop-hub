import React, { useState } from 'react';
import { NewsArticle } from '../types';

interface CreateNewsFormProps {
  onSubmit: (article: Omit<NewsArticle, 'id' | 'date'>) => void;
  onCancel: () => void;
}

const CreateNewsForm: React.FC<CreateNewsFormProps> = ({ onSubmit, onCancel }) => {
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState('Cooperative Movement');
  const [image, setImage] = useState('');
  const [author, setAuthor] = useState('');
  const [role, setRole] = useState('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !summary || !content || !image || !author) {
      alert("Please fill in all required fields.");
      return;
    }
    
    // Convert newlines to HTML paragraphs/breaks for simple formatting
    const formattedContent = content
      .split('\n\n')
      .map(p => `<p>${p.replace(/\n/g, '<br/>')}</p>`)
      .join('<br/>');

    onSubmit({
      title,
      summary,
      content: formattedContent,
      category,
      image,
      author,
      role
    });
  };

  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-slate-100 animate-in fade-in slide-in-from-bottom-4">
      <div className="flex justify-between items-center mb-8">
        <h3 className="text-2xl font-black uppercase tracking-tight text-black">Create New Post</h3>
        <button onClick={onCancel} className="text-slate-400 hover:text-black transition-colors">
          <i className="fas fa-times text-xl"></i>
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Article Title *</label>
            <input 
              type="text" 
              value={title} 
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-black transition-colors"
              placeholder="Enter headline..."
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Category *</label>
            <select 
              value={category} 
              onChange={e => setCategory(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-black transition-colors"
            >
              <option value="Cooperative Movement">Cooperative Movement</option>
              <option value="Sustainable Farming">Sustainable Farming</option>
              <option value="Market Updates">Market Updates</option>
              <option value="Community Impact">Community Impact</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Short Summary *</label>
          <textarea 
            value={summary} 
            onChange={e => setSummary(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:border-black transition-colors resize-none h-24"
            placeholder="A brief 1-2 sentence summary for the card..."
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Full Content *</label>
          <textarea 
            value={content} 
            onChange={e => setContent(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-medium focus:outline-none focus:border-black transition-colors resize-y min-h-[200px]"
            placeholder="Write the full article here. Double line breaks will create new paragraphs..."
            required
          />
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cover Image *</label>
          <div className="flex items-center gap-4">
            <label className="cursor-pointer bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold hover:bg-slate-100 transition-colors flex-1 text-center">
              <i className="fas fa-upload mr-2"></i> {image ? 'Change Image' : 'Upload Image'}
              <input 
                type="file" 
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
                required={!image}
              />
            </label>
            {image && (
              <div className="w-16 h-16 rounded-xl overflow-hidden border border-slate-200 shrink-0">
                <img src={image} alt="Preview" className="w-full h-full object-cover" />
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Author Name *</label>
            <input 
              type="text" 
              value={author} 
              onChange={e => setAuthor(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-black transition-colors"
              placeholder="e.g. Clifford Ochieng"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400">Author Role</label>
            <input 
              type="text" 
              value={role} 
              onChange={e => setRole(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-6 py-4 text-sm font-bold focus:outline-none focus:border-black transition-colors"
              placeholder="e.g. Sales Manager"
            />
          </div>
        </div>

        <div className="pt-6 flex justify-end gap-4">
          <button 
            type="button" 
            onClick={onCancel}
            className="px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest text-slate-500 hover:bg-slate-100 transition-all"
          >
            Cancel
          </button>
          <button 
            type="submit"
            className="bg-black text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest shadow-xl hover:bg-slate-800 transition-all"
          >
            Publish Post
          </button>
        </div>
      </form>
    </div>
  );
};

export default CreateNewsForm;
