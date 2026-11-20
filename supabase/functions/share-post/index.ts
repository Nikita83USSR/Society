// Supabase Edge Function: returns post-specific Open Graph HTML to social crawlers.
// Deploy with: supabase functions deploy share-post
// Required secret: SUPABASE_SERVICE_ROLE_KEY (provided automatically by Supabase).
const SITE = "https://nikita83ussr.github.io/Society/";
const FALLBACK_IMAGE = SITE + "assets/social-preview.png?v=3";
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
const shorten = (v: string, n: number) => v.length > n ? v.slice(0,n-1).trim()+"…" : v;
Deno.serve(async (req) => {
  const id = new URL(req.url).searchParams.get("id") || "";
  const target = SITE + (id ? "?post="+encodeURIComponent(id)+"#post-"+encodeURIComponent(id) : "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return Response.redirect(target, 302);
  const base = Deno.env.get("SUPABASE_URL")!;
  const secretKeys = Deno.env.get("SUPABASE_SECRET_KEYS");
  const key = secretKeys ? JSON.parse(secretKeys).default : Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!key) return new Response("Server configuration error", {status:500});
  const api = new URL(base + "/rest/v1/posts");
  api.searchParams.set("id","eq."+id);
  api.searchParams.set("select","id,body,image_urls,created_at,profiles:profiles!posts_author_id_fkey(display_name),comments(body,created_at)");
  const result = await fetch(api, {headers:{apikey:key,Authorization:"Bearer "+key}});
  if (!result.ok) return Response.redirect(target,302);
  const rows = await result.json();
  const post = rows?.[0];
  if (!post) return new Response("Публикация не найдена", {status:404});
  const body = String(post.body || "").trim();
  const comments = (post.comments || []).slice().sort((a:any,b:any)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,2).map((c:any)=>String(c.body||"").trim()).filter(Boolean);
  const description = shorten([body, ...comments.map((c:string)=>"Комментарий: "+c)].filter(Boolean).join(" · ") || "Публикация в блоге Никиты Маркина", 280);
  const title = "Никита Маркин — публикация";
  const image = post.image_urls?.[0] || FALLBACK_IMAGE;
  const canonical = "https://rjjcmagkaitfvjpdrgzp.supabase.co/functions/v1/share-post?id="+encodeURIComponent(id);
  const html = `<!doctype html><html lang="ru"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(target)}"><meta property="og:type" content="article"><meta property="og:site_name" content="Блог Никиты Маркина"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta property="og:image" content="${esc(image)}"><meta property="og:image:secure_url" content="${esc(image)}"><meta property="og:image:alt" content="Публикация в блоге Никиты Маркина"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(description)}"><meta name="twitter:image" content="${esc(image)}"><meta http-equiv="refresh" content="0;url=${esc(target)}"><script>location.replace(${JSON.stringify(target)})</script></head><body><p><a href="${esc(target)}">Открыть публикацию</a></p></body></html>`;
  return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"public, max-age=60, s-maxage=300","X-Content-Type-Options":"nosniff"}});
});