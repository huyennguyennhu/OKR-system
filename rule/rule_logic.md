# Luồng Logic Xây Dựng Hệ Thống OKR

## 1. Quản lý Nhân sự (Nền tảng ban đầu)
- **Tạo người dùng (Nhân viên):** Cần thu thập các thông tin cơ bản như: Họ tên, Email, Số điện thoại...
- **Vị trí và Đội nhóm (Team & Role):** Để phân bổ nhân viên vào đúng vị trí làm việc, hệ thống cần phải được khởi tạo danh sách Team và các Role (vai trò) trong Team đó từ trước.
👉 **Đề xuất giao diện:** Cấu trúc thành một menu/tab **"Nhân sự"** bao gồm 2 tab con là **Team** (Đội nhóm) và **Nhân viên** (Danh sách người dùng).

---

## 2. Thiết lập OKR (OKR Settings)
Sau khi đã có dữ liệu nền tảng về nhân sự, bước tiếp theo là cấu hình các thông số cho hệ thống OKR. 
Một Objective (Mục tiêu) chỉ có ý nghĩa khi xác định rõ: *Áp dụng cho ai? Trong khoảng thời gian nào? Đo lường bằng đơn vị gì? Nếu là mục tiêu con thì cách tổng hợp (roll-up) lên mục tiêu cha ra sao? và Tiến độ hiện tại tính thế nào?*

👉 **Đề xuất giao diện:** Cấu trúc OKR Settings sẽ bao gồm các tab như: **Space**, **Timeline**, **Thành viên**,...

### 2.1. Không gian làm việc (Space)
- **Mục đích:** Đóng vai trò là một vùng không gian độc lập để ngăn cách dữ liệu giữa các phòng ban hoặc tổ chức khác nhau.
- **Khởi tạo Space:** Yêu cầu các thông tin cơ bản gồm:
    - **Tên Space**
    - **Mô tả**
    - **Mã Space** (Có thể tự động sinh ra từ tên)
- **Thành viên trong Space:** Sau khi khởi tạo không gian, cần xác định và quản lý danh sách những thành viên nào được phép hoạt động trong không gian đó.

### 2.2. Chu kỳ thời gian (Timeline)
- **Mục đích:** Định nghĩa khoảng thời gian hiệu lực cho các mục tiêu.
- **Cấu trúc khởi tạo (Create Timeline):**
    - **Title (Tên chu kỳ):** Định danh chu kỳ (Ví dụ: 2026).
    - **Space (Không gian):** Chọn Space mà Timeline này sẽ được áp dụng (VD: AUTV22: Automation OKR...).
    - **Tree Timeline (Cây chu kỳ):** Cho phép phân cấp thời gian thành các khoảng nhỏ hơn theo cấu trúc lồng nhau (VD: Chọn phân cấp theo Quarterly, Monthly).
    - **Multiple years timeline:** Tính năng (Toggle) bật/tắt cho phép lựa chọn chu kỳ linh hoạt qua nhiều năm thông qua thanh trượt timeline (Ví dụ: Từ 2021 đến 2031).
    - **Start Date & End Date:** Xác định mốc thời gian bắt đầu và kết thúc cụ thể của toàn bộ chu kỳ (VD: Jan 01, 2026 - Dec 31, 2026).
- **Preview Timeline (Bản xem trước cấu trúc cây):** Hệ thống sẽ hiển thị một cây phân cấp thời gian rõ ràng dựa trên các tùy chọn ở trên. Người dùng có thể tick chọn các mốc thời gian muốn khởi tạo thực sự:
    - **Cấp 1 (Năm):** Ví dụ `2026` (Jan 01, 2026 - Dec 31, 2026).
        - **Cấp 2 (Quý):** Ví dụ `Quarter 1` (Jan 01, 2026 - Mar 31, 2026).
            - **Cấp 3 (Tháng):** Ví dụ `Month 1` (Jan 01, 2026 - Jan 31, 2026), `Month 2`, `Month 3`...

### 2.3. Thành viên (Members)
- **Mục đích:** Tab dùng để quản lý danh sách người dùng được cấp quyền tham gia vào thiết lập OKR.
- **Chức năng:** Theo dõi danh sách, phân bổ thành viên vào các Space cụ thể, và cấp quyền (Roles) cho họ trong hệ thống OKR.
