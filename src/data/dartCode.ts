export const dartCodeChunks = {
  full: `import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:html/parser.dart' as parser;
import 'package:html/dom.dart' as dom;
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:crypto/crypto.dart';

// =========================================================================
// 1. JSON Models & Configurations (Dynamic Scrape Guide & Job Posting)
// =========================================================================

/// 외부 JSON 파일이나 Remote Config에서 받아올 파싱 규칙 모델
class ScrapeGuide {
  final String code;         // 기관 고유 코드 (예: GY_OFFICE)
  final String agency;       // 기관명 (예: 계양구청)
  final String url;          // 수집 대상 URL
  final String baseUrl;      // 상대경로 복원을 위한 도메인 URL
  final String rowSelector;  // 게시글 행(Row)을 지정할 CSS Selector
  final String titleSelector;// 제목을 지정할 CSS Selector (row 내의 상대경로)
  final String dateSelector; // 등록일을 지정할 CSS Selector (row 내의 상대경로)
  final String linkSelector; // 상세 보기 링크를 지정할 CSS Selector (row 내의 상대경로)

  ScrapeGuide({
    required this.code,
    required this.agency,
    required this.url,
    required this.baseUrl,
    required this.rowSelector,
    required this.titleSelector,
    required this.dateSelector,
    required this.linkSelector,
  });

  factory ScrapeGuide.fromJson(Map<String, dynamic> json) {
    return ScrapeGuide(
      code: json['code'] as String,
      agency: json['agency'] as String,
      url: json['url'] as String,
      baseUrl: json['baseUrl'] as String,
      rowSelector: json['rowSelector'] as String,
      titleSelector: json['titleSelector'] as String,
      dateSelector: json['dateSelector'] as String,
      linkSelector: json['linkSelector'] as String,
    );
  }

  Map<String, dynamic> toJson() => {
    'code': code,
    'agency': agency,
    'url': url,
    'baseUrl': baseUrl,
    'rowSelector': rowSelector,
    'titleSelector': titleSelector,
    'dateSelector': dateSelector,
    'linkSelector': linkSelector,
  };
}

/// 온디바이스 DB(Hive)에 저장될 채용 공고 모델
@HiveType(typeId: 0)
class JobPosting extends HiveObject {
  @HiveField(0)
  final String id;           // Unique Key (Deterministic SHA-256)

  @HiveField(1)
  final String agencyCode;

  @HiveField(2)
  final String agencyName;

  @HiveField(3)
  final String title;

  @HiveField(4)
  final String url;

  @HiveField(5)
  final String createdAt;

  @HiveField(6)
  final String scrapedAt;

  JobPosting({
    required this.id,
    required this.agencyCode,
    required this.agencyName,
    required this.title,
    required this.url,
    required this.createdAt,
    required this.scrapedAt,
  });

  factory JobPosting.generate({
    required String agencyCode,
    required String agencyName,
    required String title,
    required String url,
    required String createdAt,
  }) {
    // 중복 방지용 고유 식별자 생성 (기관코드 + 제목 + URL 해시)
    final bytes = utf8.encode('$agencyCode-$title-$url');
    final digest = sha256.convert(bytes);
    return JobPosting(
      id: digest.toString().substring(0, 16),
      agencyCode: agencyCode,
      agencyName: agencyName,
      title: title,
      url: url,
      createdAt: createdAt,
      scrapedAt: DateTime.now().toIso8601String().split('T')[0],
    );
  }
}

// 샘플 가이드 JSON 스트링 (Remote Config 또는 서버 API에서 페치 가능)
const String SAMPLE_GUIDE_JSON = '''
[
  {
    "code": "GY_OFFICE",
    "agency": "계양구청",
    "url": "https://www.gyeyang.go.kr/open_content/main/open_info/admin/job.jsp",
    "baseUrl": "https://www.gyeyang.go.kr",
    "rowSelector": "table.list_table tbody tr, ul.list_board li",
    "titleSelector": "td.subject a, .left a, .title a",
    "dateSelector": "td.date, span.date, .write_date",
    "linkSelector": "td.subject a, .left a, .title a"
  },
  {
    "code": "GY_WOMAN",
    "agency": "계양여성회관",
    "url": "https://gywoman.or.kr/bbs/board.php?bo_table=notice02",
    "baseUrl": "https://gywoman.or.kr",
    "rowSelector": ".tbl_head01 tbody tr, .bo_list tr",
    "titleSelector": ".td_subject a, .bo_tit a",
    "dateSelector": ".td_date",
    "linkSelector": ".td_subject a, .bo_tit a"
  }
]
''';

// =========================================================================
// 2. On-Device Sequential Crawling Engine (Dynamic Headless WebView Queue)
// =========================================================================

class DynamicCrawlerEngine {
  final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();
  bool isCrawling = false;

  DynamicCrawlerEngine() {
    _initNotifications();
  }

  void _initNotifications() async {
    const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const iosSettings = DarwinInitializationSettings();
    await _notificationsPlugin.initialize(
      const InitializationSettings(android: androidSettings, iOS: iosSettings)
    );
  }

  /// 10개 사이트를 '비동기 순차 처리(Queue)' 방식으로 하나씩 크롤링하는 메인 함수
  Future<void> startSequentialCrawling(
    List<ScrapeGuide> guides, {
    required Function(String agency, String status) onProgress,
    required Function(int newPostingsCount) onFinished,
  }) async {
    if (isCrawling) return;
    isCrawling = true;
    int totalNewItems = 0;

    final jobBox = Hive.box<JobPosting>('job_postings');
    final todayStr = DateTime.now().toString().split(' ')[0];

    // 스마트폰 부하 방지를 위해 순차 처리 (Queue) 루프 작동
    for (int i = 0; i < guides.length; i++) {
      final guide = guides[i];
      onProgress(guide.agency, "크롤링 준비 중... (\${i + 1}/\${guides.length})");

      try {
        final rawHtml = await _fetchHtmlViaOptimizedWebView(guide.url);
        if (rawHtml == null || rawHtml.isEmpty) {
          throw Exception("HTML을 로드하지 못했습니다.");
        }

        onProgress(guide.agency, "HTML 파싱 및 오늘 날짜 필터링 중...");
        final parsedPostings = _parseDocument(rawHtml, guide);

        int addedInThisAgency = 0;
        for (var posting in parsedPostings) {
          // 1. 오늘 날짜가 아니면 자가검증에 의해 즉시 제외
          if (posting.createdAt != todayStr) {
            continue;
          }

          // 2. 온디바이스 DB 중복 체크 (Deduplication)
          if (!jobBox.containsKey(posting.id)) {
            await jobBox.put(posting.id, posting);
            addedInThisAgency++;
            totalNewItems++;

            // 신규 공고 로컬 푸시 알림 트리거
            _triggerPushNotification(posting);
          }
        }

        onProgress(guide.agency, "완료 (신규: \$addedInThisAgency개)");
      } catch (e) {
        onProgress(guide.agency, "오류 발생: \$e");
      }

      // 기기 발열 방지 및 리소스 반환을 위해 사이트 간 2초의 대기시간(Cool-down) 부여
      await Future.delayed(const Duration(seconds: 2));
    }

    isCrawling = false;
    onFinished(totalNewItems);
  }

  /// 배터리 및 데이터 절약을 위해 이미지/미디어 로딩이 원천 차단된 InAppWebView 비동기 인스턴스 실행
  Future<String?> _fetchHtmlViaOptimizedWebView(String targetUrl) async {
    final completer = Completer<String?>();
    HeadlessInAppWebView? headlessWebView;

    // WebView 성능 최적화 설정 적용 (이미지/미디어 로딩 비활성화)
    final optimizedSettings = InAppWebViewSettings(
      imagesFilter: true,                // 이미지 로딩 차단하여 데이터/배터리 극대화
      blockNetworkImage: true,           // 네트워크 이미지 블로킹
      loadsImagesAutomatically: false,  // 자동 이미지 로드 해제
      javaScriptEnabled: true,           // SPA 사이트 및 JS 동적 데이터 로딩용 허용
      preferredContentMode: UserPreferredContentMode.MOBILE, // 모바일 모드로 리소스 최소화
      userAgent: "Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1",
    );

    headlessWebView = HeadlessInAppWebView(
      initialUrlRequest: URLRequest(url: WebUri(targetUrl)),
      initialSettings: optimizedSettings,
      onLoadStop: (controller, url) async {
        // 페이지 로딩 완료 시 DOM HTML을 추출 후 리소스를 해제하기 위해 Completer 호출
        final html = await controller.getHtml();
        completer.complete(html);
        
        // 사용이 완료된 HeadlessWebView 즉각 폐기하여 배터리 절약
        headlessWebView?.dispose();
      },
      onReceivedError: (controller, request, error) {
        if (!completer.isCompleted) {
          completer.completeError("WebView Error: \${error.description}");
          headlessWebView?.dispose();
        }
      },
    );

    await headlessWebView.run();
    return completer.future.timeout(
      const Duration(seconds: 15),
      onTimeout: () {
        headlessWebView?.dispose();
        return null;
      },
    );
  }

  /// html 패키지를 활용한 다이내믹 CSS Selector 파싱 엔진
  List<JobPosting> _parseDocument(String htmlContent, ScrapeGuide guide) {
    final List<JobPosting> results = [];
    final document = parser.parse(htmlContent);

    // Dynamic Row Selector 매핑
    final rows = document.querySelectorAll(guide.rowSelector);
    final todayStr = DateTime.now().toString().split(' ')[0];

    for (var row in rows) {
      try {
        final titleEl = row.querySelector(guide.titleSelector);
        final dateEl = row.querySelector(guide.dateSelector);
        final linkEl = row.querySelector(guide.linkSelector);

        if (titleEl != null && dateEl != null) {
          final title = titleEl.text.trim();
          final rawDate = dateEl.text.trim();
          var link = linkEl?.attributes['href'] ?? '';

          // 상대 경로를 절대 경로로 복원
          if (link.isNotEmpty && !link.startsWith('http')) {
            if (link.startsWith('/')) {
              link = '\${guide.baseUrl}\$link';
            } else {
              link = '\${guide.baseUrl}/\$link';
            }
          }

          // 다양한 한글 날짜 포맷 표준화 (YYYY-MM-DD)
          final cleanDate = _normalizeDate(rawDate);

          final posting = JobPosting.generate(
            agencyCode: guide.code,
            agencyName: guide.agency,
            title: title,
            url: link,
            createdAt: cleanDate,
          );

          results.add(posting);
        }
      } catch (_) {
        // 특정 행 파싱 실패 시 다음 행으로 안전하게 통과
      }
    }

    return results;
  }

  String _normalizeDate(String rawDate) {
    final dateRegex = RegExp(r'(\d{4})[-.](\d{2})[-.](\d{2})');
    final match = dateRegex.firstMatch(rawDate);
    if (match != null) {
      return "\${match.group(1)}-\${match.group(2)}-\${match.group(3)}";
    }
    // 예: 26.07.04 같은 형태 보정
    final shortDateRegex = RegExp(r'(\d{2})[-.](\d{2})[-.](\d{2})');
    final shortMatch = shortDateRegex.firstMatch(rawDate);
    if (shortMatch != null) {
      return "20\${shortMatch.group(1)}-\${shortMatch.group(2)}-\${shortMatch.group(3)}";
    }
    return DateTime.now().toString().split(' ')[0]; // 매치 안될 시 오늘 날짜 반환
  }

  void _triggerPushNotification(JobPosting posting) async {
    const androidDetails = AndroidNotificationDetails(
      'job_crawler_channel',
      '신규 채용 소식 알림',
      channelDescription: '오늘 등록된 신규 채용 공고 발생 시 푸시 전송',
      importance: Importance.max,
      priority: Priority.high,
    );
    const notificationDetails = NotificationDetails(android: androidDetails);
    
    await _notificationsPlugin.show(
      posting.id.hashCode,
      '[\${posting.agencyName}] 신규 채용 알림',
      posting.title,
      notificationDetails,
    );
  }
}
`,
  models: `// =========================================================================
// 1. Dynamic Scrape Guide & Job Posting Models
// =========================================================================
import 'dart:convert';
import 'package:hive/hive.dart';
import 'package:crypto/crypto.dart';

part 'models.g.dart'; // Hive Type Generator 파일

/// 서버 연동 및 Remote Config용 다이내믹 셀렉터 바인딩 가이드 모델
class ScrapeGuide {
  final String code;
  final String agency;
  final String url;
  final String baseUrl;
  final String rowSelector;
  final String titleSelector;
  final String dateSelector;
  final String linkSelector;

  ScrapeGuide({
    required this.code,
    required this.agency,
    required this.url,
    required this.baseUrl,
    required this.rowSelector,
    required this.titleSelector,
    required this.dateSelector,
    required this.linkSelector,
  });

  factory ScrapeGuide.fromJson(Map<String, dynamic> json) {
    return ScrapeGuide(
      code: json['code'] as String,
      agency: json['agency'] as String,
      url: json['url'] as String,
      baseUrl: json['baseUrl'] as String,
      rowSelector: json['rowSelector'] as String,
      titleSelector: json['titleSelector'] as String,
      dateSelector: json['dateSelector'] as String,
      linkSelector: json['linkSelector'] as String,
    );
  }
}

/// 온디바이스 NoSQL 데이터베이스인 Hive 고유 모델 정의
@HiveType(typeId: 0)
class JobPosting extends HiveObject {
  @HiveField(0)
  final String id; // 기관코드, 제목, url을 결정론적 해싱하여 생성

  @HiveField(1)
  final String agencyCode;

  @HiveField(2)
  final String agencyName;

  @HiveField(3)
  final String title;

  @HiveField(4)
  final String url;

  @HiveField(5)
  final String createdAt;

  @HiveField(6)
  final String scrapedAt;

  JobPosting({
    required this.id,
    required this.agencyCode,
    required this.agencyName,
    required this.title,
    required this.url,
    required this.createdAt,
    required this.scrapedAt,
  });

  factory JobPosting.generate({
    required String agencyCode,
    required String agencyName,
    required String title,
    required String url,
    required String createdAt,
  }) {
    final bytes = utf8.encode('$agencyCode-$title-$url');
    final digest = sha256.convert(bytes);
    return JobPosting(
      id: digest.toString().substring(0, 16),
      agencyCode: agencyCode,
      agencyName: agencyName,
      title: title,
      url: url,
      createdAt: createdAt,
      scrapedAt: DateTime.now().toIso8601String().split('T')[0],
    );
  }
}`,
  crawlers: `// =========================================================================
// 2. 비동기 순차 처리(Queue) & WebView 이미지 로딩 최적화 엔진
// =========================================================================
import 'dart:async';
import 'package:flutter_inappwebview/flutter_inappwebview.dart';
import 'package:html/parser.dart' as parser;
import 'models.dart';

class SequentialCrawlingEngine {
  
  /// 스마트폰의 리소스를 방어하고 CPU 과부하를 막기 위한 비동기 순차 크롤링 큐(Queue)
  Future<List<JobPosting>> startSequentialCrawling(List<ScrapeGuide> guides) async {
    final List<JobPosting> todayNewPostings = [];
    
    for (var guide in guides) {
      try {
        // 비동기 순차 처리로 한 번에 단 하나의 사이트만 파싱
        final String? html = await _fetchHtmlWithBatteryOptimizedWebView(guide.url);
        if (html != null) {
          final List<JobPosting> items = _parseDocumentWithSelectors(html, guide);
          todayNewPostings.addAll(items);
        }
      } catch (e) {
        print("Sequential Scrape Error at \${guide.agency}: \$e");
      }
      
      // 대상 사이트 차단 회피 및 디바이스 쿨다운을 위한 지연 부여
      await Future.delayed(const Duration(seconds: 2));
    }
    
    return todayNewPostings;
  }

  /// 배터리 소모를 극적으로 줄이기 위한 웹뷰 최적화 설정 코드 (InAppWebViewSettings)
  Future<String?> _fetchHtmlWithBatteryOptimizedWebView(String targetUrl) async {
    final completer = Completer<String?>();
    HeadlessInAppWebView? headlessWebView;

    final batteryOptimizedSettings = InAppWebViewSettings(
      imagesFilter: true,                // 리소스 로딩 필터 활성화
      blockNetworkImage: true,           // 네트워크를 통한 모든 이미지 다운로드 차단
      loadsImagesAutomatically: false,  // 자동 이미지 로딩 무시
      javaScriptEnabled: true,           // AJAX 데이터 바인딩을 위한 최소 JS 엔진만 허용
      preferredContentMode: UserPreferredContentMode.MOBILE,
      userAgent: "Mozilla/5.0 (Linux; Android 10) Mobile Safari/537.36",
    );

    headlessWebView = HeadlessInAppWebView(
      initialUrlRequest: URLRequest(url: WebUri(targetUrl)),
      initialSettings: batteryOptimizedSettings,
      onLoadStop: (controller, url) async {
        final html = await controller.getHtml();
        completer.complete(html);
        headlessWebView?.dispose(); // 리소스 완전 반환
      },
      onReceivedError: (controller, request, error) {
        if (!completer.isCompleted) {
          completer.completeError("Fetch Failed: \${error.description}");
          headlessWebView?.dispose();
        }
      },
    );

    await headlessWebView.run();
    return completer.future.timeout(const Duration(seconds: 15));
  }

  List<JobPosting> _parseDocumentWithSelectors(String html, ScrapeGuide guide) {
    final List<JobPosting> list = [];
    final doc = parser.parse(html);
    final rows = doc.querySelectorAll(guide.rowSelector);

    for (var row in rows) {
      final titleEl = row.querySelector(guide.titleSelector);
      final dateEl = row.querySelector(guide.dateSelector);
      final linkEl = row.querySelector(guide.linkSelector);

      if (titleEl != null && dateEl != null) {
        list.add(JobPosting.generate(
          agencyCode: guide.code,
          agencyName: guide.agency,
          title: titleEl.text.trim(),
          url: linkEl?.attributes['href'] ?? guide.url,
          createdAt: dateEl.text.trim(),
        ));
      }
    }
    return list;
  }
}`,
  factory: `// =========================================================================
// 3. On-Device Local NoSQL DB Deduplication & Push Manager
// =========================================================================
import 'package:hive_flutter/hive_flutter.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'models.dart';

class LocalDatabaseManager {
  static const String boxName = 'job_postings';
  final FlutterLocalNotificationsPlugin _notifications = FlutterLocalNotificationsPlugin();

  static Future<void> initDB() async {
    await Hive.initFlutter();
    Hive.registerAdapter(JobPostingAdapter());
    await Hive.openBox<JobPosting>(boxName);
  }

  /// 중복 체크 자가검증 알고리즘 및 저장 로직
  Future<int> processAndSavePostings(List<JobPosting> fetchedList) async {
    final box = Hive.box<JobPosting>(boxName);
    final todayStr = DateTime.now().toString().split(' ')[0];
    int newItemsCount = 0;

    for (var posting in fetchedList) {
      // 1단계: 오늘 날짜인지 자가검증 필터링
      if (posting.createdAt != todayStr) {
        continue;
      }

      // 2단계: NoSQL Key 중복 검증 (Deduplication)
      if (!box.containsKey(posting.id)) {
        await box.put(posting.id, posting);
        newItemsCount++;
        
        // 3단계: 신규 아이템에 한해 로컬 백그라운드 푸시 알림 전송
        _showPushNotification(posting);
      }
    }

    return newItemsCount;
  }

  void _showPushNotification(JobPosting item) async {
    const android = AndroidNotificationDetails(
      'bg_crawler_chan', '온디바이스 수집기',
      importance: Importance.max, priority: Priority.high,
    );
    await _notifications.show(
      item.id.hashCode,
      '[\${item.agencyName}] 신규 공고 등록',
      item.title,
      const NotificationDetails(android: android),
    );
  }
}`,
  ui: `// =========================================================================
// 4. Flutter UI Dashboard Control Center (HomeScreen)
// =========================================================================
import 'package:flutter/material.dart';
import 'models.dart';
import 'crawlers.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final SequentialCrawlingEngine _engine = SequentialCrawlingEngine();
  Map<String, String> _statusMap = {};
  bool _isProcessing = false;

  final List<ScrapeGuide> _guides = [
    ScrapeGuide(
      code: "GY_OFFICE", agency: "계양구청",
      url: "https://www.gyeyang.go.kr/open_content/main/open_info/admin/job.jsp",
      baseUrl: "https://www.gyeyang.go.kr",
      rowSelector: "table.list_table tbody tr",
      titleSelector: "td.subject a", dateSelector: "td.date", linkSelector: "td.subject a"
    ),
    ScrapeGuide(
      code: "GY_WOMAN", agency: "계양여성회관",
      url: "https://gywoman.or.kr/bbs/board.php?bo_table=notice02",
      baseUrl: "https://gywoman.or.kr",
      rowSelector: ".tbl_head01 tbody tr",
      titleSelector: ".td_subject a", dateSelector: ".td_date", linkSelector: ".td_subject a"
    ),
  ];

  void _triggerOnDeviceScrape() async {
    setState(() {
      _isProcessing = true;
      _statusMap.clear();
    });

    await _engine.startSequentialCrawling(_guides);

    setState(() {
      _isProcessing = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('온디바이스 모바일 크롤러')),
      body: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          children: [
            ElevatedButton(
              onPressed: _isProcessing ? null : _triggerOnDeviceScrape,
              child: const Text('모바일 통신망 수집 시작'),
            ),
            const SizedBox(height: 20),
            Expanded(
              child: ListView.builder(
                itemCount: _guides.length,
                itemBuilder: (context, index) {
                  final guide = _guides[index];
                  return ListTile(
                    title: Text(guide.agency),
                    subtitle: Text(guide.url),
                    trailing: Text(_statusMap[guide.code] ?? '대기 중'),
                  );
                },
              ),
            )
          ],
        ),
      ),
    );
  }
}`
};
