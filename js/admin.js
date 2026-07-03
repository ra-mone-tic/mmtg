import{$ as T}from"./helpers.js?v=bc7b79e2";import{state as L}from"./state.js?v=bc7b79e2";import{supabase as g,callEdge as U}from"./supabase.js?v=bc7b79e2";import"./auth.js";import{showToast as v}from"./toast.js?v=bc7b79e2";import{loadAllEvents as P,normalizeDate as ae,parseDate as Y}from"./data.js?v=bc7b79e2";let B=["\u041A\u043E\u043D\u0446\u0435\u0440\u0442","\u0412\u044B\u0441\u0442\u0430\u0432\u043A\u0430","\u0412\u0435\u0447\u0435\u0440\u0438\u043D\u043A\u0430","\u0424\u0435\u0441\u0442\u0438\u0432\u0430\u043B\u044C","\u041B\u0435\u043A\u0446\u0438\u044F","\u0419\u043E\u0433\u0430","\u0411\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E","\u0421\u043F\u043E\u0440\u0442","\u041A\u0438\u043D\u043E","\u041C\u0430\u0441\u0442\u0435\u0440-\u043A\u043B\u0430\u0441\u0441","\u0422\u0430\u043D\u0446\u044B","\u0422\u0435\u0430\u0442\u0440"];async function ie(){try{const{data:i,error:e}=await g.from("tags").select("name").order("name");if(!e&&i?.length){const t=i.map(a=>a.name).filter(a=>!B.includes(a));B=[...B,...t]}}catch{}}export function openAdminPanel(){const i=T("admin-panel");i&&(i.classList.add("open"),i.setAttribute("aria-hidden","false"),history.pushState({meowAdmin:!0},""),D(i))}export function closeAdminPanel(){const i=T("admin-panel");i&&(i.classList.remove("open"),i.setAttribute("aria-hidden","true"))}export function openAdminCreate(){const i=T("admin-panel");i&&(i.classList.add("open"),i.setAttribute("aria-hidden","false"),H(i,null))}export async function openAdminEdit(i){const e=T("admin-panel");if(!e)return;e.classList.add("open"),e.setAttribute("aria-hidden","false");const t=L.rawAllEvents.find(a=>a.id===i);if(t)H(e,t);else try{const{data:a}=await g.from("events").select("*").eq("id",i).single();a?H(e,a):(v("\u0421\u043E\u0431\u044B\u0442\u0438\u0435 \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E"),closeAdminPanel())}catch{v("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438"),closeAdminPanel()}}async function D(i){const e=i.querySelector(".admin-body");if(e){e.innerHTML='<p style="padding:20px;text-align:center;color:var(--c-t2)">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</p>';try{let t=[];try{const{data:s,error:m}=await g.rpc("get_all_events_admin");if(m)throw m;t=s??[]}catch{t=[...L.rawAllEvents].sort((s,m)=>{const d=Y(s.date)||new Date(0);return(Y(m.date)||new Date(0))-d})}const a=i.querySelector(".admin-header");a&&(a.innerHTML=`
        <button class="admin-back" id="admin-panel-back-btn" aria-label="\u041D\u0430\u0437\u0430\u0434">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="admin-header-title">\u{1F6E1}\uFE0F \u0410\u0434\u043C\u0438\u043D-\u043F\u0430\u043D\u0435\u043B\u044C</div>
      `,a.querySelector("#admin-panel-back-btn")?.addEventListener("click",closeAdminPanel));let l="";l+=`<button class="btn-admin-create" id="btn-admin-create-event">
      \u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435
    </button>`,l+=`<div class="admin-tabs">
      <button class="admin-tab active" data-tab="active">\u0410\u043A\u0442\u0438\u0432\u043D\u044B\u0435 (${t.filter(s=>s.is_active).length})</button>
      <button class="admin-tab" data-tab="inactive">\u041D\u0435\u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0435 (${t.filter(s=>!s.is_active).length})</button>
      <button class="admin-tab" data-tab="reports">\u041E\u0442\u0447\u0451\u0442\u044B</button>
      <button class="admin-tab" data-tab="admins">\u{1F511} \u0410\u0434\u043C\u0438\u043D\u044B</button>
    </div>`,l+='<div id="admin-events-list" class="admin-events-list">',l+=Z(t.filter(s=>s.is_active),"active"),l+='<div id="admin-events-inactive" style="display:none">',l+=Z(t.filter(s=>!s.is_active),"inactive"),l+="</div></div>",l+=`<div id="admin-reports-section" style="display:none">
      <p style="padding:12px 0;color:var(--c-t2);font-size:13px;">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043E\u0442\u0447\u0451\u0442\u043E\u0432\u2026</p>
    </div>`,l+=`<div id="admin-admins-section" style="display:none">
      <p style="padding:12px 0;color:var(--c-t2);font-size:13px;">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</p>
    </div>`,e.innerHTML=l,e.querySelector("#btn-admin-create-event")?.addEventListener("click",()=>{H(i,null)}),e.querySelectorAll(".admin-tab").forEach(s=>{s.addEventListener("click",()=>{e.querySelectorAll(".admin-tab").forEach(d=>d.classList.remove("active")),s.classList.add("active");const m=s.dataset.tab;e.querySelector("#admin-events-list").style.display=m==="reports"||m==="admins"?"none":"",e.querySelector("#admin-events-inactive").style.display=m==="inactive"?"":"none",e.querySelector("#admin-reports-section").style.display=m==="reports"?"":"none",e.querySelector("#admin-admins-section").style.display=m==="admins"?"":"none",m==="reports"&&O(e.querySelector("#admin-reports-section")),m==="admins"&&N(e.querySelector("#admin-admins-section"))})}),ne(e,t)}catch(t){console.error("[MEOW] Admin list error:",t),e.innerHTML='<p style="padding:20px;text-align:center;color:var(--c-t2)">\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438</p>'}}}function Z(i,e){return i.length?i.map(t=>{const a=t.is_active,l=t.date||"\u2014";return`
      <div class="admin-event-row" data-event-id="${t.id}">
        <div class="admin-event-info">
          <div class="admin-event-title">${u(t.title)}</div>
          <div class="admin-event-date">${l}${t.time?" \xB7 "+t.time:""}</div>
        </div>
        <div class="admin-event-badges">
          ${a?'<span class="admin-badge active">\u2713 \u0410\u043A\u0442\u0438\u0432\u043D\u043E</span>':'<span class="admin-badge inactive">\u041D\u0435\u0430\u043A\u0442\u0438\u0432\u043D\u043E</span>'}
        </div>
        <div class="admin-event-actions">
          <button class="btn-admin-sm edit" data-id="${t.id}" title="\u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </button>
          <button class="btn-admin-sm toggle-active" data-id="${t.id}" data-active="${a}" title="${a?"\u0414\u0435\u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u0442\u044C":"\u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u0442\u044C"}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              ${a?'<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>':'<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'}
            </svg>
          </button>
          <button class="btn-admin-sm delete" data-id="${t.id}" title="\u0423\u0434\u0430\u043B\u0438\u0442\u044C">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
            </svg>
          </button>
        </div>
      </div>`}).join(""):`<p class="admin-empty">\u041D\u0435\u0442 ${e==="inactive"?"\u043D\u0435\u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445":""} \u0441\u043E\u0431\u044B\u0442\u0438\u0439</p>`}function ne(i){i.querySelectorAll(".btn-admin-sm.edit").forEach(e=>{e.addEventListener("click",t=>{t.stopPropagation(),H(T("admin-panel"),L.rawAllEvents.find(a=>a.id===e.dataset.id))})}),i.querySelectorAll(".btn-admin-sm.toggle-active").forEach(e=>{e.addEventListener("click",async t=>{t.stopPropagation();const a=e.dataset.id,l=e.dataset.active==="true";try{const{error:s}=await g.from("events").update({is_active:!l}).eq("id",a);if(s)throw s;v(l?"\u0414\u0435\u0430\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D\u043E":"\u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u043D\u043E"),await P(),D(T("admin-panel"))}catch(s){v("\u041E\u0448\u0438\u0431\u043A\u0430: "+(s.message||s))}})}),i.querySelectorAll(".btn-admin-sm.delete").forEach(e=>{e.addEventListener("click",async t=>{t.stopPropagation();const a=e.dataset.id;if(confirm(`\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435 \u043D\u0430\u0432\u0441\u0435\u0433\u0434\u0430? \u042D\u0442\u043E \u043D\u0435\u043B\u044C\u0437\u044F \u043E\u0442\u043C\u0435\u043D\u0438\u0442\u044C.

\u0415\u0441\u043B\u0438 \u0438\u0441\u0445\u043E\u0434\u043D\u044B\u0439 \u043F\u043E\u0441\u0442 \u0432\u0441\u0451 \u0435\u0449\u0451 \u0435\u0441\u0442\u044C \u0432 Telegram-\u043A\u0430\u043D\u0430\u043B\u0435, \u043F\u0440\u0438 \u0441\u043B\u0435\u0434\u0443\u044E\u0449\u0435\u0439 \u0441\u0438\u043D\u0445\u0440\u043E\u043D\u0438\u0437\u0430\u0446\u0438\u0438 \u0441\u043E\u0431\u044B\u0442\u0438\u0435 \u043C\u043E\u0436\u0435\u0442 \u0431\u044B\u0442\u044C \u0441\u043E\u0437\u0434\u0430\u043D\u043E \u0437\u0430\u043D\u043E\u0432\u043E (\u044D\u0442\u043E \u0440\u0430\u0437\u043D\u044B\u0435 \u043C\u0435\u0445\u0430\u043D\u0438\u0437\u043C\u044B).`))try{const{error:l}=await g.from("events").delete().eq("id",a);if(l)throw l;v("\u0423\u0434\u0430\u043B\u0435\u043D\u043E"),await P(),document.dispatchEvent(new CustomEvent("meow:events-changed")),D(T("admin-panel"))}catch(l){v("\u041E\u0448\u0438\u0431\u043A\u0430: "+(l.message||l))}})})}let K=null;function se(){const i=document.getElementById("admin-f-location"),e=document.getElementById("admin-location-suggestions");!i||!e||(i.addEventListener("input",()=>{clearTimeout(K);const t=i.value.trim();if(t.length<2){e.innerHTML="",e.classList.remove("open");return}K=setTimeout(()=>{de(t,e,i)},250)}),i.addEventListener("blur",()=>{setTimeout(()=>{e.classList.remove("open")},200)}),e.addEventListener("mousedown",t=>t.preventDefault()))}function de(i,e,t){const a=i.toLowerCase().trim(),l=(L.rawPlaces||[]).filter(n=>{const r=(n.name||"").toLowerCase(),p=(n.address||"").toLowerCase(),y=(n.keywords||[]).join(" ").toLowerCase();return r.includes(a)||p.includes(a)||y.includes(a)});let s=[];try{window._geocodeCache&&(s=Object.keys(window._geocodeCache).filter(n=>n.toLowerCase().includes(a)).map(n=>({_cacheKey:n,name:n,lat:window._geocodeCache[n]?.[0],lon:window._geocodeCache[n]?.[1]})))}catch{}const m=[...l.map(n=>({type:"place",data:n})),...s.map(n=>({type:"cache",data:n}))];if(!m.length){e.innerHTML="",e.classList.remove("open");return}const d=new Set,c=[];for(const n of m){const r=(n.type==="place",n.data.name);d.has(r.toLowerCase())||(d.add(r.toLowerCase()),c.push(n))}e.innerHTML=c.slice(0,10).map(n=>{if(n.type==="place"){const r=n.data;return`<div class="admin-sug-item" data-type="place" data-place-id="${r.id}">
        <div class="admin-sug-icon">\u{1F4CD}</div>
        <div class="admin-sug-text">${u(r.name)}</div>
        <div class="admin-sug-sub">${u(r.address||"")}</div>
      </div>`}else{const r=n.data;return`<div class="admin-sug-item" data-type="cache" data-lat="${r.lat}" data-lon="${r.lon}">
        <div class="admin-sug-icon">\u{1F5FA}\uFE0F</div>
        <div class="admin-sug-text">${u(r.name)}</div>
      </div>`}}).join(""),e.classList.add("open"),e.querySelectorAll(".admin-sug-item").forEach(n=>{n.addEventListener("click",()=>{const r=n.dataset.type;if(r==="place"){const p=n.dataset.placeId,y=L.rawPlaces.find(f=>f.id===p);if(y){document.getElementById("admin-f-location").value=y.name,document.getElementById("admin-f-address").value=y.address||"";const f=document.getElementById("admin-f-lat"),w=document.getElementById("admin-f-lon");f&&(f.value=y.lat??""),w&&(w.value=y.lng??y.lon??"")}}else if(r==="cache"){const p=document.getElementById("admin-f-location"),y=document.getElementById("admin-f-address"),f=document.getElementById("admin-f-lat"),w=document.getElementById("admin-f-lon");p&&(p.value=n.querySelector(".admin-sug-text")?.textContent||""),y&&(y.value=n.querySelector(".admin-sug-text")?.textContent||""),f&&(f.value=n.dataset.lat||""),w&&(w.value=n.dataset.lon||"")}e.classList.remove("open")})})}async function le(){if(!window._geocodeCache)try{const i=await fetch("geocode_cache.json?"+Date.now());window._geocodeCache=await i.json()}catch{window._geocodeCache={}}}async function H(i,e){const t=i.querySelector(".admin-body");if(!t)return;ie(),le();const a=!!e,l=e?.title||"",s=e?.location||"",m=e?.address||"",d=Array.isArray(e?.tags)?e.tags:typeof e?.tags=="string"?e.tags.split(",").map(o=>o.trim()).filter(Boolean):[],c=e?.short_description||"",n=e?.full_description||"",r=e?.contacts||"",p=e?.lat??"",y=e?.lon??"",f=e?.image_url||e?.imageUrl||"",w=e?.is_active!==void 0?e.is_active:!0;let E=[];if(a&&e?.multi_day_group_id)try{const{data:o}=await g.from("events").select("id, date, time").eq("multi_day_group_id",e.multi_day_group_id).order("date");o?.length&&(E=o.map(b=>({date:b.date,time:b.time||""})))}catch{}E.length||(E=[{date:e?.date||ve(new Date),time:e?.time||""}]);const S=i.querySelector(".admin-header");S&&(S.innerHTML=`
      <button class="admin-back" id="admin-panel-back-btn" aria-label="\u041D\u0430\u0437\u0430\u0434">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="admin-header-title">${a?"\u270F\uFE0F \u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C":"\u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435"}</div>
    `,S.querySelector("#admin-panel-back-btn")?.addEventListener("click",()=>{D(i)}));const $=a?`<input type="hidden" id="admin-f-id" value="${u(e.id)}">`:"";t.innerHTML=`
    <form id="admin-event-form" class="admin-form">
      ${$}
      <div class="admin-field">
        <label class="admin-label" for="admin-f-title">\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 *</label>
        <input class="admin-input" id="admin-f-title" value="${u(l)}" placeholder="\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u044F" required>
      </div>
      <div class="admin-field">
        <label class="admin-label">\u0414\u0430\u0442\u044B \u043F\u0440\u043E\u0432\u0435\u0434\u0435\u043D\u0438\u044F *</label>
        <div id="admin-f-dates-list" class="admin-dates-list">
          ${E.map((o,b)=>`
            <div class="admin-date-row">
              <input class="admin-input admin-date-input" value="${u(o.date)}" placeholder="01.01.2026" required>
              <input class="admin-input admin-time-input" value="${u(o.time)}" placeholder="19:00">
              ${b>0?`<button type="button" class="btn-admin-remove-date" title="\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0434\u0430\u0442\u0443">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>`:""}
            </div>
          `).join("")}
        </div>
        <button type="button" class="btn-admin-add-date" id="btn-admin-add-date">\u2795 \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0434\u0430\u0442\u0443</button>
      </div>
      <div class="admin-field" style="position:relative">
        <label class="admin-label" for="admin-f-location">\u041C\u0435\u0441\u0442\u043E / \u041B\u043E\u043A\u0430\u0446\u0438\u044F
          <span style="font-weight:400;text-transform:none;letter-spacing:0;color:var(--c-t2)">(\u0432\u0432\u0435\u0434\u0438\u0442\u0435 \u0434\u043B\u044F \u043F\u043E\u0434\u0441\u043A\u0430\u0437\u043E\u043A)</span>
        </label>
        <input class="admin-input" id="admin-f-location" value="${u(s)}" placeholder="\u0411\u0430\u0440\u043D, \u041A\u0430\u0448\u0442\u0430\u043D\u043E\u0432\u0430\u044F \u0430\u043B\u043B\u0435\u044F 1\u0430" autocomplete="off">
        <div class="admin-location-suggestions" id="admin-location-suggestions"></div>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-address">\u0410\u0434\u0440\u0435\u0441</label>
        <input class="admin-input" id="admin-f-address" value="${u(m)}" placeholder="\u041A\u0430\u0448\u0442\u0430\u043D\u043E\u0432\u0430\u044F \u0430\u043B\u043B\u0435\u044F 1\u0430, \u041A\u0430\u043B\u0438\u043D\u0438\u043D\u0433\u0440\u0430\u0434">
      </div>
      <div class="admin-field">
        <label class="admin-label">\u0422\u0435\u0433\u0438</label>
        <div class="admin-tags" id="admin-f-tags">
          ${B.map(o=>`<button type="button" class="admin-tag ${d.includes(o)?"selected":""}" data-tag="${u(o)}">${u(o)}</button>`).join("")}
        </div>
        <div class="admin-tag-add-row">
          <input class="admin-input admin-tag-input" id="admin-f-new-tag" placeholder="\u041D\u043E\u0432\u044B\u0439 \u0442\u0435\u0433..." autocomplete="off">
          <button type="button" class="admin-tag-add-btn" id="admin-f-tag-add">\u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C</button>
        </div>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-short-desc">\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435</label>
        <textarea class="admin-textarea" id="admin-f-short-desc" rows="3" placeholder="\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435\u2026">${u(c)}</textarea>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-full-desc">\u041F\u043E\u043B\u043D\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435</label>
        <textarea class="admin-textarea" id="admin-f-full-desc" rows="6" placeholder="\u041F\u043E\u043B\u043D\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435\u2026">${u(n)}</textarea>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-f-contacts">\u041A\u043E\u043D\u0442\u0430\u043A\u0442\u044B (URL \u0438\u043B\u0438 @username)</label>
        <input class="admin-input" id="admin-f-contacts" value="${u(r)}" placeholder="https://t.me/...">
      </div>
      <div class="admin-field">
        <label class="admin-label">\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435</label>
        <div class="admin-image-row">
          <input class="admin-input" id="admin-f-image" value="${u(f)}" placeholder="URL \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F (https://... \u0438\u043B\u0438 images/...)">
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
          <input class="admin-input" id="admin-f-lat" type="number" step="any" value="${p}" placeholder="54.710">
        </div>
        <div class="admin-field">
          <label class="admin-label" for="admin-f-lon">\u0414\u043E\u043B\u0433\u043E\u0442\u0430 (lon)</label>
          <input class="admin-input" id="admin-f-lon" type="number" step="any" value="${y}" placeholder="20.467">
        </div>
      </div>
      <div class="admin-field">
        <label class="admin-toggle-row">
          <span class="admin-label" style="margin-bottom:0">\u0410\u043A\u0442\u0438\u0432\u043D\u043E</span>
          <div class="toggle ${w?"active":""}" id="admin-f-active"></div>
        </label>
      </div>
      <div class="admin-actions">
        <button type="button" class="btn-admin-cancel" id="admin-f-cancel">\u041E\u0442\u043C\u0435\u043D\u0430</button>
        <button type="submit" class="btn-admin-save">
          ${a?"\u{1F4BE} \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C":"\u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C"}
        </button>
      </div>
    </form>
  `,t.querySelectorAll(".admin-tag").forEach(o=>{o.addEventListener("click",b=>{b.preventDefault(),o.classList.toggle("selected")})});const x=t.querySelector("#admin-f-new-tag"),R=t.querySelector("#admin-f-tag-add");function q(){const o=x?.value?.trim();if(!o)return;const b=t.querySelector(`.admin-tag[data-tag="${u(o)}"]`);if(b){b.classList.add("selected"),x.value="";return}const j=t.querySelector("#admin-f-tags"),h=document.createElement("button");h.type="button",h.className="admin-tag selected",h.dataset.tag=o,h.textContent=o,h.addEventListener("click",I=>{I.preventDefault(),h.classList.toggle("selected")}),j.appendChild(h),x.value="",B.includes(o)||(B.push(o),g.from("tags").upsert({name:o},{onConflict:"name"}).catch(()=>{}))}R?.addEventListener("click",q),x?.addEventListener("keydown",o=>{o.key==="Enter"&&(o.preventDefault(),q())});const C=t.querySelector("#admin-f-dates-list");t.querySelector("#btn-admin-add-date")?.addEventListener("click",()=>{const o=document.createElement("div");o.className="admin-date-row",o.innerHTML=`
      <input class="admin-input admin-date-input" placeholder="01.01.2026" required>
      <input class="admin-input admin-time-input" placeholder="19:00">
      <button type="button" class="btn-admin-remove-date" title="\u0423\u0434\u0430\u043B\u0438\u0442\u044C \u0434\u0430\u0442\u0443">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    `,o.querySelector(".btn-admin-remove-date")?.addEventListener("click",()=>{o.remove()}),C?.appendChild(o)}),C?.querySelectorAll(".btn-admin-remove-date").forEach(o=>{o.addEventListener("click",()=>{o.closest(".admin-date-row")?.remove()})}),t.querySelector("#admin-f-active")?.addEventListener("click",o=>{o.currentTarget.classList.toggle("active")});const A=t.querySelector("#admin-f-file"),_=t.querySelector("#admin-f-image"),k=t.querySelector("#admin-image-preview"),M=t.querySelector("#admin-preview-img"),te=t.querySelector("#admin-preview-remove");let W="";A?.addEventListener("change",async o=>{const b=o.target.files?.[0];if(!b)return;const j=new FileReader;j.onload=h=>{const I=h.target.result;W=I,M&&k&&(M.src=I,k.style.display="flex"),_&&(_.value=I)},j.readAsDataURL(b);try{const h=`events/${Date.now()}_${b.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`,{data:I,error:G}=await g.storage.from("event-images").upload(h,b,{upsert:!0,contentType:b.type});if(G)throw G;const{data:V}=g.storage.from("event-images").getPublicUrl(h);V?.publicUrl&&(_&&(_.value=V.publicUrl),W="",v("\u2705 \u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E"))}catch(h){console.warn("[MEOW] Supabase Storage upload failed, keeping base64:",h.message),h.message?.includes("bucket")||h.message?.includes("not found")?v("\u26A0\uFE0F \u0411\u0430\u043A\u0435\u0442 event-images \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D. \u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u043C\u0438\u0433\u0440\u0430\u0446\u0438\u044E SQL."):v("\u26A0\uFE0F \u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u043A\u0430\u043A base64 (\u0431\u0443\u0434\u0435\u0442 \u0432 \u0434\u0430\u043D\u043D\u044B\u0445 \u0441\u043E\u0431\u044B\u0442\u0438\u044F)")}}),te?.addEventListener("click",()=>{k&&(k.style.display="none"),M&&(M.src=""),A&&(A.value=""),_&&(_.value="")}),_?.addEventListener("input",()=>{const o=_.value.trim();o&&M&&k?(M.src=o,k.style.display="flex"):k&&(k.style.display="none")}),t.querySelector("#admin-f-cancel")?.addEventListener("click",()=>{D(i)}),t.querySelector("#admin-event-form")?.addEventListener("submit",async o=>{o.preventDefault(),await re(i,a)}),se()}function F(i,e){const t=`${i}|${e}`;let a=0;for(let s=0;s<t.length;s++){const m=t.charCodeAt(s);a=(a<<5)-a+m,a|=0}return(a>>>0).toString(16).padStart(12,"0").slice(0,12)}async function re(i,e){const t=i.querySelector(".admin-body");if(!t)return;const a=t.querySelector("#admin-f-title")?.value?.trim();if(!a){v("\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u043E");return}const l=t.querySelectorAll("#admin-f-dates-list .admin-date-row");if(!l.length){v("\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0445\u043E\u0442\u044F \u0431\u044B \u043E\u0434\u043D\u0443 \u0434\u0430\u0442\u0443");return}const s=[];for(const c of l){const n=c.querySelector(".admin-date-input")?.value?.trim();if(!n){v("\u0417\u0430\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u0432\u0441\u0435 \u0434\u0430\u0442\u044B");return}const r=ae(n);if(!r){v(`\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u0430\u044F \u0434\u0430\u0442\u0430: ${n}`);return}s.push({date:r,time:c.querySelector(".admin-time-input")?.value?.trim()||""})}const m=[];t.querySelectorAll(".admin-tag.selected").forEach(c=>m.push(c.dataset.tag));const d={title:a,location:t.querySelector("#admin-f-location")?.value?.trim()||"",address:t.querySelector("#admin-f-address")?.value?.trim()||"",tags:m,short_description:t.querySelector("#admin-f-short-desc")?.value||"",full_description:t.querySelector("#admin-f-full-desc")?.value||"",contacts:t.querySelector("#admin-f-contacts")?.value?.trim()||"",image_url:t.querySelector("#admin-f-image")?.value?.trim()||null,lat:t.querySelector("#admin-f-lat")?.value?parseFloat(t.querySelector("#admin-f-lat").value):null,lon:t.querySelector("#admin-f-lon")?.value?parseFloat(t.querySelector("#admin-f-lon").value):null,is_active:t.querySelector("#admin-f-active")?.classList.contains("active")??!0};if(!d.lat&&d.location)try{const n=await(await fetch("geocode_cache.json")).json(),r=Object.entries(n).find(([p])=>p.toLowerCase().includes(d.location.toLowerCase()));r&&(d.lat=r[1]?.[0]??null,d.lon=r[1]?.[1]??null)}catch{}try{if(e){const c=t.querySelector("#admin-f-id")?.value,n=L.rawAllEvents.find(f=>f.id===c),r=n?.multi_day_group_id||c;let p=[];if(n?.multi_day_group_id){const{data:f}=await g.from("events").select("id, date").eq("multi_day_group_id",n.multi_day_group_id);p=f||[]}else p=[{id:c}];const y=new Set(p.map(f=>f.date));for(const f of p){const w=s.find(E=>E.date===f.date);w?await g.from("events").update({...d,date:w.date,time:w.time,multi_day_group_id:r}).eq("id",f.id):await g.from("events").delete().eq("id",f.id)}for(const f of s)if(!y.has(f.date)){const w=F(f.date,a);await g.from("events").insert({...d,id:w,date:f.date,time:f.time,multi_day_group_id:r,created_by:n?.created_by||L.user?.id||null})}}else if(s.length===1){const c=F(s[0].date,a),{error:n}=await g.from("events").insert({...d,id:c,date:s[0].date,time:s[0].time,created_by:L.user?.id||null});if(n)throw n}else{const c=ee();for(const n of s){const r=F(n.date,a),{error:p}=await g.from("events").insert({...d,id:r,date:n.date,time:n.time,multi_day_group_id:c,created_by:L.user?.id||null});if(p)throw p}}v(e?"\u2705 \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E":"\u2705 \u0421\u043E\u0437\u0434\u0430\u043D\u043E"),await P(),document.dispatchEvent(new CustomEvent("meow:events-changed")),D(i)}catch(c){console.error("[MEOW] Admin save error:",c),v("\u041E\u0448\u0438\u0431\u043A\u0430: "+(c.message||"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F"))}}export async function openAdminEditPlace(i){const e=T("admin-panel");if(!e)return;e.classList.add("open"),e.setAttribute("aria-hidden","false"),history.pushState({meowAdmin:!0},"");const t=L.rawPlaces?.find(a=>a.id===i);if(t)Q(e,t);else try{const{data:a}=await g.from("places").select("*").eq("id",i).single();a?Q(e,a):(v("\u041C\u0435\u0441\u0442\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E"),closeAdminPanel())}catch{v("\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438"),closeAdminPanel()}}function Q(i,e){const t=i.querySelector(".admin-body");if(!t)return;const a=!!e,l=e?.name||"",s=e?.address||"",m=e?.description||"",d=e?.time||"",c=e?.lat??"",n=e?.lng??e?.lon??"",r=e?.image_url||e?.imageUrl||"",p=Array.isArray(e?.keywords)?e.keywords.join(", "):e?.keywords||"",y=e?.is_active!==void 0?e.is_active:!0,f=i.querySelector(".admin-header");f&&(f.innerHTML=`
      <button class="admin-back" id="admin-panel-back-btn" aria-label="\u041D\u0430\u0437\u0430\u0434">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
      </button>
      <div class="admin-header-title">${a?"\u270F\uFE0F \u0420\u0435\u0434\u0430\u043A\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u043C\u0435\u0441\u0442\u043E":"\u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043C\u0435\u0441\u0442\u043E"}</div>
    `,f.querySelector("#admin-panel-back-btn")?.addEventListener("click",()=>{closeAdminPanel()}));const w=a?`<input type="hidden" id="admin-pf-id" value="${u(e.id)}">`:"";t.innerHTML=`
    <form id="admin-place-form" class="admin-form">
      ${w}
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-name">\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 *</label>
        <input class="admin-input" id="admin-pf-name" value="${u(l)}" placeholder="\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435 \u043C\u0435\u0441\u0442\u0430" required>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-address">\u0410\u0434\u0440\u0435\u0441</label>
        <input class="admin-input" id="admin-pf-address" value="${u(s)}" placeholder="\u041A\u0430\u0448\u0442\u0430\u043D\u043E\u0432\u0430\u044F \u0430\u043B\u043B\u0435\u044F 1\u0430">
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-time">\u0427\u0430\u0441\u044B \u0440\u0430\u0431\u043E\u0442\u044B</label>
        <input class="admin-input" id="admin-pf-time" value="${u(d)}" placeholder="\u043F\u043D-\u0447\u0442 16:00-00:00...">
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-desc">\u041E\u043F\u0438\u0441\u0430\u043D\u0438\u0435</label>
        <textarea class="admin-textarea" id="admin-pf-desc" rows="3" placeholder="\u041A\u0440\u0430\u0442\u043A\u043E\u0435 \u043E\u043F\u0438\u0441\u0430\u043D\u0438\u0435 \u043C\u0435\u0441\u0442\u0430\u2026">${u(m)}</textarea>
      </div>
      <div class="admin-field">
        <label class="admin-label" for="admin-pf-keywords">\u041A\u043B\u044E\u0447\u0435\u0432\u044B\u0435 \u0441\u043B\u043E\u0432\u0430 (\u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E, \u0434\u043B\u044F \u0441\u043E\u043F\u043E\u0441\u0442\u0430\u0432\u043B\u0435\u043D\u0438\u044F \u0441 \u0441\u043E\u0431\u044B\u0442\u0438\u044F\u043C\u0438)</label>
        <input class="admin-input" id="admin-pf-keywords" value="${u(p)}" placeholder="\u0431\u0430\u0440\u043D, barn">
      </div>
      <div class="admin-field">
        <label class="admin-label">\u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435</label>
        <div class="admin-image-row">
          <input class="admin-input" id="admin-pf-image" value="${u(r)}" placeholder="URL \u0438\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u044F">
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
          <input class="admin-input" id="admin-pf-lat" type="number" step="any" value="${c}" placeholder="54.710" required>
        </div>
        <div class="admin-field">
          <label class="admin-label" for="admin-pf-lng">\u0414\u043E\u043B\u0433\u043E\u0442\u0430 (lng) *</label>
          <input class="admin-input" id="admin-pf-lng" type="number" step="any" value="${n}" placeholder="20.467" required>
        </div>
      </div>
      <div class="admin-field">
        <label class="admin-toggle-row">
          <span class="admin-label" style="margin-bottom:0">\u0410\u043A\u0442\u0438\u0432\u043D\u043E</span>
          <div class="toggle ${y?"active":""}" id="admin-pf-active"></div>
        </label>
      </div>
      <div class="admin-actions">
        <button type="button" class="btn-admin-cancel" id="admin-pf-cancel">\u041E\u0442\u043C\u0435\u043D\u0430</button>
        <button type="submit" class="btn-admin-save">
          ${a?"\u{1F4BE} \u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C":"\u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C"}
        </button>
      </div>
    </form>
  `,t.querySelector("#admin-pf-active")?.addEventListener("click",q=>{q.currentTarget.classList.toggle("active")});const E=t.querySelector("#admin-pf-file"),S=t.querySelector("#admin-pf-image"),$=t.querySelector("#admin-pf-image-preview"),x=t.querySelector("#admin-pf-preview-img"),R=t.querySelector("#admin-pf-preview-remove");E?.addEventListener("change",async q=>{const C=q.target.files?.[0];if(!C)return;const z=new FileReader;z.onload=A=>{const _=A.target.result;x&&$&&(x.src=_,$.style.display="flex"),S&&(S.value=_)},z.readAsDataURL(C);try{const A=`places/${Date.now()}_${C.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`,{error:_}=await g.storage.from("event-images").upload(A,C,{upsert:!0,contentType:C.type});if(_)throw _;const{data:k}=g.storage.from("event-images").getPublicUrl(A);k?.publicUrl&&(S&&(S.value=k.publicUrl),v("\u2705 \u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0437\u0430\u0433\u0440\u0443\u0436\u0435\u043D\u043E"))}catch(A){console.warn("[MEOW] Place image upload failed, keeping base64:",A.message),v("\u26A0\uFE0F \u0418\u0437\u043E\u0431\u0440\u0430\u0436\u0435\u043D\u0438\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E \u043A\u0430\u043A base64")}}),R?.addEventListener("click",()=>{$&&($.style.display="none"),x&&(x.src=""),E&&(E.value=""),S&&(S.value="")}),S?.addEventListener("input",()=>{const q=S.value.trim();q&&x&&$?(x.src=q,$.style.display="flex"):$&&($.style.display="none")}),r&&x&&$&&(x.src=r,$.style.display="flex"),t.querySelector("#admin-pf-cancel")?.addEventListener("click",()=>{closeAdminPanel()}),t.querySelector("#admin-place-form")?.addEventListener("submit",async q=>{q.preventDefault(),await oe(i,a)})}async function oe(i,e){const t=i.querySelector(".admin-body");if(!t)return;const a=t.querySelector("#admin-pf-name")?.value?.trim(),l=parseFloat(t.querySelector("#admin-pf-lat")?.value),s=parseFloat(t.querySelector("#admin-pf-lng")?.value);if(!a||Number.isNaN(l)||Number.isNaN(s)){v("\u041D\u0430\u0437\u0432\u0430\u043D\u0438\u0435, \u0448\u0438\u0440\u043E\u0442\u0430 \u0438 \u0434\u043E\u043B\u0433\u043E\u0442\u0430 \u043E\u0431\u044F\u0437\u0430\u0442\u0435\u043B\u044C\u043D\u044B");return}const d=(t.querySelector("#admin-pf-keywords")?.value||"").split(",").map(p=>p.trim()).filter(Boolean),c={name:a,address:t.querySelector("#admin-pf-address")?.value?.trim()||"",description:t.querySelector("#admin-pf-desc")?.value||"",time:t.querySelector("#admin-pf-time")?.value?.trim()||"",lat:l,lng:s,keywords:d,image_url:t.querySelector("#admin-pf-image")?.value?.trim()||null,is_active:t.querySelector("#admin-pf-active")?.classList.contains("active")??!0};e||(c.id="place-"+ee());const n=t.querySelector("#admin-pf-id")?.value,r=e?n:c.id;try{let p;if(e?p=await g.from("places").update(c).eq("id",r):p=await g.from("places").insert(c),p.error)throw p.error;v(e?"\u2705 \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E":"\u2705 \u0421\u043E\u0437\u0434\u0430\u043D\u043E");const{loadPlaces:y}=await import("./places.js");await y(),document.dispatchEvent(new CustomEvent("meow:places-changed")),closeAdminPanel()}catch(p){console.error("[MEOW] Place save error:",p),v("\u041E\u0448\u0438\u0431\u043A\u0430: "+(p.message||"\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F"))}}async function N(i){if(i){i.innerHTML='<p style="padding:12px 0;color:var(--c-t2);font-size:13px;">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</p>';try{const e=await U("manage-admin",{action:"list"}),t=e.admins||[],a=e.profiles||[],l={};t.forEach(d=>{l[d.user_id]=d});const{count:s}=await g.from("profiles").select("*",{count:"exact",head:!0});let m="";m+=`<div style="margin-bottom:12px">
      <div class="admin-label" style="margin-bottom:8px;font-size:12px">
        \u{1F451} \u0422\u0435\u043A\u0443\u0449\u0438\u0435 \u0430\u0434\u043C\u0438\u043D\u044B (${a.length})
      </div>`,a.length?m+=a.map(d=>{const c=l[d.id]?.role||"admin",n=((d.first_name?.[0]??"")+(d.last_name?.[0]??"")).toUpperCase()||"?",r=d.id===L.user?.id;return`
          <div class="admin-event-row" data-uid="${d.id}">
            <div style="width:34px;height:34px;border-radius:50%;background:var(--c-accent-d);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;flex-shrink:0;color:var(--c-accent)">
              ${n}
            </div>
            <div class="admin-event-info">
              <div class="admin-event-title">${u(d.first_name||"")} ${u(d.last_name||"")}</div>
              <div class="admin-event-date">@${u(d.username||"\u2014")} \xB7 ${c==="super_admin"?"\u2B50 \u0421\u0443\u043F\u0435\u0440-\u0430\u0434\u043C\u0438\u043D":"\u{1F511} \u0410\u0434\u043C\u0438\u043D"}</div>
            </div>
            <div class="admin-event-badges">
              ${r?'<span class="admin-badge active" style="font-size:10px">\u042D\u0442\u043E \u0432\u044B</span>':""}
            </div>
            <div class="admin-event-actions">
              ${r?"":`<button class="btn-admin-sm delete admin-remove-admin" data-uid="${d.id}" title="\u0423\u0431\u0440\u0430\u0442\u044C \u0430\u0434\u043C\u0438\u043D\u0430">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>`}
            </div>
          </div>`}).join(""):m+='<p class="admin-empty">\u041D\u0435\u0442 \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D\u043D\u044B\u0445 \u0430\u0434\u043C\u0438\u043D\u043E\u0432</p>',m+="</div>",m+=`<div style="margin-top:16px;padding-top:14px;border-top:1px solid var(--c-soft-br)">
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
        \u0412\u0441\u0435\u0433\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u0435\u0439 \u0432 \u0441\u0435\u0440\u0432\u0438\u0441\u0435: <strong>${s??"\u2014"}</strong>
      </p>
    </div>`,i.innerHTML=m,i.querySelectorAll(".admin-remove-admin").forEach(d=>{d.addEventListener("click",async()=>{const c=d.dataset.uid;if(confirm("\u0423\u0431\u0440\u0430\u0442\u044C \u044D\u0442\u043E\u0433\u043E \u043F\u043E\u043B\u044C\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044F \u0438\u0437 \u0430\u0434\u043C\u0438\u043D\u043E\u0432?"))try{await U("manage-admin",{action:"remove",target_user_id:c}),v("\u2705 \u0410\u0434\u043C\u0438\u043D \u0443\u0434\u0430\u043B\u0451\u043D"),N(i)}catch(n){v("\u041E\u0448\u0438\u0431\u043A\u0430: "+(n.message||n))}})}),ce(i)}catch(e){console.error("[MEOW] Admins section error:",e),i.innerHTML='<p style="padding:12px 0;text-align:center;color:var(--c-t2);font-size:13px;">\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438</p>'}}}let J=new Set,X=null;function ce(i){(async()=>{try{const a=await U("manage-admin",{action:"list"});J=new Set((a.admins||[]).map(l=>l.user_id))}catch{}})();const e=i.querySelector("#admin-user-search-input"),t=i.querySelector("#admin-user-search-results");!e||!t||e.addEventListener("input",()=>{clearTimeout(X);const a=e.value.trim();if(a.length<2){t.innerHTML="";return}X=setTimeout(()=>{me(a,t,i)},300)})}async function me(i,e,t){const a=i.toLowerCase().trim();try{const{data:l,error:s}=await g.from("profiles").select("id, first_name, last_name, username, photo_url").or(`first_name.ilike.%${a}%,last_name.ilike.%${a}%,username.ilike.%${a}%`).limit(20);if(s)throw s;if(!l?.length){e.innerHTML='<p style="padding:8px 0;color:var(--c-t2);font-size:12px">\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E</p>';return}const m=J;e.innerHTML=l.map(d=>{const c=m.has(d.id),n=((d.first_name?.[0]??"")+(d.last_name?.[0]??"")).toUpperCase()||"?";return`
        <div class="admin-event-row" data-uid="${d.id}" style="cursor:pointer;margin-bottom:4px">
          <div style="width:32px;height:32px;border-radius:50%;background:var(--c-accent-d);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;flex-shrink:0;color:var(--c-accent)">
            ${n}
          </div>
          <div class="admin-event-info">
            <div class="admin-event-title">${u(d.first_name||"")} ${u(d.last_name||"")}</div>
            <div class="admin-event-date">@${u(d.username||"\u2014")}</div>
          </div>
          <div class="admin-event-badges">
            ${c?'<span class="admin-badge active">\u{1F451} \u0410\u0434\u043C\u0438\u043D</span>':""}
          </div>
          <div class="admin-event-actions">
            ${c?"":`<button class="btn-admin-sm edit admin-promote-btn" data-uid="${d.id}" title="\u0421\u0434\u0435\u043B\u0430\u0442\u044C \u0430\u0434\u043C\u0438\u043D\u043E\u043C" style="width:auto;padding:0 10px;font-size:11px;font-weight:700;color:var(--c-accent)">
                  + \u041D\u0430\u0437\u043D\u0430\u0447\u0438\u0442\u044C
                </button>`}
          </div>
        </div>`}).join(""),e.querySelectorAll(".admin-promote-btn").forEach(d=>{d.addEventListener("click",async c=>{c.stopPropagation();const n=d.dataset.uid;try{await U("manage-admin",{action:"add",target_user_id:n}),v("\u2705 \u0410\u0434\u043C\u0438\u043D \u043D\u0430\u0437\u043D\u0430\u0447\u0435\u043D");const r=t.querySelector("#admin-user-search-input");r&&(r.value=""),e.innerHTML="",N(t)}catch(r){v("\u041E\u0448\u0438\u0431\u043A\u0430: "+(r.message||r))}})})}catch(l){console.error("[MEOW] User search error:",l),e.innerHTML='<p style="padding:8px 0;color:var(--c-t2);font-size:12px">\u041E\u0448\u0438\u0431\u043A\u0430 \u043F\u043E\u0438\u0441\u043A\u0430</p>'}}async function O(i){if(i){i.innerHTML='<p style="padding:12px 0;color:var(--c-t2);font-size:13px;">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043E\u0442\u0447\u0451\u0442\u043E\u0432\u2026</p>';try{const{data:e,error:t}=await g.rpc("get_reports_admin");if(t)throw t;if(!e?.length){i.innerHTML='<p class="admin-empty">\u041D\u0435\u0442 \u043E\u0442\u0447\u0451\u0442\u043E\u0432</p>';return}i.innerHTML=e.map(a=>{const l={new:"\u{1F195}",reviewed:"\u{1F441}\uFE0F",resolved:"\u2705"}[a.status]||"",s={bug:"\u{1F41B} \u0411\u0430\u0433",wrong_info:"\u{1F4DD} \u041D\u0435\u0432\u0435\u0440\u043D\u0430\u044F \u0438\u043D\u0444\u043E",spam:"\u{1F6AB} \u0421\u043F\u0430\u043C",other:"\u2753 \u0414\u0440\u0443\u0433\u043E\u0435"}[a.type]||a.type,m=a.target_type?`${a.target_type}: ${a.target_id||"\u2014"}`:"";return`
        <div class="admin-report-row" data-report-id="${a.id}">
          <div class="admin-report-head">
            <span class="admin-report-type">${s}</span>
            <span class="admin-report-status" data-status="${a.status}">${l} ${a.status}</span>
          </div>
          <div class="admin-report-text">${u(a.text)}</div>
          <div class="admin-report-meta">
            <span>${u(a.reporter_name||"Anonymous")}</span>
            <span>${pe(a.created_at)}</span>
            ${m?`<span>${u(m)}</span>`:""}
          </div>
          <div class="admin-report-actions">
            ${a.status!=="reviewed"?`<button class="btn-admin-sm review" data-id="${a.id}">\u{1F441}\uFE0F \u0420\u0430\u0441\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E</button>`:""}
            ${a.status!=="resolved"?`<button class="btn-admin-sm resolve" data-id="${a.id}">\u2705 \u0420\u0435\u0448\u0435\u043D\u043E</button>`:""}
          </div>
        </div>`}).join(""),i.querySelectorAll(".btn-admin-sm.review").forEach(a=>{a.addEventListener("click",async()=>{try{await g.rpc("update_report_status",{p_report_id:a.dataset.id,p_status:"reviewed"}),v("\u041E\u0442\u043C\u0435\u0447\u0435\u043D\u043E \u043A\u0430\u043A \u0440\u0430\u0441\u0441\u043C\u043E\u0442\u0440\u0435\u043D\u043E"),O(i)}catch{v("\u041E\u0448\u0438\u0431\u043A\u0430")}})}),i.querySelectorAll(".btn-admin-sm.resolve").forEach(a=>{a.addEventListener("click",async()=>{try{await g.rpc("update_report_status",{p_report_id:a.dataset.id,p_status:"resolved"}),v("\u041E\u0442\u043C\u0435\u0447\u0435\u043D\u043E \u043A\u0430\u043A \u0440\u0435\u0448\u0435\u043D\u043E"),O(i)}catch{v("\u041E\u0448\u0438\u0431\u043A\u0430")}})})}catch(e){console.error("[MEOW] Reports load error:",e),i.innerHTML='<p style="padding:12px 0;color:var(--c-t2);font-size:13px;">\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438 \u043E\u0442\u0447\u0451\u0442\u043E\u0432</p>'}}}const ue={"&":"amp;","<":"lt;",">":"gt;",'"':"quot;","'":"#39;"};function u(i){return String(i||"").replace(/[&<>"']/g,e=>ue[e])}function ee(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}function pe(i){if(!i)return"";const e=new Date(i),t=a=>String(a).padStart(2,"0");return`${t(e.getDate())}.${t(e.getMonth()+1)}.${e.getFullYear()}`}function ve(i){if(!i)return"";const e=t=>String(t).padStart(2,"0");return`${e(i.getDate())}.${e(i.getMonth()+1)}.${i.getFullYear()}`}
