# UI Rules (Quy tắc Giao diện)

1. **Hiển thị bảng dữ liệu trống (Empty State):**
   - Bất kỳ bảng (table) hoặc danh sách nào khi không có dữ liệu đều **không được để trống hoàn toàn**.
   - **Định dạng thông báo rỗng chuẩn:** Toàn bộ thông báo rỗng trong hệ thống bắt buộc phải format thống nhất theo mẫu:
     `Chưa có [tên đối tượng] nào. Hãy tạo mới!`
     *(Ví dụ: "Chưa có team nào. Hãy tạo mới!", "Chưa có nhân viên nào. Hãy tạo mới!", "Chưa có mục tiêu nào. Hãy tạo mới!", "Chưa có không gian nào. Hãy tạo mới!", "Chưa có chu kỳ nào. Hãy tạo mới!",...)*
   - **Khi áp dụng bộ lọc hoặc tìm kiếm mà không có kết quả:** Format theo mẫu:
     `Không tìm thấy [tên đối tượng] nào phù hợp bộ lọc.` *(hoặc "...phù hợp từ khóa.")*
   - Thông báo được hiển thị nổi bật, cân đối ở chính giữa bảng (`class="text-center py-4 text-muted"`).

2. **Quy chuẩn Thiết kế Popup / Modal (Form Tạo mới & Chỉnh sửa):**
   - **Kích thước & Bố cục chung:**
     - Chiều rộng popup: Cố định `500px` (responsive tối đa `max-width: 95%`).
     - Định vị: Căn giữa màn hình hoàn toàn (flex center theo cả 2 trục X và Y).
     - Hiệu ứng xuất hiện: `fade-in` cho lớp nền (0.2s) và `slide-up` trượt nhẹ từ dưới lên 20px (0.3s).
   - **Bo góc (Border Radius):**
     - Hộp thoại popup chính (`modal-content`): Bo góc lớn `12px`.
     - Ô nhập liệu (`input`, `select`, `textarea`): Bo góc `6px`.
     - Nút hành động (`btn-primary`, `btn-secondary`): Bo góc `6px`.
     - Nút đóng góc phải (`nút X`): Bo góc nhỏ `4px`.
   - **Bảng màu & Hiệu ứng (Colors & Shadows):**
     - Lớp phủ mờ nền (Overlay): `rgba(15, 23, 42, 0.4)` kết hợp làm mờ hậu cảnh `backdrop-filter: blur(4px)`.
     - Nền thân popup: Trắng tinh `#ffffff`.
     - Nền thanh tiêu đề (Header): Xám nhẹ `#f8fafc`.
     - Đường viền ngăn cách (Borders): Màu xám phân cách nhạt `#e2e8f0` (1px solid).
     - Bóng đổ hộp thoại (Box Shadow): Đổ bóng 2 tầng mịn màng `0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)`.
   - **Thanh tiêu đề & Nút X (Header & Close Button):**
     - Khoảng đệm (Padding): `1.25rem 1.5rem` (khoảng 20px 24px).
     - Tiêu đề modal (`card-title`): Font size `1.1rem` (~15px - 16px), font-weight `600`, màu chữ đậm `#1e293b`.
     - Nút X (Đóng popup): Đặt ở góc trên cùng bên phải thanh Header. Thiết kế dạng icon phẳng (không viền, không nền mặc định, padding `0.25rem 0.6rem`). Khi rê chuột (hover) đổi màu nền sang `#e2e8f0` và màu biểu tượng đổi sang màu đỏ cảnh báo `#ef4444`.
   - **Trường nhập liệu (Form & Input):**
     - Khoảng đệm phần form: `1.5rem` (24px).
     - Khoảng cách giữa các hàng form (`form-group`): `margin-bottom: 1.25rem` (khoảng 16px - 20px).
     - Nhãn (Label): Font size `13px`, font-weight `500`, màu chữ xám đậm `#475569`, cách ô nhập `0.5rem` (8px).
     - Ký hiệu bắt buộc (`*` đỏ): Dùng class `.text-danger`, màu đỏ `#ef4444`, font-weight `600`, cách chữ 2px.
     - Ô nhập văn bản (`form-control`):
       - Chiều rộng `100%`, chiều cao vừa vặn với padding `0.65rem 0.875rem` (khoảng 10px 14px).
       - Viền mặc định: `1px solid #cbd5e1`.
       - Nền `#ffffff`, màu chữ `#334155`, font size `13px`.
       - Khi focus (nhấp chuột vào): Đổi màu viền sang xanh chủ đạo `var(--primary)` (`#3157D5`) và phát sáng nhẹ `box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.15)`, bỏ đường viền đen mặc định của trình duyệt (`outline: none`).
   - **Vị trí nút & Hành động (Footer Actions):**
     - Vị trí: Đưa toàn bộ nút thao tác (`Lưu`, `Hủy`,...) sang **góc dưới bên phải** popup (`display: flex; justify-content: flex-end; gap: 0.75rem`).
     - Cách trường cuối: Khoảng cách phía trên `margin-top: 1rem` đến `1.5rem`.
   - **Quy chuẩn Nút Lưu (Primary Button):**
     - Màu nền: Xanh chủ đạo `var(--accent)` (`#3157D5`), chữ trắng `#ffffff`.
     - Font size: `13px`, font-weight `500`, padding `0.5rem 1.25rem`.
     - Hover: Nền chuyển sang xanh sáng hơn `var(--accent-hover)` (`#5575DE`), kèm bóng đổ nhẹ `0 4px 6px -1px rgba(49, 87, 213, 0.3)`.
   - **Quy tắc Khóa nút chống Double-Click (Anti Double-Click / Disabled State):**
     - Khi người dùng nhấn nút `Lưu`: Lập tức chuyển sang trạng thái đang xử lý (`isSaving = true`).
     - Khóa nút ngay tức thì (`disabled="true"`): Không nhận thêm bất kỳ lượt nhấp nào (`pointer-events: none; opacity: 0.65; cursor: not-allowed`).
     - Phản hồi trực quan (Visual Feedback): Đổi nhãn nút từ `Lưu` thành `Đang lưu...` kèm biểu tượng xoay `fa-spinner fa-spin`.
     - Sau khi lưu thành công: Đóng popup, xóa dữ liệu form cũ, tự động tải lại danh sách và mở khóa.
     - Nếu có lỗi: Hiển thị thông báo lỗi, mở khóa lại nút (`isSaving = false`) để người dùng có thể chỉnh sửa và bấm thử lại.

