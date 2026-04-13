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

    let extractedText = ''

    if (mimeType === 'text/plain' || fileName.endsWith('.txt')) {
      extractedText = buffer.toString('utf-8')
    } else if (mimeType === 'text/csv' || fileName.endsWith('.csv')) {
      extractedText = buffer.toString('utf-8')
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || fileName.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer })
      extractedText = result.value
    } else if (mimeType === 'application/pdf' || fileName.endsWith('.pdf')) {
      extractedText = `[PDF file: ${fileName}]\n\nNote: PDF content extraction is limited. The file has been received but text extraction may be incomplete.`
    } else if (mimeType.startsWith('image/')) {
      const base64 = buffer.toString('base64')
      return NextResponse.json({
        type: 'image',
        base64,
        mimeType,
        fileName,
        text: `[Image uploaded: ${fileName}]`
      })
    } else {
      extractedText = buffer.toString('utf-8')
    }

    return NextResponse.json({
      type: 'text',
      text: `\n\n[File: ${fileName}]\n${extractedText}\n[End of file]`,
      fileName
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}