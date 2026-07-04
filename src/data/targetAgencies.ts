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
  }
];
