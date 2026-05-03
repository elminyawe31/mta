async function test() {
  const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
  const response = await fetch(`${OPENROUTER_BASE_URL}/models`);
  const data = await response.json();
  const models = data.data.filter(m => m.id.includes(':free') && (m.architecture?.modality?.includes('image') || m.id.includes('vision')));
  console.log(models.map(m => m.id));
}
test();
