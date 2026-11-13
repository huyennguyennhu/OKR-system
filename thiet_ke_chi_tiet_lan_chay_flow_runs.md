# TÀI LIỆU ĐẶC TẢ THIẾT KẾ GIAO DIỆN: MODAL CHI TIẾT LẦN CHẠY (FLOW RUN DETAILS)
> **Dự án:** Hệ thống Quản trị Mục tiêu & Kết quả Then chốt (OKR System) - Phân hệ Flow Runs & Activepieces SLA Tracker  
> **Repository GitLab kiểm chứng:** `https://gitlab.com/dcor2/Dcor-project` (Project ID: `86650434`)  
> **Đối tượng người dùng mục tiêu:** Ban Giám đốc, Quản lý dự án (PM/Team Lead), Chuyên viên BA/QA (Người dùng phi kỹ thuật - Non-Tech) và Kỹ sư Phần mềm (Developer/DevOps).  
> **Nguyên tắc cốt lõi:** **Minh bạch tận cùng & Truy vết 1-Click (End-to-End Traceability)** — Mọi con số KPI đều phải đối soát được tận gốc từng Issue/MR trên GitLab.

---

## I. MỤC TIÊU VÀ TRIẾT LÝ THIẾT KẾ

### 1. Vấn đề của giao diện cũ
* **Trực quan kém:** Trước đây giao diện modal chỉ hiển thị một khối mã thô `JSON Payload` dài hàng trăm dòng. Người dùng non-tech không thể nắm bắt được tiến độ, tỷ lệ đạt SLA hay lý do trễ hạn.
* **Thiếu tính kiểm chứng (Lack of Traceability):** Khi hệ thống ghi nhận kết quả *"Đạt 2/3 Issue (66.7%)"*, người dùng hoàn toàn không biết cụ thể là **Issue nào đạt**, **Issue nào trễ**, và **ai là người phụ trách**.
* **Mất kết nối với GitLab:** Không có đường dẫn trực tiếp sang repository để xem bằng chứng code, commit, hoặc log thảo luận.

### 2. Triết lý thiết kế mới: Non-Tech Friendly & Truy vết tận gốc
* **Dễ hiểu:** Trình bày dưới dạng Thẻ chỉ số (KPI Cards), Bảng phân rã theo nhân sự và Bảng danh sách tác vụ với màu sắc trực quan (Xanh: Đạt, Đỏ/Cam: Trễ).
* **Đầy đủ bằng chứng:** Mỗi lần chạy đều lưu vết chi tiết danh sách tất cả các Issue, Merge Request, Bug tham gia tính toán.
* **Gắn Link trực tiếp (Clickable Links):** Mọi mã Issue (`#44`) và Merge Request (`!18`) đều là siêu liên kết (`target="_blank"`) mở thẳng sang GitLab để người dùng kiểm chứng ngay lập tức.
* **Phân lớp thông tin:** Dữ liệu kinh doanh và tiến độ hiển thị trực diện; mã JSON kỹ thuật được giấu gọn trong thẻ Accordion `<details>` bên dưới.