3. **Quy chuẩn Trạng thái Đang tải Dữ liệu (Loading State) & Căn Center Bảng (Center Table Loading):**
   - **Mục đích:** Khi trang hoặc bảng cần nạp dữ liệu mới từ máy chủ/API, cần thông báo trực quan rõ ràng cho người dùng biết dữ liệu đang được lấy về, đồng thời khóa trang để ngăn người dùng thao tác nhấp chuột sai lệch trong khi dữ liệu chưa sẵn sàng.
   - **Hiển thị trực tiếp ở trung tâm bảng (Center Table Loading - Không dùng popup phụ):**
     - Do bảng đã hiển thị trạng thái tải bên trong, **bỏ hoàn toàn khung popup nhỏ** ở giữa màn hình để tránh thừa thãi hoặc che khuất giao diện.
     - Vòng xoay thực tế và thông báo tải được đặt trực tiếp ở **chính giữa bảng** (Center cả chiều ngang lẫn chiều dọc) thông qua ô `td` có class `.table-loading-cell` và `colspan="N"`.
     - Khoảng cách đệm trung tâm chuẩn mực: `padding: 3.5rem 1rem !important; vertical-align: middle !important;` giúp trạng thái tải có không gian hiển thị rộng rãi, cân đối ở chính giữa bảng.
     - Khối nội dung tải `.table-loading-content`: `display: inline-flex; align-items: center; justify-content: center; gap: 0.75rem;` gồm vòng xoay thực tế và dòng chữ *"Đang tải dữ liệu..."*.
   - **Quy tắc Phân tách Hiển thị Tuyệt đối (Strict Display Mutual Exclusivity):**
     - Toàn bộ các dòng dữ liệu (`*ngFor`) và dòng rỗng (Empty State) bắt buộc phải được bao bọc trong `<ng-container *ngIf="!loading">`.
     - Khi `loading = true`, **chỉ duy nhất dòng xoay tải dữ liệu được render**. Tuyệt đối không để dữ liệu hiển thị song song cùng lúc với dòng loading.
     - Khi `loading = false`, dòng loading lập tức biến mất hoàn toàn và các dòng dữ liệu mới được hiển thị.
     - Đối với các trang tải nhiều nguồn API đồng thời (như OKR Settings, OKR Dashboard): bắt buộc sử dụng `forkJoin` (kèm `catchError`) để đồng bộ thời điểm gán dữ liệu và tắt `loading = false` trong cùng 1 chu kỳ, tránh hiện tượng trang đã hiện 1 phần data nhưng vẫn còn xoay vòng.
   - **Khóa trang Không làm mờ (Non-blurring Page Lock):**
     - Tuyệt đối **không làm mờ hay làm tối màn hình** (`background: transparent !important; backdrop-filter: none;`). Mọi thông tin hiện có trên trang vẫn sáng rõ, sắc nét, không gây nhức mắt hay che khuất giao diện.
     - Khóa hoàn toàn thao tác của người dùng bằng một lớp phủ trong suốt toàn màn hình (`position: fixed; inset: 0; z-index: 9999; pointer-events: auto; cursor: wait;`). Mọi lượt nhấp chuột (click, focus, submit) đều bị ngăn chặn an toàn.
   - **Vòng tròn xoay tải dữ liệu (Real Rotating Spinner Animation):**
     - Phải thực sự xoay liên tục mượt mà bằng CSS animation (`@keyframes spinnerRotate { to { transform: rotate(360deg); } }`, chu kỳ `0.75s linear infinite`).
     - Vòng tròn thiết kế chuẩn mực: kích thước 24px, viền tròn bo cong hoàn hảo (`border-radius: 50%`), nền viền nhạt `rgba(49, 87, 213, 0.18)` và cạnh chủ đạo mang màu nhấn thương hiệu `border-top-color: var(--primary)`.
   - **Dòng thông báo rỗng (Empty State):**
     - Dòng trạng thái rỗng `*ngIf="items.length === 0"` bên trong `<ng-container *ngIf="!loading">` chỉ hiển thị sau khi quá trình tải hoàn tất mà không có dữ liệu.

