import 'dart:async';
import 'dart:typed_data';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/services.dart' show rootBundle;
import 'package:flutter_onnxruntime/flutter_onnxruntime.dart';

// On-device Taiwanese (Minnan) TTS using the team's VITS model
// (neurlang/coqui-vits-suisiann-minnan-hokkien, CC-BY-SA-4.0, see
// assets/models/taigi-vits/NOTICE). Input is a phoneme string as produced
// by the build-time pygoruut pipeline (NFD + g>ɡ + ʰ>ʜ); token IDs follow
// assets/models/taigi-vits/tokens.txt with BOS=2, EOS=1.
class TaigiTtsService {
  TaigiTtsService._();

  static const String _modelAsset = 'assets/models/taigi-vits/model.onnx';
  static const String _tokensAsset = 'assets/models/taigi-vits/tokens.txt';
  static const int _sampleRate = 22050;

  static OrtSession? _session;
  static Map<String, int>? _tokens;
  static final AudioPlayer _player = AudioPlayer();
  static bool _unavailable = false;
  static String? _unavailableReason;
  static Future<bool>? _initFuture;
  static Completer<void>? _playDone;
  // Generation counter: every stop() bumps it; each speak() captures its own
  // generation and aborts if a newer stop/speak superseded it. This isolates
  // overlapping utterances even when stop/speak messages interleave.
  static int _gen = 0;

  static void _log(String msg) {
    // ignore: avoid_print
    print('[taigi] $msg');
  }

  /// Shared init future: concurrent callers join the same load, never double-load.
  static Future<bool> _ensureInit() {
    if (_session != null && _tokens != null) return Future.value(true);
    if (_unavailable) return Future.value(false);
    _initFuture ??= _load();
    return _initFuture!;
  }

  static Future<bool> _load() async {
    final sw = Stopwatch()..start();
    try {
      _log('init start (model 114MB, first load takes a while)');
      final ort = OnnxRuntime();
      _session = await ort.createSessionFromAsset(_modelAsset);
      _log('session created in ${sw.elapsedMilliseconds}ms, loading tokens');
      final raw = await rootBundle.loadString(_tokensAsset);
      final map = <String, int>{};
      for (final line in raw.split('\n')) {
        final s = line.trimRight();
        if (s.isEmpty) continue;
        final i = s.lastIndexOf(' ');
        map[s.substring(0, i)] = int.parse(s.substring(i + 1));
      }
      _tokens = map;
      _log('init done in ${sw.elapsedMilliseconds}ms, ${map.length} tokens');
      return true;
    } catch (e) {
      _log('init FAILED after ${sw.elapsedMilliseconds}ms: $e');
      _unavailable = true;
      _unavailableReason = e.toString();
      _session = null;
      _tokens = null;
      return false;
    } finally {
      _initFuture = null;
    }
  }

  /// Fire-and-forget warmup, e.g. when the user enters the service.
  static void warmup() {
    _log('warmup requested');
    _ensureInit().then((ok) => _log('warmup finished: $ok'));
  }

  /// 'ready' | 'loading' | 'unavailable'. Never throws.
  static Future<Map<String, Object>> status() async {
    if (_session != null && _tokens != null) return {'status': 'ready'};
    if (_unavailable) {
      final Map<String, Object> out = {'status': 'unavailable'};
      final String? reason = _unavailableReason;
      if (reason != null) out['error'] = reason;
      return out;
    }
    if (_initFuture != null) return {'status': 'loading'};
    return {'status': 'idle'};
  }

  static Future<bool> supportsTaigi() async {
    try {
      return await _ensureInit();
    } catch (e) {
      _log('supportsTaigi error: $e');
      return false;
    }
  }

  static Future<void> stop() async {
    _gen++;
    // Release any speak() stuck in its playback wait so it returns promptly.
    final Completer<void>? waiter = _playDone;
    _playDone = null;
    if (waiter != null && !waiter.isCompleted) waiter.complete();
    try {
      await _player.stop();
    } catch (_) {
      // Best effort only.
    }
  }

