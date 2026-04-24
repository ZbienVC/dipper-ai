import { useState, useCallback, useRef } from 'react'
import DashboardLayout from '../components/DashboardLayout'
import { Search, MessageSquare, Bot, Filter, ChevronRight, X } from 'lucide-react'

function getToken() {
  try { return JSON.parse(localStorage.getItem('dipperai_user') || '{}').token } catch { return null }
}

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'Just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

const CHANNEL_COLORS: Record<string, string> = {
  telegram: 'bg-blue-500/15 text-blue-400',
  sms: 'bg-green-500/15 text-green-400',
  web: 'bg-violet-500/15 text-violet-400',
  discord: 'bg-indigo-500/15 text-indigo-400',
  twitter: 'bg-sky-500/15 text-sky-400',
}

export default function ConversationSearch() {
  const [query, setQuery] = useState('')
  const [filterChannel, setFilterChannel] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const [selectedConv, setSelectedConv] = useState<any>(null)
  const [convMessages, setConvMessages] = useState<any[]>([])
  const [loadingConv, setLoadingConv] = useState(false)

  const doSearch = useCallback(async () => {
    const token = getToken()
    if (!token) return
    setLoading(true)
    setSearched(true)
    try {
      const params = new URLSearchParams()
      if (query) params.set('q', query)
      if (filterChannel) params.set('channel', filterChannel)
      params.set('limit', '50')
      const res = await fetch(`/api/conversations/search?${params}`, { headers: { Authorization: `Bearer ${token}` } })
      const data = await res.json()
      setResults(data.results || [])
      setTotal(data.total || 0)
    } catch { setResults([]) }
    setLoading(false)
  }, [query, filterChannel])

  const loadConversation = async (convId: string) => {
    const token = getToken()
    if (!token) return
    setLoadingConv(true)
    try {
      const res = await fetch(`/api/conversations/${convId}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const data = await res.json()
        setConvMessages(data.messages || [])
      }
    } catch {}
    setLoadingConv(false)
  }

  const openConv = (result: any) => {
    setSelectedConv(result)
    loadConversation(result.conversation_id)
  }

  return (
    <DashboardLayout title="Conversation Search">
      <div className="mb-6">
        <h1 className="text-xl font-bold text-white mb-1">Conversation Search</h1>
        <p className="text-sm text-slate-500">Search across all conversations from all your agents.</p>
      </div>

      {/* Search Bar */}
      <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4 mb-4">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
            <input
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value)
                if (debounceRef.current) clearTimeout(debounceRef.current)
                if (e.target.value.trim()) debounceRef.current = setTimeout(doSearch, 300)
              }}
              onKeyDown={e => e.key === 'Enter' && doSearch()}
              placeholder="Search conversations..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-white/5 border border-[#1e1e2e] focus:outline-none focus:ring-1 focus:ring-violet-500/50 text-white placeholder-slate-600 text-sm"
            />
          </div>
          <select
            value={filterChannel}
            onChange={e => setFilterChannel(e.target.value)}
            className="px-3 py-2.5 rounded-xl bg-white/5 border border-[#1e1e2e] text-slate-300 text-sm focus:outline-none focus:ring-1 focus:ring-violet-500/50"
          >
            <option value="">All Channels</option>
            <option value="web">Web</option>
            <option value="telegram">Telegram</option>
            <option value="sms">SMS</option>
            <option value="discord">Discord</option>
          </select>
          <button
            onClick={doSearch}
            disabled={loading}
            className="gradient-btn px-5 py-2.5 rounded-xl font-semibold text-sm flex items-center gap-2 disabled:opacity-50"
          >
            {loading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Search size={14} />}
            Search
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Results */}
        <div>
          {searched && !loading && (
            <p className="text-xs text-slate-500 mb-3">{total} conversation{total !== 1 ? 's' : ''} found</p>
          )}
          {loading ? (
            <div className="space-y-3">
              {[0, 1, 2, 3].map(i => (
                <div key={i} className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-4 animate-pulse">
                  <div className="h-3 w-32 bg-white/5 rounded mb-2" />
                  <div className="h-2.5 w-48 bg-white/5 rounded" />
                </div>
              ))}
            </div>
          ) : results.length === 0 && searched ? (
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-8 text-center">
              <MessageSquare size={24} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm font-semibold">No conversations found</p>
              <p className="text-slate-600 text-xs mt-2 max-w-xs mx-auto">Try different keywords, remove the channel filter, or check that your agents have received messages.</p>
              <div className="mt-3 flex flex-wrap gap-2 justify-center">
                {['hello', 'help', 'order', 'price'].map(s => (
                  <button key={s} onClick={() => { setQuery(s); setTimeout(doSearch, 50) }} className="text-xs px-3 py-1 rounded-full bg-white/5 border border-[#1e1e2e] text-slate-400 hover:text-slate-200 transition-colors">
                    Try "{s}"
                  </button>
                ))}
              </div>
            </div>
          ) : results.length === 0 ? (
            <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl p-8 text-center">
              <Search size={24} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Enter a keyword and press Search</p>
            </div>
          ) : (
            <div className="space-y-2">
              {results.map(r => (
                <button
                  key={r.conversation_id}
                  onClick={() => openConv(r)}
                  className={`w-full text-left bg-[#111118] border rounded-xl p-4 hover:border-violet-500/30 hover:bg-violet-500/5 transition-all ${selectedConv?.conversation_id === r.conversation_id ? 'border-violet-500/50 bg-violet-500/5' : 'border-[#1e1e2e]'}`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-xl flex-shrink-0 mt-0.5">{r.agent_emoji || '🤖'}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-white text-sm">{r.agent_name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${CHANNEL_COLORS[r.channel] || 'bg-slate-500/15 text-slate-400'}`}>
                          {r.channel}
                        </span>
                      </div>
                      {r.matching_messages ? (
                        <div className="space-y-1">
                          {r.matching_messages.map((m: any) => (
                            <p key={m.id} className="text-xs text-slate-400 truncate">
                              <span className={`font-semibold ${m.role === 'user' ? 'text-blue-400' : 'text-violet-400'}`}>{m.role}: </span>
                              {m.content}
                            </p>
                          ))}
                        </div>
                      ) : r.preview ? (
                        <p className="text-xs text-slate-400 truncate">{r.preview}</p>
                      ) : null}
                      <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-600">
                        <span>{r.message_count} messages</span>
                        <span>{timeAgo(r.last_message_at)}</span>
                      </div>
                    </div>
                    <ChevronRight size={14} className="text-slate-600 flex-shrink-0 mt-1" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Conversation Detail */}
        <div className="bg-[#111118] border border-[#1e1e2e] rounded-xl overflow-hidden h-fit sticky top-4">
          {!selectedConv ? (
            <div className="p-8 text-center">
              <MessageSquare size={24} className="text-slate-600 mx-auto mb-3" />
              <p className="text-slate-500 text-sm">Select a conversation to view the full thread</p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between p-4 border-b border-[#1e1e2e]">
                <div className="flex items-center gap-2">
                  <span>{selectedConv.agent_emoji || '🤖'}</span>
                  <div>
                    <p className="text-sm font-semibold text-white">{selectedConv.agent_name}</p>
                    <p className="text-xs text-slate-500">{selectedConv.channel} · {selectedConv.message_count} messages</p>
                  </div>
                </div>
                <button onClick={() => { setSelectedConv(null); setConvMessages([]) }} className="text-slate-600 hover:text-white transition-colors">
                  <X size={16} />
                </button>
              </div>
              <div className="p-4 space-y-3 max-h-[500px] overflow-y-auto">
                {loadingConv ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-violet-500/30 border-t-violet-500 rounded-full animate-spin" />
                  </div>
                ) : convMessages.length === 0 ? (
                  <p className="text-slate-600 text-xs text-center py-4">No messages to display</p>
                ) : (
                  convMessages.map((m: any) => (
                    <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[80%] rounded-xl px-3 py-2 text-xs ${
                        m.role === 'user'
                          ? 'bg-violet-600/30 text-violet-100 border border-violet-500/20'
                          : 'bg-white/5 text-slate-300 border border-[#1e1e2e]'
                      }`}>
                        <p className="leading-relaxed">{m.content}</p>
                        <p className="text-[10px] opacity-50 mt-1">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  )
}
