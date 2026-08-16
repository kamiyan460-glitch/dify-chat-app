import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  const { query, conversationId } = (await req.json()) as {
    query: string;
    conversationId?: string;
  };

  const apiKey = process.env.DIFY_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'DIFY_API_KEY is not set' }, { status: 500 });
  }

  const res = await fetch('https://api.dify.ai/v1/chat-messages', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      inputs: {},
      query,
      response_mode: 'streaming',
      conversation_id: conversationId ?? '',
      user: 'web-user',
    }),
  });

  if (!res.ok || !res.body) {
    return NextResponse.json({ error: 'Failed to fetch response from Dify' }, { status: 500 });
  }

  return new NextResponse(res.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
