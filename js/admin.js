import{$ as A}from"./helpers.js?v=47f8b7e5";import{state as C}from"./state.js?v=47f8b7e5";import{supabase as f,callEdge as z}from"./supabase.js?v=47f8b7e5";import"./auth.js";import{showToast as u}from"./toast.js?v=47f8b7e5";import{loadAllEvents as P,normalizeDate as ee,parseDate as G}from"./data.js?v=47f8b7e5";let I=["\u041A\u043E\u043D\u0446\u0435\u0440\u0442","\u0412\u044B\u0441\u0442\u0430\u0432\u043A\u0430","\u0412\u0435\u0447\u0435\u0440\u0438\u043D\u043A\u0430","\u0424\u0435\u0441\u0442\u0438\u0432\u0430\u043B\u044C","\u041B\u0435\u043A\u0446\u0438\u044F","\u0419\u043E\u0433\u0430","\u0411\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E","\u0421\u043F\u043E\u0440\u0442","\u041A\u0438\u043D\u043E","\u041C\u0430\u0441\u0442\u0435\u0440-\u043A\u043B\u0430\u0441\u0441","\u0422\u0430\u043D\u0446\u044B","\u0422\u0435\u0430\u0442\u0440"];async function te(){try{const{data:a,error:e}=await f.from("tags").select("name").order("name");if(!e&&a?.length){const t=a.map(i=>i.name).filter(i=>!I.includes(i));I=[...I,...t]}}catch{}}export function openAdminPanel(){const a=A("admin-panel");a&&(a.classList.add("open"),a.setAttribute("aria-hidden","false"),history.pushState({meowAdmin:!0},""),j(a))}export function closeAdminPanel(){const a=A("admin-panel");a&&(a.classList.remove("open"),a.setAttribute("aria-hidden","true"))}export function openAdminCreate(){const a=A("admin-panel");a&&(a.classList.add("open"),a.setAttribute("aria-hidden","false"),D(a,null))}export async function openAdminEdit(a){const e=A("admin-panel");if(!e)return;e.classList.add("open"),e.setAttribute("aria-hidden","false");const t=C.rawAllEvents.find(i=>i.id===a);if(t)D(e,t);else try{const{data:i}=await f.from("events").select("*").eq("id",a).single();i?D(e,i):(u("\u0421\u043E\u0431\u044B\u0442\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E"),closeAdminPanel())}catch{u("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438"),closeAdminPanel()}}async function j(a){const e=a.querySelector(".admin-body");if(e){e.innerHTML='<p style="padding:20px;text-align:center;color:var(--c-t2)">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</p>';try{let t=[];try{const{data:r,error:d}=await f.rpc("get_all_events_admin");if(d)throw d;t=r??[]}catch{t=[...C.rawAllEvents].sort((r,d)=>{const l=G(r.date)||new Date(0);return(G(d.date)||new Date(0))-l})}const i=a.querySelector(".admin-header");i&&(i.innerHTML=`
        <button class="admin-back" id="admin-panel-back-btn" aria-label="\u041D\u0430\u0437\u0430\u0434">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="admin-header-title">\u{1F6E1}\uFE0F \u0410\u0434\u043C\u0438\u043D-\u043F\u0430\u043D\u0435\u043B\u044C</div>
      `,i.querySelector("#admin-panel-back-btn")?.addEventListener("click",closeAdminPanel));let s="";s+=`<button class="btn-admin-create" id="btn-admin-create-event">
      \u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435
    </button>`,s+=`<div class="admin-tabs">
      <button class="admin-tab active" data-tab="active">\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435 (${t.filter(r=>r.is_active).length})</button>
      <button class="admin-tab" data-tab="inactive">\u041D\u0435\u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0435 (${t.filter(r=>!r.is_active).length})</button>
      <button class="admin-tab" data-tab="reports">\u041E\u0442\u0447\u0451\u0442\u044B</button>
      <button class="admin-tab" data-tab="admins">\u{1F511} \u0410\u0434\u043C\u0438\u043D\u044B</button>
    </div>`,s+='<div id="admin-events-list" class="admin-events-list">',s+=V(t.filter(r=>r.is_active),"active"),s+='<div id="admin-events-inactive" style="display:none">',s+=V(t.filter(r=>!r.is_active),"inactive"),s+="</div></div>",s+=`<div id="admin-reports-section" style="display:none">
      <p style="padding:12px 0;color:var(--c-t2);font-size:13px;">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043E\u0442\u0447\u0451\u0442\u043E\u0432\u2026</p>
    </div>`,s+=`<div id="admin-admins-section" style="display:none">
      <p style="padding:12px 0;color:var(--c-t2);font-size:13px;">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</p>
    </div>`,e.innerHTML=s,e.querySelector("#btn-admin-create-event")?.addEventListener("click",()=>{D(a,null)}),e.querySelectorAll(".admin-tab").forEach(r=>{r.addEventListener("click",()=>{e.querySelectorAll(".admin-tab").forEach(l=>l.classList.remove("active")),r.classList.add("active");const d=r.dataset.tab;e.querySelector("#admin-events-list").style.display=d==="reports"||d==="admins"?"none":"",e.querySelector("#admin-events-inactive").style.display=d==="inactive"?"":"none",e.querySelector("#admin-reports-section").style.display=d==="reports"?"":"none",e.querySelector("#admin-admins-section").style.display=d==="admins"?"":"none",d==="reports"&&F(e.querySelector("#admin-reports-section")),d==="admins"&&R(e.querySelector("#admin-admins-section"))})}),ae(e,t)}catch(t){console.error("[MEOW] Admin list error:",t),e.innerHTML='<p style="padding:20px;text-align:center;color:var(--c-t2)">\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438</p>'}}}function V(a,e){return a.length?a.map(t=>{const i=t.is_active,s=t.date||"\u2014";return`
      <div class="admin-event-row" data-event-id="${t.id}">
        <div class="admin-event-info">
          <div class="admin-event-title">${c(t.title)}</div>
          <div class="admin-event-date">${s}${t.time?" \xB7 "+t.time:""}</div>
        </div>
        <div class="admin-event-badges">
          ${i?'<span class="admin-badge active">\u2713 \u0410\u043A\u0442\u0438\u0432\u043D\u043E</span>':'<span class="admin-badge inactive">\u041D\u0435\u0430\u043A\u0442\u0438\u0432\u043D\u043E</span>'}
        </div>
        <div class="admin-event-actions">
          <button class="btn-admin-sm edit" data-id="${t.id}" title="\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-admin-sm toggle-active" data-id="${t.id}" data-active="${i}" title="${i?"\u0414\u0435\u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u0442\u044C":"\u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u0442\u044C"}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${i?'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>':'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'}
            </svg>
          </button>
          <button class="btn-admin-sm delete" data-id="${t.id}" title="\u0423\u0434\u0430\u043B\u0438\u0442\u044C">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>`}).join(""):`<p class="admin-empty">\u041D\u0435\u0442 ${e==="inactive"?"\u043D\u0435\u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445":""} \u0441\u043E\u0431\u044B\u0442\u0438\u0439</p>`}function ae(a){a.querySelectorAll(".btn-admin-sm.edit").forEach(e=>{e.addEventListener("click",t=>{t.stopPropagation(),D(A("admin-panel"),C.rawAllEvents.find(i=>i.id===e.dataset.id))})}),a.querySelectorAll(".btn-admin-sm.toggle-active").forEach(e=>{e.addEventListener("click",async t=>{t.stopPropagation();const i=e.dataset.id,s=e.dataset.active==="true";try{const{error:r}=await f.from("events").update({is_active:!s}).eq("id",i);if(r)throw r;u(s?"\u0414\u0435\u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D\u043E":"\u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D\u043E"),await P(),j(A("admin-panel"))}catch(r){u("\u041E\u0448\u0438\u0431\u043A\u0430: "+(r.message||r))}})}),a.querySelectorAll(".btn-admin-sm.delete").forEach(e=>{e.addEventListener("click",async t=>{t.stopPropagation();const i=e.dataset.id;if(confirm(`\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435 \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430? \u042D\u0442\u043E \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u044C.

\u0415\u0441\u043B\u0438 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u043F\u043E\u0441\u0442 \u0432\u0441\u0451 \u0435\u0449\u0451 \u0435\u0441\u0442\u044C \u0432 Telegram-\u043A\u0430\u043D\u0430\u043B\u0435, \u043F\u0440\u0438 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u0441\u043E\u0431\u044B\u0442\u0438\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0441\u043E\u0437\u0434\u0430\u043D\u043E \u0437\u0430\u043D\u043E\u0432\u043E (\u044D\u0442\u043E \u0440\u0430\u0437\u043D\u044B\u0435 \u043C\u0435\u0445\u0430\u043D\u0438\u0437\u043C\u044B).`))try{const{error:s}=await f.from("events").delete().eq("id",i);if(s)throw s;u("\u0423\u0434\u0430\u043B\u0435\u043D\u043E"),await P(),document.dispatchEvent(new CustomEvent("meow:events-changed")),j(A("admin-panel"))}catch(s){u("\u041E\u0448\u0438\u0431\u043A\u0430: "+(s.message||s))}})})}let Y=null;function ie(){const a=document.getElementById("admin-f-location"),e=document.getElementById("admin-location-suggestions");!a||!e||(a.addEventListener("input",()=>{clearTimeout(Y);const t=a.value.trim();if(t.length<2){e.innerHTML="",e.classList.remove("open");return}Y=setTimeout(()=>{ne(t,e,a)},250)}),a.addEventListener("blur",()=>{setTimeout(()=>{e.classList.remove("open")},200)}),e.addEventListener("mousedown",t=>t.preventDefault()))}function ne(a,e,t){const i=a.toLowerCase().trim(),s=(C.rawPlaces||[]).filter(n=>{const o=(n.name||"").toLowerCase(),p=(n.address||"").toLowerCase(),g=(n.keywords||[]).join(" ").toLowerCase();return o.includes(i)||p.includes(i)||g.includes(i)});let r=[];try{window._geocodeCache&&(r=Object.keys(window._geocodeCache).filter(n=>n.toLowerCase().includes(i)).map(n=>({_cacheKey:n,name:n,lat:window._geocodeCache[n]?.[0],lon:window._geocodeCache[n]?.[1]})))}catch{}const d=[...s.map(n=>({type:"place",data:n})),...r.map(n=>({type:"cache",data:n}))];if(!d.length){e.innerHTML="",e.classList.remove("open");return}const l=new Set,v=[];for(const n of d){const o=(n.type==="place",n.data.name);l.has(o.toLowerCase())||(l.add(o.toLowerCase()),v.push(n))}e.innerHTML=v.slice(0,10).map(n=>{if(n.type==="place"){const o=n.data;return`<div class="admin-sug-item" data-type="place" data-place-id="${o.id}">
        <div class="admin-sug-icon">\u{1F4CD}</div>
        <div class="admin-sug-text">${c(o.name)}</div>
        <div class="admin-sug-sub">${c(o.address||"")}</div>
      </div>`}else{const o=n.data;return`<div class="admin-sug-item" data-type="cache" data-lat="${o.lat}" data-lon="${o.lon}">
        <div class="admin-sug-icon">\u{1F5FA}\uFE0F</div>
        <div class="admin-sug-text">${c(o.name)}</div>
      </div>`}}).join(""),e.classList.add("open"),e.querySelectorAll(".admin-sug-item").forEach(n=>{n.addEventListener("click",()=>{const o=n.dataset.type;if(o==="place"){const p=n.dataset.placeId,g=C.rawPlaces.find(x=>x.id===p);if(g){document.getElementById("admin-f-location").value=g.name,document.getElementById("admin-f-address").value=g.address||"";const x=document.getElementById("admin-f-lat"),q=document.getElementById("admin-f-lon");x&&(x.value=g.lat??""),q&&(q.value=g.lng??g.lon??"")}}else if(o==="cache"){const p=document.getElementById("admin-f-location"),g=document.getElementById("admin-f-address"),x=document.getElementById("admin-f-lat"),q=document.getElementById("admin-f-lon");p&&(p.value=n.querySelector(".admin-sug-text")?.textContent||""),g&&(g.value=n.querySelector(".admin-sug-text")?.textContent||""),x&&(x.value=n.dataset.lat||""),q&&(q.value=n.dataset.lon||"")}e.classList.remove("open")})})}async function se(){if(!window._geocodeCache)try{const a=await fetch("geocode_cache.json?"+Date.now());window._geocodeCache=await a.json()}catch{window._geocodeCache={}}}function D(a,e){const t=a.querySelector(".admin-body");if(!t)return;te(),se();const i=!!e,s=e?.title||"",r=e?.date||ue(new Date),d=e?.time||"",l=e?.location||"",v=e?.address||"",n=Array.isArray(e?.tags)?e.tags:typeof e?.tags=="string"?e.tags.split(",").map(m=>m.trim()).filter(Boolean):[],o=e?.short_description||"",p=e?.full_description||"",g=e?.contacts||"",x=e?.lat??"",q=e?.lon??"",B=e?.image_url||e?.imageUrl||"",$=e?.is_active!==void 0?e.is_active:!0,h=a.querySelector(".admin-header");h&&(h.innerHTML=`
      <button class="admin-back" id="admin-panel-back-btn" aria-label="\u041D\u0430\u0437\u0430\u0434">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="admin-header-title">${i?"\u270F\uFE0F \u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C":"\u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435"}</div>
    `,h.querySelector("#admin-panel-back-btn")?.addEventListener("click",()=>{j(a)}));const _=i?`<input type="hidden" id="admin-f-id" value="${c(e.id)}">`:"";t.innerHTML=`
    <form id="admin-event-form" class="admin-form">
      ${_}
      <div class="admin-field">
        <label class="admin-label" for="admin-f-title">\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 *</label>
        <input class="admin-input" id="admin-f-title" value="${c(s)}" placeholder="\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u044F" required>
      </div>
      <div class="admin-row-2">
        <div class="admin-field">
          <label class="admin-label" for="admin-f-date">\u0414\u0430\u0442\u0430 (\u0414\u0414.\u041C\u041C.\u0413\u0413\u0413\u0413) *</label>
          <input class="admin-input" id="admin-f-date" value="${c(r)}" placeholder="01.01.2026" required>
        </div>
        <div class="admin-field">
          <label class="admin-label" for="admin-f-time">\u0412\u0440\u0435\u043C\u044F</label>
          <input class="admin-input" id="admin-f-time" value="${c(d)}" placeholder="19:00">
        </div>
      </div>
      <div class="admin-field" style="position:relative">
        <label class="admin-label" for="admin-f-location">\u041C\u0435\u0441\u0442\u043E / \u041B\u043E\u043A\u0430\u0446\u0438\u044F
          <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--c-t2)">(\u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0434\u043B\u044F \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043E\u043A)</span>
        </label>
        <input class="admin-input" id="admin-f-location" value="${c(l)}" placeholder="\u0411\u0430\u0440\u043D, \u041A\u0430\u0448\u0442\u0430\u043D\u043E\u0432\u0430\u044F \u0430\u043B\u043B\u0435\u044F 1\u0430" autocomplete="off">
        <div class="admin-location-suggestions" id="admin-location-suggestions"></div>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-address">\u0410\u0434\u0440\u0435\u0441</label>
        <input class="admin-input" id="admin-f-address" value="${c(v)}" placeholder="\u041A\u0430\u0448\u0442\u0430\u043D\u043E\u0432\u0430\u044F \u0430\u043B\u043B\u0435\u044F 1\u0430, \u041A\u0430\u043B\u0438\u043D\u0438\u043D\u0433\u0440\u0430\u0434">
      </div>
      <div class="admin-field">
        <label class="admin-label">\u0422\u0435\u0433\u0438</label>
        <div class="admin-tags" id="admin-f-tags">
          ${I.map(m=>`<button type="button" class="admin-tag ${n.includes(m)?"selected":""}" data-tag="${c(m)}">${c(m)}</button>`).join("")}
        </div>
        <div class="admin-tag-add-row">
          <input class="admin-input admin-tag-input" id="admin-f-new-tag" placeholder="\u041D\u043E\u0432\u044B\u0439 \u0442\u0435\u0433..." autocomplete="off">
          <button type="button" class="admin-tag-add-btn" id="admin-f-tag-add">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C</button>
        </div>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-short-desc">\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435</label>
        <textarea class="admin-textarea" id="admin-f-short-desc" rows="3" placeholder="\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435\u2026">${c(o)}</textarea>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-full-desc">\u041F\u043E\u043B\u043D\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435</label>
        <textarea class="admin-textarea" id="admin-f-full-desc" rows="6" placeholder="\u041F\u043E\u043B\u043D\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435\u2026">${c(p)}</textarea>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-contacts">\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B (URL \u0438\u043B\u0438 @username)</label>
        <input class="admin-input" id="admin-f-contacts" value="${c(g)}" placeholder="https://t.me/...">
      </div>
      <div class="admin-field">
        <label class="admin-label">\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435</label>
        <div class="admin-image-row">
          <input class="admin-input" id="admin-f-image" value="${c(B)}" placeholder="URL \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F (https://... \u0438\u043B\u0438 images/...)">
          <div class="admin-file-upload-wrap">
            <label class="admin-file-btn" for="admin-f-file">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </label>
            <input type="file" id="admin-f-file" accept="image/png,image/jpeg,image/webp" style="display:none">
          </div>
        </div>
        <div id="admin-image-preview" class="admin-image-preview" style="display:none">
          <img id="admin-preview-img" alt="Preview">
          <button type="button" class="admin-preview-remove" id="admin-preview-remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="admin-row-2">
        <div class="admin-field">
          <label class="admin-label" for="admin-f-lat">\u0428\u0438\u0440\u043E\u0442\u0430 (lat)</label>
          <input class="admin-input" id="admin-f-lat" type="number" step="any" value="${x}" placeholder="54.710">
        </div>
        <div class="admin-field">
          <label class="admin-label" for="admin-f-lon">\u0414\u043E\u043B\u0433\u043E\u0442\u0430 (lon)</label>
          <input class="admin-input" id="admin-f-lon" type="number" step="any" value="${q}" placeholder="20.467">
        </div>
      </div>
      <div class="admin-field">
        <label class="admin-toggle-row">
          <span class="admin-label" style="margin-bottom:0">\u0410\u043A\u0442\u0438\u0432\u043D\u043E</span>
          <div class="toggle ${$?"active":""}" id="admin-f-active"></div>
        </label>
      </div>
      <div class="admin-actions">
        <button type="button" class="btn-admin-cancel" id="admin-f-cancel">\u041E\u0442\u043C\u0435\u043D\u0430</button>
        <button type="submit" class="btn-admin-save">
          ${i?"\u{1F4BE} \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C":"\u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C"}
        </button>
      </div>
    </form>
  `,t.querySelectorAll(".admin-tag").forEach(m=>{m.addEventListener("click",S=>{S.preventDefault(),m.classList.toggle("selected")})});const T=t.querySelector("#admin-f-new-tag"),L=t.querySelector("#admin-f-tag-add");function E(){const m=T?.value?.trim();if(!m)return;const S=t.querySelector(`.admin-tag[data-tag="${c(m)}"]`);if(S){S.classList.add("selected"),T.value="";return}const U=t.querySelector("#admin-f-tags"),y=document.createElement("button");y.type="button",y.className="admin-tag selected",y.dataset.tag=m,y.textContent=m,y.addEventListener("click",H=>{H.preventDefault(),y.classList.toggle("selected")}),U.appendChild(y),T.value="",I.includes(m)||(I.push(m),f.from("tags").upsert({name:m},{onConflict:"name"}).catch(()=>{}))}L?.addEventListener("click",E),T?.addEventListener("keydown",m=>{m.key==="Enter"&&(m.preventDefault(),E())}),t.querySelector("#admin-f-active")?.addEventListener("click",m=>{m.currentTarget.classList.toggle("active")});const M=t.querySelector("#admin-f-file"),b=t.querySelector("#admin-f-image"),w=t.querySelector("#admin-image-preview"),k=t.querySelector("#admin-preview-img"),X=t.querySelector("#admin-preview-remove");let N="";M?.addEventListener("change",async m=>{const S=m.target.files?.[0];if(!S)return;const U=new FileReader;U.onload=y=>{const H=y.target.result;N=H,k&&w&&(k.src=H,w.style.display="flex"),b&&(b.value=H)},U.readAsDataURL(S);try{const y=`events/${Date.now()}_${S.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`,{data:H,error:O}=await f.storage.from("event-images").upload(y,S,{upsert:!0,contentType:S.type});if(O)throw O;const{data:W}=f.storage.from("event-images").getPublicUrl(y);W?.publicUrl&&(b&&(b.value=W.publicUrl),N="",u("\u2705 \u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E"))}catch(y){console.warn("[MEOW] Supabase Storage upload failed, keeping base64:",y.message),y.message?.includes("bucket")||y.message?.includes("not found")?u("\u26A0\uFE0F \u0411\u0430\u043A\u0435\u0442 event-images \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D. \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u044E SQL."):u("\u26A0\uFE0F \u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u043A\u0430\u043A base64 (\u0431\u0443\u0434\u0435\u0442 \u0432 \u0434\u0430\u043D\u043D\u044B\u0445 \u0441\u043E\u0431\u044B\u0442\u0438\u044F)")}}),X?.addEventListener("click",()=>{w&&(w.style.display="none"),k&&(k.src=""),M&&(M.value=""),b&&(b.value="")}),b?.addEventListener("input",()=>{const m=b.value.trim();m&&k&&w?(k.src=m,w.style.display="flex"):w&&(w.style.display="none")}),t.querySelector("#admin-f-cancel")?.addEventListener("click",()=>{j(a)}),t.querySelector("#admin-event-form")?.addEventListener("submit",async m=>{m.preventDefault(),await de(a,i)}),ie()}async function de(a,e){const t=a.querySelector(".admin-body");if(!t)return;const i=t.querySelector("#admin-f-title")?.value?.trim(),s=t.querySelector("#admin-f-date")?.value?.trim();if(!i||!s){u("\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u0438 \u0434\u0430\u0442\u0430 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B");return}const r=[];t.querySelectorAll(".admin-tag.selected").forEach(n=>r.push(n.dataset.tag));const d={title:i,date:ee(s),time:t.querySelector("#admin-f-time")?.value?.trim()||"",location:t.querySelector("#admin-f-location")?.value?.trim()||"",address:t.querySelector("#admin-f-address")?.value?.trim()||"",tags:r,short_description:t.querySelector("#admin-f-short-desc")?.value||"",full_description:t.querySelector("#admin-f-full-desc")?.value||"",contacts:t.querySelector("#admin-f-contacts")?.value?.trim()||"",image_url:t.querySelector("#admin-f-image")?.value?.trim()||null,lat:t.querySelector("#admin-f-lat")?.value?parseFloat(t.querySelector("#admin-f-lat").value):null,lon:t.querySelector("#admin-f-lon")?.value?parseFloat(t.querySelector("#admin-f-lon").value):null,is_active:t.querySelector("#admin-f-active")?.classList.contains("active")??!0};if(!e&&(d.id=J(),d.created_by=C.user?.id||null,!d.lat&&d.location))try{const p=(await(await fetch("geocode_cache.json")).json()).find(g=>g.query?.toLowerCase().includes(d.location.toLowerCase()));p&&(d.lat=p.lat,d.lon=p.lon)}catch{}const l=t.querySelector("#admin-f-id")?.value,v=e?l:d.id;try{let n;if(e?n=await f.from("events").update(d).eq("id",v):n=await f.from("events").insert(d),n.error)throw n.error;u(e?"\u2705 \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E":"\u2705 \u0421\u043E\u0437\u0434\u0430\u043D\u043E"),await P(),document.dispatchEvent(new CustomEvent("meow:events-changed")),j(a)}catch(n){console.error("[MEOW] Admin save error:",n),u("\u041E\u0448\u0438\u0431\u043A\u0430: "+(n.message||"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F"))}}export async function openAdminEditPlace(a){const e=A("admin-panel");if(!e)return;e.classList.add("open"),e.setAttribute("aria-hidden","false"),history.pushState({meowAdmin:!0},"");const t=C.rawPlaces?.find(i=>i.id===a);if(t)Z(e,t);else try{const{data:i}=await f.from("places").select("*").eq("id",a).single();i?Z(e,i):(u("\u041C\u0435\u0441\u0442\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E"),closeAdminPanel())}catch{u("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438"),closeAdminPanel()}}function Z(a,e){const t=a.querySelector(".admin-body");if(!t)return;const i=!!e,s=e?.name||"",r=e?.address||"",d=e?.description||"",l=e?.time||"",v=e?.lat??"",n=e?.lng??e?.lon??"",o=e?.image_url||e?.imageUrl||"",p=Array.isArray(e?.keywords)?e.keywords.join(", "):e?.keywords||"",g=e?.is_active!==void 0?e.is_active:!0,x=a.querySelector(".admin-header");x&&(x.innerHTML=`
      <button class="admin-back" id="admin-panel-back-btn" aria-label="\u041D\u0430\u0437\u0430\u0434">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="admin-header-title">${i?"\u270F\uFE0F \u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043C\u0435\u0441\u0442\u043E":"\u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043C\u0435\u0441\u0442\u043E"}</div>
    `,x.querySelector("#admin-panel-back-btn")?.addEventListener("click",()=>{closeAdminPanel()}));const q=i?`<input type="hidden" id="admin-pf-id" value="${c(e.id)}">`:"";t.innerHTML=`
    <form id="admin-place-form" class="admin-form">
      ${q}
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-name">\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 *</label>
        <input class="admin-input" id="admin-pf-name" value="${c(s)}" placeholder="\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043C\u0435\u0441\u0442\u0430" required>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-address">\u0410\u0434\u0440\u0435\u0441</label>
        <input class="admin-input" id="admin-pf-address" value="${c(r)}" placeholder="\u041A\u0430\u0448\u0442\u0430\u043D\u043E\u0432\u0430\u044F \u0430\u043B\u043B\u0435\u044F 1\u0430">
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-time">\u0427\u0430\u0441\u044B \u0440\u0430\u0431\u043E\u0442\u044B</label>
        <input class="admin-input" id="admin-pf-time" value="${c(l)}" placeholder="\u043F\u043D-\u0447\u0442 16:00-00:00...">
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-desc">\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435</label>
        <textarea class="admin-textarea" id="admin-pf-desc" rows="3" placeholder="\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043C\u0435\u0441\u0442\u0430\u2026">${c(d)}</textarea>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-keywords">\u041A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u0441\u043B\u043E\u0432\u0430 (\u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E, \u0434\u043B\u044F \u0441\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0441 \u0441\u043E\u0431\u044B\u0442\u0438\u044F\u043C\u0438)</label>
        <input class="admin-input" id="admin-pf-keywords" value="${c(p)}" placeholder="\u0431\u0430\u0440\u043D, barn">
      </div>
      <div class="admin-field">
        <label class="admin-label">\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435</label>
        <div class="admin-image-row">
          <input class="admin-input" id="admin-pf-image" value="${c(o)}" placeholder="URL \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F">
          <div class="admin-file-upload-wrap">
            <label class="admin-file-btn" for="admin-pf-file">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                <polyline points="17 8 12 3 7 8"/>
                <line x1="12" y1="3" x2="12" y2="15"/>
              </svg>
            </label>
            <input type="file" id="admin-pf-file" accept="image/png,image/jpeg,image/webp" style="display:none">
          </div>
        </div>
        <div id="admin-pf-image-preview" class="admin-image-preview" style="display:none">
          <img id="admin-pf-preview-img" alt="Preview">
          <button type="button" class="admin-preview-remove" id="admin-pf-preview-remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>
      <div class="admin-row-2">
        <div class="admin-field">
          <label class="admin-label" for="admin-pf-lat">\u0428\u0438\u0440\u043E\u0442\u0430 (lat) *</label>
          <input class="admin-input" id="admin-pf-lat" type="number" step="any" value="${v}" placeholder="54.710" required>
        </div>
        <div class="admin-field">
          <label class="admin-label" for="admin-pf-lng">\u0414\u043E\u043B\u0433\u043E\u0442\u0430 (lng) *</label>
          <input class="admin-input" id="admin-pf-lng" type="number" step="any" value="${n}" placeholder="20.467" required>
        </div>
      </div>
      <div class="admin-field">
        <label class="admin-toggle-row">
          <span class="admin-label" style="margin-bottom:0">\u0410\u043A\u0442\u0438\u0432\u043D\u043E</span>
          <div class="toggle ${g?"active":""}" id="admin-pf-active"></div>
        </label>
      </div>
      <div class="admin-actions">
        <button type="button" class="btn-admin-cancel" id="admin-pf-cancel">\u041E\u0442\u043C\u0435\u043D\u0430</button>
        <button type="submit" class="btn-admin-save">
          ${i?"\u{1F4BE} \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C":"\u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C"}
        </button>
      </div>
    </form>
  `,t.querySelector("#admin-pf-active")?.addEventListener("click",L=>{L.currentTarget.classList.toggle("active")});const B=t.querySelector("#admin-pf-file"),$=t.querySelector("#admin-pf-image"),h=t.querySelector("#admin-pf-image-preview"),_=t.querySelector("#admin-pf-preview-img"),T=t.querySelector("#admin-pf-preview-remove");B?.addEventListener("change",async L=>{const E=L.target.files?.[0];if(!E)return;const M=new FileReader;M.onload=b=>{const w=b.target.result;_&&h&&(_.src=w,h.style.display="flex"),$&&($.value=w)},M.readAsDataURL(E);try{const b=`places/${Date.now()}_${E.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`,{error:w}=await f.storage.from("event-images").upload(b,E,{upsert:!0,contentType:E.type});if(w)throw w;const{data:k}=f.storage.from("event-images").getPublicUrl(b);k?.publicUrl&&($&&($.value=k.publicUrl),u("\u2705 \u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E"))}catch(b){console.warn("[MEOW] Place image upload failed, keeping base64:",b.message),u("\u26A0\uFE0F \u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u043A\u0430\u043A base64")}}),T?.addEventListener("click",()=>{h&&(h.style.display="none"),_&&(_.src=""),B&&(B.value=""),$&&($.value="")}),$?.addEventListener("input",()=>{const L=$.value.trim();L&&_&&h?(_.src=L,h.style.display="flex"):h&&(h.style.display="none")}),o&&_&&h&&(_.src=o,h.style.display="flex"),t.querySelector("#admin-pf-cancel")?.addEventListener("click",()=>{closeAdminPanel()}),t.querySelector("#admin-place-form")?.addEventListener("submit",async L=>{L.preventDefault(),await le(a,i)})}async function le(a,e){const t=a.querySelector(".admin-body");if(!t)return;const i=t.querySelector("#admin-pf-name")?.value?.trim(),s=parseFloat(t.querySelector("#admin-pf-lat")?.value),r=parseFloat(t.querySelector("#admin-pf-lng")?.value);if(!i||Number.isNaN(s)||Number.isNaN(r)){u("\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435, \u0448\u0438\u0440\u043E\u0442\u0430 \u0438 \u0434\u043E\u043B\u0433\u043E\u0442\u0430 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B");return}const l=(t.querySelector("#admin-pf-keywords")?.value||"").split(",").map(p=>p.trim()).filter(Boolean),v={name:i,address:t.querySelector("#admin-pf-address")?.value?.trim()||"",description:t.querySelector("#admin-pf-desc")?.value||"",time:t.querySelector("#admin-pf-time")?.value?.trim()||"",lat:s,lng:r,keywords:l,image_url:t.querySelector("#admin-pf-image")?.value?.trim()||null,is_active:t.querySelector("#admin-pf-active")?.classList.contains("active")??!0};e||(v.id="place-"+J());const n=t.querySelector("#admin-pf-id")?.value,o=e?n:v.id;try{let p;if(e?p=await f.from("places").update(v).eq("id",o):p=await f.from("places").insert(v),p.error)throw p.error;u(e?"\u2705 \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E":"\u2705 \u0421\u043E\u0437\u0434\u0430\u043D\u043E");const{loadPlaces:g}=await import("./places.js");await g(),document.dispatchEvent(new CustomEvent("meow:places-changed")),closeAdminPanel()}catch(p){console.error("[MEOW] Place save error:",p),u("\u041E\u0448\u0438\u0431\u043A\u0430: "+(p.message||"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F"))}}async function R(a){if(a){a.innerHTML='<p style="padding:12px 0;color:var(--c-t2);font-size:13px;">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</p>';try{const e=await z("manage-admin",{action:"list"}),t=e.admins||[],i=e.profiles||[],s={};t.forEach(l=>{s[l.user_id]=l});const{count:r}=await f.from("profiles").select("*",{count:"exact",head:!0});let d="";d+=`<div style="margin-bottom:12px">
      <div class="admin-label" style="margin-bottom:8px;font-size:12px">
        \u{1F451} \u0422\u0435\u043A\u0443\u0449\u0438\u0435 \u0430\u0434\u043C\u0438\u043D\u044B (${i.length})
      </div>`,i.length?d+=i.map(l=>{const v=s[l.id]?.role||"admin",n=((l.first_name?.[0]??"")+(l.last_name?.[0]??"")).toUpperCase()||"?",o=l.id===C.user?.id;return`
          <div class="admin-event-row" data-uid="${l.id}">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--c-accent-d);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;color:var(--c-accent)">
              ${n}
            </div>
            <div class="admin-event-info">
              <div class="admin-event-title">${c(l.first_name||"")} ${c(l.last_name||"")}</div>
              <div class="admin-event-date">@${c(l.username||"\u2014")} \xB7 ${v==="super_admin"?"\u2B50 \u0421\u0443\u043F\u0435\u0440-\u0430\u0434\u043C\u0438\u043D":"\u{1F511} \u0410\u0434\u043C\u0438\u043D"}</div>
            </div>
            <div class="admin-event-badges">
              ${o?'<span class="admin-badge active" style="font-size:10px">\u042D\u0442\u043E \u0432\u044B</span>':""}
            </div>
            <div class="admin-event-actions">
              ${o?"":`<button class="btn-admin-sm delete admin-remove-admin" data-uid="${l.id}" title="\u0423\u0431\u0440\u0430\u0442\u044C \u0430\u0434\u043C\u0438\u043D\u0430">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>`}
            </div>
          </div>`}).join(""):d+='<p class="admin-empty">\u041D\u0435\u0442 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044B\u0445 \u0430\u0434\u043C\u0438\u043D\u043E\u0432</p>',d+="</div>",d+=`<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--c-soft-br)">
      <div class="admin-label" style="margin-bottom:8px;font-size:12px">
        \u{1F50D} \u041D\u0430\u0437\u043D\u0430\u0447\u0438\u0442\u044C \u0430\u0434\u043C\u0438\u043D\u0430
      </div>
      <div style="position:relative">
        <input class="admin-input" id="admin-user-search-input"
               placeholder="\u0412\u0432\u0435\u0434\u0438\u0442\u0435 \u0438\u043C\u044F, \u0444\u0430\u043C\u0438\u043B\u0438\u044E \u0438\u043B\u0438 @username..."
               autocomplete="off" style="margin-bottom:4px">
        <div id="admin-user-search-results" style="max-height:240px;overflow-y:auto"></div>
      </div>
      <p style="font-size:11px;color:var(--c-t2);margin-top:6px">
        \u0412\u0441\u0435\u0433\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u0439 \u0432 \u0441\u0435\u0440\u0432\u0438\u0441\u0435: <strong>${r??"\u2014"}</strong>
      </p>
    </div>`,a.innerHTML=d,a.querySelectorAll(".admin-remove-admin").forEach(l=>{l.addEventListener("click",async()=>{const v=l.dataset.uid;if(confirm("\u0423\u0431\u0440\u0430\u0442\u044C \u044D\u0442\u043E\u0433\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0438\u0437 \u0430\u0434\u043C\u0438\u043D\u043E\u0432?"))try{await z("manage-admin",{action:"remove",target_user_id:v}),u("\u2705 \u0410\u0434\u043C\u0438\u043D \u0443\u0434\u0430\u043B\u0451\u043D"),R(a)}catch(n){u("\u041E\u0448\u0438\u0431\u043A\u0430: "+(n.message||n))}})}),re(a)}catch(e){console.error("[MEOW] Admins section error:",e),a.innerHTML='<p style="padding:12px 0;text-align:center;color:var(--c-t2);font-size:13px;">\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438</p>'}}}let K=new Set,Q=null;function re(a){(async()=>{try{const i=await z("manage-admin",{action:"list"});K=new Set((i.admins||[]).map(s=>s.user_id))}catch{}})();const e=a.querySelector("#admin-user-search-input"),t=a.querySelector("#admin-user-search-results");!e||!t||e.addEventListener("input",()=>{clearTimeout(Q);const i=e.value.trim();if(i.length<2){t.innerHTML="";return}Q=setTimeout(()=>{oe(i,t,a)},300)})}async function oe(a,e,t){const i=a.toLowerCase().trim();try{const{data:s,error:r}=await f.from("profiles").select("id, first_name, last_name, username, photo_url").or(`first_name.ilike.%${i}%,last_name.ilike.%${i}%,username.ilike.%${i}%`).limit(20);if(r)throw r;if(!s?.length){e.innerHTML='<p style="padding:8px 0;color:var(--c-t2);font-size:12px">\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E</p>';return}const d=K;e.innerHTML=s.map(l=>{const v=d.has(l.id),n=((l.first_name?.[0]??"")+(l.last_name?.[0]??"")).toUpperCase()||"?";return`
        <div class="admin-event-row" data-uid="${l.id}" style="cursor:pointer;margin-bottom:4px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--c-accent-d);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;color:var(--c-accent)">
            ${n}
          </div>
          <div class="admin-event-info">
            <div class="admin-event-title">${c(l.first_name||"")} ${c(l.last_name||"")}</div>
            <div class="admin-event-date">@${c(l.username||"\u2014")}</div>
          </div>
          <div class="admin-event-badges">
            ${v?'<span class="admin-badge active">\u{1F451} \u0410\u0434\u043C\u0438\u043D</span>':""}
          </div>
          <div class="admin-event-actions">
            ${v?"":`<button class="btn-admin-sm edit admin-promote-btn" data-uid="${l.id}" title="\u0421\u0434\u0435\u043B\u0430\u0442\u044C \u0430\u0434\u043C\u0438\u043D\u043E\u043C" style="width:auto;padding:0 10px;font-size:11px;font-weight:700;color:var(--c-accent)">
                  + \u041D\u0430\u0437\u043D\u0430\u0447\u0438\u0442\u044C
                </button>`}
          </div>
        </div>`}).join(""),e.querySelectorAll(".admin-promote-btn").forEach(l=>{l.addEventListener("click",async v=>{v.stopPropagation();const n=l.dataset.uid;try{await z("manage-admin",{action:"add",target_user_id:n}),u("\u2705 \u0410\u0434\u043C\u0438\u043D \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D");const o=t.querySelector("#admin-user-search-input");o&&(o.value=""),e.innerHTML="",R(t)}catch(o){u("\u041E\u0448\u0438\u0431\u043A\u0430: "+(o.message||o))}})})}catch(s){console.error("[MEOW] User search error:",s),e.innerHTML='<p style="padding:8px 0;color:var(--c-t2);font-size:12px">\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u0438\u0441\u043A\u0430</p>'}}async function F(a){if(a){a.innerHTML='<p style="padding:12px 0;color:var(--c-t2);font-size:13px;">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043E\u0442\u0447\u0451\u0442\u043E\u0432\u2026</p>';try{const{data:e,error:t}=await f.rpc("get_reports_admin");if(t)throw t;if(!e?.length){a.innerHTML='<p class="admin-empty">\u041D\u0435\u0442 \u043E\u0442\u0447\u0451\u0442\u043E\u0432</p>';return}a.innerHTML=e.map(i=>{const s={new:"\u{1F195}",reviewed:"\u{1F441}\uFE0F",resolved:"\u2705"}[i.status]||"",r={bug:"\u{1F41B} \u0411\u0430\u0433",wrong_info:"\u{1F4DD} \u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0438\u043D\u0444\u043E",spam:"\u{1F6AB} \u0421\u043F\u0430\u043C",other:"\u2753 \u0414\u0440\u0443\u0433\u043E\u0435"}[i.type]||i.type,d=i.target_type?`${i.target_type}: ${i.target_id||"\u2014"}`:"";return`
        <div class="admin-report-row" data-report-id="${i.id}">
          <div class="admin-report-head">
            <span class="admin-report-type">${r}</span>
            <span class="admin-report-status" data-status="${i.status}">${s} ${i.status}</span>
          </div>
          <div class="admin-report-text">${c(i.text)}</div>
          <div class="admin-report-meta">
            <span>${c(i.reporter_name||"Anonymous")}</span>
            <span>${me(i.created_at)}</span>
            ${d?`<span>${c(d)}</span>`:""}
          </div>
          <div class="admin-report-actions">
            ${i.status!=="reviewed"?`<button class="btn-admin-sm review" data-id="${i.id}">\u{1F441}\uFE0F \u0420\u0430\u0441\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E</button>`:""}
            ${i.status!=="resolved"?`<button class="btn-admin-sm resolve" data-id="${i.id}">\u2705 \u0420\u0435\u0448\u0435\u043D\u043E</button>`:""}
          </div>
        </div>`}).join(""),a.querySelectorAll(".btn-admin-sm.review").forEach(i=>{i.addEventListener("click",async()=>{try{await f.rpc("update_report_status",{p_report_id:i.dataset.id,p_status:"reviewed"}),u("\u041E\u0442\u043C\u0435\u0447\u0435\u043D\u043E \u043A\u0430\u043A \u0440\u0430\u0441\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E"),F(a)}catch{u("\u041E\u0448\u0438\u0431\u043A\u0430")}})}),a.querySelectorAll(".btn-admin-sm.resolve").forEach(i=>{i.addEventListener("click",async()=>{try{await f.rpc("update_report_status",{p_report_id:i.dataset.id,p_status:"resolved"}),u("\u041E\u0442\u043C\u0435\u0447\u0435\u043D\u043E \u043A\u0430\u043A \u0440\u0435\u0448\u0435\u043D\u043E"),F(a)}catch{u("\u041E\u0448\u0438\u0431\u043A\u0430")}})})}catch(e){console.error("[MEOW] Reports load error:",e),a.innerHTML='<p style="padding:12px 0;color:var(--c-t2);font-size:13px;">\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043E\u0442\u0447\u0451\u0442\u043E\u0432</p>'}}}const ce={"&":"amp;","<":"lt;",">":"gt;",'"':"quot;","'":"#39;"};function c(a){return String(a||"").replace(/[&<>"']/g,e=>ce[e])}function J(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}function me(a){if(!a)return"";const e=new Date(a),t=i=>String(i).padStart(2,"0");return`${t(e.getDate())}.${t(e.getMonth()+1)}.${e.getFullYear()}`}function ue(a){if(!a)return"";const e=t=>String(t).padStart(2,"0");return`${e(a.getDate())}.${e(a.getMonth()+1)}.${a.getFullYear()}`}
