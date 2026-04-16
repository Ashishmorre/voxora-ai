'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { createClient } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

// ─── Icons ───────────────────────────────────────────────────────────────────
const SendIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
  </svg>
)
const CopyIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
  </svg>
)
const CheckIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12"/>
  </svg>
)
const AttachIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
  </svg>
)
const StopIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <rect x="4" y="4" width="16" height="16" rx="2"/>
  </svg>
)
const BotIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/>
  </svg>
)
const UserIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
  </svg>
)
const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>
  </svg>
)
const XIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
  </svg>
)
const DownloadIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>
  </svg>
)
const LogoutIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
  </svg>
)

// ─── Copy Button ──────────────────────────────────────────────────────────────
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <button onClick={copy} style={{
      display: 'flex', alignItems: 'center', gap: '4px',
      padding: '3px 8px', borderRadius: '6px', border: 'none',
      background: copied ? '#22c55e22' : '#ffffff15',
      color: copied ? '#22c55e' : '#9ca3af',
      cursor: 'pointer', fontSize: '11px', fontFamily: 'inherit',
      transition: 'all 0.15s'
    }}>
      {copied ? <CheckIcon /> : <CopyIcon />}
      {copied ? 'Copied!' : 'Copy'}
    </button>
  )
}

// ─── Markdown Renderer ────────────────────────────────────────────────────────
function MarkdownContent({ content }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ node, inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '')
          const codeText = String(children).replace(/\n$/, '')
          if (!inline && match) {
            return (
              <div style={{ margin: '16px 0', borderRadius: '10px', overflow: 'hidden', border: '1px solid #374151' }}>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 14px', background: '#1a1f2e', borderBottom: '1px solid #374151'
                }}>
                  <span style={{ fontSize: '12px', color: '#6b7280', fontFamily: 'monospace' }}>{match[1]}</span>
                  <CopyButton text={codeText} />
                </div>
                <SyntaxHighlighter
                  style={oneDark}
                  language={match[1]}
                  PreTag="div"
                  customStyle={{ margin: 0, borderRadius: 0, fontSize: '13px', lineHeight: '1.6' }}
                  {...props}
                >
                  {codeText}
                </SyntaxHighlighter>
              </div>
            )
          }
          return (
            <code style={{
              background: '#1e2433', color: '#e2e8f0', padding: '2px 6px',
              borderRadius: '4px', fontSize: '13px', fontFamily: 'monospace'
            }} {...props}>
              {children}
            </code>
          )
        },
        h1: ({ children }) => <h1 style={{ fontSize: '22px', fontWeight: '700', margin: '24px 0 12px', color: '#f1f5f9', borderBottom: '1px solid #1e293b', paddingBottom: '8px' }}>{children}</h1>,
        h2: ({ children }) => <h2 style={{ fontSize: '18px', fontWeight: '600', margin: '20px 0 10px', color: '#e2e8f0' }}>{children}</h2>,
        h3: ({ children }) => <h3 style={{ fontSize: '16px', fontWeight: '600', margin: '16px 0 8px', color: '#cbd5e1' }}>{children}</h3>,
        p: ({ children }) => <p style={{ margin: '8px 0', lineHeight: '1.75', color: '#cbd5e1' }}>{children}</p>,
        ul: ({ children }) => <ul style={{ margin: '8px 0', paddingLeft: '20px', color: '#cbd5e1' }}>{children}</ul>,
        ol: ({ children }) => <ol style={{ margin: '8px 0', paddingLeft: '20px', color: '#cbd5e1' }}>{children}</ol>,
        li: ({ children }) => <li style={{ margin: '4px 0', lineHeight: '1.7' }}>{children}</li>,
        blockquote: ({ children }) => (
          <blockquote style={{
            margin: '12px 0', padding: '10px 16px',
            borderLeft: '3px solid #6366f1', background: '#1e1b4b22',
            borderRadius: '0 8px 8px 0', color: '#a5b4fc'
          }}>{children}</blockquote>
        ),
        table: ({ children }) => (
          <div style={{ overflowX: 'auto', margin: '12px 0' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: '14px' }}>{children}</table>
          </div>
        ),
        th: ({ children }) => <th style={{ padding: '8px 14px', background: '#1e293b', color: '#94a3b8', fontWeight: '600', textAlign: 'left', border: '1px solid #334155' }}>{children}</th>,
        td: ({ children }) => <td style={{ padding: '8px 14px', color: '#cbd5e1', border: '1px solid #1e293b' }}>{children}</td>,
        strong: ({ children }) => <strong style={{ color: '#f1f5f9', fontWeight: '600' }}>{children}</strong>,
        a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer" style={{ color: '#818cf8', textDecoration: 'underline' }}>{children}</a>,
        hr: () => <hr style={{ margin: '20px 0', border: 'none', borderTop: '1px solid #1e293b' }} />,
      }}
    >
      {content}
    </ReactMarkdown>
  )
}