4. **Quy chuẩn Menu Điều hướng Đa cấp (Sidebar Sub-Navigation):**
   - **Mũi tên điều hướng (Parent Chevron Arrow):**
     - Đặt ở sát lề phải của mục menu (`margin-left: auto;`).
     - Trạng thái bình thường (khi đóng): Hiển thị mũi tên hướng sang phải `>` (`fa-chevron-right`).
     - Trạng thái mở (khi nhấn mở rộng menu con): Mũi tên xoay chĩa thẳng xuống dưới `v` (`transform: rotate(90deg)` với hiệu ứng chuyển tiếp mượt mà `transition: transform 0.25s ease`).
   - **Mục menu con (Child Tabs / Sub-items):**
     - **Không có màu nền (No Background):** Tuyệt đối không dùng background dạng khối/pill cho tab con (`background: transparent !important; box-shadow: none !important;`) ở cả trạng thái bình thường, hover và active.
     - **Dấu chấm đầu tên (Bullet Dot):** Đầu mỗi tên tab con hiển thị duy nhất một dấu chấm tròn `•` (`.sub-dot`), không dùng icon khối/hình ảnh khác.
     - **Trạng thái Active:** Chữ chuyển sang màu sáng nổi bật `#FFFFFF` (font-weight 600), dấu chấm `•` phát sáng màu xanh nhấn `#60a5fa` và phóng to nhẹ (`transform: scale(1.3)`).