```
+---------------------------------------------------------------------------------------------------+
| [CÂY OKR / DASHBOARD]                                                                             |
|   └─ Key Result: KR-M11-A1 đạt 93.3%  --> [Nút Truy vết]                                         |
+--------------------------------------------------+------------------------------------------------+
                                                   | Mở Modal
                                                   v
+---------------------------------------------------------------------------------------------------+
| MODAL CHI TIẾT LẦN CHẠY (RUN_20261110_A1_2453)                                                   |
|                                                                                                   |
|  [KHỐI 1] 4 Thẻ KPI: Quét 15 mục | Đạt SLA 14 (93.3%) | Trễ 1 (6.7%) | Đánh giá: ĐẠT CHUẨN (PASS)  |
|                                                                                                   |
|  [KHỐI 2] BẢNG PHÂN RÃ CÁ NHÂN (Kèm Drill-down từng người):                                       |
|    - Huyền Nguyễn Như   : 3/3 Issue (100%) [ĐẠT]        [▼ Xem chi tiết 3 tác vụ]                |
|    - Nguyễn Tuấn Anh   : 2/3 Issue (71.4%) [CẦN CẢI THIỆN] [▲ Thu gọn]                            |
|        └─ 🔗 #44 Tối ưu hóa truy vấn Cây OKR (5 Story Point) -> [ĐÚNG HẠN +0.5h]                  |
|        └─ 🔗 #46 Viết Unit Test cho Measurement Engine (2 Story Point) -> [TRỄ HẠN -1.5h]         |
|        └─ 🔗 #52 Sửa lỗi responsive trên mobile (3 Story Point) -> [ĐÚNG HẠN +0.25h]              |
|                                                                                                   |
|  [KHỐI 3] BẢNG BẰNG CHỨNG TOÀN BỘ TÁC NGHIỆP (15/15 Items có link GitLab & đánh giá SLA)          |
|                                                                                                   |
|  [KHỐI 4] CẤU HÌNH ĐO LƯỜNG ÁP DỤNG (Lịch làm việc 8h/ngày: 09:00-18:30, Trừ 1.5h trưa)          |
|                                                                                                   |
|  [KHỐI 5] DỮ LIỆU KỸ THUẬT: ▶ Xem Payload JSON gốc (Thu gọn mặc định)                             |
+---------------------------------------------------------------------------------------------------+
```

---

## II. ĐẶC TẢ CHI TIẾT 5 KHỐI THÀNH PHẦN CỦA MODAL

### Khối 1: Header Định Danh & 4 Thẻ KPI Tóm Tắt (Run Summary Cards)

#### 1.1 Header modal
* **Tiêu đề:** `Chi tiết lần chạy` kèm Badge mã chạy: `RUN_20261110_A1_2453`
* **Thông tin định danh:**
  * **Kịch bản thực thi:** `Activepieces SLA Issue Tracker (FLOW-KR-A1)`
  * **Trạng thái:** `SUCCESS` (Huy hiệu xanh lá)
  * **Thời gian quét:** `10/11/2026 14:00:23` (Thời lượng thực thi: `2.10 giây`)
  * **Kiểu kích hoạt:** `Schedule (Định kỳ tự động)`
  * **Tác động OKR:** `Đã cập nhật Team KR-A1 đạt 93.3% và đồng bộ tiến độ 5 Personal KRs thành viên.`

#### 1.2 4 Thẻ KPI trực quan
1. **Tổng tác vụ quét được:** `15 Issue` (Icon GitLab)
2. **Đúng hạn SLA:** `14 Issue (93.3%)` — Đạt tiêu chuẩn $\ge 90\%$ (Màu xanh lục)
3. **Trễ hạn / Quá hạn:** `1 Issue (6.7%)` (Màu đỏ cam)
4. **Đánh giá tổng thể đợt chạy:** Huy hiệu `ĐẠT CHUẨN (PASS)` (Icon tích xanh)

---

### Khối 2: Bảng Phân Rã Cá Nhân (Individual Breakdown) với Drill-down Tác Vụ & Link GitLab

Mỗi thành viên trong đội ngũ có một dòng tóm tắt chỉ số đóng góp của mình. Người dùng có thể nhấn nút **"Xem chi tiết tác vụ (▼)"** để mở ra danh sách cụ thể từng công việc của người đó.