// ─── File Generate Bar ────────────────────────────────────────────────────────
function GenerateFileBar({ content, onGenerate }) {
  const fileTypes = [
    { type: 'pdf', label: 'PDF' },
    { type: 'docx', label: 'Word' },
    { type: 'pptx', label: 'PowerPoint' },
    { type: 'xlsx', label: 'Excel' },
    { type: 'html', label: 'HTML' },
  ]
  const [loading, setLoading] = useState(null)

  const generate = async (type) => {
    setLoading(type)
    try {
      const res = await fetch('/api/generate-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type })
      })
      if (res.ok) {
        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `voxora-export.${type}`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (e) {
      console.error(e)
    }
    setLoading(null)
  }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap',
      padding: '10px 14px', background: '#0f172a', borderRadius: '10px',
      border: '1px solid #1e293b', marginTop: '8px'
    }}>
      <span style={{ fontSize: '12px', color: '#64748b', marginRight: '4px' }}>Export as:</span>
      {fileTypes.map(({ type, label }) => (
        <button key={type} onClick={() => generate(type)} disabled={!!loading} style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '4px 12px', borderRadius: '6px', border: '1px solid #334155',
          background: loading === type ? '#6366f1' : '#1e293b',
          color: loading === type ? '#fff' : '#94a3b8',
          cursor: loading ? 'not-allowed' : 'pointer', fontSize: '12px',
          fontFamily: 'inherit', transition: 'all 0.15s'
        }}>
          <DownloadIcon />
          {loading === type ? 'Generating...' : label}
        </button>
      ))}
    </div>
  )
}

