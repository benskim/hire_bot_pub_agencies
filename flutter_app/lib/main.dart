import 'dart:convert';
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
    final dateRegex = RegExp(r'(\d{4})[-.](\d{2})[-.](\d{2})');
    final shortDateRegex = RegExp(r'^(\d{2})[-.](\d{2})$');
    for (var cell in cells) {
      final text = cell.text.trim();
      final match = dateRegex.firstMatch(text);
      if (match != null) {
        return "${match.group(1)}-${match.group(2)}-${match.group(3)}";
      }
      final shortMatch = shortDateRegex.firstMatch(text);
      if (shortMatch != null) {
        final currentYear = DateTime.now().year;
        return "$currentYear-${shortMatch.group(1)}-${shortMatch.group(2)}";
      }
    }
  }
  return defaultDate;
}

// ==========================================
// 3. Concrete Implementation: GenericHtmlCrawler (Highly Flexible Multi-Engine)
// ==========================================
class GenericHtmlCrawler extends JobCrawler {
  @override
  final String agencyName;
  @override
  final String agencyCode;
  final String targetUrl;
  final String selector;

  GenericHtmlCrawler({
    required this.agencyName,
    required this.agencyCode,
    required this.targetUrl,
    this.selector = 'td.subject a, td.title a, td.nttSj a, .td_subject a, .bo_tit a, .left a, td.subject_left a',
  });

  @override
  Future<List<JobPosting>> crawl() async {
    final List<JobPosting> postings = [];
    try {
      final uri = Uri.parse(targetUrl);
      final baseUrl = "${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}";

      final response = await http.get(
        uri,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
          'Referer': '$baseUrl/',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        throw Exception("HTTP Failed with status: ${response.statusCode}");
      }

      final document = parser.parse(utf8.decode(response.bodyBytes));
      
      final selectorList = selector.split(',');
      List<Element> elements = [];
      for (var sel in selectorList) {
        final found = document.querySelectorAll(sel.trim());
        if (found.isNotEmpty) {
          elements = found;
          break;
        }
      }

      if (elements.isEmpty) {
        final allLinks = document.querySelectorAll('a');
        final jobKeywords = ["채용", "모집", "공고", "강사", "대체", "직원", "인력", "근로자", "사원", "조리", "구인", "임용"];
        for (var link in allLinks) {
          final t = link.text.trim();
          if (t.length > 5 && jobKeywords.any((kw) => t.contains(kw))) {
            elements.add(link);
          }
        }
      }

      final todayStr = DateTime.now().toString().split(' ')[0];

      for (var element in elements) {
        final title = element.text.trim();
        var href = element.attributes['href'] ?? '';
        
        if (title.isNotEmpty && href.isNotEmpty) {
          final cleanTitle = title.replaceAll(RegExp(r'\s+'), ' ');
          if (cleanTitle.contains('댓글') || cleanTitle.isEmpty) continue;

          // STRICT FILTER: Only job titles allowed
          final jobKeywords = ["채용", "모집", "공고", "강사", "대체", "직원", "인력", "근로자", "사원", "조리", "초빙", "일자리", "구인", "임용", "선발", "요원", "지도사", "조리원", "행정원", "지도원", "복지사", "모십니다"];
          final isJob = jobKeywords.any((kw) => cleanTitle.contains(kw));
          if (!isJob) continue;

          if (!href.startsWith('http')) {
            if (href.startsWith('/')) {
              href = '$baseUrl$href';
            } else {
              final pathSegments = List<String>.from(uri.pathSegments);
              if (pathSegments.isNotEmpty) {
                pathSegments.removeLast();
              }
              final basePath = pathSegments.join('/');
              href = '$baseUrl/$basePath/$href';
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
      debugPrint("Error in GenericHtmlCrawler ($agencyCode): $e");
      rethrow;
    }
    return postings;
  }
}

// ==========================================
// 4. Crawler Factory & Registry Strategy
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

    return GenericHtmlCrawler(
      agencyName: name,
      agencyCode: code,
      targetUrl: url,
    );
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
        onProgress?.call(crawler.agencyCode, "Success (${results.length} found)");
        return results;
      } catch (e) {
        onProgress?.call(crawler.agencyCode, "Failed: $e");
        return <JobPosting>[]; // Return empty list on failure to let other crawlers proceed
      }
    }).toList();

    final List<List<JobPosting>> nestedResults = await Future.wait(futures);
    
    // Flatten the list
    final List<JobPosting> allPostings = nestedResults.expand((x) => x).toList();
    
    // Sort by createdAt descending (newest first)
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
    },
    {
      "code": "IC_SISEOL",
      "agency": "인천시설공단",
      "type": "SPRING",
      "url": "https://www.insiseol.or.kr/main/notice/job2.jsp"
    },
    {
      "code": "GY_SISEOL",
      "agency": "계양구 시설관리공단",
      "type": "GNUBOARD",
      "url": "https://www.gysiseol.or.kr/main/main.php?categoryid=07&menuid=09&groupid=00"
    },
    {
      "code": "BP_GU",
      "agency": "부평구청",
      "type": "SPRING",
      "url": "https://www.icbp.go.kr/main/eminwon/eminwonJobList.do?pgno=1"
    },
    {
      "code": "SEOHAE_OFFICE",
      "agency": "서해구청",
      "type": "SPRING",
      "url": "https://www.seohae.go.kr/open_content/main/community/news/job.jsp"
    },
    {
      "code": "BPSS",
      "agency": "부평구 시설관리공단",
      "type": "SPRING",
      "url": "https://www.bpss.or.kr:444/open_content/main/community/job.jsp"
    },
    {
      "code": "ISSI",
      "agency": "서해구 시설관리공단",
      "type": "ASP",
      "url": "https://www.issi.or.kr/sub/common_board.asp?mNo=MA030010000"
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
            content: Text('Scraping completed! Found ${results.length} postings.'),
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
            content: Text('Scraping failed: $e'),
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
      case 'IC_SISEOL':
        return Colors.indigo.shade600;
      case 'GY_SISEOL':
        return Colors.orange.shade700;
      case 'BP_GU':
        return Colors.deepPurple.shade600;
      case 'SEOHAE_OFFICE':
        return Colors.cyan.shade700;
      case 'BPSS':
        return Colors.amber.shade800;
      case 'ISSI':
        return Colors.pink.shade600;
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
          const SizedBox(height: 12),
          // Start Button
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

          // Main List View
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
                                      padding: EdgeInsets.zero,
                                      visualDensity: VisualDensity.compact,
                                      materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
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
                                  // In a real mobile app, open the link in a WebView or browser
                                  debugPrint("Opening URL: ${job.url}");
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text('Opening Link: ${job.url}'),
                                      duration: const Duration(seconds: 2),
                                    ),
                                  );
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
