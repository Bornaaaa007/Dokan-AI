'use client';
// Speech-to-text using the browser's built-in SpeechRecognition (Chrome, Edge, Android Chrome, Safari).
// No backend, no API key. Chrome sends the audio to Google for recognition, so it needs an internet connection.
// Needs HTTPS or localhost. Where the browser has no support, `supported` stays false and the UI hides the mic.
import { useCallback, useEffect, useRef, useState } from 'react';

export default function useSpeechInput({ lang = 'bn-BD', onFinal } = {}) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');   // words shown live while the person is still speaking
  const [error, setError] = useState('');       // '', 'not-allowed', 'no-speech', 'audio-capture', 'network', 'failed'
  const recRef = useRef(null);
  const onFinalRef = useRef(onFinal);
  onFinalRef.current = onFinal;

  useEffect(() => {
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => { const r = recRef.current; recRef.current = null; r?.abort(); };
  }, []);

  const start = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const old = recRef.current; recRef.current = null; old?.abort();
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    let finalText = '';
    let failed = '';
    recRef.current = rec;

    rec.onstart = () => { setError(''); setInterim(''); setListening(true); };
    rec.onresult = (e) => {
      let fin = '', tmp = '';
      for (let i = 0; i < e.results.length; i++) (e.results[i].isFinal ? (fin += e.results[i][0].transcript) : (tmp += e.results[i][0].transcript));
      finalText = fin;
      setInterim(fin || tmp);
    };
    rec.onerror = (e) => { console.warn('speech error:', e.error, e.message); if (e.error !== 'aborted') failed = e.error || 'failed'; };
    rec.onend = () => {
      if (recRef.current !== rec) return;   // replaced or unmounted: ignore
      recRef.current = null;
      setListening(false); setInterim('');
      if (failed) { setError(failed); return; }
      const text = finalText.trim();
      if (!text) { setError('no-speech'); return; }
      onFinalRef.current?.(text);
    };
    try { rec.start(); } catch { setError('failed'); }
  }, [lang]);

  const stop = useCallback(() => { recRef.current?.stop(); }, []);   // keeps what was heard so far
  return { supported, listening, interim, error, start, stop };
}