#### Bảng tổng hợp cá nhân:
| Thành viên & GitLab ID | Tác vụ đến hạn | Đạt SLA | Trễ hạn | Tỷ lệ SLA ($IC_i$) | Đánh giá | Chi tiết tác vụ |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Huyền Nguyễn Như**<br>`@huyennn23406` | 3 Issue (8 SP) | 3 Issue (8 SP) | 0 Issue | **100.0%** | <span class="badge badge-success">ĐẠT (PASS)</span> | <button class="btn btn-sm btn-outline-primary">Xem 3 tác vụ ▼</button> |
| **Nguyễn Tuấn Anh**<br>`@nguyentuananh2221` | 3 Issue (7 SP) | 2 Issue (5 SP) | 1 Issue (2 SP) | **71.4%** | <span class="badge badge-warning">CẦN CẢI THIỆN</span> | <button class="btn btn-sm btn-outline-primary">Xem 3 tác vụ ▲</button> |
| **Lê Thái An**<br>`@thaian2221` | 3 Issue (9 SP) | 3 Issue (9 SP) | 0 Issue | **100.0%** | <span class="badge badge-success">ĐẠT (PASS)</span> | <button class="btn btn-sm btn-outline-primary">Xem 3 tác vụ ▼</button> |
| **Phan Quốc Cường**<br>`@cuongpq` | 3 Issue (7 SP) | 3 Issue (7 SP) | 0 Issue | **100.0%** | <span class="badge badge-success">ĐẠT (PASS)</span> | <button class="btn btn-sm btn-outline-primary">Xem 3 tác vụ ▼</button> |
| **Trần Thân**<br>`@thanhtran` | 3 Issue (7 SP) | 3 Issue (7 SP) | 0 Issue | **100.0%** | <span class="badge badge-success">ĐẠT (PASS)</span> | <button class="btn btn-sm btn-outline-primary">Xem 3 tác vụ ▼</button> |

