import{$ as l,fmt as v}from"./helpers.js?v=25c5e1a4";import{state as n}from"./state.js?v=25c5e1a4";import{normalizeEvent as h}from"./data.js?v=25c5e1a4";import{flyTo as m,flyToPlace as y}from"./map-core.js?v=25c5e1a4";import{searchPlaces as C,getPlaceById as x}from"./places.js?v=25c5e1a4";import{closeCard as w}from"./card.js?v=25c5e1a4";import{openPlaceCard as L}from"./place-card.js?v=25c5e1a4";let u=null,f=null;export function initSearch({onOpenCard:e,onDateChange:s}){u=e,f=s}export function addChip(e){if(!e||n.searchChips.includes(e))return;n.searchChips.push(e),d();const s=l("search-input");s&&(s.focus(),s.value=""),handleSearch("")}export function removeChip(e){if(n.searchChips.splice(e,1),d(),n.searchChips.length){const s=l("search-input");handleSearch(s?.value?.trim()||"")}else{hideSuggestions();const s=l("search-input");s&&(s.value="")}}export function clearChips(){n.searchChips=[],d(),hideSuggestions();const e=l("search-input");e&&(e.value="")}function d(){const e=l("search-chips"),s=e?.closest(".search-wrap"),a=l("search-input");if(e){if(!n.searchChips.length){e.innerHTML="",e.style.display="none",s?.classList.remove("has-chips"),a&&(a.style.paddingLeft="");return}e.style.display="flex",s?.classList.add("has-chips"),e.innerHTML=n.searchChips.map((r,i)=>`
    <span class="search-chip" data-index="${i}">
      <span class="search-chip-label">${r}</span>
      <button class="search-chip-remove" data-index="${i}" aria-label="\u0423\u0431\u0440\u0430\u0442\u044C \u0442\u0435\u0433">
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="3" stroke-linecap="round">
          <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
        </svg>
      </button>
    </span>
  `).join(""),e.querySelectorAll(".search-chip-remove").forEach(r=>{r.addEventListener("click",i=>{i.stopPropagation();const t=parseInt(r.getAttribute("data-index"),10);removeChip(t)})}),requestAnimationFrame(()=>{if(!n.searchChips.length)return;const r=e.scrollWidth;a&&r>0&&(a.style.paddingLeft=r+16+"px")})}}export function handleSearch(e){const s=n.searchChips;if(!s.length&&!e?.trim()){hideSuggestions();return}const a=e?.toLowerCase().trim()||"";let r=n.rawAllEvents.map(h);s.length&&(r=r.filter(t=>{if(!t.tags||!t.tags.length)return!1;const p=Array.isArray(t.tags)?t.tags:String(t.tags).split(",").map(c=>c.trim());return s.some(c=>p.some(o=>o.toLowerCase()===c.toLowerCase()))})),a&&(r=r.filter(t=>t.title.toLowerCase().includes(a)||t.venue.toLowerCase().includes(a)||t.address.toLowerCase().includes(a)||t.desc.toLowerCase().includes(a)));const i=a?C(e):[];A(r,i)}export function hideSuggestions(){const e=l("search-suggestions");e&&(e.classList.remove("open"),e.setAttribute("aria-hidden","true"))}function A(e,s){const a=l("search-suggestions");if(!a)return;const r=[];if(s?.length&&s.slice(0,3).forEach(i=>{r.push({type:"place",place:i})}),e?.length&&e.slice(0,5).forEach(i=>{r.push({type:"event",event:i})}),!r.length){hideSuggestions();return}a.innerHTML=r.map(i=>{if(i.type==="place"){const t=i.place;return`
        <div class="sug-item" data-type="place" data-place-id="${t.id}">
          <div class="sug-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="6"/>
            </svg>
          </div>
          <div>
            <div class="sug-text">${t.name}</div>
            <div class="sug-sub">${t.address||"\u041C\u0435\u0441\u0442\u043E"}</div>
          </div>
        </div>`}else{const t=i.event;return`
        <div class="sug-item" data-type="event" data-id="${t.id}">
          <div class="sug-icon">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                 stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <div>
            <div class="sug-text">${t.title}</div>
            <div class="sug-sub">${t.venue} \xB7 ${t.time||t.date}</div>
          </div>
        </div>`}}).join(""),a.querySelectorAll(".sug-item").forEach(i=>{i.addEventListener("click",async()=>{if(i.getAttribute("data-type")==="place"){const c=i.getAttribute("data-place-id");w();const o=x(c);o&&y(o),L(c)}else{const c=i.getAttribute("data-id"),o=n.rawAllEvents.map(h).find(g=>g.id===c);o&&(o.date!==v(n.currentDate)&&await f?.(o.date),m(o),u?.(c))}hideSuggestions();const p=l("search-input");p&&(p.value="")})}),a.classList.add("open"),a.setAttribute("aria-hidden","false")}
