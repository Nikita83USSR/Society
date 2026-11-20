// Single-author blog frontend. Public browser config only.
const SUPABASE_URL = "https://rjjcmagkaitfvjpdrgzp.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_hZe9Pu5vCr8ThbVjQa6oiw_wkVR2yIk";
const OWNER_LOGIN = "Nikita83USSR";
const $ = (s, root=document) => root.querySelector(s);
const $$ = (s, root=document) => [...root.querySelectorAll(s)];
const configured = !!(window.supabase && SUPABASE_URL && SUPABASE_ANON_KEY);
const db = configured ? window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null;
let session=null, me=null, ownerProfile=null, selectedFiles=[], cachedPosts=[];
const fallbackAvatar="https://github.com/Nikita83USSR.png";
function esc(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
function toast(s){const el=$("#toast");el.textContent=s;el.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>el.classList.remove("show"),3200);}
function profileOf(user){const m=user?.user_metadata||{};return {id:user.id,github_login:m.user_name||m.preferred_username||m.login||"github-user",display_name:m.full_name||m.name||m.user_name||"GitHub user",avatar_url:m.avatar_url||fallbackAvatar,profile_url:m.html_url||("https://github.com/"+(m.user_name||"")),bio:m.bio||""};}
function isOwner(){return me?.github_login?.toLowerCase()===OWNER_LOGIN.toLowerCase();}
function setAvatar(el,url){if(el)el.src=url||fallbackAvatar;}
function updateIdentity(){
  setAvatar($("#sideAvatar"),ownerProfile?.avatar_url||fallbackAvatar);
  setAvatar($("#topAvatar"),ownerProfile?.avatar_url||fallbackAvatar);
  setAvatar($("#wallAvatar"),ownerProfile?.avatar_url||fallbackAvatar);
  $("#sideName").textContent=ownerProfile?.display_name||"Никита";
  $("#topUserName").textContent=session?(isOwner()?"Автор · @"+me.github_login:"Вы вошли · @"+me.github_login):"Гость · чтение";
  $("#loginButton").classList.toggle("hidden",!!session);
  $("#logoutButton").classList.toggle("hidden",!session);
  $("#postForm").classList.toggle("hidden",!isOwner());
  $("#bannerEdit").classList.toggle("hidden",!isOwner());
  $("#ownerNotice").classList.toggle("hidden",!isOwner());
  $("#readerNotice").classList.toggle("hidden",!!session);
}
function login(){if(!db)return toast("Нет подключения к Supabase.");const redirectTo=new URL("./",location.href).href;db.auth.signInWithOAuth({provider:"github",options:{redirectTo,scopes:"read:user user:email"}}).then(({error})=>{if(error)toast(error.message);});}
async function logout(){if(!db)return;const {error}=await db.auth.signOut();if(error)toast(error.message);else{session=null;me=null;updateIdentity();await loadPosts();toast("Вы вышли из аккаунта.");}}
async function syncProfile(){
  if(!session?.user)return;
  const p=profileOf(session.user);
  const {error}=await db.from("profiles").upsert({...p,updated_at:new Date().toISOString()},{onConflict:"id"});
  if(error)console.warn("Profile sync:",error.message);
  me=p;
  if(isOwner())ownerProfile=p;
  updateIdentity();
}
async function loadBanner(){
  const {data,error}=await db.from("site_settings").select("value").eq("key","banner_url").maybeSingle();
  if(error){console.warn("Banner setting:",error.message);return;}
  if(data?.value)$("#blogBanner").style.backgroundImage='url("'+data.value.replace(/["\\\\]/g,"")+'")';
}
async function changeBanner(file){
  if(!isOwner()||!file)return;
  if(!file.type.startsWith("image/")||file.size>12*1024*1024)return toast("Выберите изображение до 12 МБ.");
  const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase();
  const path=session.user.id+"/banner-"+Date.now()+"."+ext;
  const {error:uploadError}=await db.storage.from("society-images").upload(path,file,{contentType:file.type,upsert:true});
  if(uploadError)return toast("Не удалось загрузить баннер: "+uploadError.message);
  const url=db.storage.from("society-images").getPublicUrl(path).data.publicUrl;
  const {error}=await db.from("site_settings").upsert({key:"banner_url",value:url,updated_at:new Date().toISOString()},{onConflict:"key"});
  if(error)return toast("Файл загружен, но настройку сохранить не удалось: "+error.message);
  $("#blogBanner").style.backgroundImage='url("'+url+'")';
  toast("Баннер обновлён для всех посетителей.");
}
async function loadOwner(){
  const {data,error}=await db.from("profiles").select("*").eq("github_login",OWNER_LOGIN).maybeSingle();
  if(error)console.warn("Owner profile:",error.message);
  ownerProfile=data||ownerProfile||{github_login:OWNER_LOGIN,display_name:"Никита",avatar_url:fallbackAvatar,profile_url:"https://github.com/"+OWNER_LOGIN};
  updateIdentity();
}
function findLinks(text){return [...new Set((String(text||"").match(/https?:\/\/[^\s<>"']+/gi)||[]).map(x=>x.replace(/[),.!?;:]+$/,"")))];}
function linkPreview(url){try{const u=new URL(url);if(!["http:","https:"].includes(u.protocol))return "";return '<a class="link-preview" href="'+esc(u.href)+'" target="_blank" rel="noopener noreferrer"><span class="link-preview-icon">↗</span><span class="link-preview-copy"><b>'+esc(u.hostname.replace(/^www\./,""))+'</b><small>'+esc(u.pathname==="/"?"Открыть страницу":u.pathname)+'</small><em>'+esc(u.href)+'</em></span></a>';}catch{return "";}}
function richText(value){let out="",last=0;const source=String(value||"");const re=/https?:\/\/[^\s<>"']+/gi;let m;while((m=re.exec(source))){const raw=m[0],url=raw.replace(/[),.!?;:]+$/,"");out+=esc(source.slice(last,m.index));out+='<a href="'+esc(url)+'" target="_blank" rel="noopener noreferrer">'+esc(url)+'</a>'+esc(raw.slice(url.length));last=m.index+raw.length;}return (out+esc(source.slice(last))).replace(/\n/g,"<br>");}
function postMarkup(p){
  const comments=(p.comments||[]).slice().sort((a,b)=>new Date(a.created_at)-new Date(b.created_at)).map(c=>{
    const a=c.profiles||{};
    const anonymous=!c.author_id;
    return '<div class="comment"><img src="'+esc(anonymous?"https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp":a.avatar_url||"https://github.com/identicons/app.png")+'" alt=""><div class="comment-content"><b>'+esc(anonymous?"Аноним":a.display_name||a.github_login||"Пользователь")+'</b>'+(anonymous?"":'<span class="comment-login">@'+esc(a.github_login||"github-user")+'</span>')+'<div>'+richText(c.body)+'</div></div></div>';
  }).join("");
  const imgs=(p.image_urls||[]).map(url=>'<img src="'+esc(url)+'" alt="Изображение публикации" loading="lazy">').join("");
  const urls=[...findLinks(p.body),...(p.link_url?[p.link_url]:[])];
  const link=urls.length?linkPreview(urls[0]):"";
  const canComment=true;
  return '<article class="post" data-post="'+esc(p.id)+'"><div class="post-head"><img class="post-avatar" src="'+esc(ownerProfile?.avatar_url||fallbackAvatar)+'" alt=""><div><b class="post-author">'+esc(ownerProfile?.display_name||"Никита")+'</b><div class="post-meta">@'+OWNER_LOGIN+" · "+new Date(p.created_at).toLocaleString("ru-RU")+'</div></div><span class="post-owner-mark">Автор</span></div><div class="post-body">'+richText(p.body||"")+'</div>'+link+(imgs?'<div class="post-images">'+imgs+"</div>":"")+'<div class="comments"><div class="comments-heading">Комментарии · '+(p.comments||[]).length+'</div>'+comments+'<form class="comment-form"><input maxlength="3000" placeholder="'+(session?"Написать комментарий…":"Оставить комментарий анонимно…")+'" '+(!canComment?"disabled":"")+'><button '+(!canComment?"disabled":"")+'>Отправить</button></form></div>'+(isOwner()?'<div class="post-admin-actions"><button data-action="delete">Удалить запись</button></div>':"")+'</article>';
}
async function loadPosts(){
  if(!db){$("#setupNotice").classList.remove("hidden");return;}
  await loadOwner();
  await loadBanner();
  if(!ownerProfile?.id){$("#posts").innerHTML='<div class="empty-state">Профиль автора пока не найден. Войдите в блог через GitHub под аккаунтом автора.</div>';$("#postCount").textContent="0 записей";return;}
  const {data,error}=await db.from("posts").select("*,profiles!posts_author_id_fkey(*),comments(*,profiles!comments_author_id_fkey(*))").eq("author_id",ownerProfile.id).order("created_at",{ascending:false}).limit(100);
  if(error){console.error("Blog posts load:",error);toast("Не удалось загрузить записи: "+error.message);return;}
  cachedPosts=data||[];
  renderPosts();
}
function renderPosts(){
  const term=$("#searchInput").value.trim().toLocaleLowerCase("ru");
  const visible=cachedPosts.filter(p=>!term||(p.body||"").toLocaleLowerCase("ru").includes(term));
  $("#posts").innerHTML=visible.map(postMarkup).join("");
  $("#postCount").textContent=visible.length+" записей";
  $("#emptyState").classList.toggle("hidden",visible.length>0);
}
async function uploadImages(){
  const urls=[];
  for(const file of selectedFiles){
    if(!file.type.startsWith("image/")||file.size>8*1024*1024)throw new Error("Изображения должны быть до 8 МБ каждое.");
    const ext=(file.name.split(".").pop()||"jpg").replace(/[^a-z0-9]/gi,"").toLowerCase();
    const id=window.crypto?.randomUUID?window.crypto.randomUUID():Date.now().toString(36)+"-"+Math.random().toString(36).slice(2);
    const path=session.user.id+"/"+id+"."+ext;
    const {error}=await db.storage.from("society-images").upload(path,file,{contentType:file.type,upsert:false});
    if(error)throw error;
    urls.push(db.storage.from("society-images").getPublicUrl(path).data.publicUrl);
  }
  return urls;
}
async function publish(e){
  e.preventDefault();
  if(!isOwner())return toast("Публиковать записи может только автор блога.");
  const body=$("#postText").value.trim();
  if(!body&&!selectedFiles.length)return;
  const button=$("#publishButton");button.disabled=true;button.textContent="Публикация…";
  try{
    const images=await uploadImages();
    const {error}=await db.from("posts").insert({author_id:session.user.id,wall_owner_id:null,body,link_url:null,image_urls:images});
    if(error)throw error;
    $("#postText").value="";selectedFiles=[];$("#imageInput").value="";$("#imagePreview").innerHTML="";$("#imagePreview").classList.add("hidden");$("#fileNames").textContent="";
    await loadPosts();toast("Запись опубликована.");
  }catch(err){console.error("Blog publish failed:",err);toast("Ошибка публикации: "+(err?.message||String(err)));}
  finally{button.textContent="Опубликовать";button.disabled=!($("#postText").value.trim()||selectedFiles.length);}
}
async function addComment(e){
  if(!e.target.matches(".comment-form"))return;
  e.preventDefault();
  const article=e.target.closest("[data-post]"),input=e.target.querySelector("input"),body=input.value.trim();
  if(!body)return;
  const button=e.target.querySelector("button");button.disabled=true;
  const {error}=await db.from("comments").insert({post_id:article.dataset.post,author_id:session?.user?.id||null,body});
  if(error){toast("Не удалось добавить комментарий: "+error.message);button.disabled=false;}
  else{await loadPosts();toast(session?"Комментарий добавлен.":"Комментарий опубликован анонимно.");}
}
async function postAction(e){
  const button=e.target.closest("[data-action='delete']");if(!button)return;
  if(!isOwner())return toast("Удалять записи может только автор.");
  const article=button.closest("[data-post]");if(!article||!confirm("Удалить эту запись?"))return;
  button.disabled=true;
  const {error}=await db.from("posts").delete().eq("id",article.dataset.post).eq("author_id",session.user.id);
  if(error){toast("Не удалось удалить запись: "+error.message);button.disabled=false;return;}
  cachedPosts=cachedPosts.filter(p=>p.id!==article.dataset.post);renderPosts();toast("Запись удалена.");
}
async function init(){
  $("#footerYear").textContent=new Date().getFullYear();
  if(!configured){$("#setupNotice").classList.remove("hidden");return;}
  db.auth.onAuthStateChange((_event,nextSession)=>{setTimeout(async()=>{session=nextSession;me=session?profileOf(session.user):null;if(session)await syncProfile();updateIdentity();await loadPosts();},0);});
  const {data:{session:current},error}=await db.auth.getSession();
  if(error)console.warn("Session restore:",error.message);
  session=current;me=session?profileOf(session.user):null;
  if(session)await syncProfile();
  await loadOwner();updateIdentity();await loadPosts();
}
$("#loginButton").addEventListener("click",login);
$("#logoutButton").addEventListener("click",logout);
document.addEventListener("click",e=>{if(e.target.closest("[data-login]"))login();});
$("#postForm").addEventListener("submit",publish);
$("#posts").addEventListener("click",postAction);
$("#posts").addEventListener("submit",addComment);
$("#postText").addEventListener("input",()=>$("#publishButton").disabled=!($("#postText").value.trim()||selectedFiles.length));
$("#bannerInput").addEventListener("change",e=>{const file=e.target.files?.[0];if(file)changeBanner(file);e.target.value="";});
$("#imageInput").addEventListener("change",e=>{
  selectedFiles=[...e.target.files].slice(0,5);$("#imagePreview").innerHTML="";
  selectedFiles.forEach(file=>{const img=document.createElement("img");img.src=URL.createObjectURL(file);$("#imagePreview").append(img);});
  $("#imagePreview").classList.toggle("hidden",!selectedFiles.length);$("#fileNames").textContent=selectedFiles.map(f=>f.name).join(", ");
  $("#publishButton").disabled=!($("#postText").value.trim()||selectedFiles.length);
});
$("#searchInput").addEventListener("input",renderPosts);
init();