#### Khu vực mở rộng khi click "Xem chi tiết tác vụ" (Ví dụ với nhân sự Nguyễn Tuấn Anh):
```markdown
┌────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ 📂 Danh sách 3 tác vụ của Nguyễn Tuấn Anh (@nguyentuananh2221) trong đợt quét:                                         │
├────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ 1. 🔗 [#44] [ISSUE_A1_08] Tối ưu hóa truy vấn Cây OKR                                                                 │
│    - Link GitLab: https://gitlab.com/dcor2/Dcor-project/-/issues/44                                                    │
│    - Trọng số: 5 Story Point                                                                                           │
│    - Mốc thời gian: Hạn chót 10/11 12:00 | Thực tế hoàn thành 10/11 11:30                                             │
│    - Kết quả: [ĐÚNG HẠN] (Sớm 0.5 giờ làm việc)                                                                        │
│                                                                                                                        │
│ 2. 🔗 [#46] [ISSUE_A1_09] Viết Unit Test cho Measurement Engine                                                       │
│    - Link GitLab: https://gitlab.com/dcor2/Dcor-project/-/issues/46                                                    │
│    - Trọng số: 2 Story Point                                                                                           │
│    - Mốc thời gian: Hạn chót 10/11 15:00 | Thực tế hoàn thành 10/11 16:30                                             │
│    - Kết quả: [TRỄ HẠN] (Trễ 1.5 giờ làm việc do vướng kiểm thử tích hợp)                                             │
│                                                                                                                        │
│ 3. 🔗 [#52] [ISSUE_A1_10] Sửa lỗi responsive trên mobile                                                              │
│    - Link GitLab: https://gitlab.com/dcor2/Dcor-project/-/issues/52                                                    │
│    - Trọng số: 3 Story Point                                                                                           │
│    - Mốc thời gian: Hạn chót 10/11 17:00 | Thực tế hoàn thành 10/11 16:45                                             │
│    - Kết quả: [ĐÚNG HẠN] (Sớm 0.25 giờ làm việc)                                                                       │
└────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

### Khối 3: Bảng Bằng Chứng Toàn Bộ Tác Nghiệp (Master Evidence Records)

Bảng kê chi tiết **toàn bộ 100% các Issue / MR / Bug** được Activepieces quét và tính toán trong lần chạy này. Hỗ trợ thanh tìm kiếm nhanh, lọc theo trạng thái (Đúng hạn / Trễ hạn) và click trực tiếp mở GitLab:

| Loại | Mã & Tiêu đề trên GitLab (Link trực tiếp) | Người thực hiện / Reviewer | Trọng số / Thời lượng | Mốc hoàn thành | Đánh giá SLA | Tác động KR |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| <span class="badge-type issue">Issue</span> | [**#42** [ISSUE_A1_06] Tích hợp API Check-in OKR <i class="fa-solid fa-arrow-up-right-from-square"></i>](https://gitlab.com/dcor2/Dcor-project/-/issues/42) | Huyền Nguyễn Như | 3 Story Point | 10/11 10:45 | <span class="badge-success">ĐÚNG HẠN (+1.2h)</span> | `KR-M11-A1-01` |
| <span class="badge-type issue">Issue</span> | [**#43** [ISSUE_A1_07] Xây dựng UI Accordion Drill-down <i class="fa-solid fa-arrow-up-right-from-square"></i>](https://gitlab.com/dcor2/Dcor-project/-/issues/43) | Huyền Nguyễn Như | 5 Story Point | 10/11 11:15 | <span class="badge-success">ĐÚNG HẠN (+0.7h)</span> | `KR-M11-A1-01` |
| <span class="badge-type issue">Issue</span> | [**#44** [ISSUE_A1_08] Tối ưu hóa truy vấn Cây OKR <i class="fa-solid fa-arrow-up-right-from-square"></i>](https://gitlab.com/dcor2/Dcor-project/-/issues/44) | Nguyễn Tuấn Anh | 5 Story Point | 10/11 11:30 | <span class="badge-success">ĐÚNG HẠN (+0.5h)</span> | `KR-M11-A1-02` |
| <span class="badge-type issue">Issue</span> | [**#46** [ISSUE_A1_09] Viết Unit Test cho Measurement Engine <i class="fa-solid fa-arrow-up-right-from-square"></i>](https://gitlab.com/dcor2/Dcor-project/-/issues/46) | Nguyễn Tuấn Anh | 2 Story Point | 10/11 16:30 | <span class="badge-danger">TRỄ HẠN (-1.5h)</span> | `KR-M11-A1-02` |
| <span class="badge-type mr">MR</span> | [**!18** [MR_B1_15] refactor(auth): Chuẩn hóa Token Interceptor <i class="fa-solid fa-arrow-up-right-from-square"></i>](https://gitlab.com/dcor2/Dcor-project/-/merge_requests/18) | Nguyễn Tuấn Anh (Reviewer) | 2.5 giờ làm việc *(SLA 4.0h)* | 10/11 15:15 | <span class="badge-success">ĐẠT SLA (SỚM 1.5H)</span> | `KR-M11-B1-02` |
| <span class="badge-type bug">Bug</span> | [**#88** [BUG_C1_08] Khắc phục lỗi rò rỉ bộ nhớ WebSocket <i class="fa-solid fa-arrow-up-right-from-square"></i>](https://gitlab.com/dcor2/Dcor-project/-/issues/88) | Trần Thân | 5.2 giờ làm việc *(SLA 8.0h)* | 10/11 16:40 | <span class="badge-success">ĐẠT SLA (SỚM 2.8H)</span> | `KR-M11-C1-05` |

*(Quy tắc link: Tất cả liên kết đều có thuộc tính `target="_blank" rel="noopener noreferrer"` trỏ thẳng vào đúng project `https://gitlab.com/dcor2/Dcor-project`)*.

---

### Khối 4: Cấu Hình Đo Lường Áp Dụng (Measurement Rules Snapshot)

Khung thẻ thông tin nhẹ nhàng giải thích căn cứ hệ thống đã sử dụng để tính toán:
* 🕒 **Khung giờ làm việc chuẩn:** 8.0 giờ/ngày:
  * Ca sáng: `09:00 – 12:00` (3.0 giờ)
  * Ca chiều: `13:30 – 18:30` (5.0 giờ)
  * Nghỉ trưa: `12:00 – 13:30` (1.5 giờ — Tự động loại trừ, không tính vào thời gian SLA).
  * Cuối tuần (Thứ 7, CN) và Ngày lễ: Đóng băng tính giờ (Freeze time).