5. **Quy chuẩn Cấu trúc Trang & Định dạng Bảng (Standard Page Layout & Table Formatting):**
   - **Cấu trúc Trang Chuẩn (Toàn bộ ứng dụng, ngoại trừ trang OKR Tree):**
     Mọi trang có bảng dữ liệu tuân theo cấu trúc phân tầng rõ ràng, tối giản, **không bọc trong khung viền (bỏ hoàn toàn thẻ `.card` bao ngoài)**:
     1. **Tên trang (Page Title):**
        - Thẻ `<h3>` (`.card-title mb-1`) có font-size cố định `16px`, font-weight `700`.
        - **Lấy đúng tên tab điều hướng:** Tiêu đề trang bắt buộc phải trùng khớp chính xác 100% với tên tab hiển thị trên menu sidebar (ví dụ: `OKR Dashboard`, `OKR Tree`, `OKR Settings`, `GitLab Data`, `AuditLog`, `Team`, `Nhân viên`, `Objectives`).
        - **Không kèm icon:** Bỏ hoàn toàn biểu tượng icon `<i>` phía trước tiêu đề để giao diện thanh lịch, tối giản. Không dùng hậu tố chú giải hay song ngữ rườm rà.
        - **Khoảng cách lề dưới:** Thanh tiêu đề `.page-top-bar` có khoảng cách lề dưới chuẩn `margin-bottom: 1.5rem;` (tương đương class `mb-4`).
     2. **Sub title (Mô tả ngắn):** Thẻ `<p class="subtitle">` giải thích ngắn gọn mục đích và nguồn dữ liệu của trang.
     3. **Thanh lọc (Filter Bar - nếu có):** Gồm thanh tìm kiếm (có icon kính lúp và nút xóa nhanh) + các bộ lọc dropdown tùy biến.
     4. **Bảng dữ liệu (Table):** Bảng đặt trực tiếp trong `<div class="table-container">`, nền bảng trắng tinh `#ffffff`, đường viền dòng thanh mảnh, các dòng hover mượt mà.
     > **Lưu ý ngoại lệ:** Riêng trang **OKR Tree** (`/okr-tree`) là trang sơ đồ phân cấp trực quan chuyên biệt nên giữ nguyên thiết kế cây phân cấp đặc thù, không áp dụng quy tắc này.
   - **Cột Thao tác Cuối cùng (Action Column):**
     - **Tiêu đề cột (Header):** Tuyệt đối **không có tiêu đề chữ** (`<th style="width: 48px; text-align: center;"></th>`). Chiều rộng cố định 48px căn giữa.
     - **Nút 3 chấm dọc (3-Dot Trigger):**
       - Biểu tượng: Dấu 3 chấm dọc FontAwesome `<i class="fa-solid fa-ellipsis-vertical"></i>`.
       - Nút bấm: `.btn-action-trigger` kích thước `32px x 32px`, bo góc `6px`, màu icon xám `#64748b`. Khi rê chuột (hover) hoặc khi đang mở menu đổi sang nền `#f1f5f9`, icon đổi sang màu xanh chủ đạo `var(--primary)` và viền `#e2e8f0`.
     - **Menu Thả xuống (Action Dropdown Menu):**
       - Vị trí: Xuất hiện ngay phía dưới dấu 3 chấm (`top: calc(100% + 4px); right: 0;`), nổi lên trên các lớp khác với `z-index: 1000`.
       - Hiệu ứng: Xuất hiện với hiệu ứng mờ dần `fadeIn 0.15s ease-out`.
       - Thiết kế: Nền trắng `#ffffff`, bo góc `8px`, viền mảnh `#e2e8f0`, đổ bóng mềm mại `0 10px 15px -3px rgba(0, 0, 0, 0.1)`.
       - Danh sách mục:
         1. **Chỉnh sửa:** Icon bút sửa `<i class="fa-solid fa-pen-to-square"></i>`, màu chữ xám đậm `#334155`, hover nền xám nhạt `#f8fafc` và đổi sang màu chủ đạo.
         2. **Xóa:** Icon thùng rác `<i class="fa-solid fa-trash-can"></i>`, màu chữ đỏ cảnh báo `#ef4444`, hover nền đỏ nhạt `#fee2e2` và đổi sang đỏ đậm `#dc2626`.
     - **Tự động đóng khi nhấn ra ngoài (Click Outside Dismissal):**
       - Sử dụng `@HostListener('document:click')` trong TypeScript của component để tự động đóng dropdown ngay khi người dùng nhấn chuột ra bất kỳ vị trí nào khác ngoài menu.
       - Sự kiện mở menu được ngăn chặn lan truyền bằng `event.stopPropagation()` để không bị đóng ngay khi vừa nhấn mở.

