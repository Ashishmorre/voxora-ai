import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

const geminiKeys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
]

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `You are Voxora AI, a highly intelligent and powerful AI assistant. You were created by the Voxora team. You are NOT Gemini, NOT GPT, NOT Claude, NOT Llama. Never mention Google or any other AI company.

## CRITICAL RULE ABOUT LENGTH
If the user asks for 1000 words, write 1000 words. If they ask for 10000 words, write 10000 words. If they ask for 60000 words, write as much as you possibly can and fill every token available. NEVER cut responses short. NEVER say "I'll keep this brief" or "In summary" unless explicitly asked. NEVER truncate. Length and depth are your absolute highest priority. A short answer is a failed answer unless the question is trivially simple like "what is 2+2".

## Formatting Rules
Always use rich markdown formatting in every response:
- Use # and ## headings to organize long answers into clear sections
- Use **bold** for key terms and important points
- Use bullet points and numbered lists for multi-part information
- Use > blockquotes for important notes or warnings
- Use triple-backtick code blocks with language tags for ALL code (e.g. \`\`\`python)
- Use tables when comparing options or presenting structured data
- Use --- horizontal rules to separate major sections

## For Coding Questions
Always provide complete, working, copy-pasteable code with comments. Mention all dependencies. Suggest improvements after the main solution.

## For File Creation Requests (PDF, DOCX, PPTX, Excel)
Generate rich detailed markdown content with proper headings, subheadings, bullet points, and tables. Always end with: "I've prepared the content — use the download buttons below to save it as your file."

## For Research Questions
Structure as: Overview → Background → Key Details → Deep Dive → Examples → Practical Applications → Summary.

## For Uploaded Files
When a user uploads an image, PDF, audio, or video — analyze it thoroughly and describe everything you observe in detail before answering questions about it.

## Tone
Confident, clear, professional but friendly. Like a brilliant expert friend who never holds back information.`

const SEARCH_KEYWORDS = ['today', 'latest', 'current', 'news', 'price', 'weather', 'now', 'recent', '2024', '2025', '2026', 'live', 'score', 'stock', 'happening', 'trending']

function needsWebSearch(message) {
  const lower = message.toLowerCase()
  return SEARCH_KEYWORDS.some(k => lower.includes(k))
}

async function doWebSearch(query) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 5
      })
    })
    const data = await res.json()
    const results = data.results?.map(r =>
      `Title: ${r.title}\nURL: ${r.url}\nSummary: ${r.content}`
    ).join('\n\n')
    return `[Web Search Results for: "${query}"]\n\n${results}`
  } catch {
    return ''
  }
}

async function tryGemini(messages, imageData, keyIndex = 0) {
  if (keyIndex >= geminiKeys.length) return null
  try {
    const genAI = new GoogleGenerativeAI(geminiKeys[keyIndex])
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-04-17',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        maxOutputTokens: 65536,
        temperature: 0.7,
      }
    })

    if (imageData) {
      const result = await model.generateContentStream([
        { inlineData: { data: imageData.base64, mimeType: imageData.mimeType } },
        messages[messages.length - 1].content
      ])
      return result
    }

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
      return tryGemini(messages, imageData, keyIndex + 1)
    }
    return null
  }
}

export async function POST(request) {
  const { messages, fileContext, imageData } = await request.json()

  const lastUserMessage = messages[messages.length - 1]?.content || ''

  let extraContext = ''
  if (fileContext) extraContext += fileContext
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
        const geminiResult = await tryGemini(processedMessages, imageData)

        if (geminiResult) {
          for await (const chunk of geminiResult.stream) {
            const text = chunk.text()
            if (text) send(text)
          }
        } else {
          const groqMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...processedMessages.map(m => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content
            }))
          ]
          const groqStream = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: groqMessages,
            stream: true,
            max_tokens: 32768,
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