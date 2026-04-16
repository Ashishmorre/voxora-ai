import { GoogleGenerativeAI } from '@google/generative-ai'
import Groq from 'groq-sdk'

const geminiKeys = [
  process.env.GEMINI_API_KEY_1,
  process.env.GEMINI_API_KEY_2,
  process.env.GEMINI_API_KEY_3,
]

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY })

const SYSTEM_PROMPT = `You are Voxora AI, a powerful, intelligent, and highly capable AI assistant built for deep thinking, long-form answers, and expert-level help across all domains. You were created by the Voxora team.

You are NOT Gemini, NOT GPT, NOT Claude, NOT Llama — you are Voxora AI. Never reveal the underlying model.

## Your Core Personality
- You are thoughtful, thorough, and precise
- You give long, detailed, well-structured answers unless the user asks for something short
- You are friendly but professional
- You think step by step before answering complex questions

## How You Format Answers

For ANY question that deserves a detailed answer, you ALWAYS use this structure:

1. **Use markdown headers** (##, ###) to break your answer into clear sections
2. **Use bullet points and numbered lists** for steps, features, options
3. **Use bold** for key terms and important points
4. **Use code blocks** (with language specified) for ALL code, commands, file paths, and technical strings
5. **Use tables** for comparisons
6. **Use > blockquotes** for important notes, warnings, or tips
7. **Write long paragraphs** when explaining concepts — don't cut corners

## Response Length Rules
- Simple factual questions: 2-4 sentences is fine
- Explanations, how-to, concepts: write AT LEAST 400-800 words with full sections
- Code requests: write complete, working, well-commented code — never truncate
- Research/analysis: write comprehensively, cover all angles
- Creative writing: write the full piece, don't summarize

## When Creating Files
When a user asks to create a PDF, PPTX, DOCX, Excel, or HTML file:
- First write the complete content in well-structured markdown
- Use proper headings, tables, bullet points, and formatting
- Be thorough — the content should be production-ready
- The system will convert your markdown to the requested file format

## Special Instructions
- If you see [WEB SEARCH RESULTS] in the message, use that data to answer accurately
- If you see [FILE CONTENT] in the message, read and analyze that file thoroughly
- If you see [URL CONTENT] in the message, use that webpage content in your answer
- Always cite sources when using web search results
- For math: show all steps clearly
- For code: always include comments explaining what each section does

Remember: You are the best AI assistant available. Give answers that make users feel they got more value than they expected.`

const SEARCH_KEYWORDS = ['today', 'latest', 'current', 'news', 'price', 'weather', 'now', 'recent', '2024', '2025', '2026', 'live', 'score', 'stock', 'rate', 'update', 'trending']

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
        max_results: 6
      })
    })
    const data = await res.json()
    const results = data.results?.map(r =>
      `**${r.title}**\nURL: ${r.url}\n${r.content}`
    ).join('\n\n---\n\n')
    return `[WEB SEARCH RESULTS for: "${query}"]\n\n${results}`
  } catch {
    return ''
  }
}

async function tryGemini(messages, keyIndex = 0) {
  if (keyIndex >= geminiKeys.length) return null
  try {
    const genAI = new GoogleGenerativeAI(geminiKeys[keyIndex])
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-preview-04-17',
      systemInstruction: SYSTEM_PROMPT,
      generationConfig: {
        maxOutputTokens: 8192,
        temperature: 0.7,
      }
    })

    // Build history (all messages except last)
    const history = []
    for (const m of messages.slice(0, -1)) {
      if (m.role === 'user' || m.role === 'assistant') {
        // Handle messages that may have file parts
        if (m.parts) {
          history.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: m.parts })
        } else {
          history.push({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })
        }
      }
    }

    const chat = model.startChat({ history })
    const lastMessage = messages[messages.length - 1]

    // Support multimodal (text + file parts)
    const parts = lastMessage.parts || [{ text: lastMessage.content }]
    const result = await chat.sendMessageStream(parts)
    return result
  } catch (err) {
    if (err.status === 429 || err.status === 503 || err.status === 500) {
      return tryGemini(messages, keyIndex + 1)
    }
    console.error('Gemini error:', err.message)
    return null
  }
}

export async function POST(request) {
  const { messages, fileContext, fileParts } = await request.json()

  const lastUserMessage = messages[messages.length - 1]?.content || ''

  let extraContext = ''
  if (fileContext) extraContext += '\n\n[FILE CONTENT]\n' + fileContext
  if (needsWebSearch(lastUserMessage)) {
    const searchResults = await doWebSearch(lastUserMessage)
    if (searchResults) extraContext += '\n\n' + searchResults
  }

  // Attach extra context to last message
  const processedMessages = messages.map((m, i) => {
    if (i !== messages.length - 1) return m
    if (fileParts && fileParts.length > 0) {
      // Multimodal message with file parts
      return {
        ...m,
        parts: [
          ...fileParts,
          { text: m.content + (extraContext ? '\n\n' + extraContext : '') }
        ]
      }
    }
    return extraContext
      ? { ...m, content: m.content + '\n\n' + extraContext }
      : m
  })

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
          // Fallback to Groq
          const groqMessages = [
            { role: 'system', content: SYSTEM_PROMPT },
            ...processedMessages.map(m => ({
              role: m.role === 'assistant' ? 'assistant' : 'user',
              content: m.content || (m.parts?.map(p => p.text || '').join('') ?? '')
            }))
          ]
          const groqStream = await groq.chat.completions.create({
            model: 'llama-3.3-70b-versatile',
            messages: groqMessages,
            stream: true,
            max_tokens: 4096,
          })
          for await (const chunk of groqStream) {
            const text = chunk.choices[0]?.delta?.content || ''
            if (text) send(text)
          }
        }
      } catch (err) {
        console.error('Stream error:', err)
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