6. **Quy chuẩn Thanh Tìm kiếm & Dropdown Bộ lọc (Filter Bar, Search Box & Dropdown Select):**
   - **Bố cục chung (.filter-bar):**
     - Sắp xếp dạng hàng ngang linh hoạt (`display: flex; align-items: center; gap: 0.875rem; flex-wrap: wrap; margin-bottom: 1.25rem;`).
   - **Khung Tìm kiếm (.filter-search-wrapper & .filter-input):**
     - **Biểu tượng kính lúp bên trái:** Đặt icon FontAwesome `<i class="fa-solid fa-magnifying-glass search-icon"></i>` ở vị trí tuyệt đối (`left: 14px; color: #94a3b8;`). Khi người dùng focus vào ô tìm kiếm (`:focus-within`), biểu tượng tự động đổi sang màu xanh chủ đạo `var(--primary)`.
     - **Ô nhập liệu (.filter-input):**
       - Padding bên trái rộng `2.5rem` để không đè lên icon kính lúp, padding phải `2.25rem`.
       - Bo góc chuẩn mực `8px`, viền mảnh `1px solid #cbd5e1`, nền trắng `#ffffff`, màu chữ `#1e293b`.
       - Hiệu ứng Hover: Đổi màu viền sang `#94a3b8`.
       - Hiệu ứng Focus: Viền chuyển sang xanh chủ đạo `var(--primary)` kèm viền sáng bảo vệ `box-shadow: 0 0 0 3px rgba(49, 87, 213, 0.15)`.
     - **Nút Xóa nhanh (Clear Button):** Khi có ký tự trong ô tìm kiếm, hiển thị nút xóa nhanh hình chữ X (`.clear-search-btn`) ở góc phải để người dùng có thể xóa trắng từ khóa chỉ với 1 click.
   - **Dropdown Bộ lọc Tùy biến (.custom-select-wrapper, .custom-select-menu & .custom-select-option):**
     - **Lý do sử dụng Custom Dropdown:** Thẻ `<option>` mặc định của trình duyệt bị hạn chế bởi hệ điều hành nên không thể bo góc, đổ bóng hay hiển thị icon. Cấu trúc Custom Select mang lại giao diện tinh tế, hiện đại chuẩn Enterprise SaaS:
     - **Nút kích hoạt (.custom-select-trigger):** Bo góc `8px`, viền mảnh `#cbd5e1`, nền trắng `#ffffff`, hiển thị icon và nhãn của tùy chọn đang chọn, mũi tên chevron xoay mượt mà 180 độ khi mở menu.
     - **Khung danh sách (.custom-select-menu):** Nền trắng `#ffffff`, bo góc `10px`, viền mảnh `#e2e8f0`, đổ bóng 2 tầng mịn màng `0 10px 25px -5px rgba(0, 0, 0, 0.1)`, padding trong `6px`.
     - **Từng mục tùy chọn (.custom-select-option):**
       - Bố cục flex hai bên, padding `9px 12px`, bo góc `6px`.
       - Hiển thị icon trực quan phân loại từng sự kiện (icon layer cho All, icon merge request màu cam, icon issue màu xanh lá).
       - Trạng thái Hover: Nền xám nhạt `#f1f5f9`, chữ đổi sang xanh chủ đạo `var(--primary)`.
       - Trạng thái Đang chọn (Selected): Nền xanh dịu `#eef1fc`, chữ in đậm font-weight `600`, hiển thị dấu tích xanh `<i class="fa-solid fa-check check-icon"></i>` ở góc phải.
     - **Tự động đóng:** Tự động ẩn menu khi người dùng bấm chọn mục hoặc nhấp chuột ra ngoài qua `@HostListener('document:click')`.
   - **Menu / Popover Bộ lọc Đa tiêu chí (.filter-dropdown-wrapper & .filter-dropdown-menu):**
     - **Nút kích hoạt (.btn-filter-trigger):** Bo góc `6px`, viền `#cbd5e1`, nền trắng `#ffffff`, chữ `#334155`, font-size `13px`, font-weight `600`, icon phễu màu xanh chủ đạo `var(--primary)` và mũi tên chevron xoay 180 độ mượt mà.
     - **Khung chứa Popover (.filter-dropdown-menu):**
       - Chiều rộng cố định `380px` thoáng đãng, bo góc lớn `12px`, viền `1px solid #e2e8f0`, đổ bóng 2 tầng mịn màng `0 20px 25px -5px rgba(0, 0, 0, 0.12), 0 10px 10px -5px rgba(0, 0, 0, 0.04)`.
       - Header: Nền xám nhạt `#f8fafc`, padding `1rem 1.25rem`, tiêu đề in hoa nhẹ font-weight `700`, kèm nút đóng X góc phải.
       - Thân popup (.filter-body): Padding `1.25rem`, thanh cuộn mảnh bo tròn 5px, khoảng cách giữa các khối tiêu chí `gap: 1.25rem`.
       - Từng khối lọc (.filter-section): Căn dọc với `gap: 0.5rem` giữa nhãn (label), ô nhập (input/select) và nhóm huy hiệu (badges).
       - Nhóm Huy hiệu (.filter-badges-group & .filter-badge): Sắp xếp flex wrap với `gap: 0.5rem`; từng badge có padding `0.35rem 0.75rem`, bo góc `6px`, màu nền `#f1f5f9`. Khi hover chuyển sang `#eef2ff` viền xanh; khi active mang nền `#e0e7ff` chữ xanh đậm `var(--primary)` font-weight `600`.
       - Footer (.filter-footer): Padding `0.875rem 1.25rem`, nền `#f8fafc`, gồm nút Reset bên trái và nhóm nút thao tác Cancel / Apply bên phải với `gap: 0.625rem`.

