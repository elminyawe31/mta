async function test() {
  const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
  const OPENROUTER_API_KEY = "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";
  const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "meta-llama/llama-3.2-11b-vision-instruct:free",
      messages: [{ role: "user", content: "hello" }]
    })
  });
  console.log(response.status, response.statusText);
  const text = await response.text();
  console.log(text);
}
test();
