# Itqan Web — إتقان: منصة تخطيط التصنيع

**From product tree to finished product.** Arabic-first Angular 22 client for **Itqan**, a manufacturing planning platform.

> Backend: [`itqan-backend`](https://github.com/Ahmadjarad47/itqan-backend) (.NET 10, Clean Architecture, CQRS). This repo is the front end; it also runs on its own with seeded demo data.

![Angular 22](https://img.shields.io/badge/Angular-22-DD0031?logo=angular&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-3178C6?logo=typescript&logoColor=white) ![RTL](https://img.shields.io/badge/UI-Arabic%20RTL-2E7D32) ![License: MIT](https://img.shields.io/badge/license-MIT-green)

## The idea

A manufacturer building a complex product (a machine, a vehicle, a system) has to answer the same questions for thousands of parts: *what is it made of, what does it cost, do we make it or buy it, who supplies it, when is it produced, and is it in stock?* Usually those answers sit in separate spreadsheets that never agree.

**Itqan** (إتقان, "mastery and precision in craft") connects them all through the **product tree (BOM)**:

1. **Engineer:** build an unlimited-depth product tree per project, with drawings, quality files and materials on every part.
2. **Cost:** costs roll up bottom-up through the tree, live.
3. **Decide:** every part gets a mandatory **MAKE or BUY** decision, supported by multi-criteria scoring (MCDM).
4. **Buy:** BUY parts flow into a 10-stage purchasing workflow (requests, RFQs, quotes, supplier comparison, receipt into the warehouse).
5. **Make:** MAKE parts flow into production routing (operations, stations, setup and run times, consumables, quality checks) on a Gantt chart.
6. **Store:** warehouses, stock movements and FIFO costing.
7. **Track:** tasks for managers and employees, roles and permissions, and admin-defined custom fields everywhere.

---

## نبذة بالعربية

واجهة أمامية كاملة لمتطلبات وثيقة SRS: شجرة المنتج المرئية، التكلفة التراكمية، قرار التصنيع/الشراء، تدفق الشراء، مسار الإنتاج ومخطط جانت، المستودعات، وتتبع المهام. مبنية بالهوية البصرية السورية (الأخضر الحرجي، القمحي الذهبي، البني العميق) وباتجاه RTL.

## التشغيل

يتطلب Node.js ‏24.15+ (أو 22.22+).

```bash
npm install
npm start
```

ثم افتح `http://localhost:4200`. البيانات التجريبية تُنشأ تلقائياً وتُحفظ في `localStorage`، ويمكن إعادة تعيينها من قائمة المستخدم أعلى الشاشة.

```bash
npm test        # اختبارات قواعد المجال (Vitest)
npm run build   # بناء الإنتاج
```

## التقنيات

- Angular 22 (Standalone، Signals، Zoneless، Control flow الجديد، `input()/model()/output()`، `linkedSignal`، `animate.enter/leave`، View Transitions)
- TypeScript strict + strictTemplates
- SCSS بنظام Design Tokens (وضع فاتح/داكن)
- بدون مكتبات UI خارجية

## المعمارية (Clean Architecture)

```
src/app/
├── domain/            # قلب النظام — TypeScript نقي بلا Angular
│   ├── models/        # الكيانات: BomNode, Project, PurchaseRequest, RoutingOperation, WorkTask ...
│   ├── rules/         # قواعد العمل: BomTree، Cost Roll-Up، Progress Roll-Up، آلة حالات الشراء، MCDM، تدفق المهام
│   └── ports/         # عقود المستودعات (Repository ports) كـ abstract classes
├── infrastructure/    # المحوّلات: LocalStorageRepository + بيانات تجريبية (seed)
├── application/       # حالة التطبيق وحالات الاستخدام
│   ├── state/         # Signal stores لكل Aggregate
│   ├── use-cases/     # Sourcing (Make/Buy)، Purchase workflow، Production، Task workflow، Project setup
│   └── queries/       # Read models مشتقة (التكلفة والتقدم الحيّان، لوحة القيادة، الإشعارات)
├── core/              # الهيكل العام (Shell)، التنقل، الإشعارات والتأكيد
├── shared/            # مكونات UI قابلة لإعادة الاستخدام + Pipes
└── features/          # الشاشات (Lazy-loaded)
    ├── dashboard/
    ├── projects/      # قائمة المشاريع، مستكشف الشجرة (Drill-down)، صفحة تفاصيل المكون
    ├── costing/
    ├── procurement/   # طلبات الشراء، متابعة الطلب (10 مراحل + RFQ + MCDM)، الموردون
    ├── production/    # حوض التصنيع، محرر المسار، مخطط جانت
    ├── inventory/
    └── tasks/         # شاشة المدير، شاشة الموظف
```

اتجاه الاعتماديات: `features → application → domain ← infrastructure`. لاستبدال التخزين المحلي بـ API حقيقي يكفي كتابة محوّل HTTP يطبّق نفس الـ ports وتغيير `provideInfrastructure()` فقط.

## الصلاحيات (RBAC) والحقول المخصصة

- **الأدوار والصلاحيات** (`/admin/roles`): 19 صلاحية موزعة على الوحدات، محرر لكل دور ومصفوفة أدوار × صلاحيات. دور «مدير النظام» يحتفظ دائماً بكل الصلاحيات.
- **المستخدمون** (`/admin/users`): إضافة المستخدمين وإسناد الأدوار وتعطيل الحسابات، مع منع تعطيل آخر مدير نظام.
- **التطبيق**: حراسة المسارات `requirePermission()`، توجيه كل مستخدم لأول شاشة مسموحة، توجيه `*appCan` لإخفاء الإجراءات، وعرض للقراءة فقط (fieldset) عند غياب صلاحية التعديل. بدّل المستخدم من القائمة أعلى الشاشة لتجربة الأدوار.
- **الحقول المخصصة** (`/admin/fields`): حقول ديناميكية (نص، رقم، تاريخ، قائمة، اختيار متعدد، نعم/لا، رابط) لمكونات الشجرة والموردين وطلبات الشراء والمواد والعمليات، مع الإلزامية والترتيب والتفعيل وإظهارها كأعمدة في الجداول ومعاينة حيّة.
- **مخطط شجرة المنتج**: عرض الشجرة كعقد مترابطة (Org chart) مع طي/توسيع لكل عقدة، اختيار عمق العرض، تكبير وسحب للتنقل.

## تغطية المتطلبات

| المتطلب | الشاشة |
| --- | --- |
| شجرة منتج بطبقات غير محدودة + Breadcrumb + تنقل متحرك | المشاريع ← مستكشف الشجرة (بطاقات/شجرة) |
| عدد الوحدات المراد إنتاجها | بطاقة المشروع |
| تفاصيل المكون (ب1، ملفات CAD/الجودة، ب2 تعيين المواد، ب3 قرار إلزامي) | نقر مزدوج على أي مكون |
| BUY ← حوض الشراء تلقائياً / MAKE ← حوض الإنتاج | صفحة المكون |
| مرشحات الشراء، آلة الحالات بعشر مراحل مع التاريخ والمستندات، MCDM، الشراء المستقل، الموردون | طلبات الشراء / الموردون |
| جدول المسار: التسلسل، داخلي/خارجي، المدخلات المتعددة، التواريخ والساعات، المحطة، الإعداد والمعالجة، المستهلكات وخصمها من المستودع، الجودة والإرجاع | حوض التصنيع ← محرر المسار |
| مخطط جانت قابل للتصفية حسب المشروع والمستوى والمكون | مخطط جانت |
| التكلفة التراكمية Bottom-Up مع التحديث الفوري | التكلفة التراكمية |
| تتبع المهام: شاشة المدير وشاشة الموظف | إدارة المهام / مهامي |
