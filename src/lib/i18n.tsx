import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

export type Lang = 'en' | 'bn';

const translations = {
  // Nav & Layout
  dashboard: { en: 'Dashboard', bn: 'ড্যাশবোর্ড' },
  products: { en: 'Products', bn: 'প্রোডাক্ট' },
  salesPOS: { en: 'Sales / POS', bn: 'বিক্রয় / POS' },
  newSaleEntry: { en: 'New Sale Entry', bn: 'নতুন বিক্রয়' },
  inventory: { en: 'Inventory', bn: 'মজুদ' },
  customers: { en: 'Customers', bn: 'কাস্টমার' },
  reports: { en: 'Reports', bn: 'রিপোর্ট' },
  excelImport: { en: 'Excel Import', bn: 'এক্সেল ইম্পোর্ট' },
  settings: { en: 'Settings', bn: 'সেটিংস' },

  // Dashboard
  businessOverview: { en: 'Business Overview', bn: 'ব্যবসার সারসংক্ষেপ' },
  todaysSales: { en: "Today's Sales", bn: 'আজকের বিক্রয়' },
  totalProducts: { en: 'Total Products', bn: 'মোট প্রোডাক্ট' },
  totalStock: { en: 'Total Stock', bn: 'মোট মজুদ' },
  lowStockAlert: { en: 'Low Stock Alert', bn: 'কম মজুদ সতর্কতা' },
  recentTransactions: { en: 'Recent Transactions', bn: 'সাম্প্রতিক লেনদেন' },
  weeklySales: { en: 'Weekly Sales Performance', bn: 'সাপ্তাহিক বিক্রয়' },
  viewAll: { en: 'View All', bn: 'সব দেখুন' },
  viewAllInventory: { en: 'View All Inventory', bn: 'সব মজুদ দেখুন' },
  allStockOK: { en: 'All stock levels OK!', bn: 'সব মজুদ ঠিক আছে!' },
  itemsNeedRestock: { en: 'Items needing restock', bn: 'পুনরায় মজুদ দরকার' },
  newSale: { en: 'New Sale', bn: 'নতুন বিক্রয়' },
  salesToday: { en: 'sales today', bn: 'আজকের বিক্রয়' },
  activeItems: { en: 'Active items', bn: 'সক্রিয় আইটেম' },
  lowStock: { en: 'low stock', bn: 'কম মজুদ' },
  totalSales: { en: 'total sales', bn: 'মোট বিক্রয়' },
  last7Days: { en: 'Last 7 days revenue', bn: 'গত ৭ দিনের আয়' },
  noSalesYetDash: { en: 'No sales yet. Start by creating a new sale!', bn: 'এখনও কোনো বিক্রয় নেই। নতুন বিক্রয় শুরু করুন!' },
  today: { en: 'Today', bn: 'আজ' },

  // Products
  stockManagement: { en: 'Stock Management', bn: 'মজুদ ব্যবস্থাপনা' },
  addProduct: { en: 'Add Product', bn: 'প্রোডাক্ট যোগ করুন' },
  allProducts: { en: 'All Products', bn: 'সব প্রোডাক্ট' },
  productName: { en: 'Product Name', bn: 'প্রোডাক্টের নাম' },
  size: { en: 'Size', bn: 'সাইজ' },
  finish: { en: 'Finish', bn: 'ফিনিশ' },
  pricePerBox: { en: 'Price/Box', bn: 'দাম/বক্স' },
  sqftPerBox: { en: 'Sqft/Box', bn: 'স্কয়ারফিট/বক্স' },
  stock: { en: 'Stock', bn: 'মজুদ' },
  batch: { en: 'Batch', bn: 'ব্যাচ' },
  action: { en: 'Action', bn: 'কাজ' },
  edit: { en: 'Edit', bn: 'সম্পাদনা' },
  delete: { en: 'Delete', bn: 'মুছুন' },
  save: { en: 'Save', bn: 'সেভ করুন' },
  cancel: { en: 'Cancel', bn: 'বাতিল' },
  update: { en: 'Update', bn: 'আপডেট' },
  searchProducts: { en: 'Search products...', bn: 'প্রোডাক্ট খুঁজুন...' },
  boxes: { en: 'boxes', bn: 'বক্স' },
  noProducts: { en: 'No products found.', bn: 'কোনো প্রোডাক্ট পাওয়া যায়নি।' },
  editProduct: { en: 'Edit Product', bn: 'প্রোডাক্ট সম্পাদনা' },
  addNewProduct: { en: 'Add New Product', bn: 'নতুন প্রোডাক্ট যোগ করুন' },
  deleteProduct: { en: 'Delete Product?', bn: 'প্রোডাক্ট মুছে ফেলবেন?' },
  deleteConfirm: { en: 'This action cannot be undone.', bn: 'এটি আর ফিরিয়ে আনা যাবে না।' },
  productNameReq: { en: 'Product Name *', bn: 'প্রোডাক্টের নাম *' },
  priceBoxReq: { en: 'Price / Box (৳) *', bn: 'দাম / বক্স (৳) *' },
  batchNo: { en: 'Batch No.', bn: 'ব্যাচ নং' },
  saveProduct: { en: 'Save Product', bn: 'প্রোডাক্ট সেভ করুন' },
  updateProduct: { en: 'Update Product', bn: 'প্রোডাক্ট আপডেট করুন' },
  nameAndPriceReq: { en: 'Name and price required!', bn: 'নাম ও দাম আবশ্যক!' },
  productAdded: { en: 'Product added!', bn: 'প্রোডাক্ট যোগ হয়েছে!' },
  productUpdated: { en: 'Product updated!', bn: 'প্রোডাক্ট আপডেট হয়েছে!' },
  productDeleted: { en: 'Product deleted!', bn: 'প্রোডাক্ট মুছে ফেলা হয়েছে!' },
  deleteProductMsg: { en: 'This product will be permanently removed.', bn: 'এই প্রোডাক্টটি স্থায়ীভাবে মুছে যাবে।' },

  // Sales / POS
  pointOfSale: { en: 'Point of Sale', bn: 'বিক্রয় কেন্দ্র' },
  currentCart: { en: 'Current Cart', bn: 'বর্তমান কার্ট' },
  clear: { en: 'Clear', bn: 'সব মুছুন' },
  customerName: { en: 'Customer name (optional)', bn: 'কাস্টমারের নাম (ঐচ্ছিক)' },
  subtotal: { en: 'Subtotal', bn: 'সাবটোটাল' },
  discount: { en: 'Discount', bn: 'ছাড়' },
  total: { en: 'Total', bn: 'মোট' },
  checkoutInvoice: { en: 'Checkout & Invoice', bn: 'চেকআউট ও চালান' },
  clickToAdd: { en: 'Click a product to add', bn: 'প্রোডাক্টে ক্লিক করুন' },
  searchByName: { en: 'Search by name, size, batch...', bn: 'নাম, সাইজ, ব্যাচ দিয়ে খুঁজুন...' },
  salesHistory: { en: 'Sales History', bn: 'বিক্রয়ের ইতিহাস' },
  export: { en: 'Export', bn: 'এক্সপোর্ট' },
  invoice: { en: 'Invoice', bn: 'চালান' },
  customer: { en: 'Customer', bn: 'কাস্টমার' },
  items: { en: 'Items', bn: 'আইটেম' },
  amount: { en: 'Amount', bn: 'পরিমাণ' },
  payment: { en: 'Payment', bn: 'পেমেন্ট' },
  date: { en: 'Date', bn: 'তারিখ' },
  actions: { en: 'Actions', bn: 'কাজ' },
  view: { en: 'View', bn: 'দেখুন' },
  noSalesYet: { en: 'No sales recorded yet.', bn: 'এখনও কোনো বিক্রয় হয়নি।' },
  deleteSale: { en: 'Delete Sale?', bn: 'বিক্রয় মুছে ফেলবেন?' },
  deleteSaleMsg: { en: 'This sale record will be permanently deleted.', bn: 'এই বিক্রয় রেকর্ড স্থায়ীভাবে মুছে যাবে।' },
  saleDeleted: { en: 'Sale deleted.', bn: 'বিক্রয় মুছে ফেলা হয়েছে।' },
  saleCompleted: { en: 'Sale completed!', bn: 'বিক্রয় সম্পন্ন!' },
  csvExported: { en: 'CSV exported!', bn: 'CSV এক্সপোর্ট হয়েছে!' },
  newSaleEntryBtn: { en: 'New Sale Entry', bn: 'নতুন বিক্রয়' },
  cartEmpty: { en: 'Cart is empty!', bn: 'কার্ট খালি!' },
  addedToCart: { en: 'added!', bn: 'যোগ হয়েছে!' },
  outOfStockMsg: { en: 'out of stock!', bn: 'স্টক নেই!' },
  onlyBoxesAvail: { en: 'boxes available!', bn: 'বক্স আছে!' },
  onlyInStock: { en: 'Only', bn: 'মাত্র' },
  itemCount: { en: 'item(s)', bn: 'আইটেম' },
  time: { en: 'Time', bn: 'সময়' },
  status: { en: 'Status', bn: 'অবস্থা' },

  // New Sale Entry
  createTransaction: { en: 'Create Transaction', bn: 'নতুন লেনদেন' },
  customerInfo: { en: 'Customer Information', bn: 'কাস্টমারের তথ্য' },
  customerNameReq: { en: 'Customer Name *', bn: 'কাস্টমারের নাম *' },
  phone: { en: 'Phone (optional)', bn: 'ফোন (ঐচ্ছিক)' },
  address: { en: 'Address (optional)', bn: 'ঠিকানা (ঐচ্ছিক)' },
  paymentMethod: { en: 'Payment Method', bn: 'পেমেন্ট মাধ্যম' },
  notes: { en: 'Notes', bn: 'নোট' },
  pricingSummary: { en: 'Pricing Summary', bn: 'মূল্য সারসংক্ষেপ' },
  grandTotal: { en: 'Grand Total', bn: 'সর্বমোট' },
  amountReceived: { en: 'Amount Received', bn: 'প্রাপ্ত টাকা' },
  change: { en: 'Change', bn: 'ফেরত' },
  barcodeSearch: { en: 'Barcode / Quick Search', bn: 'বারকোড / দ্রুত খোঁজ' },
  saleItems: { en: 'Sale Items', bn: 'বিক্রয় আইটেম' },
  selectProduct: { en: '— Select Product —', bn: '— প্রোডাক্ট বাছুন —' },
  qty: { en: 'Qty (boxes)', bn: 'পরিমাণ (বক্স)' },
  rate: { en: 'Rate (৳)', bn: 'দর (৳)' },
  addItem: { en: 'Add another item', bn: 'আরেকটি আইটেম যোগ করুন' },
  saveSale: { en: 'Save Sale', bn: 'সেভ করুন' },
  saveAndPrint: { en: 'Save & Print', bn: 'সেভ ও প্রিন্ট' },
  saveAndPDF: { en: 'Save & PDF', bn: 'সেভ ও PDF' },
  saleSaved: { en: 'Sale saved successfully!', bn: 'বিক্রয় সফলভাবে সেভ হয়েছে!' },
  billTo: { en: 'Bill To', bn: 'বিল প্রাপক' },
  cash: { en: 'Cash', bn: 'নগদ' },
  bkash: { en: 'bKash', bn: 'বিকাশ' },
  nagad: { en: 'Nagad', bn: 'নগদ (Nagad)' },
  card: { en: 'Card', bn: 'কার্ড' },
  creditDue: { en: 'Credit / Due', bn: 'বাকি / বকেয়া' },
  paid: { en: 'Paid', bn: 'পরিশোধিত' },
  pending: { en: 'Pending', bn: 'অপেক্ষমাণ' },
  credit: { en: 'Credit', bn: 'বাকি' },
  flat: { en: '৳ Flat', bn: '৳ নির্দিষ্ট' },
  percent: { en: '% Percent', bn: '% শতাংশ' },
  outOfStock: { en: 'Out of stock', bn: 'স্টক নেই' },
  searchProductPlaceholder: { en: 'Type to search product...', bn: 'প্রোডাক্ট খুঁজতে টাইপ করুন...' },
  addAtLeastOneItem: { en: 'Add at least one item!', bn: 'অন্তত একটি আইটেম যোগ করুন!' },
  productNotFound: { en: 'Product not found!', bn: 'প্রোডাক্ট পাওয়া যায়নি!' },
  scanOrType: { en: 'Scan barcode or type name & Enter', bn: 'বারকোড স্ক্যান করুন বা নাম লিখে Enter দিন' },
  scan: { en: 'Scan', bn: 'স্ক্যান' },
  scanBarcodeHint: { en: 'Scan barcode with scanner or type product name/batch code', bn: 'স্ক্যানার দিয়ে বারকোড স্ক্যান করুন অথবা প্রোডাক্ট নাম/ব্যাচ কোড লিখুন' },

  // Invoice
  print: { en: 'Print', bn: 'প্রিন্ট' },
  pdf: { en: 'PDF', bn: 'PDF' },
  whatsapp: { en: 'WhatsApp', bn: 'হোয়াটসঅ্যাপ' },
  close: { en: 'Close', bn: 'বন্ধ করুন' },
  thermal: { en: 'Thermal', bn: 'রিসিপ্ট' },
  thankYou: { en: 'Thank you for your business!', bn: 'ব্যবসার জন্য ধন্যবাদ!' },
  termsAndConditions: { en: 'Terms & Conditions', bn: 'শর্তাবলী' },
  goodsOnceDelivered: { en: 'Goods once delivered cannot be returned or exchanged.', bn: 'একবার ডেলিভারি হওয়া পণ্য ফেরত বা বিনিময় করা যাবে না।' },
  priceSubjectToChange: { en: 'Prices are subject to change without prior notice.', bn: 'দাম পূর্ব নোটিশ ছাড়াই পরিবর্তন হতে পারে।' },
  paymentDueWithin: { en: 'Credit payment due within 30 days.', bn: 'বাকি টাকা ৩০ দিনের মধ্যে পরিশোধ করতে হবে।' },
  challanPreview: { en: 'Challan Preview', bn: 'চালান প্রিভিউ' },
  livePreview: { en: 'Live preview — fill the form to see', bn: 'লাইভ প্রিভিউ — ফর্ম পূরণ করুন' },

  // Inventory
  warehouse: { en: 'Warehouse', bn: 'গোদাম' },
  currentStockLevels: { en: 'Current Stock Levels', bn: 'বর্তমান মজুদের অবস্থা' },
  stockMovements: { en: 'Stock Movements', bn: 'মজুদের গতিবিধি' },
  outOfStockLabel: { en: 'Out of Stock', bn: 'স্টক নেই' },
  lowStockLabel: { en: 'Low Stock ⚠', bn: 'কম মজুদ ⚠' },
  inStock: { en: 'In Stock ✓', bn: 'মজুদে আছে ✓' },
  lowStockItems: { en: 'Low Stock Items', bn: 'কম মজুদের আইটেম' },
  product: { en: 'Product', bn: 'প্রোডাক্ট' },
  type: { en: 'Type', bn: 'ধরন' },
  note: { en: 'Note', bn: 'নোট' },

  // Customers
  crm: { en: 'CRM', bn: 'CRM' },
  addCustomer: { en: 'Add Customer', bn: 'কাস্টমার যোগ করুন' },
  allCustomers: { en: 'All Customers', bn: 'সব কাস্টমার' },
  totalRevenue: { en: 'Total Revenue', bn: 'মোট আয়' },
  avgSpend: { en: 'Avg. Spend', bn: 'গড় ব্যয়' },
  totalSpent: { en: 'Total Spent', bn: 'মোট খরচ' },
  lastOrder: { en: 'Last Order', bn: 'শেষ অর্ডার' },
  totalCustomers: { en: 'Total Customers', bn: 'মোট কাস্টমার' },
  nameRequired: { en: 'Name required!', bn: 'নাম আবশ্যক!' },
  customerAdded: { en: 'Customer added!', bn: 'কাস্টমার যোগ হয়েছে!' },
  name: { en: 'Name', bn: 'নাম' },
  addressLabel: { en: 'Address', bn: 'ঠিকানা' },
  phoneLabel: { en: 'Phone', bn: 'ফোন' },

  // Reports
  performanceOverview: { en: 'Performance Overview', bn: 'কর্মক্ষমতা পর্যালোচনা' },
  businessIntelligence: { en: 'Business Intelligence', bn: 'ব্যবসায়িক বুদ্ধিমত্তা' },
  monthlyRevenue: { en: 'Monthly Revenue', bn: 'মাসিক আয়' },
  totalOrders: { en: 'Total Orders', bn: 'মোট অর্ডার' },
  avgTicket: { en: 'Avg. Ticket', bn: 'গড় টিকেট' },
  topProducts: { en: 'Top Products', bn: 'সেরা প্রোডাক্ট' },
  dailySalesPerformance: { en: 'Daily Sales Performance', bn: 'দৈনিক বিক্রয়' },
  exportReport: { en: 'Export Report', bn: 'রিপোর্ট এক্সপোর্ট' },
  totalSalesAllTime: { en: 'Total Sales (all time)', bn: 'সর্বমোট বিক্রয়' },
  transactions: { en: 'transactions', bn: 'লেনদেন' },
  thisMonth: { en: 'This month', bn: 'এই মাসে' },
  orders: { en: 'orders', bn: 'অর্ডার' },
  noSalesDataMonth: { en: 'No sales data yet this month.', bn: 'এই মাসে এখনও কোনো বিক্রয় নেই।' },
  reportExported: { en: 'Report exported!', bn: 'রিপোর্ট এক্সপোর্ট হয়েছে!' },

  // Settings
  configuration: { en: 'Configuration', bn: 'কনফিগারেশন' },
  businessInfo: { en: 'Business Information', bn: 'ব্যবসার তথ্য' },
  businessName: { en: 'Business Name', bn: 'ব্যবসার নাম' },
  email: { en: 'Email', bn: 'ইমেইল' },
  userProfile: { en: 'User Profile', bn: 'ব্যবহারকারী প্রোফাইল' },
  fullName: { en: 'Full Name', bn: 'পূর্ণ নাম' },
  role: { en: 'Role', bn: 'পদবি' },
  systemSettings: { en: 'System Settings', bn: 'সিস্টেম সেটিংস' },
  invoicePrefix: { en: 'Invoice Prefix', bn: 'চালান প্রিফিক্স' },
  lowStockThreshold: { en: 'Low Stock Threshold', bn: 'কম মজুদের সীমা' },
  saveAllSettings: { en: 'Save All Settings', bn: 'সব সেটিংস সেভ করুন' },
  dataManagement: { en: 'Data Management', bn: 'ডাটা ব্যবস্থাপনা' },
  exportBackup: { en: 'Export Backup', bn: 'ব্যাকআপ নিন' },
  importBackup: { en: 'Import Backup', bn: 'ব্যাকআপ আমদানি' },
  clearAllData: { en: 'Clear All Data', bn: 'সব ডাটা মুছুন' },
  language: { en: 'Language', bn: 'ভাষা' },
  english: { en: 'English', bn: 'ইংরেজি' },
  bangla: { en: 'বাংলা', bn: 'বাংলা' },
  settingsSaved: { en: 'Settings saved!', bn: 'সেটিংস সেভ হয়েছে!' },
  dataImported: { en: 'Data imported! Reloading...', bn: 'ডাটা আমদানি হয়েছে! রিলোড হচ্ছে...' },
  invalidBackup: { en: 'Invalid backup file!', bn: 'ভুল ব্যাকআপ ফাইল!' },
  allDataCleared: { en: 'All data cleared! Reloading...', bn: 'সব ডাটা মুছে গেছে! রিলোড হচ্ছে...' },
  clearAllDataQ: { en: 'Clear All Data?', bn: 'সব ডাটা মুছে ফেলবেন?' },
  clearAllDataMsg: { en: 'This will permanently delete ALL products, sales, customers, and settings. This cannot be undone.', bn: 'এটি সব প্রোডাক্ট, বিক্রয়, কাস্টমার ও সেটিংস স্থায়ীভাবে মুছে ফেলবে। এটি আর ফেরানো যাবে না।' },
  deleteEverything: { en: 'Delete Everything', bn: 'সব মুছুন' },
  dataStoredLocally: { en: 'All data is stored locally in your browser. Export regularly for backup.', bn: 'সব ডাটা আপনার ব্রাউজারে সংরক্ষিত। নিয়মিত ব্যাকআপ নিন।' },
  darkMode: { en: 'Dark Mode', bn: 'ডার্ক মোড' },
  lightMode: { en: 'Light Mode', bn: 'লাইট মোড' },
  appearance: { en: 'Appearance', bn: 'থিম' },
  selectDataToClear: { en: 'Select Data to Clear', bn: 'মুছতে চান এমন ডাটা বাছুন' },
  selectDataToClearMsg: { en: 'Choose which data you want to delete. This cannot be undone.', bn: 'কোন ডাটা মুছতে চান বাছুন। এটি আর ফেরানো যাবে না।' },
  clearProducts: { en: 'All Products', bn: 'সব প্রোডাক্ট' },
  clearCustomers: { en: 'All Customers', bn: 'সব কাস্টমার' },
  allInvoices: { en: 'All Invoices / Sales', bn: 'সব চালান / বিক্রয়' },
  allSettingsData: { en: 'Settings & Preferences', bn: 'সেটিংস ও পছন্দসমূহ' },
  invoiceCounter: { en: 'Invoice Counter (Reset)', bn: 'চালান কাউন্টার (রিসেট)' },
  selectAll: { en: 'Select All', bn: 'সব বাছুন' },
  deleteSelected: { en: 'Delete Selected', bn: 'বাছাইকৃত মুছুন' },
  noItemSelected: { en: 'Select at least one item!', bn: 'অন্তত একটি আইটেম বাছুন!' },
  selectedDataCleared: { en: 'Selected data cleared! Reloading...', bn: 'বাছাইকৃত ডাটা মুছে গেছে! রিলোড হচ্ছে...' },
  googleDriveBackup: { en: 'Google Drive Backup', bn: 'গুগল ড্রাইভ ব্যাকআপ' },

  // Search
  searchPlaceholder: { en: 'Search products, customers, invoices...', bn: 'প্রোডাক্ট, কাস্টমার, চালান খুঁজুন...' },

  // Excel Import
  dataImport: { en: 'Data Management', bn: 'ডাটা ব্যবস্থাপনা' },
  sampleTemplate: { en: 'Sample Template', bn: 'নমুনা টেমপ্লেট' },
  importData: { en: 'Import Data', bn: 'ডাটা আমদানি করুন' },
  columnMapping: { en: 'Column Mapping', bn: 'কলাম ম্যাপিং' },
  uploadFile: { en: 'Click to upload Excel / CSV file', bn: 'এক্সেল / CSV ফাইল আপলোড করতে ক্লিক করুন' },
  supportsFormats: { en: 'Supports .xlsx, .xls, .csv', bn: '.xlsx, .xls, .csv সাপোর্ট করে' },
  previewLabel: { en: 'Preview', bn: 'প্রিভিউ' },
  uploadToPreview: { en: 'Upload a file to see preview', bn: 'প্রিভিউ দেখতে ফাইল আপলোড করুন' },
  tileName: { en: 'Tile Name →', bn: 'টাইলের নাম →' },
  rateArrow: { en: 'Rate →', bn: 'দর →' },
  qtyArrow: { en: 'Qty →', bn: 'পরিমাণ →' },
  sizeArrow: { en: 'Size →', bn: 'সাইজ →' },
  finishArrow: { en: 'Finish →', bn: 'ফিনিশ →' },
  importRules: { en: 'Import Rules', bn: 'আমদানির নিয়ম' },
  importRule1: { en: 'Duplicate products (same name) → Stock will be updated', bn: 'একই নামের প্রোডাক্ট → মজুদ আপডেট হবে' },
  importRule2: { en: 'Invalid / empty rows are automatically skipped', bn: 'ভুল / খালি সারি স্বয়ংক্রিয়ভাবে বাদ যাবে' },
  importRule3: { en: 'All prices must be numeric (no ৳ symbol in file)', bn: 'সব দাম সংখ্যায় হতে হবে (ফাইলে ৳ চিহ্ন দেবেন না)' },
  importingData: { en: 'Importing data...', bn: 'ডাটা আমদানি হচ্ছে...' },
  productsImported: { en: 'products imported!', bn: 'প্রোডাক্ট আমদানি হয়েছে!' },
  rowsFound: { en: 'rows found!', bn: 'সারি পাওয়া গেছে!' },
  uploadFirst: { en: 'Upload a file first!', bn: 'প্রথমে একটি ফাইল আপলোড করুন!' },
  templateDownloaded: { en: 'Template downloaded!', bn: 'টেমপ্লেট ডাউনলোড হয়েছে!' },

  // General
  walkInCustomer: { en: 'Walk-in Customer', bn: 'সরাসরি কাস্টমার' },
  prev: { en: '← Prev', bn: '← আগে' },
  next: { en: 'Next →', bn: 'পরে →' },
  page: { en: 'Page', bn: 'পৃষ্ঠা' },
  of: { en: 'of', bn: 'এর' },
  popupBlocked: { en: 'Pop-up blocked!', bn: 'পপ-আপ ব্লক হয়েছে!' },
  pdfDownloaded: { en: 'PDF downloaded!', bn: 'PDF ডাউনলোড হয়েছে!' },
} as const;

export type TranslationKey = keyof typeof translations;

interface I18nContextType {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: TranslationKey) => string;
}

const I18nContext = createContext<I18nContextType>({
  lang: 'en',
  setLang: () => {},
  t: (key) => translations[key]?.en || key,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(() => {
    try { return (localStorage.getItem('tilepos_lang') as Lang) || 'en'; } catch { return 'en'; }
  });

  useEffect(() => {
    localStorage.setItem('tilepos_lang', lang);
  }, [lang]);

  const t = (key: TranslationKey): string => {
    return translations[key]?.[lang] || translations[key]?.en || key;
  };

  return (
    <I18nContext.Provider value={{ lang, setLang, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
