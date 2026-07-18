import 'dart:convert';

import 'package:crypto/crypto.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:html/parser.dart' as parser;
import 'package:html/dom.dart' as html;

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

abstract class JobCrawler {
  String get agencyName;
  String get agencyCode;
  Future<List<JobPosting>> crawl();
}

String extractDateFromRow(html.Element element, String defaultDate) {
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
        return '${match.group(1)}-${match.group(2)}-${match.group(3)}';
      }
      final shortMatch = shortDateRegex.firstMatch(text);
      if (shortMatch != null) {
        final currentYear = DateTime.now().year;
        return '$currentYear-${shortMatch.group(1)}-${shortMatch.group(2)}';
      }
    }
  }
  return defaultDate;
}

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
      final baseUrl = '${uri.scheme}://${uri.host}${uri.hasPort ? ':${uri.port}' : ''}';

      final response = await http.get(
        uri,
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
          'Referer': '$baseUrl/',
          'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        },
      ).timeout(const Duration(seconds: 10));

      if (response.statusCode != 200) {
        throw Exception('HTTP Failed with status: ${response.statusCode}');
      }

      final document = parser.parse(utf8.decode(response.bodyBytes));

      final selectorList = selector.split(',');
      List<html.Element> elements = [];
      for (var sel in selectorList) {
        final found = document.querySelectorAll(sel.trim());
        if (found.isNotEmpty) {
          elements = found;
          break;
        }
      }

      if (elements.isEmpty) {
        final allLinks = document.querySelectorAll('a');
        final jobKeywords = ['채용', '모집', '공고', '강사', '대체', '직원', '인력', '근로자', '사원', '조리', '구인', '임용'];
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

          final jobKeywords = ['채용', '모집', '공고', '강사', '대체', '직원', '인력', '근로자', '사원', '조리', '초빙', '일자리', '구인', '임용', '선발', '요원', '지도사', '조리원', '행정원', '지도원', '복지사', '모십니다'];
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
      debugPrint('Error in GenericHtmlCrawler ($agencyCode): $e');
      rethrow;
    }
    return postings;
  }
}

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

    final List<Future<List<JobPosting>>> futures = crawlers.map((crawler) async {
      onProgress?.call(crawler.agencyCode, 'Crawling started...');
      try {
        final results = await crawler.crawl();
        onProgress?.call(crawler.agencyCode, 'Success (${results.length} found)');
        return results;
      } catch (e) {
        onProgress?.call(crawler.agencyCode, 'Failed: $e');
        return <JobPosting>[];
      }
    }).toList();

    final List<List<JobPosting>> nestedResults = await Future.wait(futures);
    final List<JobPosting> allPostings = nestedResults.expand((x) => x).toList();
    allPostings.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    return allPostings;
  }
}
