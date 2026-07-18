import 'package:flutter/material.dart';

// main.dart 파일 맨 위에 아래 두 줄을 꼭 임포트(Import) 해주세요!
import 'package:firebase_core/firebase_core.dart'; // Firebase 코어 패키지
import 'package:firebase_analytics/firebase_analytics.dart';
import 'firebase_options.dart'; // 아까 flutterfire configure로 자동 생성된 파일
import 'scraper.dart';

// ==========================================
// 7. UI Screen (HomeScreen & Flutter Main App)
// ==========================================

// 기존 void main() 부분을 아래와 같이 'async'를 붙여서 수정합니다.
void main() async {
  // Flutter 프레임워크가 초기화될 때까지 안전하게 대기하는 명령어입니다.
  WidgetsFlutterBinding.ensureInitialized();
  
  // 아까 flutterfire 명령어가 만들어준 DefaultFirebaseOptions를 사용해 
  // Flutter 앱과 Firebase를 연결(초기화)합니다.
  await Firebase.initializeApp(
    options: DefaultFirebaseOptions.currentPlatform,
  );
  await FirebaseAnalytics.instance.logAppOpen();

  // 이 아래는 기존에 사용하시던 원래 구조를 그대로 두시면 됩니다.
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
  final FirebaseAnalytics _analytics = FirebaseAnalytics.instance;
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
    await _analytics.logEvent(
      name: 'click_start_scraping',
      parameters: {
        'target_agency_count': targetAgencies.length,
      },
    );
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

      await _analytics.logEvent(
        name: 'scraping_completed',
        parameters: {
          'result_count': results.length,
        },
      );

      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Scraping completed! Found ${results.length} postings.'),
            backgroundColor: Colors.green,
          ),
        );
      }
    } catch (e) {
      await _analytics.logEvent(
        name: 'scraping_failed',
        parameters: {
          'error': e.toString(),
        },
      );
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
                                onTap: () async {
                                  await _analytics.logEvent(
                                    name: 'click_job_posting',
                                    parameters: {
                                      'agency_code': job.agencyCode,
                                      'agency_name': job.agencyName,
                                    },
                                  );
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