* 🎯 **Quy chuẩn SLA theo loại tác vụ:**
  * **FLOW-KR-A1:** Issue tính năng hoàn thành đúng hạn cam kết $\text{Closed At} \le \text{Due Date}$. Đạt chuẩn nhóm khi tỷ lệ $\ge 90\%$.
  * **FLOW-KR-B1:** Thời gian phản hồi Review Merge Request $\le 4.0\text{ giờ làm việc}$ kể từ lúc được gán (`reviewer_assigned`).
  * **FLOW-KR-C1:** Thời gian MTTR xử lý Bug $\le 8.0\text{ giờ làm việc}$ kể từ lúc mở Issue Bug (`opened` $\rightarrow$ `closed`).

---

### Khối 5: Dữ Liệu Kỹ Thuật (Payload JSON Gốc)

Dành riêng cho Đội ngũ Phát triển, DevOps và Kiểm thử khi cần đối soát sâu:
* Thiết kế dưới dạng thẻ Accordion `<details>`: **Mặc định đóng lại**, không chiếm diện tích màn hình.
* Tiêu đề: `▶ Xem Payload JSON kỹ thuật (Dành cho Developer / IT)`
* Kèm nút **"Sao chép JSON"** với hiệu ứng thông báo chớp nhoáng (Toast/Tooltip).
* Khối mã có màu nền tối (`#1e1e2f`), highlight cú pháp JSON chuẩn.

---

## III. QUY CÁCH DỮ LIỆU & CẤU TRÚC JSON CẦN LƯU VÀ PHẢN HỒI

Để giao diện hiển thị được đầy đủ danh sách Issue/MR có link GitLab và phân rã cá nhân, cấu trúc `payload_json` được chuẩn hóa như sau:

