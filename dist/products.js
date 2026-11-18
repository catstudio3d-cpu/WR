// 商品資料集中於此：替換 name、image、price、description 即可更新實品。
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
  }
];

