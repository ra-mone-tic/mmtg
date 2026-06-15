// MeowAfisha · cleanup-old-images Edge Function
// Удаляет изображения событий старше 7 дней из Storage и деактивирует события.
// Запуск: supabase functions deploy cleanup-old-images
// Cron:   SELECT cron.schedule('cleanup-images', '0 2 * * *', '...invoke cleanup-old-images')

import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  // CORS для ручного вызова из браузера (опционально)
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseKey) {
    return new Response(
      JSON.stringify({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  // Дата 7 дней назад в формате DD.MM.YYYY (как хранится в БД)
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const day = String(weekAgo.getDate()).padStart(2, "0");
  const month = String(weekAgo.getMonth() + 1).padStart(2, "0");
  const year = weekAgo.getFullYear();
  const thresholdDate = `${day}.${month}.${year}`;

  console.log(`Чистка событий с датой < ${thresholdDate}`);

  try {
    // 1. Найти старые события
    const { data: oldEvents, error: selectError } = await supabase
      .from("events")
      .select("id, image_url")
      .lt("date", thresholdDate)
      .eq("is_active", true);

    if (selectError) {
      throw new Error(`Ошибка выборки: ${selectError.message}`);
    }

    console.log(`Найдено событий для очистки: ${oldEvents?.length ?? 0}`);

    if (!oldEvents || oldEvents.length === 0) {
      return new Response(
        JSON.stringify({ deleted: 0 }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // 2. Удалить изображения из Storage
    const filePaths: string[] = [];
    for (const event of oldEvents) {
      if (event.image_url) {
        // Извлекаем имя файла из URL (последний сегмент)
        const fileName = event.image_url.split("/").pop();
        if (fileName) {
          filePaths.push(fileName);
        }
      }
    }

    if (filePaths.length > 0) {
      const { error: storageError } = await supabase.storage
        .from("event-images")
        .remove(filePaths);

      if (storageError) {
        console.error(`Ошибка удаления из Storage: ${storageError.message}`);
      } else {
        console.log(`Удалено изображений из Storage: ${filePaths.length}`);
      }
    }

    // 3. Деактивировать события
    const eventIds = oldEvents.map((e) => e.id);
    const { error: updateError } = await supabase
      .from("events")
      .update({ is_active: false })
      .in("id", eventIds);

    if (updateError) {
      throw new Error(`Ошибка деактивации: ${updateError.message}`);
    }

    console.log(`Деактивировано событий: ${eventIds.length}`);

    return new Response(
      JSON.stringify({ deleted: oldEvents.length }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Ошибка: ${message}`);
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
});