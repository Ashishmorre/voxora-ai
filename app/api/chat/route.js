import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

const geminiKeys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
]

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SEARCH_KEYWORDS = ['today', 'latest', 'current', 'news', 'price', 'weather', 'now', 'recent', '2024', '2025', '2026', 'live', 'score', 'stock']

function needsWebSearch(message) {
  const lower = message.toLowerCase()
  return SEARCH_KEYWORDS.some(k => lower.includes(k))
}

async function doWebSearch(query) {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL ? 'http://localhost:3000' : 'http://localhost:3000'}/api/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    })
    const data = await res.json()
    return data.results || ''
  } catch {
    return ''
  }
}

async function tryGemini(messages, keyIndex = 0) {
  if (keyIndex >= geminiKeys.length) return null
  try {
    const genAI = new GoogleGenerativeAI(geminiKeys[keyIndex])
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-preview-04-17' })

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

    const chat = model.startChat({ history })
    const lastMessage = messages[messages.length - 1].content
    const result = await chat.sendMessageStream(lastMessage)
    return result
  } catch (err) {
    if (err.status === 429 || err.status === 503) {
      return tryGemini(messages, keyIndex + 1)
    }
    return null
  }
}

export async function POST(request) {
  const { messages, fileContext } = await request.json()

  const lastUserMessage = messages[messages.length - 1]?.content || ''

  let extraContext = ''

  if (fileContext) {
    extraContext += fileContext
  }

  if (needsWebSearch(lastUserMessage)) {
    const searchResults = await doWebSearch(lastUserMessage)
    if (searchResults) extraContext += '\n\n' + searchResults
  }

  const processedMessages = extraContext
    ? messages.map((m, i) =>
        i === messages.length - 1
          ? { ...m, content: m.content + '\n\n' + extraContext }
          : m
      )
    : messages

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const send = (text) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text })}\n\n`))
      }

      try {
        const geminiResult = await tryGemini(processedMessages)

        if (geminiResult) {
          for await (const chunk of geminiResult.stream) {
            const text = chunk.text()
            if (text) send(text)
          }
        } else {
          const groqMessages = processedMessages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          }))
          const groqStream = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: groqMessages,
            stream: true,
          })
          for await (const chunk of groqStream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) send(text)
          }
        }
      } catch (err) {
        send('Sorry, I encountered an error. Please try again.')
      }

      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}