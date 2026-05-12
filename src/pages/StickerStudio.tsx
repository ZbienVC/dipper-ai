import { useState, useRef, useCallback } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Loader2, Download, Send, Plus, X, Sparkles, Image, ChevronDown, Check, ExternalLink } from 'lucide-react'

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}
function getAgentId() {
  // Stored from last agent used
  return localStorage.getItem('last_agent_id') || ''
}

const PRESETS = [
  { id: 'buy', label: 'Aggressive "BUY THIS" pointing at viewer', checked: true },
  { id: 'cry', label: 'Crying but smiling, clutching crypto bag', checked: true },
  { id: 'rocket', label: 'Riding rocket upward, arms out, excited', checked: true },
  { id: 'laser', label: 'Laser eyes, smug arms crossed', checked: false },
  { id: 'wagmi', label: 'Arms wide open triumphant WAGMI pose', checked: false },
  { id: 'rug', label: 'Face-down on floor, dead eyes, rugged', checked: false },
  { id: 'hype', label: 'Screaming into megaphone, hype energy', checked: false },
  { id: 'sleep', label: 'Sleeping peacefully while chaos burns behind', checked: false },
  { id: 'ceo', label: 'Dressed as CEO, mic in hand, confident', checked: false },
  { id: 'chart', label: 'Sweating, staring at red chart', checked: false },
]

