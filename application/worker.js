const INDEX_HTML = __INDEX_HTML__;
const STYLE_CSS = __STYLE_CSS__;
const SCRIPT_JS = __SCRIPT_JS__;

const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });


// All tasks live under ONE key, so reads right after writes are consistent.
// (KV list() is eventually consistent and caused tasks to appear late or be overwritten.)
async function loadTasks(kv) {
  let tasks = await kv.get("all_tasks", "json");
  if (tasks) return tasks;
  // One-time migration of tasks stored one-key-per-task by the older version.
  const { keys } = await kv.list({ prefix: "T" });
  tasks = (await Promise.all(keys.map((k) => kv.get(k.name, "json")))).filter(Boolean);
  if (tasks.length) await kv.put("all_tasks", JSON.stringify(tasks));
  return tasks;
}
const saveTasks = (kv, tasks) => kv.put("all_tasks", JSON.stringify(tasks));
const nextId = (tasks) =>
  "T" + (tasks.reduce((m, t) => Math.max(m, parseInt(t.id.slice(1), 10) || 100), 100) + 1);

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    const method = request.method;

    if (method === "GET" && (path === "/" || path === "/index.html"))
      return new Response(INDEX_HTML.replaceAll("{{APP_TITLE}}", env.APP_TITLE || "Student Task Manager"),
        { headers: { "Content-Type": "text/html; charset=utf-8" } });
    if (method === "GET" && path === "/style.css")
      return new Response(STYLE_CSS, { headers: { "Content-Type": "text/css" } });
    if (method === "GET" && path === "/script.js")
      return new Response(SCRIPT_JS, { headers: { "Content-Type": "application/javascript" } });

    const m = path.match(/^\/api\/tasks(?:\/([A-Za-z0-9_-]+))?\/?$/);
    if (!m) return json({ error: "Not found" }, 404);
    const id = m[1];


    try {
      const kv = env.TASKS_KV;
      if (!id && method === "GET") {
        const tasks = await loadTasks(kv);
        tasks.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
        return json(tasks);
      }
      if (!id && method === "POST") {
        const body = await request.json();
        if (!body.title || !String(body.title).trim()) return json({ error: "title is required" }, 400);
        const tasks = await loadTasks(kv);
        const task = {
          id: nextId(tasks),
          title: String(body.title).trim(),
          priority: body.priority || "Medium",
          status: body.status || "Pending",
          createdDate: new Date().toISOString().slice(0, 10),
        };
        tasks.push(task);
        await saveTasks(kv, tasks);
        return json(task, 201);
      }
      if (id) {
        const tasks = await loadTasks(kv);
        const i = tasks.findIndex((t) => t.id === id);
        if (i < 0) return json({ error: "Task not found" }, 404);
        if (method === "GET") return json(tasks[i]);
        if (method === "PUT") {
          const body = await request.json();
          const t = tasks[i];
          tasks[i] = { ...t, title: body.title ?? t.title, priority: body.priority ?? t.priority, status: body.status ?? t.status };
          await saveTasks(kv, tasks);
          return json(tasks[i]);
        }
        if (method === "DELETE") {
          tasks.splice(i, 1);
          await saveTasks(kv, tasks);
          return json({ message: "Task removed successfully", id });
        }
      }
      return json({ error: "Method not allowed" }, 405);
    } catch (e) {
      return json({ error: e.message }, 500);
    }
  },
};
