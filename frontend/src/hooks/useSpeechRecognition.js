import { useState, useRef, useCallback, useEffect } from 'react';

/**
 * Custom hook for browser-native speech recognition.
 *
 * Returns:
 *   isSupported  – false when the browser has no SpeechRecognition API
 *   isListening  – true while actively recording
 *   transcript   – the recognised text so far (interim + final)
 *   error        – user-friendly error string, or null
 *   startListening(setText) – begin recognition; setText is the React state
 *                             setter so the transcript streams into the
 *                             existing input field
 *   stopListening()         – gracefully stop recognition
 *   clearError()            – dismiss the error banner
 */

const SpeechRecognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

function friendlyError(event) {
  switch (event.error) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was denied. Please allow microphone permission in your browser settings.';
    case 'no-speech':
      return 'No speech was detected. Please try again.';
    case 'audio-capture':
      return 'No microphone was found. Please check your device.';
    case 'network':
      return 'A network error occurred during speech recognition. Please check your connection.';
    case 'aborted':
      return null; // intentional stop – not an error
    default:
      return `Speech recognition error: ${event.error}`;
  }
}

export default function useSpeechRecognition() {
  const isSupported = Boolean(SpeechRecognition);

  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState(null);

  // Ref to the SpeechRecognition instance (singleton within the hook)
  const recognitionRef = useRef(null);
  // Keep track of cumulative final transcript across recognition events
  const finalTranscriptRef = useRef('');
  // Ref to the external setText callback so event handlers always have the
  // latest reference without re-binding.
  const setTextRef = useRef(null);
  // Guard against double-start
  const startingRef = useRef(false);

  const clearError = useCallback(() => setError(null), []);

  const stopListening = useCallback(() => {
    const rec = recognitionRef.current;
    if (rec) {
      try {
        rec.stop();
      } catch {
        // already stopped – ignore
      }
    }
    startingRef.current = false;
    setIsListening(false);
  }, []);

  const startListening = useCallback(
    (setText) => {
      if (!isSupported) {
        setError(
          'Your browser does not support speech recognition. Please try Chrome, Edge, or Safari.'
        );
        return;
      }

      // Prevent duplicate instances
      if (startingRef.current || recognitionRef.current) {
        stopListening();
        return;
      }

      startingRef.current = true;
      setError(null);
      finalTranscriptRef.current = '';
      setTextRef.current = setText;

      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = navigator.language || 'en-US';

      recognition.onstart = () => {
        startingRef.current = false;
        setIsListening(true);
      };

      recognition.onresult = (event) => {
        let finalSoFar = '';
        let interim = '';
        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            finalSoFar += result[0].transcript;
          } else {
            interim += result[0].transcript;
          }
        }
        finalTranscriptRef.current = finalSoFar;
        const combined = (finalSoFar + interim).trimStart();
        if (setTextRef.current) {
          setTextRef.current(combined);
        }
      };

      recognition.onerror = (event) => {
        const msg = friendlyError(event);
        if (msg) setError(msg);
        // Some errors auto-stop recognition; sync our state
        if (
          event.error === 'not-allowed' ||
          event.error === 'service-not-allowed' ||
          event.error === 'audio-capture'
        ) {
          recognitionRef.current = null;
          startingRef.current = false;
          setIsListening(false);
        }
      };

      recognition.onend = () => {
        // Clean up – recognition has ended (user stopped or error)
        recognitionRef.current = null;
        startingRef.current = false;
        setIsListening(false);
      };

      recognitionRef.current = recognition;

      try {
        recognition.start();
      } catch {
        setError('Failed to start speech recognition. Please try again.');
        recognitionRef.current = null;
        startingRef.current = false;
      }
    },
    [isSupported, stopListening]
  );

  // Cleanup on unmount or page hide (ensure mic is released)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) stopListening();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', stopListening);

    return () => {
      stopListening();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', stopListening);
    };
  }, [stopListening]);

  return {
    isSupported,
    isListening,
    error,
    startListening,
    stopListening,
    clearError,
  };
}

