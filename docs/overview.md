# The OSCP Ascent – Codebase Orientation

ยินดีต้อนรับสู่โปรเจกต์ **The OSCP Ascent** ซึ่งสร้างด้วย [SvelteKit](https://kit.svelte.dev/) เพื่อเป็นแอปพลิเคชันช่วยติดตามความคืบหน้าการทำแล็บสำหรับเตรียมสอบ OSCP ส่วนนี้จะสรุปโครงสร้างหลักของโค้ด สิ่งสำคัญที่ควรรู้ และแนวทางการเรียนรู้เพิ่มเติมสำหรับผู้มาใหม่

## 1. โครงสร้างไฟล์หลัก

```
├── README.md              # เอกสารเบื้องต้นและลิงก์อ้างอิง
├── package.json           # รายการสคริปต์และ dependencies ของโปรเจกต์
├── src/
│   ├── app.html           # โครงสร้าง HTML พื้นฐานของแอป
│   ├── app.css            # สไตล์รวมของแอป (Tailwind utility classes ถูกใช้ในคอมโพเนนต์)
│   ├── lib/
│   │   ├── data/          # ไฟล์ข้อมูลเริ่มต้น (JSON ของ Hack The Box และ PG Practice)
│   │   ├── index.js       # จุดรวมโมดูลที่เข้าผ่าน `$lib`
│   │   └── stores.js      # Svelte store สำหรับสถานะของแล็บทั้งหมด
│   └── routes/
│       ├── +layout.svelte # ส่วน layout หลัก มี header/footer และปุ่ม reset localStorage
│       ├── +page.svelte   # หน้าแดชบอร์ดหลัก จัดการรายการแล็บและโน้ต
│       └── stats/+page.svelte # หน้ารวมสถิติการทำแล็บเสร็จตามเดือน
└── static/                # ไฟล์สาธารณะ (หากต้องการ)
```

### รายละเอียดเพิ่มเติม

- **Frontend Framework:** ใช้ SvelteKit + Vite เป็น build tool จึงมีไฟล์ `svelte.config.js`, `vite.config.js`, `eslint.config.js` และ `jsconfig.json` เพื่อกำหนดการพัฒนา
- **Dependencies สำคัญ:** ระบุใน `package.json` เช่น `lucide-svelte` สำหรับไอคอน และ `clsx` สำหรับการจัดการ class name แบบมีเงื่อนไข

## 2. การจัดการสถานะและข้อมูล

- ไฟล์ `src/lib/stores.js` กำหนด writable store ชื่อ `labs` ที่อ่าน/เขียนข้อมูลผ่าน Local Storage บน browser เพื่อให้ผู้ใช้บันทึกความคืบหน้าได้ถาวร
- เมื่อเริ่มต้น (`src/routes/+page.svelte`) แอปจะโหลดข้อมูลจาก `src/lib/data/*.json` และปรับโครงสร้างให้มีฟิลด์ที่จำเป็น เช่น `id`, `source`, `category`, `completed`, `notes`
- ฟีเจอร์เพิ่ม/แก้ไข/ลบโน้ตถูกจัดการในหน้า `+page.svelte` ผ่าน modal และอัปเดต `labs` store ให้เป็นไปตามสคีมาที่กำหนด

## 3. หน้า UI หลัก

- `+layout.svelte` ให้กรอบ UI รวม พร้อมปุ่ม **Reset Data** ที่ลบคีย์ `my-advanced-labs` ใน Local Storage และรีเฟรชหน้า
- `+page.svelte` เป็นแดชบอร์ดที่เลือกหมวดหมู่ของแล็บ แสดงการ์ดของแต่ละแล็บ ปุ่มเปิดลิงก์ Hack The Box, ปุ่มจดโน้ต และ checkbox "Owned" เพื่ออัปเดตสถานะ
- `stats/+page.svelte` แปลงข้อมูลจาก store ให้เป็นสถิติรายเดือน โดยอาศัย timestamp จาก `completedAt`

## 4. สิ่งสำคัญที่ควรรู้สำหรับผู้เริ่มต้น

1. **Local Storage เป็นแหล่งข้อมูลหลักขณะรัน** – ตรวจสอบ logic ใน `stores.js` หากต้องเปลี่ยนรูปแบบข้อมูลหรือย้ายไป backend จริง
2. **สคีมาของ Lab Object** – ทุกแล็บควรมีฟิลด์ `{ id, name, difficulty, os, source, category, completed, completedAt, notes[] }` เพื่อให้ฟีเจอร์ทั้งหมดทำงานถูกต้อง
3. **การใช้ Svelte reactive statements** (`$:`) – ใช้คำนวณค่าที่ต้องอัปเดตอัตโนมัติ เช่น รายการแล็บตามหมวดหมู่และสถิติ OS
4. **Component Styling** – ใช้ Tailwind utility classes โดยกำหนด global ที่ `app.css` และแทรกตรงคอมโพเนนต์

## 5. แนวทางการเรียนรู้ต่อ

- **พื้นฐาน Svelte/SvelteKit:** ทำความเข้าใจไฟล์ routing (`+page.svelte`, `+layout.svelte`), stores, และการ binding ต่าง ๆ จาก [เอกสาร Svelte](https://svelte.dev/docs) และ [SvelteKit](https://kit.svelte.dev/docs)
- **การจัดการสถานะขั้นสูง:** ศึกษา Svelte stores เพิ่มเติม (derived store, readable) หากต้องการคำนวณข้อมูลซับซ้อนขึ้น หรือเชื่อมต่อ API ภายนอก
- **การเพิ่มฟีเจอร์:** ตัวอย่างเช่น ระบบกรอง/ค้นหาแล็บ, การซิงก์ข้อมูลกับ backend, หรือการแสดงกราฟในหน้า stats (อาจใช้ไลบรารีอย่าง Chart.js)
- **การทดสอบและคุณภาพโค้ด:** ตั้งค่า unit test (เช่น Vitest) และใช้ ESLint/Prettier ตามที่ระบุในโปรเจกต์เพื่อรักษามาตรฐานโค้ด
- **Deployment:** ศึกษา adapter ของ SvelteKit เพื่อดีพลอยขึ้น Vercel, Netlify หรือโฮสต์อื่น ๆ พร้อมตั้งค่า environment variables หากเชื่อมบริการภายนอก

---

หากมีคำถามเพิ่มเติมหรืออยากทราบส่วนใดละเอียดขึ้น สามารถเปิดไฟล์ในไดเร็กทอรี `src/` ตามที่ระบุด้านบนเพื่อสำรวจโค้ดจริงประกอบได้เลยครับ
