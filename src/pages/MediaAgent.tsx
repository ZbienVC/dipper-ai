import { useState, useRef, useCallback } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Upload, Film, Image, Sparkles, Download, Loader2, X, CheckCircle, AlertCircle, ChevronRight } from 'lucide-react'

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

const SUGGESTIONS = [
  { icon: '✂️', text: 'Trim to first 30 seconds' },
  { icon: '📱', text: 'Crop to vertical 9:16 for TikTok' },
  { icon: '💬', text: 'Add captions to this video' },
  { icon: '🎞️', text: 'Convert clip to animated GIF' },
  { icon: '🐸', text: 'Remove background and make Telegram sticker' },
  { icon: '🎨', text: 'Make it black and white with cinematic look' },
  { icon: '⚡', text: 'Speed up 2x and add fade in/out' },
  { icon: '🏷️', text: 'Make a Discord emoji (100x100)' },
]

const CAPABILITIES = [
  { label: 'Video', items: ['Trim & cut', 'Speed up / slow down', 'Crop to 9:16 / 1:1', 'Auto-captions (Whisper)', 'Fade in/out', 'Add music', 'Grayscale / filters', 'Reverse', 'Remove silences', 'Video → GIF'] },
  { label: 'Image', items: ['Remove background', 'Overlay / composite', 'Resize & crop', 'Add text', 'Grayscale / blur', 'Rotate', 'Watermark'] },
  { label: 'Stickers & Emojis', items: ['Telegram sticker (512x512 WebP)', 'Discord emoji (100x100)', 'Animated GIF from image', 'Ken Burns zoom effect', 'Pan & shake animations'] },
]

type JobState = {
  jobId: string
  status: 'uploading' | 'processing' | 'done' | 'error'
  progress: number
  message: string
  error?: string
  outputName?: string
}

