import React, { useState } from 'react';
import { GoogleGenAI } from '@google/genai';
import { Download, Loader2, Sparkles, Image as ImageIcon } from 'lucide-react';

const LogoGenerator: React.FC = () => {
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState('');
  const [colors, setColors] = useState('');
  const [slogan, setSlogan] = useState('');
  const [description, setDescription] = useState('');
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedLogo, setGeneratedLogo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!businessName || !category || !description) {
      setError('Please fill in the required fields (Business Name, Category, Description).');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const prompt = `A professional, high-end, minimalist logo design for a company named "${businessName}". 
      Industry/Category: ${category}. 
      Brand Colors: ${colors || "Designer's choice"}. 
      ${slogan ? `Slogan to include: "${slogan}". ` : ''}
      Additional details/concept: ${description}. 
      The logo should be modern, scalable, and visually striking, presented on a clean white background. Vector art style.`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-image',
        contents: {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      });

      let imageUrl = null;
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          const base64EncodeString: string = part.inlineData.data;
          imageUrl = `data:image/png;base64,${base64EncodeString}`;
          break;
        }
      }

      if (imageUrl) {
        setGeneratedLogo(imageUrl);
      } else {
        setError('Failed to generate logo. Please try again.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'An error occurred while generating the logo.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <section id="logo-generator" className="py-24 bg-white border-t border-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-50 text-indigo-600 font-bold text-sm mb-6">
            <Sparkles size={16} />
            <span>Free Tool</span>
          </div>
          <h2 className="text-4xl md:text-5xl font-extrabold text-slate-900 mb-6">High-End Logo Generator</h2>
          <p className="text-slate-600 text-lg">
            Describe your brand vision, and our AI will craft a professional, high-quality logo for your business in seconds. Download it for free.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12 items-start">
          {/* Form Side */}
          <div className="bg-slate-50 p-8 rounded-3xl border border-slate-100 shadow-sm">
            <form onSubmit={handleGenerate} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Business Name *</label>
                  <input 
                    type="text" 
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    placeholder="e.g. Onedigispot"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Business Category *</label>
                  <input 
                    type="text" 
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g. Technology, Cafe"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Brand Colors</label>
                  <input 
                    type="text" 
                    value={colors}
                    onChange={(e) => setColors(e.target.value)}
                    placeholder="e.g. Navy Blue & Gold"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">Logo Slogan</label>
                  <input 
                    type="text" 
                    value={slogan}
                    onChange={(e) => setSlogan(e.target.value)}
                    placeholder="e.g. Innovating the Future"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-700 mb-2">Describe Your Idea *</label>
                <textarea 
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the icon, style, or feeling you want the logo to convey..."
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-transparent transition-all resize-none"
                  required
                ></textarea>
              </div>

              {error && (
                <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium">
                  {error}
                </div>
              )}

              <button 
                type="submit" 
                disabled={isGenerating}
                className="w-full bg-indigo-600 text-white font-bold py-4 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg shadow-indigo-200"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="animate-spin" size={20} />
                    Generating Logo...
                  </>
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generate My Logo
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Result Side */}
          <div className="flex flex-col h-full min-h-[400px]">
            <div className="flex-1 bg-slate-50 rounded-3xl border border-slate-200 border-dashed flex flex-col items-center justify-center p-8 relative overflow-hidden group">
              {isGenerating ? (
                <div className="text-center">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <div className="absolute inset-0 border-4 border-indigo-100 rounded-full"></div>
                    <div className="absolute inset-0 border-4 border-indigo-600 rounded-full border-t-transparent animate-spin"></div>
                    <Sparkles className="absolute inset-0 m-auto text-indigo-600 animate-pulse" size={32} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2">Crafting your design...</h3>
                  <p className="text-slate-500 text-sm">Our AI is sketching the perfect logo for {businessName || 'your brand'}.</p>
                </div>
              ) : generatedLogo ? (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <img 
                    src={generatedLogo} 
                    alt="Generated Logo" 
                    className="w-full max-w-md h-auto object-contain rounded-2xl shadow-sm mb-8"
                  />
                  <a 
                    href={generatedLogo} 
                    download={`${businessName.replace(/\s+/g, '-').toLowerCase()}-logo.png`}
                    className="inline-flex items-center gap-2 bg-slate-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-xl shadow-slate-200"
                  >
                    <Download size={20} />
                    Download High-Res Logo
                  </a>
                </div>
              ) : (
                <div className="text-center text-slate-400">
                  <ImageIcon size={64} className="mx-auto mb-4 opacity-50" />
                  <p className="font-medium">Your generated logo will appear here</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LogoGenerator;
