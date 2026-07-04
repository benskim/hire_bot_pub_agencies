export const dartCodeChunks = {
  full: `import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:html/parser.dart' as parser;
import 'package:html/dom.dart';
import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';

// ==========================================
// 1. Data Model (JobPosting)
// ==========================================
class JobPosting {
  final String id;
  final String agencyCode;
  final String agencyName;
  final String title;
  final String url;
  final String createdAt;

  JobPosting({
    required this.id,
    required this.agencyCode,
    required this.agencyName,
    required this.title,
    required this.url,
    required this.createdAt,
  });

  factory JobPosting.create({
    required String agencyCode,
    required String agencyName,
    required String title,
    required String url,
    required String createdAt,
  }) {
    // Generate a unique ID by hashing agencyCode, title, and url
    final bytes = utf8.encode('$agencyCode-$title-$url');
    final digest = sha256.convert(bytes);
    return JobPosting(
      id: digest.toString().substring(0, 16),
      agencyCode: agencyCode,
      agencyName: agencyName,
      title: title,
      url: url,
      createdAt: createdAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'agencyCode': agencyCode,
      'agencyName': agencyName,
      'title': title,
      'url': url,
      'createdAt': createdAt,
    };
  }
}

// ==========================================
// 2. Abstract Base Class & Date Extraction Helper
// ==========================================
abstract class JobCrawler {
  String get agencyName;
  String get agencyCode;
  Future<List<JobPosting>> crawl();
}

String extractDateFromRow(Element element, String defaultDate) {
  var row = element.parent;
  while (row != null && row.localName != 'tr') {
    row = row.parent;
  }
  if (row != null) {
    final cells = row.querySelectorAll('td, span, div');
    final dateRegex = RegExp(r'(\\d{4})[-.](\\d{2})[-.](\\d{2})');
    final shortDateRegex = RegExp(r'^(\\d{2})[-.](\\d{2})\$');
    for (var cell in cells) {
      final text = cell.text.trim();
      final match = dateRegex.firstMatch(text);
      if (match != null) {
        return "\${match.group(1)}-\${match.group(2)}-\${match.group(3)}";
      }
      final shortMatch = shortDateRegex.firstMatch(text);
      if (shortMatch != null) {
        final currentYear = DateTime.now().year;
        return "\$currentYear-\${shortMatch.group(1)}-\${shortMatch.group(2)}";
      }
    }
  }
  return defaultDate;
}

// ==========================================
// 3. Concrete Implementation: GyOfficeCrawler (Java Spring type)
// ==========================================
class GyOfficeCrawler extends JobCrawler {
  @override
  String get agencyName => "계양구청";
  
  @override
  String get agencyCode => "GY_OFFICE";

  final String targetUrl = "https://www.gyeyang.go.kr/open_content/main/open_info/admin/job.jsp";

  @override
  Future<List<JobPosting>> crawl() async {
    final List<JobPosting> postings = [];
    try {
      final response = await http.get(
        Uri.parse(targetUrl),
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
          'Referer': 'https://www.gyeyang.go.kr/',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        throw Exception("HTTP Failed with status: \${response.statusCode}");
      }

      // Convert body to UTF-8 to handle Korean encoding properly
      final document = parser.parse(utf8.decode(response.bodyBytes));
      
      // Parse using "td.subject a" or ".left a"
      var elements = document.querySelectorAll('td.subject a');
      if (elements.isEmpty) {
        elements = document.querySelectorAll('.left a');
      }

      final todayStr = DateTime.now().toString().split(' ')[0];

      for (var element in elements) {
        final title = element.text.trim();
        var href = element.attributes['href'] ?? '';
        
        if (title.isNotEmpty && href.isNotEmpty) {
          // Resolve relative URL
          if (!href.startsWith('http')) {
            if (href.startsWith('/')) {
              href = 'https://www.gyeyang.go.kr\${href}';
            } else {
              href = 'https://www.gyeyang.go.kr/open_content/main/open_info/admin/\${href}';
            }
          }
          
          final postingDate = extractDateFromRow(element, todayStr);
          if (postingDate == todayStr) {
            postings.add(
              JobPosting.create(
                agencyCode: agencyCode,
                agencyName: agencyName,
                title: title,
                url: href,
                createdAt: postingDate,
              ),
            );
          }
        }
      }
    } catch (e) {
      debugPrint("Error in GyOfficeCrawler: \$e");
      rethrow;
    }
    return postings;
  }
}

// ==========================================
// 4. Concrete Implementation: GyWomanCrawler (GNUBoard type)
// ==========================================
class GyWomanCrawler extends JobCrawler {
  @override
  String get agencyName => "계양여성회관";

  @override
  String get agencyCode => "GY_WOMAN";

  final String targetUrl = "https://gywoman.or.kr/bbs/board.php?bo_table=notice02";

  @override
  Future<List<JobPosting>> crawl() async {
    final List<JobPosting> postings = [];
    try {
      final response = await http.get(
        Uri.parse(targetUrl),
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
          'Referer': 'https://gywoman.or.kr/',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        throw Exception("HTTP Failed with status: \${response.statusCode}");
      }

      final document = parser.parse(utf8.decode(response.bodyBytes));
      
      // Parse using ".td_subject a" or ".bo_tit a"
      var elements = document.querySelectorAll('.td_subject a');
      if (elements.isEmpty) {
        elements = document.querySelectorAll('.bo_tit a');
      }

      final todayStr = DateTime.now().toString().split(' ')[0];

      for (var element in elements) {
        final title = element.text.trim();
        var href = element.attributes['href'] ?? '';
        
        if (title.isNotEmpty && href.isNotEmpty) {
          final cleanTitle = title.replaceAll(RegExp(r'\\s+'), ' ');
          if (cleanTitle.contains('댓글') || cleanTitle.isEmpty) continue;

          if (!href.startsWith('http')) {
            if (href.startsWith('/')) {
              href = 'https://gywoman.or.kr\${href}';
            } else {
              href = 'https://gywoman.or.kr/bbs/\${href}';
            }
          }
          
          final postingDate = extractDateFromRow(element, todayStr);
          if (postingDate == todayStr) {
            postings.add(
              JobPosting.create(
                agencyCode: agencyCode,
                agencyName: agencyName,
                title: cleanTitle,
                url: href,
                createdAt: postingDate,
              ),
            );
          }
        }
      }
    } catch (e) {
      debugPrint("Error in GyWomanCrawler: \$e");
      rethrow;
    }
    return postings;
  }
}

// ==========================================
// 5. Concrete Implementation: IceNttCrawler (Education Board)
// ==========================================
class IceNttCrawler extends JobCrawler {
  @override
  final String agencyName;
  @override
  final String agencyCode;
  final String targetUrl;

  IceNttCrawler({
    required this.agencyName,
    required this.agencyCode,
    required this.targetUrl,
  });

  @override
  Future<List<JobPosting>> crawl() async {
    final List<JobPosting> postings = [];
    try {
      final uri = Uri.parse(targetUrl);
      final baseUrl = "\${uri.scheme}://\${uri.host}";

      final response = await http.get(
        uri,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
          'Referer': baseUrl,
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        throw Exception("HTTP Failed with status: \${response.statusCode}");
      }

      final document = parser.parse(utf8.decode(response.bodyBytes));
      
      // Parse using "td.nttSj a", "td.title a", or "td.subject a"
      var elements = document.querySelectorAll('td.nttSj a');
      if (elements.isEmpty) {
        elements = document.querySelectorAll('td.title a');
      }
      if (elements.isEmpty) {
        elements = document.querySelectorAll('td.subject a');
      }

      final todayStr = DateTime.now().toString().split(' ')[0];

      for (var element in elements) {
        final title = element.text.trim();
        var href = element.attributes['href'] ?? '';
        
        if (title.isNotEmpty && href.isNotEmpty) {
          if (!href.startsWith('http')) {
            if (href.startsWith('/')) {
              href = '\$baseUrl\${href}';
            } else {
              // Resolve relative to current directory
              final pathSegments = List<String>.from(uri.pathSegments);
              if (pathSegments.isNotEmpty) {
                pathSegments.removeLast();
              }
              final basePath = pathSegments.join('/');
              href = '\$baseUrl/\$basePath/\${href}';
            }
          }
          
          final postingDate = extractDateFromRow(element, todayStr);
          if (postingDate == todayStr) {
            postings.add(
              JobPosting.create(
                agencyCode: agencyCode,
                agencyName: agencyName,
                title: title,
                url: href,
                createdAt: postingDate,
              ),
            );
          }
        }
      }
    } catch (e) {
      debugPrint("Error in IceNttCrawler (\$agencyCode): \$e");
      rethrow;
    }
    return postings;
  }
}

// ==========================================
// 6. Crawler Factory & Registry Strategy
// ==========================================
class CrawlerFactory {
  static JobCrawler? create(Map<String, String> config) {
    final code = config['code'];
    final name = config['agency'];
    final type = config['type'];
    final url = config['url'];

    if (code == null || name == null || type == null || url == null) {
      return null;
    }

    switch (type) {
      case 'SPRING':
        return GyOfficeCrawler();
      case 'GNUBOARD':
        return GyWomanCrawler();
      case 'ICE_NTT':
        return IceNttCrawler(
          agencyName: name,
          agencyCode: code,
          targetUrl: url,
        );
      default:
        return null;
    }
  }
}

class CrawlerManager {
  final List<Map<String, String>> configs;

  CrawlerManager(this.configs);

  Future<List<JobPosting>> runAllCrawlers({
    void Function(String code, String status)? onProgress,
  }) async {
    final List<JobCrawler> crawlers = [];
    
    for (var config in configs) {
      final crawler = CrawlerFactory.create(config);
      if (crawler != null) {
        crawlers.add(crawler);
      }
    }

    // Run in parallel using Future.wait
    final List<Future<List<JobPosting>>> futures = crawlers.map((crawler) async {
      onProgress?.call(crawler.agencyCode, "Crawling started...");
      try {
        final results = await crawler.crawl();
        onProgress?.call(crawler.agencyCode, "Success (\${results.length} found)");
        return results;
      } catch (e) {
        onProgress?.call(crawler.agencyCode, "Failed: \$e");
        return <JobPosting>[]; // Return empty list on failure
      }
    }).toList();

    final List<List<JobPosting>> nestedResults = await Future.wait(futures);
    
    // Flatten the list
    final List<JobPosting> allPostings = nestedResults.expand((x) => x).toList();
    
    // Sort by createdAt descending
    allPostings.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    
    return allPostings;
  }
}

// ==========================================
// 7. UI Screen (HomeScreen & Flutter Main App)
// ==========================================
void main() {
  runApp(const ScraperApp());
}

class ScraperApp extends StatelessWidget {
  const ScraperApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Local Job Scraper',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E88E5),
          brightness: Brightness.light,
        ),
      ),
      home: const HomeScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  final List<Map<String, String>> targetAgencies = [
    {
      "code": "GY_OFFICE",
      "agency": "계양구청",
      "type": "SPRING",
      "url": "https://www.gyeyang.go.kr/open_content/main/open_info/admin/job.jsp"
    },
    {
      "code": "GY_WOMAN",
      "agency": "계양여성회관",
      "type": "GNUBOARD",
      "url": "https://gywoman.or.kr/bbs/board.php?bo_table=notice02"
    },
    {
      "code": "BUKBU_ICE",
      "agency": "인천북부교육지원청",
      "type": "ICE_NTT",
      "url": "https://bukbu.ice.go.kr/bbs/data/list.do?menu_idx=86"
    },
    {
      "code": "ICE",
      "agency": "인천광역시교육청",
      "type": "ICE_NTT",
      "url": "https://www.ice.go.kr/ice/na/ntt/selectNttList.do?mi=10997&bbsId=1981"
    }
  ];

  List<JobPosting> _listings = [];
  bool _isLoading = false;
  Map<String, String> _crawlingLogs = {};

  Future<void> _executeScraping() async {
    setState(() {
      _isLoading = true;
      _listings.clear();
      _crawlingLogs = {
        for (var config in targetAgencies) config['code']!: "Pending..."
      };
    });

    final manager = CrawlerManager(targetAgencies);
    
    try {
      final results = await manager.runAllCrawlers(
        onProgress: (code, status) {
          setState(() {
            _crawlingLogs[code] = status;
          });
        },
      );

      setState(() {
        _listings = results;
        _isLoading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Scraping completed! Found \${results.length} postings.'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Scraping failed: \$e'),
            backgroundColor: Colors.red,
          ),
        );
      }
    }
  }

  Color _getAgencyColor(String code) {
    switch (code) {
      case 'GY_OFFICE':
        return Colors.blue.shade700;
      case 'GY_WOMAN':
        return Colors.purple.shade700;
      case 'BUKBU_ICE':
        return Colors.green.shade700;
      case 'ICE':
        return Colors.teal.shade700;
      default:
        return Colors.grey.shade700;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text(
          '공공기관 일자리 수집 엔진',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
        centerTitle: true,
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        elevation: 2,
      ),
      body: Column(
        children: [
          Card(
            margin: const EdgeInsets.all(12),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      Icon(Icons.cell_tower, color: Theme.of(context).colorScheme.primary),
                      const SizedBox(width: 8),
                      const Text(
                        '클라이언트 사이드 로컬 수집 상태',
                        style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    '본 앱은 스마트폰의 local carrier(LTE/5G) 또는 Wi-Fi IP 네트워크를 '
                    '직접 사용하여 해외 클라우드 IP 차단 정책을 우회합니다.',
                    style: TextStyle(fontSize: 13, color: Colors.black87),
                  ),
                  const SizedBox(height: 12),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: targetAgencies.map((agency) {
                      final code = agency['code']!;
                      final status = _crawlingLogs[code] ?? "Idle";
                      final agencyName = agency['agency']!;
                      return Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                        decoration: BoxDecoration(
                          color: _getAgencyColor(code).withOpacity(0.1),
                          borderRadius: BorderRadius.circular(6),
                          border: Border.all(color: _getAgencyColor(code).withOpacity(0.3)),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              agencyName,
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                                color: _getAgencyColor(code),
                              ),
                            ),
                            const SizedBox(width: 4),
                            Text(
                              '(\$status)',
                              style: const TextStyle(fontSize: 10, color: Colors.black54),
                            ),
                          ],
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: ElevatedButton.icon(
              onPressed: _isLoading ? null : _executeScraping,
              icon: _isLoading
                  ? const SizedBox(
                      width: 18,
                      height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : const Icon(Icons.play_arrow),
              label: Text(_isLoading ? 'Scraping...' : '수집 엔진 가동 (Start)'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                backgroundColor: Theme.of(context).colorScheme.primary,
                foregroundColor: Colors.white,
                disabledBackgroundColor: Colors.grey.shade400,
                textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
              ),
            ),
          ),
          const SizedBox(height: 10),
          Expanded(
            child: _isLoading
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const CircularProgressIndicator(),
                        const SizedBox(height: 16),
                        const Text(
                          "Scraping via local residential IP network...",
                          style: TextStyle(fontWeight: FontWeight.w500, fontSize: 15),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          "타겟 정부 서버 우회 접속 중...",
                          style: TextStyle(color: Colors.grey.shade600, fontSize: 13),
                        ),
                      ],
                    ),
                  )
                : _listings.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.folder_open, size: 64, color: Colors.grey.shade400),
                            const SizedBox(height: 12),
                            Text(
                              '수집된 채용 정보가 없습니다.',
                              style: TextStyle(color: Colors.grey.shade600, fontSize: 15),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '위의 버튼을 눌러 수집을 시작하세요.',
                              style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
                            ),
                          ],
                        ),
                      )
                    : Scrollbar(
                        child: ListView.builder(
                          itemCount: _listings.length,
                          padding: const EdgeInsets.all(8),
                          itemBuilder: (context, index) {
                            final job = _listings[index];
                            final color = _getAgencyColor(job.agencyCode);
                            return Card(
                              elevation: 1,
                              margin: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
                              shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(8),
                                side: BorderSide(color: Colors.grey.shade200),
                              ),
                              child: ListTile(
                                contentPadding: const EdgeInsets.symmetric(vertical: 8, horizontal: 12),
                                title: Row(
                                  children: [
                                    Chip(
                                      label: Text(
                                        job.agencyName,
                                        style: const TextStyle(
                                          fontSize: 11,
                                          color: Colors.white,
                                          fontWeight: FontWeight.bold,
                                        ),
                                      ),
                                      backgroundColor: color,
                                    ),
                                    const Spacer(),
                                    Text(
                                      job.createdAt,
                                      style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
                                    ),
                                  ],
                                ),
                                subtitle: Padding(
                                  padding: const EdgeInsets.only(top: 8.0),
                                  child: Text(
                                    job.title,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      color: Colors.black87,
                                    ),
                                  ),
                                ),
                                trailing: const Icon(Icons.chevron_right, color: Colors.grey),
                                onTap: () {
                                  debugPrint("Opening URL: \${job.url}");
                                },
                              ),
                            );
                          },
                        ),
                      ),
          ),
        ],
      ),
    );
  }
}
`,
  models: `// ==========================================
// 1. Data Model (JobPosting)
// ==========================================
import 'dart:convert';
import 'package:crypto/crypto.dart';

class JobPosting {
  final String id;
  final String agencyCode;
  final String agencyName;
  final String title;
  final String url;
  final String createdAt;

  JobPosting({
    required this.id,
    required this.agencyCode,
    required this.agencyName,
    required this.title,
    required this.url,
    required this.createdAt,
  });

  factory JobPosting.create({
    required String agencyCode,
    required String agencyName,
    required String title,
    required String url,
    required String createdAt,
  }) {
    // Generate a unique ID by hashing agencyCode, title, and url
    final bytes = utf8.encode('$agencyCode-$title-$url');
    final digest = sha256.convert(bytes);
    return JobPosting(
      id: digest.toString().substring(0, 16),
      agencyCode: agencyCode,
      agencyName: agencyName,
      title: title,
      url: url,
      createdAt: createdAt,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'agencyCode': agencyCode,
      'agencyName': agencyName,
      'title': title,
      'url': url,
      'createdAt': createdAt,
    };
  }
}`,
  crawlers: `// ==========================================
// 2. Abstract Base Class & Crawlers
// ==========================================
import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:html/parser.dart' as parser;
import 'models.dart';

abstract class JobCrawler {
  String get agencyName;
  String get agencyCode;
  Future<List<JobPosting>> crawl();
}

// ------------------------------------------
// GyOfficeCrawler (Java Spring type)
// ------------------------------------------
class GyOfficeCrawler extends JobCrawler {
  @override
  String get agencyName => "계양구청";
  
  @override
  String get agencyCode => "GY_OFFICE";

  final String targetUrl = "https://www.gyeyang.go.kr/open_content/main/open_info/admin/job.jsp";

  @override
  Future<List<JobPosting>> crawl() async {
    final List<JobPosting> postings = [];
    final response = await http.get(
      Uri.parse(targetUrl),
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        'Referer': 'https://www.gyeyang.go.kr/',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      },
    ).timeout(const Duration(seconds: 10));

    if (response.statusCode != 200) {
      throw Exception("HTTP Failed with status: \${response.statusCode}");
    }

    final document = parser.parse(utf8.decode(response.bodyBytes));
    var elements = document.querySelectorAll('td.subject a');
    if (elements.isEmpty) {
      elements = document.querySelectorAll('.left a');
    }

    final todayStr = DateTime.now().toString().split(' ')[0];

    for (var element in elements) {
      final title = element.text.trim();
      var href = element.attributes['href'] ?? '';
      
      if (title.isNotEmpty && href.isNotEmpty) {
        if (!href.startsWith('http')) {
          href = href.startsWith('/') 
              ? 'https://www.gyeyang.go.kr\${href}' 
              : 'https://www.gyeyang.go.kr/open_content/main/open_info/admin/\${href}';
        }
        postings.add(
          JobPosting.create(
            agencyCode: agencyCode,
            agencyName: agencyName,
            title: title,
            url: href,
            createdAt: todayStr,
          ),
        );
      }
    }
    return postings;
  }
}

// ------------------------------------------
// GyWomanCrawler (GNUBoard type)
// ------------------------------------------
class GyWomanCrawler extends JobCrawler {
  @override
  String get agencyName => "계양여성회관";

  @override
  String get agencyCode => "GY_WOMAN";

  final String targetUrl = "https://gywoman.or.kr/bbs/board.php?bo_table=notice02";

  @override
  Future<List<JobPosting>> crawl() async {
    final List<JobPosting> postings = [];
    final response = await http.get(
      Uri.parse(targetUrl),
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        'Referer': 'https://gywoman.or.kr/',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      },
    ).timeout(const Duration(seconds: 10));

    if (response.statusCode != 200) {
      throw Exception("HTTP Failed with status: \${response.statusCode}");
    }

    final document = parser.parse(utf8.decode(response.bodyBytes));
    var elements = document.querySelectorAll('.td_subject a');
    if (elements.isEmpty) {
      elements = document.querySelectorAll('.bo_tit a');
    }

    final todayStr = DateTime.now().toString().split(' ')[0];

    for (var element in elements) {
      final title = element.text.trim();
      var href = element.attributes['href'] ?? '';
      
      if (title.isNotEmpty && href.isNotEmpty) {
        final cleanTitle = title.replaceAll(RegExp(r'\\s+'), ' ');
        if (cleanTitle.contains('댓글') || cleanTitle.isEmpty) continue;

        if (!href.startsWith('http')) {
          href = href.startsWith('/') 
              ? 'https://gywoman.or.kr\${href}' 
              : 'https://gywoman.or.kr/bbs/\${href}';
        }
        postings.add(
          JobPosting.create(
            agencyCode: agencyCode,
            agencyName: agencyName,
            title: cleanTitle,
            url: href,
            createdAt: todayStr,
          ),
        );
      }
    }
    return postings;
  }
}

// ------------------------------------------
// IceNttCrawler (Reusable NTT Board type)
// ------------------------------------------
class IceNttCrawler extends JobCrawler {
  @override
  final String agencyName;
  @override
  final String agencyCode;
  final String targetUrl;

  IceNttCrawler({
    required this.agencyName,
    required this.agencyCode,
    required this.targetUrl,
  });

  @override
  Future<List<JobPosting>> crawl() async {
    final List<JobPosting> postings = [];
    final uri = Uri.parse(targetUrl);
    final baseUrl = "\${uri.scheme}://\${uri.host}";

    final response = await http.get(
      uri,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        'Referer': baseUrl,
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
      },
    ).timeout(const Duration(seconds: 10));

    if (response.statusCode != 200) {
      throw Exception("HTTP Failed with status: \${response.statusCode}");
    }

    final document = parser.parse(utf8.decode(response.bodyBytes));
    var elements = document.querySelectorAll('td.nttSj a');
    if (elements.isEmpty) {
      elements = document.querySelectorAll('td.title a');
    }
    if (elements.isEmpty) {
      elements = document.querySelectorAll('td.subject a');
    }

    final todayStr = DateTime.now().toString().split(' ')[0];

    for (var element in elements) {
      final title = element.text.trim();
      var href = element.attributes['href'] ?? '';
      
      if (title.isNotEmpty && href.isNotEmpty) {
        if (!href.startsWith('http')) {
          if (href.startsWith('/')) {
            href = '\$baseUrl\${href}';
          } else {
            final pathSegments = List<String>.from(uri.pathSegments);
            if (pathSegments.isNotEmpty) pathSegments.removeLast();
            href = '\$baseUrl/\${pathSegments.join('/')}/\${href}';
          }
        }
        postings.add(
          JobPosting.create(
            agencyCode: agencyCode,
            agencyName: agencyName,
            title: title,
            url: href,
            createdAt: todayStr,
          ),
        );
      }
    }
    return postings;
  }
}`,
  factory: `// ==========================================
// 3. Factory Registry & Manager
// ==========================================
import 'models.dart';
import 'crawlers.dart';

final List<Map<String, String>> targetAgencies = [
  {
    "code": "GY_OFFICE",
    "agency": "계양구청",
    "type": "SPRING",
    "url": "https://www.gyeyang.go.kr/open_content/main/open_info/admin/job.jsp"
  },
  {
    "code": "GY_WOMAN",
    "agency": "계양여성회관",
    "type": "GNUBOARD",
    "url": "https://gywoman.or.kr/bbs/board.php?bo_table=notice02"
  },
  {
    "code": "BUKBU_ICE",
    "agency": "인천북부교육지원청",
    "type": "ICE_NTT",
    "url": "https://bukbu.ice.go.kr/bbs/data/list.do?menu_idx=86"
  },
  {
    "code": "ICE",
    "agency": "인천광역시교육청",
    "type": "ICE_NTT",
    "url": "https://www.ice.go.kr/ice/na/ntt/selectNttList.do?mi=10997&bbsId=1981"
  }
];

class CrawlerFactory {
  static JobCrawler? create(Map<String, String> config) {
    final code = config['code'];
    final name = config['agency'];
    final type = config['type'];
    final url = config['url'];

    if (code == null || name == null || type == null || url == null) {
      return null;
    }

    switch (type) {
      case 'SPRING':
        return GyOfficeCrawler();
      case 'GNUBOARD':
        return GyWomanCrawler();
      case 'ICE_NTT':
        return IceNttCrawler(
          agencyName: name,
          agencyCode: code,
          targetUrl: url,
        );
      default:
        return null;
    }
  }
}

class CrawlerManager {
  final List<Map<String, String>> configs;

  CrawlerManager(this.configs);

  Future<List<JobPosting>> runAllCrawlers({
    void Function(String code, String status)? onProgress,
  }) async {
    final List<JobCrawler> crawlers = [];
    
    for (var config in configs) {
      final crawler = CrawlerFactory.create(config);
      if (crawler != null) crawlers.add(crawler);
    }

    // Run parallel crawl pipelines concurrently with Future.wait
    final List<Future<List<JobPosting>>> futures = crawlers.map((crawler) async {
      onProgress?.call(crawler.agencyCode, "Running...");
      try {
        final results = await crawler.crawl();
        onProgress?.call(crawler.agencyCode, "Success (\${results.length})");
        return results;
      } catch (e) {
        onProgress?.call(crawler.agencyCode, "Failed: \$e");
        return <JobPosting>[];
      }
    }).toList();

    final List<List<JobPosting>> nestedResults = await Future.wait(futures);
    final List<JobPosting> allPostings = nestedResults.expand((x) => x).toList();
    
    // Sort chronological descending
    allPostings.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return allPostings;
  }
}`,
  ui: `// ==========================================
// 4. UI Layer - HomeScreen
// ==========================================
import 'package:flutter/material.dart';
import 'models.dart';
import 'factory.dart';

class ScraperApp extends StatelessWidget {
  const ScraperApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Local Job Scraper',
      theme: ThemeData(
        useMaterial3: true,
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF1E88E5),
          brightness: Brightness.light,
        ),
      ),
      home: const HomeScreen(),
      debugShowCheckedModeBanner: false,
    );
  }
}

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<JobPosting> _listings = [];
  bool _isLoading = false;
  Map<String, String> _crawlingLogs = {};

  Future<void> _executeScraping() async {
    setState(() {
      _isLoading = true;
      _listings.clear();
      _crawlingLogs = {
        for (var config in targetAgencies) config['code']!: "Pending..."
      };
    });

    final manager = CrawlerManager(targetAgencies);
    
    try {
      final results = await manager.runAllCrawlers(
        onProgress: (code, status) {
          setState(() {
            _crawlingLogs[code] = status;
          });
        },
      );

      setState(() {
        _listings = results;
        _isLoading = false;
      });

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Scraping completed! Found \${results.length} postings.'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      setState(() {
        _isLoading = false;
      });
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Scraping failed: \$e'), backgroundColor: Colors.red),
        );
      }
    }
  }

  Color _getAgencyColor(String code) {
    switch (code) {
      case 'GY_OFFICE': return Colors.blue.shade700;
      case 'GY_WOMAN': return Colors.purple.shade700;
      case 'BUKBU_ICE': return Colors.green.shade700;
      case 'ICE': return Colors.teal.shade700;
      default: return Colors.grey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('공공기관 일자리 수집 엔진', style: TextStyle(fontWeight: FontWeight.bold)),
        centerTitle: true,
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        elevation: 2,
      ),
      body: Column(
        children: [
          const SizedBox(height: 12),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: ElevatedButton.icon(
              onPressed: _isLoading ? null : _executeScraping,
              icon: _isLoading 
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.play_arrow),
              label: Text(_isLoading ? 'Scraping...' : '수집 엔진 가동 (Start)'),
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(50),
                backgroundColor: Theme.of(context).colorScheme.primary,
                foregroundColor: Colors.white,
              ),
            ),
          ),
          const SizedBox(height: 10),
          Expanded(
            child: _isLoading
                ? Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const CircularProgressIndicator(),
                        const SizedBox(height: 16),
                        const Text("Scraping via local residential IP network...", style: TextStyle(fontWeight: FontWeight.w500, fontSize: 15)),
                      ],
                    ),
                  )
                : _listings.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Icon(Icons.folder_open, size: 64, color: Colors.grey.shade400),
                            const SizedBox(height: 12),
                            const Text(
                              '공고없음',
                              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              '수집 버튼을 눌러 오늘 등록된 공고를 수집하세요.',
                              style: TextStyle(color: Colors.grey.shade500, fontSize: 13),
                            ),
                          ],
                        ),
                      )
                    : ListView.builder(
                        itemCount: _listings.length,
                        itemBuilder: (context, index) {
                          final job = _listings[index];
                          return Card(
                            margin: const EdgeInsets.all(8),
                            child: ListTile(
                              title: Text(job.title),
                              subtitle: Text(job.agencyName),
                            ),
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}`
};
