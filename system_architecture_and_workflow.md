# สรุปการทำงานของระบบจัดการแผงตลาด (Market Stall System Overview)

ระบบ Market Stall เป็นแพลตฟอร์มสำหรับจัดการการจองแผงตลาดและการชำระเงิน โดยแบ่งสถาปัตยกรรมออกเป็น 2 ส่วนหลักคือ **Backend (NestJS)** และ **Frontend (Angular)**

---

## 🏗️ 1. สถาปัตยกรรมระบบ (System Architecture)

### 🔹 Backend (NestJS + TypeORM + MySQL)
ทำหน้าที่เป็น RESTful API จัดการตรรกะทางธุรกิจทั้งหมด ประกอบด้วยโมดูลหลักๆ ดังนี้:
- **User / Admin Module:** จัดการข้อมูลผู้ใช้งาน ผู้ดูแลระบบ และการยืนยันตัวตน (Authentication ผ่าน JWT)
- **Market Module:** จัดการข้อมูลพื้นที่ขาย (Stall) สถานะว่าง/ไม่ว่าง รวมถึงระบบซ่อมบำรุง (Maintenance) ทั้งแบบรายแผงและแบบทั้งตลาด (Batch)
- **Booking Module:** จัดการวงจรการจอง ตั้งแต่เริ่มต้นจอง ยกเลิก ไปจนถึงการเช็คเอาท์
- **Payment Module:** จัดการการอัปโหลดสลิป ยืนยันการชำระเงิน และการสืบค้นข้อมูลรายได้ (รายวัน/สัปดาห์/เดือน)

### 🔹 Frontend (Angular 21 + TailwindCSS + DaisyUI)
ส่วนติดต่อผู้ใช้ ถูกออกแบบมาเพื่อรองรับฝั่ง Admin (และเตรียมพร้อมสำหรับ User ในอนาคต) ประกอบด้วยหน้าหลักๆ:
- **Dashboard (`/dashboard-admin`):** แสดงภาพรวมรายได้และสถิติต่างๆ 
- **Stall Management (`/stall`):** แสดงรายชื่อแผง จัดการข้อมูล แผงที่ล็อกการจอง และการเปิด-ปิดซ่อมบำรุง 
- **Booking Status (`/booking-status-admin`):** ตรวจสอบและจัดการสถานะการจองทั้งหมด
- **Payment Status (`/payment-status`):** ตรวจสอบสลิปโอนเงินและการชำระเงิน
- **Calendar (`/calender`):** ดูตารางการจองในรูปแบบปฏิทิน
- **User Management (`/user-management`):** ดูและจัดการผู้ใช้งานและผู้ดูแลระบบ

---

## 🗄️ 2. โครงสร้างฐานข้อมูล (Database Schema)

