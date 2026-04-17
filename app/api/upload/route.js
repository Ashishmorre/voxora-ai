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

    // Images — send as base64 for Gemini vision
    if (mimeType.startsWith('image/')) {
      const base64 = buffer.toString('base64')
      return NextResponse.json({
        type: 'image',
        base64,
        mimeType,
        fileName,
        text: `[Image uploaded: ${fileName}]`
      })
    }

    // PDF — send as base64 for Gemini document understanding
    if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      const base64 = buffer.toString('base64')
      return NextResponse.json({
        type: 'pdf',
        base64,
        mimeType: 'application/pdf',
        fileName,
        text: `[PDF uploaded: ${fileName}]`
      })
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