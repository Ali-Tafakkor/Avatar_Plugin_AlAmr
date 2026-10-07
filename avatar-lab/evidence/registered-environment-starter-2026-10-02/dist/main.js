// The desktop injects the same API for Apps and Environments before this file runs.
// Keep scripts in files: the product content policy disallows inline scripts.
const result = await globalThis.alamr.runtime.ready();
if (!result.ok) {
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.textContent = "اتصال به کلاینت برقرار نشد.";
  document.querySelector("main").append(message);
  console.error("Runtime readiness failed", result.error);
}
