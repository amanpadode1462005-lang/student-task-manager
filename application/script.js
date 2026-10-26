const $ = (id) => document.getElementById(id);
let tasks = [], filter = "";
const rank = { High: 0, Medium: 1, Low: 2 };

async function api(path, opts) {
  const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  return r.json();
}
function toast(msg) {
  const t = $("toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("show"), 1800);
}
async function load() { tasks = await api("/api/tasks"); render(); }

function render() {
  const q = $("search").value.toLowerCase().trim();
  let view = tasks.filter((t) => t.title.toLowerCase().includes(q) && (!filter || t.status === filter));
  if ($("sort").value === "priority") view.sort((a, b) => rank[a.priority] - rank[b.priority]);
  else view.sort((a, b) => b.id.localeCompare(a.id, undefined, { numeric: true }));

  const list = $("list"); list.innerHTML = "";
  view.forEach((t) => {
    const li = document.createElement("li");
    li.className = "item " + t.priority + " " + t.status;
    li.innerHTML = '<button class="chk" title="Toggle status"></button><div class="body"><div class="t"></div>' +
      '<div class="meta"></div></div><button class="del">Delete</button>';
    li.querySelector(".t").textContent = t.title;
    li.querySelector(".meta").innerHTML = "<b></b> &middot; <em></em> &middot; <span></span> &middot; <span></span>";
    const m = li.querySelectorAll(".meta b, .meta em, .meta span");
    m[0].textContent = t.id; m[1].textContent = t.priority; m[2].textContent = t.status; m[3].textContent = t.createdDate || "";
    li.querySelector(".chk").onclick = async () => {
      const next = t.status === "Completed" ? "Pending" : "Completed";
      await api("/api/tasks/" + t.id, { method: "PUT", body: JSON.stringify({ status: next }) });
      toast("Status changed successfully"); load();
    };
    li.querySelector(".del").onclick = async () => {
      await api("/api/tasks/" + t.id, { method: "DELETE" });
      toast("Task removed successfully"); load();
    };
    list.appendChild(li);
  });
  $("empty").hidden = view.length > 0;

  const done = tasks.filter((t) => t.status === "Completed").length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  $("s-total").textContent = tasks.length;
  $("s-done").textContent = done;
  $("s-pending").textContent = tasks.length - done;
  $("s-pct").textContent = pct + "%";
  $("bar").style.width = pct + "%";
}

$("task-form").onsubmit = async (e) => {
  e.preventDefault();
  await api("/api/tasks", { method: "POST", body: JSON.stringify({
    title: $("title").value, priority: $("priority").value, status: $("status").value }) });
  e.target.reset(); toast("Task successfully created"); load();
};
$("search").oninput = render;
$("sort").onchange = render;
$("chips").onclick = (e) => {
  if (!e.target.dataset.hasOwnProperty("f")) return;
  filter = e.target.dataset.f;
  document.querySelectorAll(".chip").forEach((c) => c.classList.toggle("on", c === e.target));
  render();
};
$("today").textContent = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long", year: "numeric" });
load();
