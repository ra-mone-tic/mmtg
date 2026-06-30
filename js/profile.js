import{$ as h,TG as k}from"./helpers.js";import{state as l}from"./state.js";import{supabase as d}from"./supabase.js";import{isAdmin as q}from"./auth.js";import{loadFavoritesList as L}from"./favorites.js";import{loadFriends as E}from"./social.js";import{showToast as g}from"./toast.js";export function openProfile(s){const i=h("profile-modal");i&&(i.dataset.userId=s??l.user?.id,i.classList.add("open"),i.setAttribute("aria-hidden","false"),k()?.HapticFeedback?.impactOccurred("light"),history.pushState({meowProfile:!0},""),S(i))}export function closeProfile(){const s=h("profile-modal");s&&(s.classList.remove("open"),s.setAttribute("aria-hidden","true"))}async function S(s){const i=s.dataset.userId;if(!i)return;const a=s.querySelector(".profile-body");if(a){a.innerHTML='<p style="padding:20px;text-align:center;color:var(--c-t2)">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430\u2026</p>';try{const{data:t}=await d.from("profiles").select("*").eq("id",i).single();if(!t){a.innerHTML='<p style="padding:20px;text-align:center;color:var(--c-t2)">\u041F\u0440\u043E\u0444\u0438\u043B\u044C \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D</p>';return}const{data:v}=await d.from("user_levels").select("*").eq("level",t.level).single(),n=l.user?.id===i,y=n?!!l.user?.is_admin:!1,p=await A(i),f=await E(i),u=n?await L():[],x=((t.first_name?.[0]??"")+(t.last_name?.[0]??"")).toUpperCase()||"?",w=t.photo_url?`<img src="${t.photo_url}" alt="${t.first_name}">`:`<span>${x}</span>`,$=y?"\u{1F6E1}\uFE0F \u0410\u0434\u043C\u0438\u043D":v?`${v.badge_emoji} ${v.badge_label}`:"\u{1F331} \u041D\u043E\u0432\u0438\u0447\u043E\u043A",m=s.querySelector(".profile-header");m&&(m.innerHTML=`
        <button class="profile-back" id="profile-back-btn" aria-label="\u041D\u0430\u0437\u0430\u0434">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <div class="profile-avatar">${w}</div>
        <div class="profile-name">${t.first_name??""}${t.last_name?" "+t.last_name:""}</div>
        ${t.username?`<div class="profile-username">@${t.username}</div>`:""}
        <div class="profile-level">${$}</div>
      `,m.querySelector("#profile-back-btn")?.addEventListener("click",closeProfile));let o="";o+=`<div class="profile-bio-section">
      <div class="profile-bio-label">\u041E \u0441\u0435\u0431\u0435</div>
      ${n?`
        <textarea class="profile-bio-input" id="profile-bio-input" maxlength="300"
                  placeholder="\u0420\u0430\u0441\u0441\u043A\u0430\u0436\u0438 \u043E \u0441\u0435\u0431\u0435\u2026">${b(t.bio||"")}</textarea>
        <button class="profile-bio-save" id="profile-bio-save">\u0421\u043E\u0445\u0440\u0430\u043D\u0438\u0442\u044C</button>
      `:`
        <div class="profile-bio-text">${b(t.bio||"\u041F\u043E\u043A\u0430 \u043D\u0438\u0447\u0435\u0433\u043E \u043E \u0441\u0435\u0431\u0435 \u043D\u0435 \u0440\u0430\u0441\u0441\u043A\u0430\u0437\u0430\u043B(\u0430)")}</div>
      `}
    </div>`,o+=`<div class="profile-stats">
      <div class="profile-stat">
        <div class="profile-stat-value">${p.favorites}</div>
        <div class="profile-stat-label">\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435</div>
      </div>
      <div class="profile-stat">
        <div class="profile-stat-value">${p.going}</div>
        <div class="profile-stat-label">\u041F\u043E\u0439\u0434\u0443</div>
      </div>
      <div class="profile-stat">
        <div class="profile-stat-value">${p.friends}</div>
        <div class="profile-stat-label">\u0414\u0440\u0443\u0437\u044C\u044F</div>
      </div>
    </div>`,n&&(o+=`<div class="profile-settings">
        <div class="profile-settings-title">\u041D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u0432\u0438\u0434\u0438\u043C\u043E\u0441\u0442\u0438</div>
        <div class="profile-setting-row">
          <div>
            <div class="profile-setting-text">\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \xAB\u041F\u043E\u0439\u0434\u0443\xBB</div>
            <div class="profile-setting-desc">\u0414\u0440\u0443\u0433\u0438\u0435 \u0443\u0432\u0438\u0434\u044F\u0442, \u043A\u0443\u0434\u0430 \u0442\u044B \u0438\u0434\u0451\u0448\u044C</div>
          </div>
          <div class="toggle ${t.show_going?"active":""}" data-setting="show_going"></div>
        </div>
        <div class="profile-setting-row">
          <div>
            <div class="profile-setting-text">\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u043F\u043E\u0434\u043F\u0438\u0441\u043A\u0438</div>
            <div class="profile-setting-desc">\u0414\u0440\u0443\u0433\u0438\u0435 \u0443\u0432\u0438\u0434\u044F\u0442, \u043D\u0430 \u043A\u043E\u0433\u043E \u0442\u044B \u043F\u043E\u0434\u043F\u0438\u0441\u0430\u043D</div>
          </div>
          <div class="toggle ${t.show_follow?"active":""}" data-setting="show_follow"></div>
        </div>
      </div>`,o+=`<div class="profile-report-section" style="margin-top:16px;padding-top:14px;border-top:1px solid var(--c-soft-br)">
        <button class="btn-report" id="profile-btn-report" style="display:flex;align-items:center;gap:6px;width:100%;height:44px;border-radius:var(--r-b);background:var(--c-glass);border:1.5px solid var(--c-glass-br);color:var(--c-t2);font-size:12.5px;font-weight:600;justify-content:center">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
          \u0421\u043E\u043E\u0431\u0449\u0438\u0442\u044C \u043E\u0431 \u043E\u0448\u0438\u0431\u043A\u0435
        </button>
      </div>`),f.length&&(o+=`<div class="profile-friends-section">
        <div class="profile-friends-title">\u0414\u0440\u0443\u0437\u044C\u044F (${f.length})</div>
        <div class="profile-friends-list">
          ${f.map(e=>{const r=((e.first_name?.[0]??"")+(e.last_name?.[0]??"")).toUpperCase()||"?",c=e.photo_url?`<img src="${e.photo_url}" alt="${e.first_name}">`:`<span>${r}</span>`;return`<div class="profile-friend-row" data-uid="${e.id}">
              <div class="profile-friend-avatar">${c}</div>
              <div>
                <div class="profile-friend-name">${e.first_name??""}${e.last_name?" "+e.last_name:""}</div>
                <div class="profile-friend-level">${e.level??"newbie"}</div>
              </div>
            </div>`}).join("")}
        </div>
      </div>`),n&&u.length?o+=`<div class="profile-fav-section">
        <div class="profile-fav-title">\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435 (${u.length})</div>
        <div class="profile-fav-list">
          ${u.map(e=>`
            <div class="profile-fav-item" data-event-id="${e.id}">
              <div class="profile-fav-dot"></div>
              <div class="profile-fav-info">
                <div class="profile-fav-name">${b(e.title)}</div>
                <div class="profile-fav-date">${e.date??""}</div>
              </div>
            </div>
          `).join("")}
        </div>
      </div>`:n&&(o+=`<div class="profile-fav-section">
        <div class="profile-fav-title">\u0418\u0437\u0431\u0440\u0430\u043D\u043D\u043E\u0435</div>
        <div class="profile-fav-empty">\u041F\u043E\u043A\u0430 \u043D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u0434\u043E\u0431\u0430\u0432\u043B\u0435\u043D\u043E</div>
      </div>`),n&&q()&&(o+=`<div class="profile-admin-section">
        <div class="profile-admin-title">\u{1F6E1}\uFE0F \u0423\u043F\u0440\u0430\u0432\u043B\u0435\u043D\u0438\u0435</div>
        <button class="btn-admin-create" id="profile-btn-admin-create" style="margin-top:10px">
          \u2795 \u0421\u043E\u0437\u0434\u0430\u0442\u044C \u043C\u0435\u0440\u043E\u043F\u0440\u0438\u044F\u0442\u0438\u0435
        </button>
        <button class="btn-admin-panel" id="profile-btn-admin-panel" style="margin-top:8px;width:100%;height:44px;border-radius:var(--r-b);background:var(--c-glass);border:1.5px solid var(--c-glass-br);color:var(--c-accent);font-size:13px;font-weight:700;display:flex;align-items:center;justify-content:center;gap:6px">
          \u{1F6E1}\uFE0F \u0410\u0434\u043C\u0438\u043D-\u043F\u0430\u043D\u0435\u043B\u044C
        </button>
      </div>`),a.innerHTML=o,a.querySelector("#profile-bio-save")?.addEventListener("click",async()=>{const e=a.querySelector("#profile-bio-input");if(!e)return;const r=e.value.trim();try{await d.from("profiles").update({bio:r}).eq("id",i),l.user.bio=r,g("\u2705 \u0421\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E")}catch{g("\u041E\u0448\u0438\u0431\u043A\u0430")}}),a.querySelector("#profile-btn-report")?.addEventListener("click",async()=>{closeProfile();const{openReport:e}=await import("./report.js");e("user",l.user?.id||"","")}),a.querySelectorAll(".toggle[data-setting]").forEach(e=>{e.addEventListener("click",async()=>{const r=e.dataset.setting,c=!e.classList.contains("active");e.classList.toggle("active",c);try{await d.from("profiles").update({[r]:c}).eq("id",i),l.user&&(l.user[r]=c)}catch{g("\u041E\u0448\u0438\u0431\u043A\u0430")}})}),a.querySelectorAll(".profile-friend-row[data-uid]").forEach(e=>{e.addEventListener("click",()=>{openProfile(e.dataset.uid)})}),a.querySelector("#profile-btn-admin-create")?.addEventListener("click",async()=>{closeProfile(),(await import("./admin.js")).openAdminCreate()}),a.querySelector("#profile-btn-admin-panel")?.addEventListener("click",async()=>{closeProfile(),(await import("./admin.js")).openAdminPanel()}),a.querySelectorAll(".profile-fav-item[data-event-id]").forEach(e=>{e.addEventListener("click",()=>{const r=e.dataset.eventId;l.rawAllEvents.find(_=>_.id===r)&&(closeProfile(),document.dispatchEvent(new CustomEvent("meow:open-event",{detail:{eventId:r}})))})})}catch(t){console.error("[MEOW] profile render error:",t),a.innerHTML='<p style="padding:20px;text-align:center;color:var(--c-t2)">\u041E\u0448\u0438\u0431\u043A\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438</p>'}}}async function A(s){const i={favorites:0,going:0,friends:0};try{const[a,t,v]=await Promise.all([d.from("favorites").select("*",{count:"exact",head:!0}).eq("user_id",s),d.from("event_attendance").select("*",{count:"exact",head:!0}).eq("user_id",s),d.from("friends").select("user_a, user_b").or(`user_a.eq.${s},user_b.eq.${s}`)]);i.favorites=a.count??0,i.going=t.count??0,i.friends=v.data?.length??0}catch{}return i}const T={"&":"amp;","<":"lt;",">":"gt;",'"':"quot;","'":"#39;"};function b(s){return String(s||"").replace(/[&<>"']/g,i=>T[i])}