```json
{
  "session_info": {
    "run_id": "RUN_20261110_A1_2453",
    "flow_code": "FLOW-KR-A1",
    "flow_name": "Activepieces SLA Issue Tracker (KR-A1)",
    "scan_time": "2026-11-10 14:00:23",
    "trigger_type": "Schedule",
    "execution_status": "SUCCESS"
  },
  "summary_metrics": {
    "input_count": 15,
    "output_count": 6,
    "total_tasks_scanned": 15,
    "ontime_tasks_count": 14,
    "late_tasks_count": 1,
    "total_story_points": 38,
    "ontime_story_points": 36,
    "team_sla_score_percent": 93.3,
    "sla_evaluation": "ĐẠT CHUẨN (PASS)"
  },
  "config_snapshot": {
    "working_calendar": "09:00 - 12:00 & 13:30 - 18:30 (Trừ nghỉ trưa 1.5h, nghỉ T7-CN)",
    "sla_threshold_percent": 90,
    "weight_method": "Story Point"
  },
  "individual_breakdown": [
    {
      "emp_id": "EMP001",
      "name": "Huyền Nguyễn Như",
      "gitlab_username": "huyennn23406",
      "due_issues": 3,
      "due_sp": 8,
      "ontime_issues": 3,
      "ontime_sp": 8,
      "late_issues": 0,
      "ic_percent": 100.0,
      "status": "PASS",
      "tasks": [
        {
          "iid": 42,
          "title": "[ISSUE_A1_06] Tích hợp API Check-in OKR",
          "story_point": 3,
          "gitlab_url": "https://gitlab.com/dcor2/Dcor-project/-/issues/42",
          "due_date": "2026-11-10 12:00:00",
          "closed_at": "2026-11-10 10:45:00",
          "working_hours": 1.75,
          "sla_status": "ON_TIME",
          "sla_diff_hours": 1.25
        },
        {
          "iid": 43,
          "title": "[ISSUE_A1_07] Xây dựng UI Accordion Drill-down",
          "story_point": 5,
          "gitlab_url": "https://gitlab.com/dcor2/Dcor-project/-/issues/43",
          "due_date": "2026-11-10 12:00:00",
          "closed_at": "2026-11-10 11:15:00",
          "working_hours": 2.25,
          "sla_status": "ON_TIME",
          "sla_diff_hours": 0.75
        }
      ]
    },
    {
      "emp_id": "EMP002",
      "name": "Nguyễn Tuấn Anh",
      "gitlab_username": "nguyentuananh2221",
      "due_issues": 3,
      "due_sp": 7,
      "ontime_issues": 2,
      "ontime_sp": 5,
      "late_issues": 1,
      "ic_percent": 71.4,
      "status": "NEEDS_IMPROVEMENT",
      "tasks": [
        {
          "iid": 44,
          "title": "[ISSUE_A1_08] Tối ưu hóa truy vấn Cây OKR",
          "story_point": 5,
          "gitlab_url": "https://gitlab.com/dcor2/Dcor-project/-/issues/44",
          "due_date": "2026-11-10 12:00:00",
          "closed_at": "2026-11-10 11:30:00",
          "working_hours": 2.5,
          "sla_status": "ON_TIME",
          "sla_diff_hours": 0.5
        },
        {
          "iid": 46,
          "title": "[ISSUE_A1_09] Viết Unit Test cho Measurement Engine",
          "story_point": 2,
          "gitlab_url": "https://gitlab.com/dcor2/Dcor-project/-/issues/46",
          "due_date": "2026-11-10 15:00:00",
          "closed_at": "2026-11-10 16:30:00",
          "working_hours": 3.5,
          "sla_status": "LATE",
          "sla_diff_hours": -1.5
        }
      ]
    }
  ],
  "source_records": [
    {
      "type": "ISSUE",
      "iid": 42,
      "gitlab_url": "https://gitlab.com/dcor2/Dcor-project/-/issues/42",
      "title": "[ISSUE_A1_06] Tích hợp API Check-in OKR",
      "assignee_name": "Huyền Nguyễn Như",
      "assignee_username": "huyennn23406",
      "story_point": 3,
      "due_date": "2026-11-10 12:00:00",
      "closed_at": "2026-11-10 10:45:00",
      "working_hours": 1.75,
      "sla_status": "ON_TIME",
      "sla_diff_text": "Sớm 1.25 giờ",
      "target_kr_id": "KR-M11-A1-01"
    },
    {
      "type": "MR",
      "iid": 18,
      "gitlab_url": "https://gitlab.com/dcor2/Dcor-project/-/merge_requests/18",
      "title": "[MR_B1_15] refactor(auth): Chuẩn hóa Token Interceptor",
      "assignee_name": "Nguyễn Tuấn Anh",
      "assignee_username": "nguyentuananh2221",
      "story_point": null,
      "due_date": "2026-11-10 16:00:00",
      "closed_at": "2026-11-10 15:15:00",
      "working_hours": 2.5,
      "sla_status": "ON_TIME",
      "sla_diff_text": "Sớm 1.5 giờ (SLA: 4.0h)",
      "target_kr_id": "KR-M11-B1-02"
    }
  ]
}
```

---

## IV. LỘ TRÌNH TRIỂN KHAI VÀO CODEBASE

1. **Cập nhật Component Template (`flow-runs.component.ts`):**
   * Phân tích `payload_json` thành object có kiểu dữ liệu mạnh (`parsedPayload`).
   * Thay thế thẻ `<pre class="json-code-box">` bằng cấu trúc 5 khối trực quan trên.
   * Thêm biến `expandedMembers: { [empId: string]: boolean }` để quản lý đóng/mở Accordion danh sách tác vụ của từng người.
   * Gắn link mở tab mới với icon `fa-arrow-up-right-from-square` cho từng Issue/MR.
   * Thêm bộ lọc nhanh cho bảng bằng chứng (Tất cả / Chỉ xem Đạt / Chỉ xem Trễ).
2. **Cập nhật Backend (`server.js`):**
   * Đảm bảo mọi payload khi ghi nhận lần chạy hoặc mô phỏng đều bao gồm `gitlab_url`, `iid`, `title`, `story_point`, `working_hours`, `sla_diff_hours` và danh sách `tasks` lồng trong từng nhân sự.
3. **Kiểm thử nghiệm thu:**
   * Mở modal lần chạy bất kỳ $\rightarrow$ Bấm vào link `#44` để đảm bảo chuyển hướng chính xác đến GitLab.
   * Bấm nút mở rộng của từng người để kiểm tra hiển thị mượt mà, không giật lag.
