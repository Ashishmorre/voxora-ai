import { NextResponse } from 'next/server'

export async function POST(request) {
  try {
    const { query } = await request.json()

    const response = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: process.env.TAVILY_API_KEY,
        query,
        search_depth: 'basic',
        max_results: 5
      })
    })

    const data = await response.json()

    const results = data.results?.map(r =>
      `Title: ${r.title}\nURL: ${r.url}\nSummary: ${r.content}`
    ).join('\n\n')

    return NextResponse.json({
      results: `[Web Search Results for: "${query}"]\n\n${results}`
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}