// ─── Main Chat Page ───────────────────────────────────────────────────────────
export default function ChatPage() {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [attachedFiles, setAttachedFiles] = useState([])
  const [user, setUser] = useState(null)
  const [showExportFor, setShowExportFor] = useState(null)

  const messagesEndRef = useRef(null)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const abortRef = useRef(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) router.push('/login')
      else setUser(data.user)
    })
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px'
    }
  }, [input])

  const handleFileAttach = async (e) => {
    const files = Array.from(e.target.files)
    const newFiles = []
    for (const file of files) {
      const reader = new FileReader()
      const data = await new Promise((resolve) => {
        reader.onload = (ev) => resolve(ev.target.result)
        reader.readAsDataURL(file)
      })
      newFiles.push({ name: file.name, type: file.type, size: file.size, data })
    }
    setAttachedFiles(prev => [...prev, ...newFiles])
    fileInputRef.current.value = ''
  }

  const removeFile = (i) => setAttachedFiles(prev => prev.filter((_, idx) => idx !== i))

  const handleSubmit = async () => {
    const text = input.trim()
    if (!text && attachedFiles.length === 0) return
    if (isLoading) {
      abortRef.current?.abort()
      return
    }

    const userMessage = { role: 'user', content: text || '(See attached file)', files: attachedFiles }
    const newMessages = [...messages, userMessage]
    setMessages(newMessages)
    setInput('')
    setAttachedFiles([])
    setIsLoading(true)
    setShowExportFor(null)

    // Build file context for text files / PDFs
    let fileContext = ''
    let fileParts = []

    for (const file of attachedFiles) {
      if (file.type === 'application/pdf' || file.type.startsWith('text/')) {
        // Send as Gemini inline data
        const base64 = file.data.split(',')[1]
        fileParts.push({ inlineData: { mimeType: file.type, data: base64 } })
      } else if (file.type.startsWith('image/') || file.type.startsWith('video/') || file.type.startsWith('audio/')) {
        const base64 = file.data.split(',')[1]
        fileParts.push({ inlineData: { mimeType: file.type, data: base64 } })
      }
    }

    const controller = new AbortController()
    abortRef.current = controller

    const assistantMessage = { role: 'assistant', content: '' }
    setMessages(prev => [...prev, assistantMessage])

    try {
      const apiMessages = newMessages.map(m => ({ role: m.role, content: m.content }))

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: apiMessages,
          fileContext: fileContext || undefined,
          fileParts: fileParts.length > 0 ? fileParts : undefined,
        }),
        signal: controller.signal
      })

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let fullText = ''

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
              const { text } = JSON.parse(data)
              if (text) {
                fullText += text
                setMessages(prev => {
                  const updated = [...prev]
                  updated[updated.length - 1] = { role: 'assistant', content: fullText }
                  return updated
                })
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        setMessages(prev => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }
          return updated
        })
      }
    }

    setIsLoading(false)
    abortRef.current = null
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit()
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1048576).toFixed(1) + ' MB'
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', height: '100vh',
      background: '#0a0f1e', color: '#e2e8f0', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    }}>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: '60px',
        background: '#080d1a', borderBottom: '1px solid #1a2332',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '8px',
            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <BotIcon />
          </div>
          <span style={{ fontWeight: '700', fontSize: '18px', color: '#f1f5f9', letterSpacing: '-0.3px' }}>Voxora AI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {user && <span style={{ fontSize: '13px', color: '#64748b' }}>{user.email}</span>}
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            padding: '6px 12px', borderRadius: '8px', border: '1px solid #1e293b',
            background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit'
          }}>
            <LogoutIcon /> Sign out
          </button>
        </div>
      </div>

      {/* Messages */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 0' }}>
        {messages.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            height: '100%', gap: '16px', padding: '40px 20px', textAlign: 'center'
          }}>
            <div style={{
              width: '64px', height: '64px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: '8px'
            }}>
              <BotIcon />
            </div>
            <h2 style={{ fontSize: '24px', fontWeight: '700', color: '#f1f5f9', margin: 0 }}>How can I help you today?</h2>
            <p style={{ color: '#64748b', fontSize: '15px', margin: 0, maxWidth: '400px', lineHeight: '1.6' }}>
              Ask me anything — I can answer questions, write code, analyze files, search the web, and generate documents.
            </p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
              {['Explain quantum computing', 'Write a Python script', 'Create a business plan PDF', 'Analyze uploaded file'].map(s => (
                <button key={s} onClick={() => setInput(s)} style={{
                  padding: '8px 16px', borderRadius: '20px', border: '1px solid #1e293b',
                  background: '#111827', color: '#94a3b8', cursor: 'pointer', fontSize: '13px', fontFamily: 'inherit'
                }}>{s}</button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} style={{
            maxWidth: '800px', margin: '0 auto', padding: '4px 24px'
          }}>
            <div style={{
              display: 'flex', gap: '14px', alignItems: 'flex-start',
              padding: '16px 0',
              borderBottom: i < messages.length - 1 ? '1px solid #0f172a' : 'none'
            }}>
              {/* Avatar */}
              <div style={{
                width: '34px', height: '34px', borderRadius: '8px', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: msg.role === 'user'
                  ? '#1e293b'
                  : 'linear-gradient(135deg, #6366f1, #8b5cf6)'
              }}>
                {msg.role === 'user' ? <UserIcon /> : <BotIcon />}
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: '600', color: msg.role === 'user' ? '#94a3b8' : '#818cf8', marginBottom: '8px' }}>
                  {msg.role === 'user' ? 'You' : 'Voxora AI'}
                </div>

                {/* Attached files preview */}
                {msg.files && msg.files.length > 0 && (
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {msg.files.map((f, fi) => (
                      <div key={fi} style={{
                        display: 'flex', alignItems: 'center', gap: '6px',
                        padding: '6px 10px', background: '#1e293b', borderRadius: '8px',
                        border: '1px solid #334155'
                      }}>
                        {f.type.startsWith('image/') ? (
                          <img src={f.data} alt={f.name} style={{ height: '40px', borderRadius: '4px', maxWidth: '80px', objectFit: 'cover' }} />
                        ) : <FileIcon />}
                        <div>
                          <div style={{ fontSize: '12px', color: '#e2e8f0', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>{formatFileSize(f.size)}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Message content */}
                {msg.role === 'user' ? (
                  <div style={{ fontSize: '15px', color: '#e2e8f0', lineHeight: '1.7', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                ) : (
                  <div style={{ fontSize: '15px' }}>
                    {msg.content ? (
                      <>
                        <MarkdownContent content={msg.content} />
                        {/* Actions row */}
                        {!isLoading && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
                            <button onClick={() => navigator.clipboard.writeText(msg.content)} style={{
                              display: 'flex', alignItems: 'center', gap: '5px',
                              padding: '4px 10px', borderRadius: '6px', border: '1px solid #1e293b',
                              background: 'transparent', color: '#64748b', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit'
                            }}>
                              <CopyIcon /> Copy response
                            </button>
                            <button onClick={() => setShowExportFor(showExportFor === i ? null : i)} style={{
                              display: 'flex', alignItems: 'center', gap: '5px',
                              padding: '4px 10px', borderRadius: '6px', border: '1px solid #1e293b',
                              background: showExportFor === i ? '#1e293b' : 'transparent',
                              color: '#64748b', cursor: 'pointer', fontSize: '12px', fontFamily: 'inherit'
                            }}>
                              <DownloadIcon /> Export as file
                            </button>
                          </div>
                        )}
                        {showExportFor === i && <GenerateFileBar content={msg.content} />}
                      </>
                    ) : (
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '4px 0' }}>
                        {[0, 1, 2].map(j => (
                          <div key={j} style={{
                            width: '7px', height: '7px', borderRadius: '50%', background: '#6366f1',
                            animation: 'pulse 1.2s ease-in-out infinite',
                            animationDelay: `${j * 0.2}s`
                          }} />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div style={{
        padding: '16px 24px 24px', background: '#080d1a',
        borderTop: '1px solid #1a2332', flexShrink: 0
      }}>
        <div style={{ maxWidth: '800px', margin: '0 auto' }}>

          {/* Attached files preview */}
          {attachedFiles.length > 0 && (
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '10px' }}>
              {attachedFiles.map((f, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '5px 10px', background: '#1e293b', borderRadius: '8px',
                  border: '1px solid #334155'
                }}>
                  {f.type.startsWith('image/') ? (
                    <img src={f.data} alt={f.name} style={{ height: '28px', borderRadius: '3px', maxWidth: '50px', objectFit: 'cover' }} />
                  ) : <FileIcon />}
                  <span style={{ fontSize: '12px', color: '#94a3b8', maxWidth: '120px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                  <button onClick={() => removeFile(i)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '0 2px', display: 'flex' }}>
                    <XIcon />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input box */}
          <div style={{
            display: 'flex', alignItems: 'flex-end', gap: '10px',
            background: '#111827', borderRadius: '14px',
            border: '1px solid #1e293b', padding: '12px 14px',
            transition: 'border-color 0.15s'
          }}>
            {/* Attach button */}
            <button onClick={() => fileInputRef.current?.click()} style={{
              background: 'none', border: 'none', color: '#64748b', cursor: 'pointer',
              padding: '4px', borderRadius: '6px', display: 'flex', alignItems: 'center',
              flexShrink: 0, marginBottom: '2px'
            }} title="Attach file">
              <AttachIcon />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,audio/*,.pdf,.txt,.csv,.json,.md,.docx,.xlsx"
              onChange={handleFileAttach}
              style={{ display: 'none' }}
            />

            {/* Textarea */}
            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask anything... (Shift+Enter for new line)"
              rows={1}
              style={{
                flex: 1, background: 'none', border: 'none', outline: 'none',
                color: '#e2e8f0', fontSize: '15px', lineHeight: '1.6',
                fontFamily: 'inherit', resize: 'none', maxHeight: '200px',
                overflowY: 'auto', padding: '0'
              }}
            />

            {/* Send/Stop button */}
            <button
              onClick={handleSubmit}
              disabled={!input.trim() && attachedFiles.length === 0 && !isLoading}
              style={{
                width: '36px', height: '36px', borderRadius: '10px', border: 'none',
                background: isLoading ? '#7c3aed' : (input.trim() || attachedFiles.length > 0) ? '#6366f1' : '#1e293b',
                color: '#fff', cursor: (input.trim() || attachedFiles.length > 0 || isLoading) ? 'pointer' : 'default',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0, transition: 'all 0.15s'
              }}
            >
              {isLoading ? <StopIcon /> : <SendIcon />}
            </button>
          </div>

          <div style={{ textAlign: 'center', marginTop: '10px', fontSize: '11px', color: '#334155' }}>
            Voxora AI · Powered by Gemini 2.5 Flash · Attach PDFs, images, audio & video
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.3; transform: scale(0.8); }
          50% { opacity: 1; transform: scale(1.2); }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 3px; }
      `}</style>
    </div>
  )
}