  /// Speaks [phonemes] and completes with 'done', 'stopped' or 'error'.
  static Future<String> speak(String phonemes) async {
    if (phonemes.trim().isEmpty) return 'done';
    // Serialize with any in-flight utterance (own or interrupted).
    await stop();
    final int myGen = _gen;
    _log('speak start gen=$myGen, ${phonemes.length} chars');
    try {
      if (!await _ensureInit()) {
        _log('speak: init failed');
        return 'error';
      }
      final tokens = _tokens!;
      final ids = <int>[2];
      for (final rune in phonemes.runes) {
        final ch = String.fromCharCode(rune);
        final id = tokens[ch];
        if (id == null) {
          _log('speak: unknown phoneme char U+${rune.toRadixString(16).toUpperCase()}');
          return 'error';
        }
        ids.add(id);
      }
      ids.add(1);
      _log('speak: tokenized ${ids.length} ids');
      final session = _session!;
      final inputs = <String, OrtValue>{
        // NOTE: pass typed lists so ORT gets int64 / float32 (plain Dart
        // int/double Lists become int32, which the VITS model rejects).
        'input': await OrtValue.fromList(
          Int64List.fromList(ids),
          [1, ids.length],
        ),
        'input_lengths': await OrtValue.fromList(
          Int64List.fromList([ids.length]),
          [1],
        ),
        'scales': await OrtValue.fromList(
          Float32List.fromList([0.667, 0.667, 1.0]),
          [3],
        ),
      };
      final outputs = await session.run(inputs).timeout(
        const Duration(minutes: 2),
        onTimeout: () => throw TimeoutException('taigi inference timeout'),
      );
      final raw = await outputs['output']!.asList();
      final samples = _flatten(raw);
      _log('speak: inference done, ${samples.length} samples');
      if (samples.isEmpty) {
        _log('speak: empty samples -> error');
        return 'error';
      }
      // Superseded by a newer stop()/speak()? Drop silently instead of overlapping.
      if (myGen != _gen) {
        _log('speak: superseded after inference -> stopped');
        return 'stopped';
      }
      final wav = _toWav16(samples, _sampleRate);
      final done = Completer<void>();
      _playDone = done;
      StreamSubscription<void>? sub;
      sub = _player.onPlayerComplete.listen((_) {
        if (!done.isCompleted) done.complete();
      });
      try {
        await _player.play(BytesSource(wav));
        await done.future.timeout(
          const Duration(minutes: 10),
          onTimeout: () async {
            await _player.stop();
          },
        );
      } finally {
        await sub.cancel();
        if (identical(_playDone, done)) _playDone = null;
      }
      final String result = myGen != _gen ? 'stopped' : 'done';
      _log('speak: playback finished -> $result');
      return result;
    } on TimeoutException {
      _log('speak: timeout -> stopped');
      return 'stopped';
    } catch (e) {
      _log('speak FAILED: $e');
      return 'error';
    }
  }

  static List<double> _flatten(Object? node) {
    if (node is List) {
      final out = <double>[];
      for (final e in node) {
        out.addAll(_flatten(e));
      }
      return out;
    }
    if (node is num) return [node.toDouble()];
    return const [];
  }

  static Uint8List _toWav16(List<double> samples, int sampleRate) {
    final data = ByteData(44 + samples.length * 2);
    void ascii(int offset, String s) {
      for (var i = 0; i < s.length; i++) {
        data.setUint8(offset + i, s.codeUnitAt(i));
      }
    }

    ascii(0, 'RIFF');
    data.setUint32(4, 36 + samples.length * 2, Endian.little);
    ascii(8, 'WAVE');
    ascii(12, 'fmt ');
    data.setUint32(16, 16, Endian.little);
    data.setUint16(20, 1, Endian.little); // PCM
    data.setUint16(22, 1, Endian.little); // mono
    data.setUint32(24, sampleRate, Endian.little);
    data.setUint32(28, sampleRate * 2, Endian.little);
    data.setUint16(32, 2, Endian.little);
    data.setUint16(34, 16, Endian.little);
    ascii(36, 'data');
    data.setUint32(40, samples.length * 2, Endian.little);
    for (var i = 0; i < samples.length; i++) {
      final v = (samples[i].clamp(-1.0, 1.0) * 32767).round();
      data.setInt16(44 + i * 2, v, Endian.little);
    }
    return data.buffer.asUint8List();
  }
}
