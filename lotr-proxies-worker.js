export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = url.searchParams.get('url');
    if (!target) {
      return new Response('missing ?url=', { status: 400 });
    }
    const resp = await fetch(target, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const buf = await resp.arrayBuffer();
    return new Response(buf, {
      status: resp.status,
      headers: {
        'Content-Type': resp.headers.get('Content-Type') || 'application/octet-stream',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600'
      }
    });
  }
}
