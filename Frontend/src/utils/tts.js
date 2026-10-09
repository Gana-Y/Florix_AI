/**
 * Florix AI Web Speech Synthesis Engine (TTS)
 * Implements cross-browser SpeechSynthesis with voice profiling, rate control,
 * markdown cleaning, and language localization.
 */

let activeUtterance = null;

// Clean text for speech synthesis: remove markdown, code fences, LaTeX, and raw links
export function sanitizeTextForTTS(rawText) {
  if (!rawText) return '';
  return rawText
    // Remove image markdowns ![alt](url)
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    // Remove link markdowns [text](url) -> text
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    // Remove code blocks
    .replace(/```[\s\S]*?```/g, 'Code block omitted.')
    // Remove inline code
    .replace(/`([^`]+)`/g, '$1')
    // Remove LaTeX math $$...$$ and $...$
    .replace(/\$\$[\s\S]*?\$\$/g, 'Formula.')
    .replace(/\$([^$]+)\$/g, '$1')
    // Remove HTML tags
    .replace(/<[^>]*>/g, '')
    // Remove header hashes, bold/italic markers
    .replace(/[#*_~>]/g, '')
    // Replace multiple spaces and newlines with a single space
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Maps Florix language codes to standard BCP-47 speech locales.
 */
export const LANGUAGE_LOCALE_MAP = {
  'en-us': 'en-US',
  'en-gb': 'en-GB',
  'hi': 'hi-IN',
  'te': 'te-IN',
  'ta': 'ta-IN',
  'es': 'es-ES',
  'fr': 'fr-FR',
  'de': 'de-DE',
  'ja': 'ja-JP',
  'zh': 'zh-CN',
  'ar': 'ar-SA',
  'ru': 'ru-RU',
};

/**
 * Returns available voices from the browser, with safety retry for Chrome/Edge async load.
 */
export function getAvailableVoices() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return [];
  return window.speechSynthesis.getVoices() || [];
}

/**
 * Select the best matching voice for a given voice profile and language.
 */
function selectVoice(voices, profile = 'female-us', lang = 'en-US') {
  if (!voices || voices.length === 0) return null;

  const targetLang = (lang || 'en-US').toLowerCase();
  const langPrefix = targetLang.split('-')[0];

  // If a non-English language is chosen, prefer native voices for that language
  if (langPrefix !== 'en') {
    const nativeMatch = voices.find(v => v.lang.toLowerCase().startsWith(langPrefix));
    if (nativeMatch) return nativeMatch;
  }

  // English profiles
  const isUK = profile.includes('uk');
  const isFemale = profile.includes('female');
  const isMale = profile.includes('male');

  const langMatches = voices.filter(v =>
    isUK ? v.lang.toLowerCase().includes('gb') : v.lang.toLowerCase().includes('us') || v.lang.toLowerCase().startsWith('en')
  );

  const pool = langMatches.length > 0 ? langMatches : voices;

  if (isFemale) {
    const femaleVoice = pool.find(v =>
      /female|zira|samantha|victoria|karen|catherine|susan|google.*english/i.test(v.name)
    );
    if (femaleVoice) return femaleVoice;
  }

  if (isMale) {
    const maleVoice = pool.find(v =>
      /male|david|guy|george|alex|oliver|ryan|daniel|google.*english/i.test(v.name)
    );
    if (maleVoice) return maleVoice;
  }

  return pool[0] || voices[0] || null;
}

/**
 * Speak text with voice assistant options.
 */
export function speakText(text, options = {}) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis is not supported in this environment.');
    if (options.onError) options.onError(new Error('SpeechSynthesis not supported'));
    return false;
  }

  // Cancel any running speech
  window.speechSynthesis.cancel();

  const cleanText = sanitizeTextForTTS(text);
  if (!cleanText) return false;

  const {
    voiceProfile = 'female-us',
    voiceRate = 1.0,
    language = 'en-us',
    onStart,
    onEnd,
    onError,
  } = options;

  const targetLocale = LANGUAGE_LOCALE_MAP[language] || 'en-US';

  const executeUtterance = () => {
    const voices = getAvailableVoices();
    const selectedVoice = selectVoice(voices, voiceProfile, targetLocale);

    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (selectedVoice) {
      utterance.voice = selectedVoice;
      utterance.lang = selectedVoice.lang || targetLocale;
    } else {
      utterance.lang = targetLocale;
    }

    // Rate: 0.5 to 2.0
    utterance.rate = Math.max(0.5, Math.min(2.0, Number(voiceRate) || 1.0));

    // Pitch: Cybernetic / robot profile uses lower pitch with slight rate modulation
    if (voiceProfile === 'robot') {
      utterance.pitch = 0.35;
      utterance.rate = Math.min(1.4, utterance.rate * 1.05);
    } else if (voiceProfile.includes('female')) {
      utterance.pitch = 1.08;
    } else if (voiceProfile.includes('male')) {
      utterance.pitch = 0.92;
    } else {
      utterance.pitch = 1.0;
    }

    utterance.onstart = () => {
      activeUtterance = utterance;
      if (onStart) onStart();
    };

    utterance.onend = () => {
      activeUtterance = null;
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      activeUtterance = null;
      if (onError) onError(e);
    };

    activeUtterance = utterance;
    window.speechSynthesis.speak(utterance);
  };

  const voices = getAvailableVoices();
  if (voices.length === 0 && 'onvoiceschanged' in window.speechSynthesis) {
    window.speechSynthesis.onvoiceschanged = () => {
      window.speechSynthesis.onvoiceschanged = null;
      executeUtterance();
    };
  } else {
    executeUtterance();
  }

  return true;
}

/**
 * Stop active speech immediately.
 */
export function stopSpeaking() {
  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    window.speechSynthesis.cancel();
    activeUtterance = null;
  }
}

/**
 * Check if browser speech engine is currently active.
 */
export function isSpeaking() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) return false;
  return window.speechSynthesis.speaking;
}
