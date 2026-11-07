import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:town_pass/util/web_message_handler/tp_web_message_handler.dart';
import 'package:url_launcher/url_launcher.dart';

// open_external {url as String} -> fire-and-forget (no reply).
// Opens the URL in the system browser (outside the App WebView), so pages
// that don't work inside the WebView (e.g. easycard balance lookup with
// captcha/JS requirements, OSM directions) remain usable.
// Uses the existing url_launcher dependency (BSD-3, AGPL-compatible).
class OpenExternalMessageHandler extends TPWebMessageHandler {
  @override
  String get name => 'open_external';

  @override
  Future<void> handle({
    required Object? message,
    required WebUri? sourceOrigin,
    required bool isMainFrame,
    required Function(WebMessage reply)? onReply,
  }) async {
    final String? raw = switch (message) {
      String s => s,
      {'url': final Object? u} => u?.toString(),
      _ => null,
    };
    if (raw == null || raw.isEmpty) return;
    final Uri? uri = Uri.tryParse(raw);
    if (uri == null) return;
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      }
    } catch (_) {
      // Best effort only; web side does not wait for a reply.
    }
  }
}
