import 'package:flutter_tts/flutter_tts.dart';

// On-device text-to-speech for the senior-card microservice web page
// (Android WebView has no Web Speech API, so the App speaks instead).
// Uses only the device TTS engine; no network involved.
class SeniorTtsService {
  SeniorTtsService._();

  static final FlutterTts _tts = FlutterTts();
  static bool _initialized = false;

  static Future<void> ensureInit() async {
    if (_initialized) return;
    try {
      await _tts.setSharedInstance(true);
    } catch (_) {
      // Not supported on this platform version; safe to ignore.
    }
    try {
      await _tts.setIosAudioCategory(
        IosTextToSpeechAudioCategory.playback,
        [
          IosTextToSpeechAudioCategoryOptions.defaultToSpeaker,
          IosTextToSpeechAudioCategoryOptions.allowBluetooth,
          IosTextToSpeechAudioCategoryOptions.allowBluetoothA2DP,
        ],
      );
    } catch (_) {
      // Android: no-op.
    }
    try {
      await _tts.awaitSpeakCompletion(true);
    } catch (_) {
      // Older engine behavior; completion is still reported via handlers.
    }
    _initialized = true;
  }

  static Future<bool> supportsChinese() async {
    try {
      await ensureInit();
      final List<dynamic>? langs = await _tts.getLanguages;
      return (langs ?? [])
          .map((e) => e.toString().toLowerCase())
          .any((tag) => tag.startsWith('zh'));
    } catch (_) {
      return false;
    }
  }

  static Future<void> stop() async {
    try {
      await ensureInit();
      await _tts.stop();
    } catch (_) {
      // Best effort only.
    }
  }

  /// Speaks [text] and completes with 'done', 'stopped' or 'error'.
  static Future<String> speak(String text) async {
    if (text.trim().isEmpty) return 'done';
    try {
      await ensureInit();
      await _tts.stop();
      await _tts.setLanguage('zh-TW');
      await _tts.setSpeechRate(0.45);
      await _tts.setVolume(1.0);
      await _tts.setPitch(1.0);
      final dynamic result = await _tts
          .speak(text)
          .timeout(const Duration(minutes: 10), onTimeout: () async {
        await _tts.stop();
        return 'stopped';
      });
      return result == 1 ? 'done' : 'error';
    } catch (_) {
      return 'error';
    }
  }
}
