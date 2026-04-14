'use client'
import { useState } from 'react'
import { FileText, Sheet, Presentation, File, Loader2 } from 'lucide-react'

export default function FileDownloadBar({ content }) {
  const [loading, setLoading] = useState(null)

  const generate = async (type, icon, ext) => {
    setLoading(type)
    try {
      const res = await fetch('/api/generate-file', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, content, filename: 'voxora-file' })
      })
      if (!res.ok) throw new Error('Failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `voxora-file.${ext}`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      alert('Error generating file. Try again.')
    }
    setLoading(null)
  }

  const buttons = [
    { type: 'docx', label: 'DOCX', ext: 'docx' },
    { type: 'pdf',  label: 'PDF',  ext: 'pdf'  },
    { type: 'xlsx', label: 'XLSX', ext: 'xlsx' },
    { type: 'pptx', label: 'PPTX', ext: 'pptx' },
  ]

  return (
    <div className="flex flex-wrap gap-1.5 mt-2 ml-1">
      {buttons.map(({ type, label, ext }) => (
        <button
          key={type}
          onClick={() => generate(type, null, ext)}
          disabled={!!loading}
          className="flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white transition-colors disabled:opacity-50"
        >
          {loading === type ? <Loader2 size={11} className="animate-spin" /> : null}
          ↓ {label}
        </button>
      ))}
    </div>
  )
}