import { NextResponse } from 'next/server'
import * as cheerio from 'cheerio'

export async function POST(request) {
  try {
    const { url } = await request.json()

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    })

    const html = await response.text()
    const $ = cheerio.load(html)

    $('script, style, nav, footer, header, aside, iframe, noscript').remove()

    const title = $('title').text().trim()
    const text = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 8000)

    return NextResponse.json({
      title,
      text: `[URL: ${url}]\n[Title: ${title}]\n\n${text}`,
      url
    })
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}