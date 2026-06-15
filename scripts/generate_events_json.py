#!/usr/bin/env python3
"""
Генерация events.json из Supabase (REST API) с постраничной выгрузкой.
Запуск: python scripts/generate_events_json.py
Требует SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в окружении.
"""
import json
import os
import urllib.request

base_url = os.environ["SUPABASE_URL"].rstrip("/")
api_key = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
headers = {
    "apikey": api_key,
    "Authorization": f"Bearer {api_key}",
    "Accept": "application/json",
}

all_events = []
offset = 0
limit = 1000

while True:
    url = f"{base_url}/rest/v1/events?select=*&order=date.asc&limit={limit}&offset={offset}"
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        page = json.loads(resp.read().decode("utf-8"))
    if not page:
        break
    all_events.extend(page)
    offset += limit
    if len(page) < limit:
        break

output = []
for e in all_events:
    output.append({
        "id": e.get("id", ""),
        "date": e.get("date", ""),
        "title": e.get("title", ""),
        "location": e.get("location", ""),
        "address": e.get("address", ""),
        "time": e.get("time", ""),
        "tags": e.get("tags", []),
        "short_description": e.get("short_description", ""),
        "full_description": e.get("full_description", ""),
        "description_blocks": e.get("description_blocks", []),
        "contacts": e.get("contacts", ""),
        "lat": e.get("lat"),
        "lon": e.get("lon"),
        "imageUrl": e.get("image_url", ""),
        "image_url": e.get("image_url", ""),
        "tg_message_id": e.get("tg_message_id"),
        "is_active": e.get("is_active", True),
    })

with open("events.json", "w", encoding="utf-8") as f:
    json.dump(output, f, ensure_ascii=False, indent=2)

print(f"Сгенерирован events.json: {len(output)} событий")