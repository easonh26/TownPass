import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:town_pass/service/senior_tts_service.dart';
import 'package:town_pass/service/taigi_tts_service.dart';
import 'package:town_pass/util/web_message_handler/tp_web_message_handler.dart';

/// taigi_warmup -> no reply. Starts model load in the background.
class TaigiWarmupMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'taigi_warmup';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    TaigiTtsService.warmup();
  }
}

/// taigi_check -> { available: bool, status: ready|loading|idle|unavailable, ... }
class TaigiCheckMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'taigi_check';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    final Map<String, Object> st = await TaigiTtsService.status();
    final String status = st['status'] as String? ?? 'unavailable';
    final bool available = status == 'ready';
    onReply?.call(replyWebMessage(data: {'available': available, ...st}));
  }
}

/// taigi_speak {phonemes} -> 'done' | 'stopped' | 'error'
class TaigiSpeakMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'taigi_speak';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    final String phonemes = switch (message) {
      {'phonemes': final Object? p} => p?.toString() ?? '',
      String s => s,
      _ => '',
    };
    // Cross-engine: never let Mandarin speech play over Taigi audio.
    await SeniorTtsService.stop();
    final String result = await TaigiTtsService.speak(phonemes);
    onReply?.call(replyWebMessage(data: result));
  }
}

/// taigi_stop -> no reply
class TaigiStopMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'taigi_stop';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    await TaigiTtsService.stop();
  }
}
