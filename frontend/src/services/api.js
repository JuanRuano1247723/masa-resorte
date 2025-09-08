export async function simularSistema(params) {
  const res = await fetch("/api/simular", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  return res.json();
}