import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:town_pass/service/senior_tts_service.dart';
import 'package:town_pass/util/web_message_handler/tp_web_message_handler.dart';

/// tts_check -> { available: bool }
class TtsCheckMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'tts_check';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    final bool available = await SeniorTtsService.supportsChinese();
    onReply?.call(replyWebMessage(data: {'available': available}));
  }
}

/// tts_speak { text } -> 'done' | 'stopped' | 'error'
class TtsSpeakMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'tts_speak';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    final String text = switch (message) {
      {'text': final Object? t} => t?.toString() ?? '',
      _ => '',
    };
    final String result = await SeniorTtsService.speak(text);
    onReply?.call(replyWebMessage(data: result));
  }
}

/// tts_stop -> no reply
class TtsStopMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'tts_stop';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    await SeniorTtsService.stop();
  }
}
