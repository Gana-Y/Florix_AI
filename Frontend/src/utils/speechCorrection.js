/**
 * Speech Recognition Normalization & Audio Quality Engine
 *
 * Grounded principles:
 * 1. NEVER forcibly mutate legitimate English words (e.g. "florist" MUST remain "florist").
 * 2. Deduplicate audio transmission glitch repetitions (e.g. "hi hi" -> "hi").
 * 3. Provide intelligent accent/dialect resolution (e.g. en-IN vs en-US) so Google Chrome's
 *    speech server uses the correct phonetic acoustic model for Indian English.
 * 4. Provide hardware-level DSP audio constraints (echoCancellation, noiseSuppression, autoGainControl)
 *    to eliminate background noise and microphone distortion before recognition.
 */

/**
 * Deduplicate repeated identical phrases caused by speech recognition transmission echoes.
 */
function deduplicateSpokenPhrases(text) {
  if (!text) return '';
  const pattern = /\b([a-zA-Z\s]{3,35}?)\s+\1\b/gi;
  let result = text;
  let prev = '';
  let count = 0;
  while (result !== prev && count < 2) {
    prev = result;
    result = result.replace(pattern, '$1');
    count++;
  }
  return result.trim();
}

/**
 * Normalizes speech recognition output without inventing or replacing words.
 * Fixes only casing and deduplicates transmission stutters.
 */
export function correctSpeechPhonetics(text) {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text;

  // 1. Brand name casing normalization ONLY if the user actually said Florix (do NOT replace florist!)
  cleaned = cleaned.replace(/\bflorix\s+ai\b/gi, 'Florix AI');
  cleaned = cleaned.replace(/\bflorix\b/gi, 'Florix');

  // 2. Deduplicate single greeting/test repetitions (e.g. "hi hi" -> "hi", "hello hello" -> "hello")
  cleaned = cleaned.replace(/\b(hi|hello|hey|yo|sup|test)\s+\1\b/gi, '$1');

  // 3. Deduplicate repeated spoken phrases caused by audio echo
  cleaned = deduplicateSpokenPhrases(cleaned);

  return cleaned.trim();
}

/**
 * Combine freshly spoken transcript with pre-existing text in the input bar
 * while preventing word duplicates or prefix stutters.
 */
export function combineSpokenWithBase(baseInput, spokenText) {
  const base = (baseInput || '').trim();
  const spoken = correctSpeechPhonetics(spokenText).trim();

  if (!base) return spoken;
  if (!spoken) return base;

  const baseLower = base.toLowerCase();
  const spokenLower = spoken.toLowerCase();

  // If base already contains spoken at the end (e.g. base = "hi", spoken = "hi")
  if (baseLower.endsWith(spokenLower)) {
    return base;
  }

  // If spoken already starts with base (e.g. base = "can you", spoken = "can you hear me")
  if (spokenLower.startsWith(baseLower)) {
    return spoken;
  }

  // If base ends with the first word of spoken
  const baseWords = base.split(/\s+/);
  const spokenWords = spoken.split(/\s+/);
  if (baseWords[baseWords.length - 1].toLowerCase() === spokenWords[0].toLowerCase()) {
    return `${base} ${spokenWords.slice(1).join(' ')}`.trim();
  }

  return `${base} ${spoken}`.trim();
}

/**
 * Extract the best transcript from SpeechRecognition results.
 * Respects whatever the user spoke with zero forced word substitutions.
 */
export function extractBestTranscript(results, startIndex = 0) {
  if (!results) return '';
  let fullSpoken = '';

  for (let i = startIndex; i < results.length; i++) {
    const item = results[i];
    if (!item || !item.length) continue;
    fullSpoken += item[0]?.transcript || '';
  }

  return correctSpeechPhonetics(fullSpoken);
}

/**
 * Detect the optimal SpeechRecognition language code based on user's location and settings.
 * Defaults to 'en-IN' (Indian English) if in India (timezone Asia/Kolkata or +05:30)
 * which drastically lowers Word Error Rate for Indian English pronunciation.
 */
export function getOptimalSpeechLanguage() {
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
    const isIndia = tz.includes('Calcutta') || tz.includes('Kolkata') || tz.includes('Asia/Kolkata') || tz.includes('IST');
    if (isIndia) return 'en-IN';

    const browserLangs = navigator.languages || [navigator.language];
    for (const l of browserLangs) {
      if (l.startsWith('en')) return l;
    }
    return navigator.language || 'en-US';
  } catch {
    return 'en-IN';
  }
}

/**
 * Recommended audio stream constraints for maximum signal-to-noise ratio.
 */
export const AUDIO_CAPTURE_CONSTRAINTS = {
  audio: {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: 1,
    sampleRate: 48000
  }
};

/**
 * Configure SpeechRecognition instance with locale auto-detection and noise-robustness.
 */
export function configureSpeechRecognition(recognition, customLang = null) {
  if (!recognition) return;

  const targetLang = customLang || getOptimalSpeechLanguage();
  recognition.lang = targetLang;
  recognition.maxAlternatives = 1;
}
