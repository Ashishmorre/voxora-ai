import { NextResponse } from 'next/server'
import mammoth from 'mammoth'

export async function POST(request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const mimeType = file.type
    const fileName = file.name

    // Images — send as base64 for Gemini vision (keep small, under 3MB)
    if (mimeType.startsWith('image/')) {
      const sizeInMB = buffer.length / (1024 * 1024)
      if (sizeInMB > 3) {
        return NextResponse.json({
          type: 'text',
          text: `[Image uploaded: ${fileName} - Note: image was too large to analyze directly]`,
          fileName
        })
      }
      const base64 = buffer.toString('base64')
      return NextResponse.json({
        type: 'image',
        base64,
        mimeType,
        fileName,
        text: `[Image uploaded: ${fileName}]`
      })
    }

    // PDF — extract text instead of sending raw base64 (avoids 413 error)
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      try {
        const pdfParse = (await import('pdf-parse')).default
        const pdfData = await pdfParse(buffer)
        const extractedText = pdfData.text || ''
        const truncated = extractedText.slice(0, 50000) // max ~50k chars
        return NextResponse.json({
          type: 'text',
          text: `\n\n[PDF Document: ${fileName}]\n\n${truncated}\n\n[End of PDF]`,
          fileName
        })
      } catch {
        return NextResponse.json({
          type: 'text',
          text: `\n\n[PDF uploaded: ${fileName} — could not extract text from this PDF]\n\n`,
          fileName
        })
      }
    }

    // Plain text
    if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
      return NextResponse.json({
        type: 'text',
        text: `\n\n[File: ${fileName}]\n${buffer.toString('utf-8')}\n[End of file]`,
        fileName
      })
    }

    // CSV
    if (mimeType === 'text/csv' || fileName.endsWith('.csv')) {
      return NextResponse.json({
        type: 'text',
        text: `\n\n[CSV File: ${fileName}]\n${buffer.toString('utf-8')}\n[End of file]`,
        fileName
      })
    }

    // Word documents
    if (
      mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      fileName.endsWith('.docx')
    ) {
      const result = await mammoth.extractRawText({ buffer })
      return NextResponse.json({
        type: 'text',
        text: `\n\n[Word Document: ${fileName}]\n${result.value}\n[End of file]`,
        fileName
      })
    }

    // Fallback
    return NextResponse.json({
      type: 'text',
      text: `\n\n[File: ${fileName}]\n${buffer.toString('utf-8')}\n[End of file]`,
      fileName
    })

  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}