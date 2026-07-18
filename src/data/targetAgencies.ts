export interface AgencyConfig {
  code: string;
  agency: string;
  type: string;
  url: string;
  baseUrl: string;
}

export const TARGET_AGENCIES: AgencyConfig[] = [
  {
    code: "GY_OFFICE",
    agency: "계양구청",
    type: "SPRING",
    url: "https://www.gyeyang.go.kr/open_content/main/open_info/admin/job.jsp",
    baseUrl: "https://www.gyeyang.go.kr"
  },
  {
    code: "GY_WOMAN",
    agency: "계양여성회관",
    type: "GNUBOARD",
    url: "https://gywoman.or.kr/bbs/board.php?bo_table=notice02",
    baseUrl: "https://gywoman.or.kr"
  },
  {
    code: "BUKBU_ICE",
    agency: "인천북부교육지원청",
    type: "ICE_NTT",
    url: "https://bukbu.ice.go.kr/bbs/data/list.do?menu_idx=86",
    baseUrl: "https://bukbu.ice.go.kr"
  },
  {
    code: "ICE",
    agency: "인천광역시교육청",
    type: "ICE_NTT",
    url: "https://www.ice.go.kr/ice/na/ntt/selectNttList.do?mi=10997&bbsId=1981",
    baseUrl: "https://www.ice.go.kr"
  },
  {
    code: "IC_SISEOL",
    agency: "인천시설공단",
    type: "SPRING",
    url: "https://www.insiseol.or.kr/main/notice/job2.jsp",
    baseUrl: "https://www.insiseol.or.kr"
  },
  {
    code: "IC_SILVER",
    agency: "노인종합문화회관",
    type: "SPRING",
    url: "http://insiseol.or.kr/culture/silver/board/job.jsp",
    baseUrl: "http://insiseol.or.kr"
  },
  {
    code: "IC_YOUTH_1",
    agency: "청소년수련관",
    type: "SPRING",
    url: "https://www.insiseol.or.kr/culture/youth/notice/job.jsp",
    baseUrl: "https://www.insiseol.or.kr"
  },
  {
    code: "IC_YOUTH_2",
    agency: "청소년수련관",
    type: "SPRING",
    url: "https://www.insiseol.or.kr/culture/youth/notice/job2.jsp",
    baseUrl: "https://www.insiseol.or.kr"
  },
  {
    code: "IC_SKY",
    agency: "하늘문화센터",
    type: "SPRING",
    url: "https://www.insiseol.or.kr/culture/sky/notice/recruit.jsp",
    baseUrl: "https://www.insiseol.or.kr"
  },
  {
    code: "IC_SKY_2",
    agency: "하늘문화센터",
    type: "SPRING",
    url: "https://www.insiseol.or.kr/culture/sky/notice/job.jsp",
    baseUrl: "https://www.insiseol.or.kr"
  },
  {
    code: "IC_GAJWA",
    agency: "가좌근로자문화센터",
    type: "SPRING",
    url: "https://www.insiseol.or.kr/culture/gajwa/data/fixedterm.jsp",
    baseUrl: "https://www.insiseol.or.kr"
  },
  {
    code: "IC_GYESAN",
    agency: "계산체육센터",
    type: "SPRING",
    url: "https://www.insiseol.or.kr/sport/gyesan/notice/job.jsp",
    baseUrl: "https://www.insiseol.or.kr"
  },
  {
    code: "IC_SAMSAN",
    agency: "삼산체육관",
    type: "SPRING",
    url: "https://www.insiseol.or.kr/sport/samsan/notice/job.jsp",
    baseUrl: "https://www.insiseol.or.kr"
  },
  {
    code: "IC_SONGNIM",
    agency: "송림체육관",
    type: "SPRING",
    url: "https://www.insiseol.or.kr/sport/songnim/notice/job.jsp",
    baseUrl: "https://www.insiseol.or.kr"
  },
  {
    code: "IC_ASIAD",
    agency: "아시아드경기장",
    type: "SPRING",
    url: "https://www.insiseol.or.kr/sport/asiad/notice/job.jsp",
    baseUrl: "https://www.insiseol.or.kr"
  },
  {
    code: "IC_ASIAD_2",
    agency: "아시아드경기장",
    type: "SPRING",
    url: "https://www.insiseol.or.kr/sport/asiad/notice/recruit.jsp",
    baseUrl: "https://www.insiseol.or.kr"
  },
  {
    code: "IC_GYEYANG",
    agency: "계양경기장",
    type: "SPRING",
    url: "https://www.insiseol.or.kr/sport/gyeyang/notice/job.jsp",
    baseUrl: "https://www.insiseol.or.kr"
  },
  {
    code: "GY_SISEOL",
    agency: "계양구 시설관리공단",
    type: "GNUBOARD",
    url: "https://www.gysiseol.or.kr/main/main.php?categoryid=07&menuid=09&groupid=00",
    baseUrl: "https://www.gysiseol.or.kr"
  },
  {
    code: "BP_GU",
    agency: "부평구청",
    type: "SPRING",
    url: "https://www.icbp.go.kr/main/eminwon/eminwonJobList.do?pgno=1",
    baseUrl: "https://www.icbp.go.kr"
  },
  {
    code: "SEOHAE_OFFICE",
    agency: "서해구청",
    type: "SPRING",
    url: "https://www.seohae.go.kr/open_content/main/community/news/job.jsp",
    baseUrl: "https://www.seohae.go.kr"
  },
  {
    code: "BPSS",
    agency: "부평구 시설관리공단",
    type: "SPRING",
    url: "https://www.bpss.or.kr:444/open_content/main/community/job.jsp",
    baseUrl: "https://www.bpss.or.kr:444"
  },
  {
    code: "ISSI",
    agency: "서해구 시설관리공단",
    type: "ASP",
    url: "https://www.issi.or.kr/sub/common_board.asp?mNo=MA030010000",
    baseUrl: "https://www.issi.or.kr"
  }
];
