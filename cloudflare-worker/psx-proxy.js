export default {
  async fetch(request) {
    const url = new URL(request.url);
    const target = `https://dps.psx.com.pk${url.pathname}${url.search}`;

    const upstream = await fetch(target, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });

    const response = new Response(upstream.body, upstream);
    response.headers.set('Access-Control-Allow-Origin', '*');
    return response;
  },
};
