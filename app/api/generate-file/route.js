import { NextResponse } from 'next/server'

export async function POST(request) {
  const { type, content, filename } = await request.json()

  try {
    if (type === 'docx') {
      const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } = await import('docx')
      
      const lines = content.split('\n')
      const children = []

      for (const line of lines) {
        if (line.startsWith('# ')) {
          children.push(new Paragraph({
            text: line.slice(2),
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 200 }
          }))
        } else if (line.startsWith('## ')) {
          children.push(new Paragraph({
            text: line.slice(3),
            heading: HeadingLevel.HEADING_2,
            spacing: { after: 160 }
          }))
        } else if (line.startsWith('### ')) {
          children.push(new Paragraph({
            text: line.slice(4),
            heading: HeadingLevel.HEADING_3,
            spacing: { after: 120 }
          }))
        } else if (line.startsWith('- ') || line.startsWith('* ')) {
          children.push(new Paragraph({
            text: line.slice(2),
            bullet: { level: 0 },
            spacing: { after: 80 }
          }))
        } else if (line.trim() === '') {
          children.push(new Paragraph({ text: '' }))
        } else {
          // Handle **bold** inline
          const parts = line.split(/(\*\*.*?\*\*)/)
          const runs = parts.map(part => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return new TextRun({ text: part.slice(2, -2), bold: true })
            }
            return new TextRun({ text: part })
          })
          children.push(new Paragraph({ children: runs, spacing: { after: 80 } }))
        }
      }

      const doc = new Document({
        sections: [{ properties: {}, children }]
      })

      const buffer = await Packer.toBuffer(doc)
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'Content-Disposition': `attachment; filename="${filename || 'voxora-document'}.docx"`
        }
      })
    }

    if (type === 'xlsx') {
      const XLSX = await import('xlsx')
      const lines = content.split('\n').filter(l => l.trim())
      
      // Try to detect table rows (lines with | separators)
      let rows
      const tableLines = lines.filter(l => l.includes('|'))
      if (tableLines.length > 2) {
        rows = tableLines
          .filter(l => !l.match(/^\|[-| ]+\|$/)) // remove separator rows
          .map(l => l.split('|').map(c => c.trim()).filter(Boolean))
      } else {
        rows = lines.map(l => [l.replace(/^#+\s*/, '').replace(/\*\*/g, '')])
      }

      const ws = XLSX.utils.aoa_to_sheet(rows)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, 'Sheet1')
      const buffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'Content-Disposition': `attachment; filename="${filename || 'voxora-spreadsheet'}.xlsx"`
        }
      })
    }

    if (type === 'pdf') {
      const { jsPDF } = await import('jspdf')
      const doc = new jsPDF()
      const lines = content.split('\n')
      let y = 20

      for (const line of lines) {
        if (y > 270) { doc.addPage(); y = 20 }

        if (line.startsWith('# ')) {
          doc.setFontSize(18); doc.setFont(undefined, 'bold')
          doc.text(line.slice(2), 15, y); y += 10
          doc.setFont(undefined, 'normal')
        } else if (line.startsWith('## ')) {
          doc.setFontSize(14); doc.setFont(undefined, 'bold')
          doc.text(line.slice(3), 15, y); y += 8
          doc.setFont(undefined, 'normal')
        } else if (line.startsWith('### ')) {
          doc.setFontSize(12); doc.setFont(undefined, 'bold')
          doc.text(line.slice(4), 15, y); y += 7
          doc.setFont(undefined, 'normal')
        } else if (line.trim() === '') {
          y += 4
        } else {
          doc.setFontSize(11)
          const clean = line.replace(/\*\*/g, '').replace(/^[-*] /, '• ')
          const wrapped = doc.splitTextToSize(clean, 180)
          doc.text(wrapped, 15, y)
          y += wrapped.length * 6
        }
      }

      const buffer = Buffer.from(doc.output('arraybuffer'))
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'application/pdf',
          'Content-Disposition': `attachment; filename="${filename || 'voxora-document'}.pdf"`
        }
      })
    }

    if (type === 'pptx') {
      const pptxgen = (await import('pptxgenjs')).default
      const prs = new pptxgen()
      prs.layout = 'LAYOUT_16x9'

      const lines = content.split('\n').filter(l => l.trim())
      let slideTitle = ''
      let slideContent = []

      const flushSlide = () => {
        if (!slideTitle && slideContent.length === 0) return
        const slide = prs.addSlide()
        slide.background = { color: '0F172A' }
        if (slideTitle) {
          slide.addText(slideTitle, {
            x: 0.5, y: 0.3, w: 9, h: 1,
            fontSize: 28, bold: true, color: '3B82F6', fontFace: 'Arial'
          })
        }
        if (slideContent.length > 0) {
          slide.addText(slideContent.join('\n'), {
            x: 0.5, y: 1.5, w: 9, h: 5,
            fontSize: 16, color: 'E5E7EB', fontFace: 'Arial',
            valign: 'top', wrap: true, lineSpacingMultiple: 1.4
          })
        }
        slideTitle = ''
        slideContent = []
      }

      for (const line of lines) {
        if (line.startsWith('# ')) {
          flushSlide()
          slideTitle = line.slice(2)
        } else if (line.startsWith('## ')) {
          flushSlide()
          slideTitle = line.slice(3)
        } else {
          const clean = line.replace(/\*\*/g, '').replace(/^[-*] /, '• ')
          slideContent.push(clean)
        }
      }
      flushSlide()

      const buffer = await prs.write({ outputType: 'arraybuffer' })
      return new NextResponse(Buffer.from(buffer), {
        headers: {
          'Content-Type': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'Content-Disposition': `attachment; filename="${filename || 'voxora-presentation'}.pptx"`
        }
      })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (err) {
    console.error(err)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}