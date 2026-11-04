# منظومة تخطيط موارد المؤسسات الصناعية (ERP) — واجهات Angular

واجهة أمامية كاملة (بدون Backend) لمتطلبات وثيقة SRS: شجرة المنتج المرئية، التكلفة التراكمية، قرار التصنيع/الشراء، تدفق الشراء، مسار الإنتاج ومخطط جانت، وتتبع المهام. مبنية بالهوية البصرية السورية (الأخضر الحرجي، القمحي الذهبي، البني العميق) وباتجاه RTL.

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
