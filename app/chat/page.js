'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { PlusCircle, Send, LogOut, MessageSquare, Trash2, Menu, X, Paperclip, Copy, Check } from 'lucide-react'
import FileDownloadBar from '@/components/FileDownloadBar'

export default function Chat() {
  const [user, setUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [currentConversation, setCurrentConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [fileContext, setFileContext] = useState(null)
  const [fileName, setFileName] = useState(null)
  const [imageData, setImageData] = useState(null)
  const [copiedId, setCopiedId] = useState(null)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)
  const textareaRef = useRef(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { window.location.href = '/login' }
      else { setUser(user); loadConversations(user.id) }
    }
    getUser()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    const handleClick = (e) => {
      if (sidebarOpen && window.innerWidth < 768) {
        const sidebar = document.getElementById('sidebar')
        if (sidebar && !sidebar.contains(e.target)) setSidebarOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [sidebarOpen])

  const loadConversations = async (userId) => {
    const { data } = await supabase
      .from('conversations').select('*').eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (data) setConversations(data)
  }

  const loadMessages = async (conversationId) => {
    const { data } = await supabase
      .from('messages').select('*').eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  const createNewConversation = async () => {
    if (!user) return
    const { data } = await supabase
      .from('conversations').insert({ user_id: user.id, title: 'New Chat' })
      .select().single()
    if (data) {
      setConversations([data, ...conversations])
      setCurrentConversation(data)
      setMessages([])
      if (window.innerWidth < 768) setSidebarOpen(false)
    }
  }

  const selectConversation = async (conv) => {
    setCurrentConversation(conv)
    await loadMessages(conv.id)
    if (window.innerWidth < 768) setSidebarOpen(false)
  }

  const deleteConversation = async (e, convId) => {
    e.stopPropagation()
    await supabase.from('conversations').delete().eq('id', convId)
    setConversations(conversations.filter(c => c.id !== convId))
    if (currentConversation?.id === convId) { setCurrentConversation(null); setMessages([]) }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      if (data.type === 'image' || data.type === 'pdf') {
        setImageData({ base64: data.base64, mimeType: data.mimeType })
        setFileContext(data.text)
      } else {
        setImageData(null)
        setFileContext(data.text)
      }
      setFileName(data.fileName)
    } catch (err) { console.error(err) }
  }

  const copyToClipboard = async (content, id) => {
    await navigator.clipboard.writeText(content)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    let conv = currentConversation
    if (!conv) {
      const { data } = await supabase
        .from('conversations').insert({ user_id: user.id, title: input.slice(0, 50) })
        .select().single()
      conv = data
      setCurrentConversation(data)
      setConversations(prev => [data, ...prev])
    }

    const userMessage = { role: 'user', content: input, conversation_id: conv.id, user_id: user.id }
    setMessages(prev => [...prev, { ...userMessage, id: Date.now() }])
    setInput('')
    setLoading(true)
    setFileContext(null)
    setFileName(null)
    setImageData(null)
    if (textareaRef.current) { textareaRef.current.style.height = 'auto' }

    await supabase.from('messages').insert(userMessage)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({ role: m.role, content: m.content })),
          conversationId: conv.id,
          fileContext,
          imageData
        })
      })

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let assistantMessage = ''
      const assistantMsgId = Date.now() + 1
      setMessages(prev => [...prev, { id: assistantMsgId, role: 'assistant', content: '' }])

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        const chunk = decoder.decode(value)
        for (const line of chunk.split('\n')) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              assistantMessage += parsed.text || ''
              setMessages(prev => prev.map(m => m.id === assistantMsgId ? { ...m, content: assistantMessage } : m))
            } catch {}
          }
        }
      }

      await supabase.from('messages').insert({ role: 'assistant', content: assistantMessage, conversation_id: conv.id, user_id: user.id })
      await supabase.from('conversations').update({ updated_at: new Date().toISOString() }).eq('id', conv.id)
      loadConversations(user.id)
    } catch (err) {
      setMessages(prev => [...prev, { id: Date.now(), role: 'assistant', content: 'Sorry, something went wrong.' }])
    }
    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage() }
  }

  const handleLogout = async () => { await supabase.auth.signOut(); window.location.href = '/login' }

  const initials = user?.email?.[0]?.toUpperCase()

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/50 z-20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <div
        id="sidebar"
        className={`
          fixed md:relative z-30 md:z-auto
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          w-72 md:w-64 h-full
          transition-transform duration-300
          bg-gray-900 border-r border-gray-800
          flex flex-col flex-shrink-0
        `}
      >
        <div className="p-4 flex flex-col h-full">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">V</div>
              <span className="font-semibold text-white">Voxora AI</span>
            </div>
            <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white">
              <X size={20} />
            </button>
          </div>

          <button onClick={createNewConversation}
            className="flex items-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2.5 rounded-lg text-sm font-medium transition-colors mb-4">
            <PlusCircle size={16} /> New Chat
          </button>

          <div className="text-xs text-gray-500 mb-3 px-1">Powered by Gemini 2.5 Flash</div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {conversations.map(conv => (
              <div key={conv.id} onClick={() => selectConversation(conv)}
                className={`group flex items-center justify-between px-3 py-2.5 rounded-lg cursor-pointer text-sm transition-colors ${
                  currentConversation?.id === conv.id ? 'bg-gray-700 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}>
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare size={14} className="flex-shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </div>
                <button onClick={(e) => deleteConversation(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 flex-shrink-0 p-1">
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-4 mt-4">
            <div className="text-xs text-gray-500 truncate mb-2 px-1">{user?.email}</div>
            <button onClick={handleLogout}
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors w-full">
              <LogOut size={16} /> Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-950 flex-shrink-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-lg hover:bg-gray-800">
            <Menu size={20} />
          </button>
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-xs font-bold">V</div>
          <h1 className="font-semibold text-white text-sm truncate flex-1">
            {currentConversation?.title || 'Voxora AI'}
          </h1>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold mb-4">V</div>
              <h2 className="text-xl md:text-2xl font-bold text-white mb-2">How can I help you today?</h2>
              <p className="text-gray-400 text-sm md:text-base max-w-md">Ask me anything — create documents, analyze data, write code, or search the web.</p>
              <div className="grid grid-cols-2 gap-2 mt-6 w-full max-w-sm">
                {['Write a report', 'Create a spreadsheet', 'Explain a concept', 'Search the web'].map(s => (
                  <button key={s} onClick={() => setInput(s)}
                    className="bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs px-3 py-2.5 rounded-xl transition-colors text-left border border-gray-700">
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto px-3 md:px-6 py-4 space-y-4">
              {messages.map((msg) => (
                <div key={msg.id} className={`flex gap-2 md:gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {msg.role === 'assistant' && (
                    <div className="w-7 h-7 md:w-8 md:h-8 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">V</div>
                  )}
                  <div className={`group relative max-w-[85%] md:max-w-[80%]`}>
                    <div className={`rounded-2xl px-3 py-2.5 md:px-4 md:py-3 text-sm md:text-base ${
                      msg.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-100'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({ node, inline, className, children, ...props }) {
                              const match = /language-(\w+)/.exec(className || '')
                              return !inline && match ? (
                                <div className="relative my-3">
                                  <div className="flex items-center justify-between bg-gray-900 px-3 py-1.5 rounded-t-lg border-b border-gray-700">
                                    <span className="text-xs text-gray-400 font-mono">{match[1]}</span>
                                    <button
                                      onClick={() => navigator.clipboard.writeText(String(children))}
                                      className="text-xs text-gray-400 hover:text-white flex items-center gap-1 transition-colors"
                                    >
                                      <Copy size={11} /> Copy
                                    </button>
                                  </div>
                                  <SyntaxHighlighter
                                    style={oneDark}
                                    language={match[1]}
                                    PreTag="div"
                                    customStyle={{ margin: 0, borderRadius: '0 0 8px 8px', fontSize: '13px' }}
                                    {...props}
                                  >
                                    {String(children).replace(/\n$/, '')}
                                  </SyntaxHighlighter>
                                </div>
                              ) : (
                                <code className="bg-gray-700 px-1.5 py-0.5 rounded text-xs font-mono text-blue-300" {...props}>
                                  {children}
                                </code>
                              )
                            },
                            p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
                            ul: ({ children }) => <ul className="list-disc list-outside ml-4 mb-2 space-y-1">{children}</ul>,
                            ol: ({ children }) => <ol className="list-decimal list-outside ml-4 mb-2 space-y-1">{children}</ol>,
                            li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                            h1: ({ children }) => <h1 className="text-xl font-bold mb-3 mt-4 text-white border-b border-gray-600 pb-1">{children}</h1>,
                            h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 text-white">{children}</h2>,
                            h3: ({ children }) => <h3 className="text-base font-bold mb-2 mt-2 text-blue-300">{children}</h3>,
                            blockquote: ({ children }) => <blockquote className="border-l-4 border-blue-500 pl-3 my-2 text-gray-300 italic">{children}</blockquote>,
                            table: ({ children }) => <div className="overflow-x-auto my-3"><table className="border-collapse border border-gray-600 text-sm w-full">{children}</table></div>,
                            th: ({ children }) => <th className="border border-gray-600 px-3 py-2 bg-gray-700 font-semibold text-left text-white">{children}</th>,
                            td: ({ children }) => <td className="border border-gray-600 px-3 py-2">{children}</td>,
                            a: ({ children, href }) => <a href={href} target="_blank" className="text-blue-400 underline hover:text-blue-300">{children}</a>,
                            strong: ({ children }) => <strong className="font-bold text-white">{children}</strong>,
                            hr: () => <hr className="border-gray-600 my-3" />,
                          }}
                        >
                          {msg.content || '...'}
                        </ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                      )}
                    </div>

                    {msg.role === 'assistant' && msg.content && msg.content !== '...' && (
                      <div>
                        <button onClick={() => copyToClipboard(msg.content, msg.id)}
                          className="mt-1 ml-1 flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded hover:bg-gray-800">
                          {copiedId === msg.id ? <><Check size={11} /> Copied</> : <><Copy size={11} /> Copy</>}
                        </button>
                        <FileDownloadBar content={msg.content} />
                      </div>
                    )}
                  </div>
                  {msg.role === 'user' && (
                    <div className="w-7 h-7 md:w-8 md:h-8 bg-gray-600 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0 mt-1">{initials}</div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-xs font-bold flex-shrink-0">V</div>
                  <div className="bg-gray-800 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      {[0, 150, 300].map(d => (
                        <div key={d} className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                      ))}
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input */}
        <div className="px-3 md:px-4 py-3 md:py-4 border-t border-gray-800 bg-gray-950 flex-shrink-0">
          <div className="max-w-3xl mx-auto">
            {fileName && (
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 mb-2 text-xs text-gray-300 border border-gray-700">
                <Paperclip size={12} />
                <span className="truncate flex-1">{fileName}</span>
                <button onClick={() => { setFileContext(null); setFileName(null); setImageData(null) }} className="text-gray-500 hover:text-red-400">
                  <X size={13} />
                </button>
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileUpload} className="hidden"
              accept=".txt,.csv,.docx,.pdf,.jpg,.jpeg,.png,.gif,.webp" />
            <div className="flex items-end gap-2 bg-gray-800 rounded-2xl px-3 py-2.5 md:px-4 md:py-3 border border-gray-700 focus-within:border-blue-500 transition-colors">
              <button onClick={() => fileInputRef.current?.click()}
                className="text-gray-400 hover:text-white transition-colors flex-shrink-0 p-1 rounded-lg hover:bg-gray-700">
                <Paperclip size={18} />
              </button>
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Voxora AI..."
                rows={1}
                className="flex-1 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none text-sm max-h-32 overflow-y-auto leading-relaxed"
                style={{ minHeight: '24px' }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px'
                }}
              />
              <button onClick={sendMessage} disabled={!input.trim() || loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors flex-shrink-0">
                <Send size={15} />
              </button>
            </div>
            <p className="text-center text-xs text-gray-600 mt-2 hidden md:block">Voxora AI can make mistakes. Verify important information.</p>
          </div>
        </div>
      </div>
    </div>
  )
}