export default function StickerStudio() {
  const token = getToken()
  const fileRef = useRef<HTMLInputElement>(null)
  
  // Character state
  const [refImg, setRefImg] = useState<{ url: string; base64: string } | null>(null)
  const [charDesc, setCharDesc] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  
  // Config
  const [bg, setBg] = useState<'none' | 'simple' | 'scene'>('none')
  const [mainChar, setMainChar] = useState(true)
  const [style, setStyle] = useState<'flat' | 'cartoon' | 'expressive'>('flat')
  const [count, setCount] = useState(5)
  const [concepts, setConcepts] = useState(PRESETS)
  const [custom, setCustom] = useState('')
  
  // Telegram
  const [packName, setPackName] = useState('')
  const [botToken, setBotToken] = useState('')
  const [autoExport, setAutoExport] = useState(false)
  
  // Output
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'generating' | 'exporting' | 'done'>('idle')
  const [genProgress, setGenProgress] = useState(0)
  const [stickers, setStickers] = useState<{url: string; prompt: string; ok: boolean}[]>([])
  const [packUrl, setPackUrl] = useState('')
  const [statusMsg, setStatusMsg] = useState('')

  const uploadAndAnalyze = useCallback(async (file: File) => {
    const localUrl = URL.createObjectURL(file)
    // Show image immediately before any async work
    setRefImg({ url: localUrl, base64: '' })
    setPhase('idle')
    
    // Resize to 1024px max
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
      img.src = localUrl
    })
    // Update with real base64 now that we have it
    setRefImg({ url: localUrl, base64 })

    // Analyze with vision - 15s timeout, completely optional
    setAnalyzing(true)
    setStatusMsg('Analyzing image... (skip and describe manually if slow)')
    try {
      const agentsRes = await fetch('/api/agents', { headers: { Authorization: `Bearer ${token}` } })
      const agents = await agentsRes.json()
      const agentId = agents[0]?.id
      
      if (agentId) {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 15000) // 15s max
        try {
          const body = JSON.stringify({
            message: 'Describe this image briefly for sticker generation. If it has a character: describe species/type, clothing, colors, art style in 2-3 sentences. If no character, describe the main subject/content.',
            model: 'claude-sonnet-4-5',
            imageData: base64,
            imageName: file.name,
          })
          const res = await fetch(`/api/agents/${agentId}/chat`, {
            method: 'POST',
            signal: controller.signal,
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body,
          })
          clearTimeout(timeoutId)
          const data = await res.json()
          if (data.content && !data.content.includes('trouble') && !data.content.includes('error')) {
            setCharDesc(data.content.replace(/\[.*?\]/g, '').replace(/^[a-z]$/i, '').trim() || data.content.trim())
            setStatusMsg('Image analyzed! Edit the description if needed.')
          } else {
            setStatusMsg('Could not auto-analyze. Describe your image/character manually below.')
          }
        } catch (fetchErr: any) {
          clearTimeout(timeoutId)
          if (fetchErr.name === 'AbortError') {
            setStatusMsg('Analysis timed out. Describe your image/character manually below.')
          }
        }
      }
    } catch {
      setStatusMsg('Auto-analysis unavailable. Describe your image/character manually below.')
    }
    
    setAnalyzing(false)
    if (!charDesc) setPhase('idle')
  }, [token])

  const buildPrompt = (concept: string) => {
    const charBase = charDesc || 'the character'
    const bgStr = bg === 'none' ? 'transparent/white background, isolated character' : bg === 'simple' ? 'minimal simple background' : 'relevant scene background'
    const styleStr = style === 'flat' ? 'flat simple cartoon' : style === 'cartoon' ? 'expressive cartoon' : 'expressive dynamic illustration'
    const charRule = mainChar ? 'character is the main and only focal point, fully visible, never cropped' : 'character prominently featured'
    return `${charBase}, ${concept}, Telegram sticker, ${styleStr}, ${bgStr}, ${charRule}, exaggerated emotion, simple clean design, no text, 512x512px`
  }

  const generateAll = async () => {
    const active = concepts.filter(c => c.checked).slice(0, count)
    if (active.length === 0 || !token) return
    
    setPhase('generating')
    setStickers([])
    setGenProgress(0)
    setPackUrl('')
    setStatusMsg('Generating stickers with DALL-E 3...')
    
    const results: {url: string; prompt: string; ok: boolean}[] = []
    
    for (let i = 0; i < active.length; i++) {
      setGenProgress(Math.round((i / active.length) * 100))
      setStatusMsg(`Generating sticker ${i + 1} of ${active.length}...`)
      
      try {
        const prompt = buildPrompt(active[i].label)
        const res = await fetch('/api/tools/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ prompt: prompt.slice(0, 500), size: '1024x1024' }),
        })
        const data = await res.json()
        results.push({ url: data.url || '', prompt: active[i].label, ok: !!data.url })
      } catch {
        results.push({ url: '', prompt: active[i].label, ok: false })
      }
      
      setStickers([...results])
      if (i < active.length - 1) await new Promise(r => setTimeout(r, 500))
    }
    
    setGenProgress(100)
    
    // Auto export to Telegram if configured
    const validUrls = results.filter(r => r.ok).map(r => r.url)
    if (autoExport && botToken && validUrls.length > 0) {
      await exportToTelegram(validUrls)
    } else {
      setPhase('done')
      setStatusMsg(`Generated ${results.filter(r => r.ok).length} stickers successfully!`)
    }
  }

  const exportToTelegram = async (urls?: string[]) => {
    const validUrls = urls || stickers.filter(s => s.ok).map(s => s.url)
    if (!botToken || validUrls.length === 0) return
    
    setPhase('exporting')
    setStatusMsg('Creating Telegram sticker pack...')
    
    try {
      const name = (packName || 'mypack').toLowerCase().replace(/[^a-z0-9_]/g, '_').slice(0, 30)
      const body = JSON.stringify({
        bot_token: botToken,
        pack_name: name,
        pack_title: packName || 'My Sticker Pack',
        sticker_urls: validUrls,
        telegram_user_id: '6705481681',
      })
      const res = await fetch('/api/sticker-pack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body,
      })
      const data = await res.json()
      if (data.pack_url) {
        setPackUrl(data.pack_url)
        setStatusMsg('Sticker pack created!')
      } else {
        setStatusMsg('Export failed: ' + (data.error || 'Unknown error'))
      }
    } catch (e: any) {
      setStatusMsg('Export error: ' + e.message)
    }
    
    setPhase('done')
  }

  const checkedCount = concepts.filter(c => c.checked).length

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-xl bg-violet-500/20 border border-violet-500/30 flex items-center justify-center text-lg">🎭</div>
            <div>
              <h1 className="text-xl font-black text-white">Sticker Studio</h1>
              <p className="text-xs text-slate-500">Upload a character → configure → generate → export to Telegram</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
          
          {/* === COLUMN 1: Input === */}
          <div className="lg:col-span-2 space-y-4">
            
            {/* Step 1: Character */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                <span className="text-sm font-bold text-white">Character</span>
              </div>
              <input ref={fileRef} type="file" className="hidden" accept="image/*,.gif" onChange={e => e.target.files?.[0] && uploadAndAnalyze(e.target.files[0])} />
              
              {refImg ? (
                <div className="relative mb-3">
                  <img src={refImg.url} alt="Character" className="w-full h-36 object-contain rounded-xl bg-black/30 border border-violet-500/20" />
                  <button onClick={() => { setRefImg(null); setCharDesc('') }} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center text-white hover:bg-red-500/80"><X size={10} /></button>
                  {analyzing && <div className="absolute inset-0 bg-black/60 rounded-xl flex items-center justify-center"><Loader2 size={20} className="animate-spin text-violet-400" /></div>}
                </div>
              ) : (
                <button onClick={() => fileRef.current?.click()} className="w-full h-28 border-2 border-dashed border-[#1e1e2e] rounded-xl flex flex-col items-center justify-center gap-2 text-slate-600 hover:border-violet-500/40 hover:text-violet-400 transition-all mb-3">
                  <Image size={20} />
                  <span className="text-xs">Upload JPG, PNG, or GIF</span>
                </button>
              )}
              
              {charDesc ? (
                <div className="bg-violet-500/8 border border-violet-500/20 rounded-xl p-3">
                  <p className="text-[10px] font-bold text-violet-400 mb-1">AI Description</p>
                  <p className="text-xs text-slate-300 leading-relaxed">{charDesc}</p>
                  <button onClick={() => setCharDesc('')} className="text-[10px] text-slate-600 mt-1 hover:text-slate-400">Edit</button>
                </div>
              ) : (
                <textarea value={charDesc} onChange={e => setCharDesc(e.target.value)} placeholder="Or describe your character manually..." rows={3}
                  className="w-full px-3 py-2 rounded-xl bg-white/5 border border-[#1e1e2e] text-xs text-white placeholder-slate-600 resize-none focus:outline-none focus:ring-1 focus:ring-violet-500/40" rows={5} />
              )}
            </div>

            {/* Step 2: Style */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                <span className="text-sm font-bold text-white">Style</span>
              </div>
              <div className="space-y-2.5">
                <div>
                  <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wide">Art style</p>
                  <div className="grid grid-cols-3 gap-1">
                    {(['flat','cartoon','expressive'] as const).map(s => (
                      <button key={s} onClick={() => setStyle(s)}
                        className={`py-1.5 rounded-lg text-xs font-semibold capitalize transition-all ${style===s?'bg-violet-600 text-white':'bg-white/4 text-slate-500 hover:text-white'}`}>{s}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <p className="text-[10px] text-slate-500 mb-1.5 uppercase tracking-wide">Background</p>
                  <div className="grid grid-cols-3 gap-1">
                    {[{v:'none',l:'None'},{v:'simple',l:'Simple'},{v:'scene',l:'Scene'}].map(({v,l}) => (
                      <button key={v} onClick={() => setBg(v as any)}
                        className={`py-1.5 rounded-lg text-xs font-semibold transition-all ${bg===v?'bg-violet-600 text-white':'bg-white/4 text-slate-500 hover:text-white'}`}>{l}</button>
                    ))}
                  </div>
                </div>
                <label className="flex items-center justify-between cursor-pointer">
                  <span className="text-xs text-slate-400">Character always in focus</span>
                  <button onClick={() => setMainChar(!mainChar)}
                    className={`w-9 h-5 rounded-full transition-all relative ${mainChar?'bg-violet-600':'bg-white/10'}`}>
                    <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform ${mainChar?'translate-x-4':'translate-x-0.5'}`} />
                  </button>
                </label>
              </div>
            </div>

            {/* Step 3: Telegram */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                <span className="text-sm font-bold text-white">Telegram Export</span>
              </div>
              <div className="space-y-2">
                <input value={packName} onChange={e => setPackName(e.target.value)} placeholder="Pack name (e.g. PepeCryptoVibes)"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#1e1e2e] text-sm text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40" />
                <input value={botToken} onChange={e => setBotToken(e.target.value)} placeholder="Bot token from @BotFather"
                  className="w-full px-3 py-2 rounded-lg bg-white/5 border border-[#1e1e2e] text-xs text-white placeholder-slate-600 font-mono focus:outline-none focus:ring-1 focus:ring-violet-500/40" />
                <label className="flex items-center gap-2 cursor-pointer">
                  <div onClick={() => setAutoExport(!autoExport)}
                    className={`w-4 h-4 rounded border flex items-center justify-center ${autoExport?'bg-violet-600 border-violet-600':'border-slate-600'}`}>
                    {autoExport && <Check size={10} className="text-white" />}
                  </div>
                  <span className="text-xs text-slate-400">Auto-export to Telegram after generation</span>
                </label>
                {!botToken && <p className="text-[10px] text-slate-600">No bot token? <a href="https://t.me/botfather" target="_blank" rel="noreferrer" className="text-violet-400">Get one from @BotFather →</a></p>}
              </div>
            </div>
          </div>

          {/* === COLUMN 2: Concepts + Generate + Results === */}
          <div className="lg:col-span-3 space-y-4">
            
            {/* Concepts */}
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-violet-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                  <span className="text-sm font-bold text-white">Sticker Concepts</span>
                  <span className="text-xs text-slate-500">({checkedCount} selected)</span>
                </div>
                <div className="flex items-center gap-1 bg-white/5 rounded-lg px-2 py-1">
                  <span className="text-[10px] text-slate-500">Generate</span>
                  {[3,5,8,10].map(n => (
                    <button key={n} onClick={() => setCount(n)}
                      className={`w-6 h-5 rounded text-[10px] font-bold transition-all ${count===n?'bg-violet-600 text-white':'text-slate-500 hover:text-white'}`}>{n}</button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-1 gap-1 mb-3 max-h-64 overflow-y-auto pr-1" style={{scrollbarWidth:'thin'}}>
                {concepts.map(c => (
                  <button key={c.id} onClick={() => setConcepts(prev => prev.map(p => p.id===c.id?{...p,checked:!p.checked}:p))}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-left transition-all ${c.checked?'bg-violet-500/10 border border-violet-500/20':'bg-white/2 border border-transparent hover:bg-white/4'}`}>
                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 ${c.checked?'bg-violet-600 border-violet-600':'border-slate-600'}`}>
                      {c.checked && <div className="w-1.5 h-1.5 bg-white rounded-sm" />}
                    </div>
                    <span className={`text-xs ${c.checked?'text-slate-200':'text-slate-500'}`}>{c.label}</span>
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <input value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => { if(e.key==='Enter'&&custom.trim()){setConcepts(p=>[...p,{id:'c'+Date.now(),label:custom.trim(),checked:true}]);setCustom('')}}}
                  placeholder="Add custom concept (press Enter)..."
                  className="flex-1 px-3 py-1.5 rounded-lg bg-white/5 border border-[#1e1e2e] text-xs text-white placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-violet-500/40" />
                <button onClick={() => {if(custom.trim()){setConcepts(p=>[...p,{id:'c'+Date.now(),label:custom.trim(),checked:true}]);setCustom('')}}}
                  className="px-3 py-1.5 rounded-lg bg-violet-600/20 border border-violet-500/30 text-violet-400 hover:bg-violet-600/30 transition-colors"><Plus size={13} /></button>
              </div>
            </div>

            {/* Generate button */}
            <button onClick={generateAll}
              disabled={phase === 'generating' || phase === 'exporting' || phase === 'analyzing'}
              className="w-full py-4 rounded-2xl font-black text-base text-white flex items-center justify-center gap-3 transition-all disabled:opacity-40"
              style={{ background: (phase==='generating'||phase==='exporting') ? 'rgba(124,58,237,0.4)' : 'linear-gradient(135deg,#7c3aed,#6d28d9)', boxShadow: '0 4px 20px rgba(124,58,237,0.3)' }}>
              {phase === 'generating' ? <><Loader2 size={18} className="animate-spin" /> Generating {genProgress}%...</>
               : phase === 'exporting' ? <><Loader2 size={18} className="animate-spin" /> Uploading to Telegram...</>
               : phase === 'analyzing' ? <><Loader2 size={18} className="animate-spin" /> Analyzing image...</>
               : <><Sparkles size={18} /> Generate {Math.min(count, checkedCount)} Stickers</>}
            </button>

            {statusMsg && (
              <p className={`text-sm text-center ${phase==='done'&&packUrl?'text-green-400':'text-slate-400'}`}>{statusMsg}</p>
            )}

            {/* Results grid */}
            {stickers.length > 0 && (
              <div className="bg-[#111118] border border-[#1e1e2e] rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-white">
                    {stickers.filter(s=>s.ok).length} stickers generated
                    {stickers.filter(s=>!s.ok).length > 0 && <span className="text-red-400 ml-2">({stickers.filter(s=>!s.ok).length} failed)</span>}
                  </h3>
                  <div className="flex gap-2">
                    {botToken && stickers.filter(s=>s.ok).length > 0 && !packUrl && (
                      <button onClick={() => exportToTelegram()}
                        disabled={phase==='exporting'}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold gradient-btn text-white disabled:opacity-50">
                        {phase==='exporting'?<Loader2 size={11} className="animate-spin"/>:<Send size={11}/>} Export to Telegram
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                  {stickers.map((s, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      {s.ok && s.url ? (
                        <a href={s.url} target="_blank" rel="noreferrer" title={s.prompt}>
                          <img src={s.url} alt={s.prompt} className="w-full aspect-square object-cover rounded-xl border border-violet-500/20 hover:border-violet-500/60 transition-colors"
                            onError={e => { const t = e.target as HTMLImageElement; t.src=''; t.style.cssText='background:#1a1a2e;display:flex'; }} />
                        </a>
                      ) : (
                        <div className="w-full aspect-square rounded-xl bg-red-500/8 border border-red-500/15 flex items-center justify-center">
                          <X size={14} className="text-red-400/60" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {packUrl && (
                  <div className="mt-4 p-3 rounded-xl bg-green-500/10 border border-green-500/20 flex items-center gap-3">
                    <Check size={16} className="text-green-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-green-400">Sticker pack ready!</p>
                      <a href={packUrl} target="_blank" rel="noreferrer" className="text-xs text-green-300 hover:text-green-200 truncate block">{packUrl}</a>
                    </div>
                    <a href={packUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-green-500/20 text-green-300 text-xs font-bold hover:bg-green-500/30 transition-colors shrink-0">
                      Add <ExternalLink size={10} />
                    </a>
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