ระบบใช้ Relational Database (MySQL) โดยมี Entity หลักที่เชื่อมโยงกันดังนี้:
1. **User (ผู้ใช้งาน/พ่อค้าแม่ค้า):** เก็บข้อมูลผู้ใช้ (username, tel) 
2. **Admin (ผู้ดูแลระบบ):** เก็บข้อมูลพร้อมสถานะ `isActive` สำหรับเข้าใช้งานระบบจัดการ
3. **Market (แผงตลาด):** เก็บ `code` (รหัสแผง), `price` (ราคา), `status` (สถานะ availability)
4. **StallMaintenance (ประวัติการซ่อมบำรุง):** เชื่อมกับแผงตลาด สามารถล็อกแผงไม่ให้จองได้ มีโหมด `isBatch` สำหรับปิดปรับปรุงพร้อมกันทั้งตลาด
5. **Booking (การจอง):** เชื่อมกับ [User](file:///d:/work2/backend_marketstall/src/user/entities/user.entity.ts#5-26), [Market](file:///d:/work2/backend_marketstall/src/market/entities/market.entity.ts#5-31), และ [Admin](file:///d:/work2/backend_marketstall/src/admin/entities/admin.entity.ts#5-24) (กรณีแอดมินแก้ไข) เก็บสถานะช่วงจองเต็นท์ (startDate, endDate, status, price)
6. **Payment (การชำระเงิน):** สัมพันธ์กับ Booking เสมอ (One-to-One) เก็บ `proof_of_payment` (รูปสลิป) และสถานะการจ่ายเงิน

---

## 🔄 3. Workflow การทำงานหลักของระบบ (Core Workflows)

### 🛡️ 3.1 การจัดการสิทธิ์และการเข้าสู่ระบบ (Authentication Flow)
- ผู้ใช้งาน/Admin เข้าสู่ระบบด้วย Username/Password
- Backend จะตรวจสอบและออก **JWT Token** ให้ 
- Frontend นำ Token ไปเก็บและ แนบกับทุก HTTP Request 
- ใช้ Angular Guard (`adminGuard`) ป้องกันหน้า Dashboard ไม่ให้คนที่ไม่ได้ล็อกอินเข้าถึง

### 🏪 3.2 การจัดการแผงค้าและการซ่อมบำรุง (Market & Maintenance Flow)
- **การตั้งค่าแผง:** Admin สามารถสร้าง ลบ แก้ไข รหัสแผงและราคาได้
- **การซ่อมบำรุง (Maintenance):**
  - **Individual:** เลือกแผงใดแผงหนึ่ง ปิดปรับปรุงตามช่วงวันที่กำหนด แผงนั้นจะไม่สามารถจองได้
  - **Batch:** สามารถสั่งปิดปรุง "ทั้งตลาด" ทันที ระบบจะมี Guard บน Backend ป้องกันไม่ให้แอดมินคนอื่นสั่งปิดแผงเดี่ยวๆ ซ้อนทับในช่วงเวลาที่ปิดแบบ Batch
  - เมื่อหมดช่วงซ่อมบำรุง สถานะจะถูกเปลี่ยนโดยอัตโนมัติ

### 📅 3.3 การจองพื้นที่ (Booking Flow)
1. **ตรวจสอบคิวว่าง:** ระบบส่งวันที่ไปที่ API [getAvailableMarkets](file:///d:/work2/marketstall/src/app/services/market.ts#29-35) เพื่อกรองแผงที่ติด Maintenance และแผงที่มีคนจองแล้วออก
2. **สร้างการจอง (Create):** ผู้ใช้เลือกแผง สร้างรายการจอง ข้อมูลถูกบันทึกลงตาราง [Booking](file:///d:/work2/backend_marketstall/src/booking/entities/booking.entity.ts#7-43) โดยจะตั้งสถานะเริ่มต้นเป็น `pending`
3. **การจัดการสถานะ:** 
   - ฝั่ง Admin สามารถกดยกเลิกการจอง ([cancelBooking](file:///d:/work2/marketstall/src/app/services/booking.ts#24-27)) หรือเช็คเอาท์ออกล่วงหน้าเช้ากว่ากำหนด ([checkoutEarly](file:///d:/work2/marketstall/src/app/services/booking.ts#28-31))

### 💰 3.4 การชำระเงินและสรุปยอด (Payment & Revenue Flow)
1. **แนบสลิป:** เมื่อผู้ใช้โอนเงิน จะอัปโหลดสลิปส่งผ่าน API `/booking/:id/payment` 
2. **สร้างรายการจ่าย:** ตาราง [Payment](file:///d:/work2/backend_marketstall/src/payment/entities/payment.entity.ts#6-33) จะถูกสร้างและผูกกับ [Booking](file:///d:/work2/backend_marketstall/src/booking/entities/booking.entity.ts#7-43) นั้น
3. **การตรวจสอบ:** Admin เข้ามาดูรูปสลิปที่หน้า **Payment Status** และกดยืนยัน (Approve) หรือ ปฏิเสธ (Reject)
4. **สรุปรายได้:** ในเมนู Dashboard มีการเรียกใช้ Service ดึงข้อมูล [getDailyRevenue](file:///d:/work2/marketstall/src/app/services/payment.ts#32-39), [getWeeklyRevenue](file:///d:/work2/marketstall/src/app/services/payment.ts#40-47), [getMonthlyRevenue](file:///d:/work2/marketstall/src/app/services/payment.ts#48-55) มาวิเคราะห์และแสดงผลในฝั่ง Admin

### 👥 3.5 การจัดการผู้ใช้งาน (Admin/User Management)
- Admin สามารถเพิ่ม Admin คนอื่นเข้าสู่ระบบได้
- สามารถระงับสิทธิ์การใช้งาน (`isActive = false`) หรือลบแอคเคาท์ได้
- มีตารางแสดงประวัติผู้เช่าว่า User คนไหนจองอะไรไปแล้วบ้าง
