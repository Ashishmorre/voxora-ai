'use client'
import { useEffect, useState, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { PlusCircle, Send, LogOut, MessageSquare, Trash2, Menu, X, Paperclip } from 'lucide-react'
import DownloadButton from '@/components/DownloadButton'

export default function Chat() {
  const [user, setUser] = useState(null)
  const [conversations, setConversations] = useState([])
  const [currentConversation, setCurrentConversation] = useState(null)
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [fileContext, setFileContext] = useState(null)
  const [fileName, setFileName] = useState(null)
  const messagesEndRef = useRef(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        window.location.href = '/login'
      } else {
        setUser(user)
        loadConversations(user.id)
      }
    }
    getUser()
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const loadConversations = async (userId) => {
    const { data } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false })
    if (data) setConversations(data)
  }

  const loadMessages = async (conversationId) => {
    const { data } = await supabase
      .from('messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
    if (data) setMessages(data)
  }

  const createNewConversation = async () => {
    if (!user) return
    const { data } = await supabase
      .from('conversations')
      .insert({ user_id: user.id, title: 'New Chat' })
      .select()
      .single()
    if (data) {
      setConversations([data, ...conversations])
      setCurrentConversation(data)
      setMessages([])
    }
  }

  const selectConversation = async (conv) => {
    setCurrentConversation(conv)
    await loadMessages(conv.id)
  }

  const deleteConversation = async (e, convId) => {
    e.stopPropagation()
    await supabase.from('conversations').delete().eq('id', convId)
    setConversations(conversations.filter(c => c.id !== convId))
    if (currentConversation?.id === convId) {
      setCurrentConversation(null)
      setMessages([])
    }
  }

  const handleFileUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    const formData = new FormData()
    formData.append('file', file)
    try {
      const res = await fetch('/api/upload', { method: 'POST', body: formData })
      const data = await res.json()
      setFileContext(data.text)
      setFileName(data.fileName)
    } catch (err) {
      console.error('File upload error:', err)
    }
  }

  const sendMessage = async () => {
    if (!input.trim() || loading) return

    let conv = currentConversation
    if (!conv) {
      const { data } = await supabase
        .from('conversations')
        .insert({ user_id: user.id, title: input.slice(0, 50) })
        .select()
        .single()
      conv = data
      setCurrentConversation(data)
      setConversations(prev => [data, ...prev])
    }

    const userMessage = {
      role: 'user',
      content: input,
      conversation_id: conv.id,
      user_id: user.id
    }

    setMessages(prev => [...prev, { ...userMessage, id: Date.now() }])
    setInput('')
    setLoading(true)
    setFileContext(null)
    setFileName(null)

    await supabase.from('messages').insert(userMessage)

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...messages, userMessage].map(m => ({
            role: m.role,
            content: m.content
          })),
          conversationId: conv.id,
          fileContext: fileContext
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
        const lines = chunk.split('\n')
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') break
            try {
              const parsed = JSON.parse(data)
              assistantMessage += parsed.text || ''
              setMessages(prev => prev.map(m =>
                m.id === assistantMsgId ? { ...m, content: assistantMessage } : m
              ))
            } catch {}
          }
        }
      }

      await supabase.from('messages').insert({
        role: 'assistant',
        content: assistantMessage,
        conversation_id: conv.id,
        user_id: user.id
      })

      await supabase.from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', conv.id)

      loadConversations(user.id)
    } catch (err) {
      console.error(err)
      setMessages(prev => [...prev, {
        id: Date.now(),
        role: 'assistant',
        content: 'Sorry, something went wrong. Please try again.'
      }])
    }

    setLoading(false)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  return (
    <div className="flex h-screen bg-gray-950 text-white overflow-hidden">

      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} transition-all duration-300 bg-gray-900 border-r border-gray-800 flex flex-col overflow-hidden flex-shrink-0`}>
        <div className="p-4 flex flex-col h-full">

          <div className="flex items-center gap-2 mb-6">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold text-sm">V</div>
            <span className="font-semibold text-white">Voxora AI</span>
          </div>

          <button
            onClick={createNewConversation}
            className="flex items-center gap-2 w-full bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors mb-4"
          >
            <PlusCircle size={16} />
            New Chat
          </button>

          <div className="text-xs text-gray-500 mb-3 px-1">Model: Gemini 2.5 Flash</div>

          <div className="flex-1 overflow-y-auto space-y-1">
            {conversations.map(conv => (
              <div
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className={`group flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                  currentConversation?.id === conv.id
                    ? 'bg-gray-700 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <div className="flex items-center gap-2 overflow-hidden">
                  <MessageSquare size={14} className="flex-shrink-0" />
                  <span className="truncate">{conv.title}</span>
                </div>
                <button
                  onClick={(e) => deleteConversation(e, conv.id)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-opacity flex-shrink-0"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <div className="border-t border-gray-800 pt-4 mt-4">
            <div className="text-xs text-gray-500 truncate mb-2 px-1">{user?.email}</div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-400 hover:text-white text-sm px-3 py-2 rounded-lg hover:bg-gray-800 transition-colors w-full"
            >
              <LogOut size={16} />
              Sign out
            </button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">

        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-800 bg-gray-950">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-gray-400 hover:text-white transition-colors"
          >
            {sidebarOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <h1 className="font-semibold text-white">
            {currentConversation?.title || 'Voxora AI'}
          </h1>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-2xl font-bold mb-4">V</div>
              <h2 className="text-2xl font-bold text-white mb-2">How can I help you today?</h2>
              <p className="text-gray-400">Ask me anything — I'm powered by Gemini 2.5 Flash</p>
            </div>
          ) : (
            <div className="max-w-3xl mx-auto space-y-6">
              {messages.map((msg) => (
                <div key={msg.id}>
                  <div className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">V</div>
                    )}
                    <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-100'
                    }`}>
                      {msg.role === 'assistant' ? (
                        <ReactMarkdown
                          remarkPlugins={[remarkGfm]}
                          components={{
                            code({node, inline, className, children, ...props}) {
                              return inline ? (
                                <code className="bg-gray-700 px-1 py-0.5 rounded text-sm font-mono" {...props}>{children}</code>
                              ) : (
                                <pre className="bg-gray-900 rounded-lg p-4 overflow-x-auto my-2">
                                  <code className="text-sm font-mono text-green-400" {...props}>{children}</code>
                                </pre>
                              )
                            },
                            p: ({children}) => <p className="mb-2 last:mb-0">{children}</p>,
                            ul: ({children}) => <ul className="list-disc list-inside mb-2 space-y-1">{children}</ul>,
                            ol: ({children}) => <ol className="list-decimal list-inside mb-2 space-y-1">{children}</ol>,
                            h1: ({children}) => <h1 className="text-xl font-bold mb-2">{children}</h1>,
                            h2: ({children}) => <h2 className="text-lg font-bold mb-2">{children}</h2>,
                            h3: ({children}) => <h3 className="text-base font-bold mb-1">{children}</h3>,
                            table: ({children}) => <div className="overflow-x-auto my-2"><table className="border-collapse border border-gray-600 text-sm">{children}</table></div>,
                            th: ({children}) => <th className="border border-gray-600 px-3 py-1 bg-gray-700 font-semibold">{children}</th>,
                            td: ({children}) => <td className="border border-gray-600 px-3 py-1">{children}</td>,
                          }}
                        >
                          {msg.content || '...'}
                        </ReactMarkdown>
                      ) : (
                        <p className="whitespace-pre-wrap">{msg.content}</p>
                      )}
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0 mt-1">
                        {user?.email?.[0]?.toUpperCase()}
                      </div>
                    )}
                  </div>
                  {msg.role === 'assistant' && msg.content && msg.content !== '...' && (
                    <div className="ml-12 mt-1">
                      <DownloadButton content={msg.content} />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-4">
                  <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0">V</div>
                  <div className="bg-gray-800 rounded-2xl px-4 py-3">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                      <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        <div className="px-4 py-4 border-t border-gray-800 bg-gray-950">
          <div className="max-w-3xl mx-auto">
            {fileName && (
              <div className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-2 mb-2 text-sm text-gray-300 border border-gray-700">
                <Paperclip size={14} />
                <span className="truncate">{fileName}</span>
                <button
                  onClick={() => { setFileContext(null); setFileName(null) }}
                  className="text-gray-500 hover:text-red-400 ml-auto"
                >
                  <X size={14} />
                </button>
              </div>
            )}
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileUpload}
              className="hidden"
              accept=".txt,.csv,.docx,.pdf,.jpg,.jpeg,.png"
            />
            <div className="flex items-end gap-3 bg-gray-800 rounded-2xl px-4 py-3 border border-gray-700 focus-within:border-blue-500 transition-colors">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
              >
                <Paperclip size={18} />
              </button>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Voxora AI..."
                rows={1}
                className="flex-1 bg-transparent text-white placeholder-gray-500 resize-none focus:outline-none text-sm max-h-40 overflow-y-auto"
                style={{ minHeight: '24px' }}
                onInput={(e) => {
                  e.target.style.height = 'auto'
                  e.target.style.height = Math.min(e.target.scrollHeight, 160) + 'px'
                }}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white p-2 rounded-xl transition-colors flex-shrink-0"
              >
                <Send size={16} />
              </button>
            </div>
            <p className="text-center text-xs text-gray-600 mt-2">Voxora AI can make mistakes. Verify important information.</p>
          </div>
        </div>

      </div>
    </div>
  )
}