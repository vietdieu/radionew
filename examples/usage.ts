// examples/usage.ts
import { CommuteCastEngine, BroadcastStyle } from '@commutecast/engine';
import { GoogleGenAI } from '@google/genai';

async function main() {
  const engine = new CommuteCastEngine({
    ai: new GoogleGenAI({ apiKey: '...' }),
    ttsServices: new Map([
      ['google-vi', new GoogleTTSService()],
      ['google-en', new GoogleTTSService()],
    ]),
    voiceCapabilities: [
      { engine: 'google', name: 'google-vi', locales: ['vi'], supportsBreak: true, /*...*/ },
    ],
  });

  const result = await engine.process(
    'TP.HCM sẽ tổ chức lễ hội vào ngày 15/08/2026.',
    {
      languageMode: 'VN_ONLY',
      style: BroadcastStyle.VOV,
      voiceVN: 'google-vi',
      voiceEN: 'google-en',
      rate: 1.0,
      pitch: 0,
    }
  );

  console.log(result.script);
  console.log(result.ssml);
  // result.audio is AudioChunk
}

main();