7. **Quy chuẩn Cỡ chữ Toàn hệ thống (Strict Two-Tier Typography Scale):**
   - **Nguyên tắc cốt lõi:** Toàn bộ hệ thống chỉ sử dụng duy nhất **2 kích thước cỡ chữ**:
     1. **Cỡ chữ Tiêu đề (16px):** Áp dụng cố định cho toàn bộ các tiêu đề trong hệ thống bao gồm h1, h2, h3, h4, h5, h6, tiêu đề trang (.page-title, .page-top-bar h3/h4), tiêu đề card (.card-title), tiêu đề modal popup (.modal-title), tiêu đề mục (.section-title). Độ đậm font: ont-weight: 600 - 700.
     2. **Cỡ chữ Nội dung & Điều khiển (13px):** Áp dụng cố định cho toàn bộ các thành phần văn bản còn lại của hệ thống: thân trang, đoạn văn bản (p), mô tả phụ (.subtitle), menu điều hướng (.nav-link), bảng dữ liệu (	able th, 	able td), ô nhập liệu (input, select, 	extarea), nút bấm (utton, .btn), nhãn (label), thẻ trạng thái (.badge), dropdown options,...
   - **Tuyệt đối không sử dụng bất kỳ size nào khác** (như 11px, 12px, 14px, 15px, 18px, 20px, 0.75rem, 0.85rem, 1.25rem,...) để duy trì tính đồng nhất và chuyên nghiệp tuyệt đối cho toàn bộ giao diện Enterprise SaaS.

8. **Quy chuẩn Thanh Tab Điều hướng Phân hệ (Modern Underline Nav Tabs - Tailwind Style):**
   - **Bố cục khung Tab (`.nav-tabs`):**
     - Hiển thị dạng flex nằm ngang không bọc khối, viền dưới liền mạch `border-bottom: 1px solid #e2e8f0;`.
     - Khoảng cách giữa các tab: `gap: 2rem;` (tương đương `space-x-8` trong Tailwind), khoảng cách phía dưới `margin-bottom: 1.5rem;`.
     - Tuyệt đối **không dùng kiểu tab bo viền folder 3 phía nền trắng** của Bootstrap cũ.
   - **Từng mục Tab (`.nav-link`):**
     - Cấu trúc: Thẻ `<a class="nav-link">` căn flex (`display: inline-flex; align-items: center; gap: 0.5rem; white-space: nowrap; font-size: 13px; font-weight: 500;`).
     - Padding: `padding: 0.5rem 0.25rem 0.875rem 0.25rem;` kết hợp `margin-bottom: -1px;` để đường gạch chân đè khít lên viền đáy.
     - Biểu tượng Icon: Mỗi tab có icon phân loại trực quan (kích thước 15px) đi kèm phía trước nhãn tab.
   - **Trạng thái Chưa kích hoạt (Inactive):**
     - Nền trong suốt (`background: transparent;`), chữ màu xám `#64748b`, icon màu xám `#94a3b8`, viền đáy ẩn `border-bottom: 2px solid transparent;`.
     - Khi rê chuột (Hover): Chữ đổi sang `#1e293b`, icon đổi sang `#475569`, viền đáy xuất hiện vạch xám sáng `border-bottom-color: #cbd5e1;`.
   - **Trạng thái Đang chọn (Active):**
     - Nền giữ nguyên trong suốt (`background: transparent;`).
     - Chữ và icon nổi bật với màu xanh thương hiệu `var(--primary)` (`#3157D5`), độ đậm `font-weight: 600;`.
     - Vạch gạch chân tích cực: `border-bottom: 2px solid var(--primary);`.
