export default {
  async fetch(request: Request, env: any): Promise<Response> {
    const url = new URL(request.url);
    const headers = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: { ...headers, 'Access-Control-Allow-Methods': 'POST, GET', 'Access-Control-Allow-Headers': 'Content-Type' } });
    }

    if (url.pathname === '/') {
      return new Response(JSON.stringify({ status: 'ok', service: 'AVI Shopper AI' }), { headers });
    }

    if (url.pathname === '/chat' && request.method === 'POST') {
      try {
        const body = await request.json() as any;
        const userMessages = (body.messages || []).map((m: any) => ({
          role: m.role === 'user' ? 'user' : 'assistant',
          content: m.text || m.content || '',
        }));

        const result: any = await env.AI.run('@cf/meta/llama-3.2-3b-instruct', {
          messages: [
            { role: 'system', content: 'Eres AVI, asistente de compras chileno. Breve, 2-3 oraciones. Pregunta marca y tipo. Si dicen listo genera JSON: ---LISTA--- ["producto1"]' },
            ...userMessages,
          ],
        });

        const text = typeof result === 'string' ? result : (result?.response || JSON.stringify(result));
        return new Response(JSON.stringify({ reply: text, products: null }), { headers });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message, stack: e.stack }), { status: 500, headers });
      }
    }

    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers });
  },
};