export default function MediaAgent() {
  const [file, setFile] = useState<File | null>(null)
  const [filePreview, setFilePreview] = useState<string | null>(null)
  const [filePath, setFilePath] = useState<string | null>(null)
  const [mimetype, setMimetype] = useState<string>('')
  const [instruction, setInstruction] = useState('')
  const [job, setJob] = useState<JobState | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const reset = () => {
    setFile(null)
    setFilePreview(null)
    setFilePath(null)
    setMimetype('')
    setInstruction('')
    setJob(null)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  const handleFile = useCallback(async (f: File) => {
    setFile(f)
    setMimetype(f.type)
    setJob({ jobId: '', status: 'uploading', progress: 0, message: 'Uploading file...' })

    // Generate preview
    if (f.type.startsWith('image/') || f.type.startsWith('video/')) {
      const url = URL.createObjectURL(f)
      setFilePreview(url)
    }

    // Upload
    const token = getToken()
    const formData = new FormData()
    formData.append('file', f)
    try {
      const res = await fetch('/api/media/upload', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Upload failed')
      setFilePath(data.path)
      setJob({ jobId: data.jobId, status: 'processing', progress: 10, message: 'File ready — describe what you want!' })
    } catch (e: any) {
      setJob({ jobId: '', status: 'error', progress: 0, message: '', error: e.message })
    }
  }, [])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) handleFile(f)
  }, [handleFile])

  const pollStatus = (jobId: string) => {
    const token = getToken()
    pollRef.current = setInterval(async () => {
      try {
        const res = await fetch(`/api/media/status/${jobId}`, { headers: { Authorization: `Bearer ${token}` } })
        const data = await res.json()
        setJob(prev => prev ? { ...prev, status: data.status, progress: data.progress, message: data.message, error: data.error, outputName: data.outputName } : prev)
        if (data.status === 'done' || data.status === 'error') {
          if (pollRef.current) clearInterval(pollRef.current)
        }
      } catch {}
    }, 1500)
  }

  const handleProcess = async () => {
    if (!instruction.trim() || !filePath || !job?.jobId) return
    const token = getToken()
    setJob(prev => prev ? { ...prev, status: 'processing', progress: 5, message: 'Analyzing your request...' } : prev)

    try {
      await fetch('/api/media/process', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: job.jobId, instruction, filePath, mimetype, originalName: file?.name }),
      })
      pollStatus(job.jobId)
    } catch (e: any) {
      setJob(prev => prev ? { ...prev, status: 'error', error: e.message } : prev)
    }
  }

  const handleDownload = () => {
    if (!job?.jobId) return
    const token = getToken()
    const a = document.createElement('a')
    a.href = `/api/media/download/${job.jobId}?token=${token}`
    a.download = job.outputName || 'output'
    a.click()
  }

  const isProcessing = job?.status === 'processing' || job?.status === 'uploading'
  const isDone = job?.status === 'done'
  const isError = job?.status === 'error'
  const isReady = job?.status === 'processing' && (job.progress ?? 0) >= 10 && filePath

  return (
    <DashboardLayout>
      <div className="flex h-[calc(100vh-64px)] overflow-hidden">

        {/* Left sidebar — capabilities */}
        <div className="w-64 flex-shrink-0 border-r border-white/5 bg-[#0d0d14] overflow-y-auto p-5 hidden lg:block">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
              <Film size={15} className="text-violet-400" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">Media Editor</div>
              <div className="text-xs text-slate-500">AI-powered</div>
            </div>
          </div>

          {CAPABILITIES.map(cap => (
            <div key={cap.label} className="mb-5">
              <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">{cap.label}</div>
              <div className="space-y-1">
                {cap.items.map(item => (
                  <div key={item} className="flex items-center gap-2 text-xs text-slate-400 py-0.5">
                    <div className="w-1 h-1 rounded-full bg-violet-500/60 flex-shrink-0" />
                    {item}
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="mt-6 p-3 rounded-xl bg-amber-500/5 border border-amber-500/20">
            <div className="text-xs font-semibold text-amber-400 mb-1">Pro tip</div>
            <div className="text-[11px] text-slate-500 leading-relaxed">Be specific: "Trim 0:05 to 0:30, then crop to 9:16 for TikTok"</div>
          </div>
        </div>

        {/* Main area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0a0a0f]">

          {/* Top bar */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-white/5">
            <div>
              <h1 className="text-lg font-bold text-white">Media Editor Agent</h1>
              <p className="text-xs text-slate-500 mt-0.5">Drop a file, describe your edit, get it back instantly</p>
            </div>
            {file && (
              <button onClick={reset} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/10 hover:border-white/20 transition-colors">
                <X size={12} /> New file
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6">
            {!file ? (
              <div className="max-w-2xl mx-auto">
                {/* Drop zone */}
                <div
                  onDragOver={e => { e.preventDefault(); setIsDragging(true) }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={onDrop}
                  onClick={() => fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
                    isDragging ? 'border-violet-500 bg-violet-500/5' : 'border-white/10 hover:border-white/20 hover:bg-white/2'
                  }`}
                >
                  <input ref={fileInputRef} type="file" className="hidden" accept="image/*,video/*,.gif"
                    onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])} />
                  <div className="flex justify-center gap-3 mb-4">
                    <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center">
                      <Film size={22} className="text-violet-400" />
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                      <Image size={22} className="text-blue-400" />
                    </div>
                  </div>
                  <div className="text-base font-semibold text-white mb-1">Drop your file here</div>
                  <div className="text-sm text-slate-500">or click to browse · Video, image, GIF · up to 200MB</div>
                </div>

                {/* Suggestions */}
                <div className="mt-8">
                  <div className="text-xs font-semibold text-slate-500 uppercase tracking-widest mb-3">What can you do?</div>
                  <div className="grid grid-cols-2 gap-2">
                    {SUGGESTIONS.map(s => (
                      <div key={s.text} className="flex items-center gap-3 p-3 rounded-xl bg-white/3 border border-white/5 text-sm text-slate-400">
                        <span className="text-base">{s.icon}</span>
                        <span>{s.text}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-5">

                {/* File preview */}
                <div className="rounded-2xl bg-[#111118] border border-white/8 overflow-hidden">
                  {mimetype.startsWith('video/') ? (
                    <video src={filePreview || ''} controls className="w-full max-h-64 object-contain bg-black" />
                  ) : (
                    <img src={filePreview || ''} alt="Preview" className="w-full max-h-64 object-contain" />
                  )}
                  <div className="px-4 py-3 flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium text-white">{file.name}</div>
                      <div className="text-xs text-slate-500 mt-0.5">{(file.size / 1024 / 1024).toFixed(1)} MB · {file.type}</div>
                    </div>
                    {job?.status === 'uploading' && (
                      <div className="flex items-center gap-2 text-xs text-slate-400">
                        <Loader2 size={12} className="animate-spin" /> Uploading...
                      </div>
                    )}
                    {filePath && <div className="flex items-center gap-1.5 text-xs text-green-400"><CheckCircle size={12} /> Ready</div>}
                  </div>
                </div>

                {/* Job status */}
                {job && job.progress > 10 && (
                  <div className={`rounded-xl p-4 border ${
                    isDone ? 'bg-green-500/5 border-green-500/20' :
                    isError ? 'bg-red-500/5 border-red-500/20' :
                    'bg-violet-500/5 border-violet-500/20'
                  }`}>
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isDone && <CheckCircle size={14} className="text-green-400" />}
                        {isError && <AlertCircle size={14} className="text-red-400" />}
                        {isProcessing && <Loader2 size={14} className="text-violet-400 animate-spin" />}
                        <span className={`text-sm font-medium ${isDone ? 'text-green-400' : isError ? 'text-red-400' : 'text-violet-400'}`}>
                          {isDone ? 'Done!' : isError ? 'Error' : job.message}
                        </span>
                      </div>
                      {!isDone && !isError && <span className="text-xs text-slate-500">{job.progress}%</span>}
                    </div>
                    {isProcessing && (
                      <div className="w-full bg-white/5 rounded-full h-1.5">
                        <div className="bg-violet-500 h-1.5 rounded-full transition-all duration-500" style={{ width: `${job.progress}%` }} />
                      </div>
                    )}
                    {isError && <div className="text-xs text-red-400 mt-1">{job.error}</div>}
                    {isDone && (
                      <button onClick={handleDownload}
                        className="mt-3 flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold text-white"
                        style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}>
                        <Download size={14} /> Download {job.outputName}
                      </button>
                    )}
                  </div>
                )}

                {/* Instruction + suggestions */}
                {!isDone && !isProcessing && (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      {SUGGESTIONS.map(s => (
                        <button key={s.text} onClick={() => setInstruction(s.text)}
                          className="flex items-center gap-2 p-3 rounded-xl bg-white/3 hover:bg-white/6 border border-white/5 hover:border-violet-500/30 text-sm text-slate-400 hover:text-white transition-all text-left">
                          <span>{s.icon}</span><span>{s.text}</span>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Bottom input */}
          {file && !isDone && (
            <div className="px-6 py-4 border-t border-white/5 bg-[#0a0a0f]">
              <div className="max-w-2xl mx-auto flex gap-3">
                <div className="flex-1 relative">
                  <input
                    value={instruction}
                    onChange={e => setInstruction(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleProcess()}
                    placeholder={isProcessing ? 'Processing...' : 'Describe what you want to do...'}
                    disabled={isProcessing || !filePath}
                    className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 text-sm disabled:opacity-50"
                  />
                </div>
                <button
                  onClick={handleProcess}
                  disabled={!instruction.trim() || isProcessing || !filePath}
                  className="flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm text-white disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  style={{ background: 'linear-gradient(135deg, #7c3aed, #6d28d9)' }}
                >
                  {isProcessing ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
                  {isProcessing ? 'Processing' : 'Edit'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
