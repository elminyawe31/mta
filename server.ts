import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { GoogleGenAI } from '@google/genai';

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "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";
const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const GEMINI_API_KEY = "AIzaSyBqYyr-fhSBnONHX7ovRUgZJZ66QvxUorw";

async function processGemini(modelName: string, messages: any[], stream: boolean, apiKey: string, res: express.Response) {
  const finalApiKey = apiKey?.trim() || GEMINI_API_KEY;
  const ai = new GoogleGenAI({ apiKey: finalApiKey });
  
  const geminiMessages = messages.map((m: any) => {
    let role = 'user';
    if (m.role === 'assistant') role = 'model';
    if (m.role === 'system') role = 'system';
    
    if (typeof m.content === 'string') {
      return { role, parts: [{ text: m.content }] };
    } else if (Array.isArray(m.content)) {
      const parts = m.content.map((part: any) => {
        if (part.type === 'text') return { text: part.text };
        if (part.type === 'image_url') {
           const b64Parts = part.image_url.url.split(',');
           const b64 = b64Parts[1];
           const mimeType = b64Parts[0].split(';')[0].split(':')[1];
           return { inlineData: { data: b64, mimeType } };
        }
        return { text: '' };
      });
      return { role, parts };
    }
    return { role, parts: [{ text: '' }] };
  });

  let systemInstruction: string | undefined;
  const contents = geminiMessages.filter((m: any) => {
     if (m.role === 'system') {
       systemInstruction = m.parts[0].text;
       return false;
     }
     return true;
  });

  let geminiModelStr = modelName;
  if (geminiModelStr.startsWith('google/')) {
    geminiModelStr = geminiModelStr.replace('google/', '');
  }
  
  if (stream) {
    const responseStream = await ai.models.generateContentStream({
      model: geminiModelStr,
      contents,
      config: systemInstruction ? { systemInstruction } : undefined
    });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    for await (const chunk of responseStream) {
      if (chunk.text) {
        const out = {
            id: "chatcmpl-gemini",
            choices: [{
               delta: { content: chunk.text }
            }]
        };
        res.write(`data: ${JSON.stringify(out)}\n\n`);
      }
    }
    res.write('data: [DONE]\n\n');
    res.end();
  } else {
    const response = await ai.models.generateContent({
       model: geminiModelStr,
       contents,
       config: systemInstruction ? { systemInstruction } : undefined
    });
    
    res.json({
      choices: [{
        message: { content: response.text }
      }]
    });
  }
}

async function openRouterFallback(reqBody: any, res: express.Response, clientApiKey?: string) {
  try {
    const apiKey = clientApiKey || OPENROUTER_API_KEY;
    const response = await fetch(`${OPENROUTER_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.APP_URL || 'https://elminyawe-chat.example.com',
        'X-Title': 'ElMINYAWE Chat'
      },
      body: JSON.stringify(reqBody)
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    if (reqBody.stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      if (response.body) {
        // Node fetch response.body might be a stream
        const reader = (response.body as any).getReader();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          res.write(value);
        }
        res.end();
      } else {
        res.end();
      }
    } else {
      const data = await response.json();
      res.json(data);
    }
  } catch (err: any) {
    console.error("Fallback error:", err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Fallback failed.' });
    } else {
      res.end();
    }
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '50mb' }));

  app.post('/api/chat', async (req, res) => {
    try {
      const clientOpenRouterKey = req.headers['x-openrouter-api-key'] as string;
      const clientGeminiKey = req.headers['x-gemini-api-key'] as string;
      const { model, messages, stream } = req.body;
      
      const hasImage = messages.some((m: any) => 
         Array.isArray(m.content) && m.content.some((part: any) => part.type === 'image_url')
      );

      const requestBody = { ...req.body };
      const isVisionModel = requestBody.model && (
        requestBody.model.includes('vision') || 
        requestBody.model.includes('gemini') || 
        requestBody.model.includes('gpt-4o') || 
        requestBody.model.includes('claude-3') || 
        requestBody.model.includes('ocr') ||
        requestBody.model.includes('qwen-vl') ||
        requestBody.model.includes('pixtral') ||
        requestBody.model.includes('llava')
      );

      if (hasImage && !isVisionModel) {
        requestBody.model = requestBody.visionModel || "google/gemini-2.5-flash";
      } else if (!requestBody.model) {
        requestBody.model = "meta-llama/llama-3-8b-instruct:free";
      }
      
      // Delete visionModel from payload to OpenRouter
      delete requestBody.visionModel;

      const modelToUse = requestBody.model;
      if (modelToUse.includes('gemini')) {
        await processGemini(modelToUse, messages, stream, clientGeminiKey || GEMINI_API_KEY, res);
      } else {
        await openRouterFallback(requestBody, res, clientOpenRouterKey);
      }

    } catch (error) {
      console.error('Chat API Error:', error);
      if (!res.headersSent) {
          res.status(500).json({ error: 'Failed to process chat request' });
      }
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
