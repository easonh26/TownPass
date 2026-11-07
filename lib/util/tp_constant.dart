import 'dart:ui';

const double kTPToolbarHeight = 56;

const double kTPToolbarBottomHeight = 46;

const String tpLaunchMailScheme = 'mailto';

const String tpMailAddress = 'CodeFestTaipei@gov.taipei';

const Size tpSwitchSize = Size(48, 32);

const double goldenRatio = 1.618;

/// 敬老卡微服務網址（build 時可覆寫）：
/// `flutter run --dart-define=MICROSERVICE_URL=https://host/`
const String kMicroserviceUrl = String.fromEnvironment(
  'MICROSERVICE_URL',
  defaultValue: 'https://cdf19.twread.net/',
);

const String kMicroserviceTitle = '敬老卡優惠場所查詢';
