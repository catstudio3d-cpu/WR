// 商品、課程與活動展示資料。雲端啟用後以 Supabase 資料庫為準。
const PRODUCTS = [
  {
    "id": "helmet",
    "group": "人身裝備",
    "category": "安全帽",
    "name": "越野安全帽",
    "price": 0,
    "image": "assets/products/helmet.png",
    "description": "越野安全帽展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "goggles",
    "group": "人身裝備",
    "category": "護目鏡",
    "name": "越野護目鏡",
    "price": 0,
    "image": "assets/products/goggles.png",
    "description": "越野護目鏡展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "armor",
    "group": "人身裝備",
    "category": "防護護具",
    "name": "護胸護背組",
    "price": 0,
    "image": "assets/products/armor.png",
    "description": "護胸護背組展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "boots",
    "group": "人身裝備",
    "category": "車靴與手套",
    "name": "越野車靴",
    "price": 0,
    "image": "assets/products/boots.png",
    "description": "越野車靴展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "wear",
    "group": "人身裝備",
    "category": "騎乘服飾",
    "name": "越野車衣",
    "price": 0,
    "image": "assets/products/wear.png",
    "description": "越野車衣展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "guards",
    "group": "改裝部品",
    "category": "車身防護",
    "name": "引擎下護板",
    "price": 0,
    "image": "assets/products/guards.png",
    "description": "引擎下護板展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "cockpit",
    "group": "改裝部品",
    "category": "把手與操控",
    "name": "越野把手",
    "price": 0,
    "image": "assets/products/cockpit.png",
    "description": "越野把手展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "suspension",
    "group": "改裝部品",
    "category": "懸吊系統",
    "name": "後避震器",
    "price": 0,
    "image": "assets/products/suspension.png",
    "description": "後避震器展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "brake",
    "group": "改裝部品",
    "category": "煞車系統",
    "name": "前煞車碟盤",
    "price": 0,
    "image": "assets/products/brake.png",
    "description": "前煞車碟盤展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "drive",
    "group": "改裝部品",
    "category": "傳動系統",
    "name": "後齒盤",
    "price": 0,
    "image": "assets/products/drive.png",
    "description": "後齒盤展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "wheel",
    "group": "改裝部品",
    "category": "輪胎與輪組",
    "name": "越野輪胎",
    "price": 0,
    "image": "assets/products/wheel.png",
    "description": "越野輪胎展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "intake",
    "group": "改裝部品",
    "category": "進排氣系統",
    "name": "泡棉空氣濾芯",
    "price": 0,
    "image": "assets/products/intake.png",
    "description": "泡棉空氣濾芯展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "electric",
    "group": "改裝部品",
    "category": "電系與照明",
    "name": "LED 輔助燈",
    "price": 0,
    "image": "assets/products/electric.png",
    "description": "LED 輔助燈展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "rescue",
    "group": "維修與救援",
    "category": "拖救與隨車工具",
    "name": "林道拖救繩",
    "price": 0,
    "image": "assets/products/rescue.png",
    "description": "林道拖救繩展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "care",
    "group": "維修與救援",
    "category": "保養耗材",
    "name": "鏈條保養組",
    "price": 0,
    "image": "assets/products/care.png",
    "description": "鏈條保養組展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "luggage",
    "group": "車用配件",
    "category": "行李與補給",
    "name": "防水尾包",
    "price": 0,
    "image": "assets/products/luggage.png",
    "description": "防水尾包展示商品。用於預覽分類與商品版面，實際品牌、功能與規格將於正式選品後更新。"
  },
  {
    "id": "course-l1",
    "group": "課程類",
    "category": "L1 基礎課程",
    "name": "L1｜基礎控車・基礎林道",
    "description": "練習坐姿與站姿、起步停止、低速平衡、八字轉彎、緩坡與基礎林道，加入自救與求援觀念。學員自備 400cc 以下輕型越野車與完整護具。日期、場地、時數及正式費用另行公告。",
    "price": 0,
    "image": "assets/products/course-l1.png",
    "demo": true,
    "stock": null,
    "active": true,
    "revision": 0,
    "featured": false,
    "ad_order": 100
  },
  {
    "id": "course-l2",
    "group": "課程類",
    "category": "L2 技術課程",
    "name": "L2｜技術林道・硬耐力入門",
    "description": "銜接 L1 對應能力，練習窄彎、後煞車協調、坡中再起步、低障礙與原木通過、坡地脫困。實際先修能力與練習範圍由教練評估。日期、場地及正式費用另行公告。",
    "price": 0,
    "image": "assets/products/course-l2.png",
    "demo": true,
    "stock": null,
    "active": true,
    "revision": 0,
    "featured": false,
    "ad_order": 100
  },
  {
    "id": "course-l3",
    "group": "課程類",
    "category": "L3 進階課程",
    "name": "L3｜硬耐力進階",
    "description": "進階專項包含 Pivot Turn、Rear Wheel Hop、Double Blip、Zap、Splatter 與連續路段判讀。需具備 L2 對應能力，依專項師資與場地安排。日期及正式費用另行公告。",
    "price": 0,
    "image": "assets/products/course-l3.png",
    "demo": true,
    "stock": null,
    "active": true,
    "revision": 0,
    "featured": false,
    "ad_order": 100
  },
  {
    "id": "course-sp",
    "group": "課程類",
    "category": "SP 獨立專項",
    "name": "SP｜獨立專項課程",
    "description": "依需求選擇孤輪入門、砂地騎乘、滑胎控制或跳躍入門。各專項有獨立先修條件，經教練確認能力後安排。專項內容、場地、日期及正式費用另行公告。",
    "price": 0,
    "image": "assets/products/course-sp.png",
    "demo": true,
    "stock": null,
    "active": true,
    "revision": 0,
    "featured": false,
    "ad_order": 100
  },
  {
    "id": "activity-wheelie",
    "group": "活動類",
    "category": "孤輪活動",
    "name": "孤輪體驗日",
    "description": "以孤輪體驗日 DM 為活動主視覺，規劃平衡感受、後煞車協調與分段練習。學員自備 400cc 以下車輛與完整護具，依教練評估安排。日期、地點及正式費用即將公布。NT$0 為展示價，非免費活動。",
    "featured": true,
    "ad_order": 1,
    "price": 0,
    "image": "assets/products/activity-wheelie.png",
    "demo": true,
    "stock": null,
    "active": true,
    "revision": 0
  }
];
