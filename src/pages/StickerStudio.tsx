import { useState, useRef } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Loader2, Download, Send, Plus, X, Sparkles, Film, Image, Zap } from 'lucide-react'

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

const STICKER_CONCEPTS = [
  { id: 'buy', label: 'Aggressive "BUY THIS" pointing', checked: true },
  { id: 'cry', label: 'Crying but holding bags with a smile', checked: true },
  { id: 'rocket', label: 'Riding a rocket going up', checked: true },
  { id: 'laser', label: 'Laser eyes, smug and confident', checked: false },
  { id: 'wagmi', label: 'Arms wide open "WAGMI" pose', checked: false },
  { id: 'rug', label: 'Face-down on floor, completely rugged', checked: false },
  { id: 'hype', label: 'Screaming into megaphone', checked: false },
  { id: 'sleep', label: 'Sleeping while chaos burns behind', checked: false },
  { id: 'ceo', label: 'Dressed as CEO shill boss', checked: false },
  { id: 'chart', label: 'Sweating at red chart', checked: false },
]

export default function StickerStudio() {
  const token = getToken()
  const fileInputRef = useRef<HTMLInputElement>(null)
  
  // Character
  const [refImage, setRefImage] = useState<{ url: string; base64: string; name: string } | null>(null)
  const [charDesc, setCharDesc] = useState('')
  
  // Style settings
  const [style, setStyle] = useState<'flat' | 'cartoon' | 'detailed'>('flat')
  const [background, setBackground] = useState<'transparent' | 'simple' | 'scene'>('transparent')
  const [animated, setAnimated] = useState(false)
  const [complexity, setComplexity] = useState<'simple' | 'medium' | 'detailed'>('simple')
  
  // Pack settings
  const [packName, setPackName] = useState('')
  const [count, setCount] = useState(5)
  const [concepts, setConcepts] = useState(STICKER_CONCEPTS)
  const [customConcept, setCustomConcept] = useState('')
  
  // Telegram
  const [botToken, setBotToken] = useState('')
  const [telegramUserId] = useState('6705481681')
  
  // Generation state
  const [generating, setGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedStickers, setGeneratedStickers] = useState<{url: string; concept: string; failed?: boolean}[]>([])
  const [packUrl, setPackUrl] = useState('')
  const [error, setError] = useState('')
  
  const uploadRef = async (file: File) => {
    const url = URL.createObjectURL(file)
    const base64 = await new Promise<string>(resolve => {
      const canvas = document.createElement('canvas')
      const img = new Image()
      img.onload = () => {
        const max = 1024
        let w = img.width, h = img.height
        if (w > max) { h = Math.round(h * max / w); w = max }
        if (h > max) { w = Math.round(w * max / h); h = max }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d')!.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = url
    })
    setRefImage({ url, base64, name: file.name })
    // Auto-analyze with vision
    analyzeCharacter(base64)
  }
  
  const analyzeCharacter = async (base64: string) => {
    try {
      const body = JSON.stringify({ message: 'Describe this character in detail for sticker generation: colors, features, clothing, distinctive traits, art style. Be specific and concise.', model: 'claude-sonnet-4-5', imageData: base64, imageName: 'character.jpg' })
      const agents = await fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } }).then(r => r.json())
      const agentId = agents[0]?.id
      if (!agentId) return
      const res = await fetch(`/api/agents/${agentId}/chat`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body })
      const data = await res.json()
      if (data.content) setCharDesc(data.content.slice(0, 500))
    } catch {}
  }
  
  const buildPrompt = (concept: string) => {
    const charBase = charDesc || 'the character from the reference image'
    const styleStr = style === 'flat' ? 'flat simple cartoon' : style === 'cartoon' ? 'expressive cartoon' : 'detailed illustration'
    const bgStr = background === 'transparent' ? 'transparent/white background' : background === 'simple' ? 'minimal simple background' : 'scene background'
    return `${charBase}, ${concept}, ${styleStr} art style, ${bgStr}, Telegram sticker format, 512x512px, the character is the clear focal point, no text, exaggerated expression, ${complexity} level of detail`
  }
  
  const generatePack = async () => {
    const activeConcepts = concepts.filter(c => c.checked).slice(0, count)
    if (activeConcepts.length === 0) { setError('Select at least one concept'); return }
    setGenerating(true); setGeneratedStickers([]); setProgress(0); setError(''); setPackUrl('')
    
    const results: {url: string; concept: string; failed?: boolean}[] = []
    
    for (let i = 0; i < activeConcepts.length; i++) {
      const concept = activeConcepts[i]
      setProgress(Math.round((i / activeConcepts.length) * 100))
      try {
        const prompt = buildPrompt(concept.label)
        const gb = JSON.stringify({ prompt: prompt.slice(0, 500), size: '1024x1024' })
        const gr = await fetch('/api/tools/generate-image', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: gb })
        const gd = await gr.json()
        results.push({ url: gd.url || '', concept: concept.label, failed: !gd.url })
        setGeneratedStickers([...results])
      } catch {
        results.push({ url: '', concept: concept.label, failed: true })
      }
      if (i < activeConcepts.length - 1) await new Promise(r => setTimeout(r, 500))
    }
    
    setProgress(100)
    
    // Create Telegram pack if bot token provided
    if (botToken && results.filter(r => !r.failed && r.url).length > 0) {
      try {
        const stickerUrls = results.filter(r => !r.failed && r.url).map(r => r.url)
        const name = packName.replace(/[^a-z0-9_]/gi, '_').toLowerCase() || 'mypack'
        const pb = JSON.stringify({ bot_token: botToken, pack_name: name, pack_title: packName || 'My Sticker Pack', sticker_urls: stickerUrls, telegram_user_id: telegramUserId })
        const pr = await fetch('/api/community/placeholder/sticker-pack', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: pb })
        const pd = await pr.json()
        if (pd.pack_url) setPackUrl(pd.pack_url)
      } catch {}
    }
    
    setGenerating(false)
  }
  
  const toggleConcept = (id: string) => setConcepts(prev => prev.map(c => c.id === id ? { ...c, checked: !c.checked } : c))
  
  const addConcept = () => {
    if (!customConcept.trim()) return
    setConcepts(prev => [...prev, { id: 'custom_' + Date.now(), label: customConcept.trim(), checked: true }])
    setCustomConcept('')
  }
  
  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <p className="text-xs font-bold uppercase tracking-widest text-violet-400 mb-2">Creative Studio</p>
          <h1 className="text-2xl font-black text-white">Sticker Studio</h1>
          <p className="text-slate-500 text-sm mt-1">Create Telegram sticker packs with AI — upload a character, configure your pack, generate and export</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Config */}
          <div className="lg:col-span-1 space-y-4">
            {/* Character */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5">
              <h3 className="font-bold text-white text-sm mb-3">1. Character Reference</h3>
              <input ref={fileInputRef} type="file" className="hidden" accept="image/*" onChange={e => e.target.files?.[0] && uploadRef(e.target.files[0])} />
              {refImage ? (
                <div className="relative mb-3">
                  <img src={refImage.url} alt="" className="w-full h-40 object-cover rounded-xl border border-violet-500/30" />
                  <button onClick={() => setRefImage(null)} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center text-white hover:bg-red-500/80 transition-colors"><X size={10} /></button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} className="w-full h-32 border-2 border-dashed border-[#1e1e2e] rounded-xl flex flex-col items-center justify-center gap-2 text-slate-500 hover:border-violet-500/40 hover:text-violet-400 transition-all mb-3">
                  <Image size={20} />
                  <span className="text-xs">Upload character image</span>
                </button>
              )}
              {charDesc && <p className="text-xs text-slate-400 leading-relaxed bg-white/3 rounded-lg p-2">{charDesc.slice(0, 150)}...</p>}
            </div>

            {/* Style */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5">
              <h3 className="font-bold text-white text-sm mb-3">2. Style Settings</h3>
              <div className="space-y-3">
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Art Style</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['flat','cartoon','detailed'] as const).map(s => (
                      <button key={s} onClick={() => setStyle(s)} className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${style===s?'bg-violet-600 text-white':'bg-white/4 text-slate-400 hover:bg-white/8'}`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-xs text-slate-400 mb-1 block">Background</label>
                  <div className="grid grid-cols-3 gap-1">
                    {(['transparent','simple','scene'] as const).map(b => (
                      <button key={b} onClick={() => setBackground(b)} className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${background===b?'bg-violet-600 text-white':'bg-white/4 text-slate-400 hover:bg-white/8'}`}>{b}</button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-400">Animated <span className="text-slate-600">(coming soon)</span></span>
                  <button onClick={() => setAnimated(!animated)} className={`w-10 h-5 rounded-full transition-all ${animated?'bg-violet-600':'bg-white/10'}`}>
                    <div className={`w-4 h-4 bg-white rounded-full m-0.5 transition-transform ${animated?'translate-x-5':''}`} />
                  </button>
                </div>
              </div>
            </div>

            {/* Telegram export */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5">
              <h3 className="font-bold text-white text-sm mb-3">3. Telegram Export</h3>
              <input value={packName} onChange={e => setPackName(e.target.value)} placeholder="Pack name (e.g. PepelienPack)" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#1e1e2e] text-sm text-white placeholder-slate-600 mb-2 focus:outline-none focus:ring-1 focus:ring-violet-500/40" />
              <input value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="Bot token from @BotFather (optional)" className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#1e1e2e] text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/40" />
              <p className="text-xs text-slate-600 mt-1">Without token, stickers are generated for download only</p>
            </div>
          </div>

          {/* Right: Concepts + Generate */}
          <div className="lg:col-span-2 space-y-4">
            {/* Concepts */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-white text-sm">Sticker Concepts</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-500">{concepts.filter(c=>c.checked).length} selected</span>
                  <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1">
                    <span className="text-xs text-slate-400">Generate:</span>
                    {[3,5,10].map(n => (
                      <button key={n} onClick={() => setCount(n)} className={`w-7 h-6 rounded text-xs font-bold transition-all ${count===n?'bg-violet-600 text-white':'text-slate-500 hover:text-white'}`}>{n}</button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1.5 mb-3">
                {concepts.map(c => (
                  <button key={c.id} onClick={() => toggleConcept(c.id)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-all ${c.checked?'bg-violet-500/12 border border-violet-500/25':'bg-white/3 border border-white/6 hover:bg-white/5'}`}>
                    <div className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 ${c.checked?'bg-violet-600 border-violet-600':'border-slate-600'}`}>
                      {c.checked && <div className="w-2 h-2 bg-white rounded-sm" />}
                    </div>
                    <span className={`text-xs ${c.checked?'text-slate-200':'text-slate-500'}`}>{c.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={customConcept} onChange={e => setCustomConcept(e.target.value)} onKeyDown={e => e.key==='Enter'&&addConcept()} placeholder="Add custom concept..." className="flex-1 px-3 py-2 rounded-lg bg-white/5 border border-[#1e1e2e] text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40" />
                <button onClick={addConcept} className="px-3 py-2 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 hover:bg-violet-600/30 transition-colors"><Plus size={14} /></button>
              </div>
            </div>

            {/* Generate button */}
            <button onClick={generatePack} disabled={generating}
              className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-3 transition-all disabled:opacity-50"
              style={{ background: generating ? 'rgba(124,58,237,0.4)' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: generating ? 'none' : '0 4px 24px rgba(124,58,237,0.4)' }}>
              {generating ? <><Loader2 size={18} className="animate-spin" /> Generating {progress}%...</> : <><Sparkles size={18} /> Generate {count} Stickers</>}
            </button>

            {error && <p className="text-red-400 text-sm text-center">{error}</p>}

            {/* Results */}
            {generatedStickers.length > 0 && (
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-bold text-white text-sm">Generated Stickers ({generatedStickers.filter(s=>!s.failed).length}/{generatedStickers.length})</h3>
                  {packUrl && (
                    <a href={packUrl} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold gradient-btn text-white">
                      <Send size={12} /> Add to Telegram
                    </a>
                  )}
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-3">
                  {generatedStickers.map((s, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      {s.url && !s.failed ? (
                        <a href={s.url} target="_blank" rel="noreferrer" className="block">
                          <img src={s.url} alt={s.concept} className="w-full aspect-square object-cover rounded-xl border border-violet-500/20 hover:border-violet-500/50 transition-colors"
                            onError={e => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).style.background = '#1a1a2e' }} />
                        </a>
                      ) : (
                        <div className="w-full aspect-square rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                          <X size={16} className="text-red-400" />
                        </div>
                      )}
                      <p className="text-[9px] text-slate-600 truncate">{s.concept.slice(0,30)}</p>
                    </div>
                  ))}
                </div>
                {packUrl && (
                  <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 text-center">
                    <p className="text-xs text-green-400 font-bold mb-1">✅ Sticker pack created!</p>
                    <a href={packUrl} target="_blank" rel="noreferrer" className="text-xs text-green-300 underline">{packUrl}</a>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
