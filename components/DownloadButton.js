'use client'
import { useState } from 'react'
import { Download, X } from 'lucide-react'

export default function DownloadButton({ content }) {
  const [showMenu, setShowMenu] = useState(false)

  const downloadTxt = () => {
    const blob = new Blob([content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'voxora-response.txt'
    a.click()
    URL.revokeObjectURL(url)
    setShowMenu(false)
  }

  const downloadMd = () => {
    const blob = new Blob([content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'voxora-response.md'
    a.click()
    URL.revokeObjectURL(url)
    setShowMenu(false)
  }

  const downloadPdf = async () => {
    const { jsPDF } = await import('jspdf')
    const doc = new jsPDF()
    const lines = doc.splitTextToSize(content, 180)
    doc.setFontSize(11)
    doc.text(lines, 15, 20)
    doc.save('voxora-response.pdf')
    setShowMenu(false)
  }

  const downloadDocx = async () => {
    const { Document, Packer, Paragraph, TextRun } = await import('docx')
    const paragraphs = content.split('\n').map(line =>
      new Paragraph({ children: [new TextRun(line)] })
    )
    const doc = new Document({ sections: [{ properties: {}, children: paragraphs }] })
    const blob = await Packer.toBlob(doc)
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'voxora-response.docx'
    a.click()
    URL.revokeObjectURL(url)
    setShowMenu(false)
  }

  const downloadXlsx = async () => {
    const XLSX = await import('xlsx')
    const rows = content.split('\n').map(line => [line])
    const ws = XLSX.utils.aoa_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Response')
    XLSX.writeFile(wb, 'voxora-response.xlsx')
    setShowMenu(false)
  }

  const downloadPptx = async () => {
    const pptxgen = (await import('pptxgenjs')).default
    const prs = new pptxgen()
    const lines = content.split('\n').filter(l => l.trim())
    const chunkSize = 10
    for (let i = 0; i < lines.length; i += chunkSize) {
      const slide = prs.addSlide()
      const chunk = lines.slice(i, i + chunkSize).join('\n')
      slide.addText(chunk, { x: 0.5, y: 0.5, w: 9, h: 6, fontSize: 14, color: '333333', wrap: true })
    }
    await prs.writeFile({ fileName: 'voxora-response.pptx' })
    setShowMenu(false)
  }

  return (
    <div className="relative inline-block mt-2">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors px-2 py-1 rounded-lg hover:bg-gray-700"
      >
        <Download size={12} />
        Download
      </button>

      {showMenu && (
        <div className="absolute bottom-8 left-0 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden min-w-[140px]">
          {[
            { label: '📄 TXT', action: downloadTxt },
            { label: '📝 Markdown', action: downloadMd },
            { label: '📕 PDF', action: downloadPdf },
            { label: '📘 Word (DOCX)', action: downloadDocx },
            { label: '📗 Excel (XLSX)', action: downloadXlsx },
            { label: '📊 PowerPoint', action: downloadPptx },
          ].map(({ label, action }) => (
            <button
              key={label}
              onClick={action}
              className="w-full text-left px-4 py-2 text-sm text-gray-300 hover:bg-gray-700 hover:text-white transition-colors"
            >
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}