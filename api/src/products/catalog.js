// Kategori dan 24 produk awal yang dibuat untuk setiap akun (PRD Produk).

const CATEGORIES = [
  { value: 'kopi', label: 'Kopi' },
  { value: 'teh', label: 'Teh' },
  { value: 'makanan-ringan', label: 'Makanan Ringan' },
  { value: 'bumbu-dapur', label: 'Bumbu Dapur' },
  { value: 'minuman-kemasan', label: 'Minuman Kemasan' },
];

const CATEGORY_VALUES = CATEGORIES.map((c) => c.value);

// 5 kopi, 4 teh, 5 makanan ringan, 5 bumbu dapur, 5 minuman kemasan.
// Ada 2 produk nonaktif dan 2 produk dengan stok 0 untuk latihan filter.
const SEED_PRODUCTS = [
  { sku: 'KOP-0001', name: 'Kopi Arabika Gayo 250 g', category: 'kopi', price: 85000, stock: 40, isActive: true, description: 'Biji kopi arabika dari dataran tinggi Gayo, sangrai medium.' },
  { sku: 'KOP-0002', name: 'Kopi Robusta Lampung 250 g', category: 'kopi', price: 45000, stock: 65, isActive: true, description: 'Kopi bubuk robusta, cocok untuk kopi tubruk.' },
  { sku: 'KOP-0003', name: 'Kopi Susu Gula Aren Botol', category: 'kopi', price: 22000, stock: 0, isActive: true, description: 'Kopi susu siap minum 250 ml.' },
  { sku: 'KOP-0004', name: 'Kopi Toraja Kalosi 200 g', category: 'kopi', price: 98000, stock: 12, isActive: true, description: 'Kopi single origin Toraja dengan rasa rempah.' },
  { sku: 'KOP-0005', name: 'Kopi Instan Sachet isi 10', category: 'kopi', price: 15500, stock: 120, isActive: true, description: 'Kopi instan 3 in 1.' },
  { sku: 'TEH-0001', name: 'Teh Melati Celup isi 25', category: 'teh', price: 9500, stock: 200, isActive: true, description: 'Teh hitam beraroma melati.' },
  { sku: 'TEH-0002', name: 'Teh Hijau Daun 100 g', category: 'teh', price: 32000, stock: 25, isActive: true, description: 'Teh hijau daun utuh dari Jawa Barat.' },
  { sku: 'TEH-0003', name: 'Teh Tarik Sachet isi 5', category: 'teh', price: 18000, stock: 48, isActive: false, description: 'Teh tarik instan, sedang tidak dijual.' },
  { sku: 'TEH-0004', name: 'Teh Rosella Kering 50 g', category: 'teh', price: 27500, stock: 15, isActive: true, description: 'Kelopak bunga rosella kering untuk diseduh.' },
  { sku: 'MKR-0001', name: 'Keripik Singkong Balado 200 g', category: 'makanan-ringan', price: 17000, stock: 75, isActive: true, description: 'Keripik singkong pedas manis.' },
  { sku: 'MKR-0002', name: 'Kacang Atom 250 g', category: 'makanan-ringan', price: 14000, stock: 90, isActive: true, description: 'Kacang tanah berbalut tepung renyah.' },
  { sku: 'MKR-0003', name: 'Rengginang Ketan 250 g', category: 'makanan-ringan', price: 21000, stock: 30, isActive: true, description: 'Rengginang mentah, tinggal digoreng.' },
  { sku: 'MKR-0004', name: 'Kerupuk Udang 250 g', category: 'makanan-ringan', price: 26000, stock: 0, isActive: true, description: 'Kerupuk udang mentah.' },
  { sku: 'MKR-0005', name: 'Biskuit Kelapa 300 g', category: 'makanan-ringan', price: 12500, stock: 64, isActive: true, description: 'Biskuit renyah rasa kelapa.' },
  { sku: 'BMB-0001', name: 'Kecap Manis 600 ml', category: 'bumbu-dapur', price: 24000, stock: 52, isActive: true, description: 'Kecap manis kental dari kedelai hitam.' },
  { sku: 'BMB-0002', name: 'Sambal Terasi Botol 200 g', category: 'bumbu-dapur', price: 19500, stock: 37, isActive: true, description: 'Sambal terasi siap saji.' },
  { sku: 'BMB-0003', name: 'Garam Dapur 500 g', category: 'bumbu-dapur', price: 6000, stock: 150, isActive: true, description: 'Garam beryodium.' },
  { sku: 'BMB-0004', name: 'Gula Pasir 1 kg', category: 'bumbu-dapur', price: 17500, stock: 80, isActive: true, description: 'Gula pasir putih.' },
  { sku: 'BMB-0005', name: 'Merica Bubuk 50 g', category: 'bumbu-dapur', price: 11000, stock: 44, isActive: false, description: 'Merica putih bubuk, sedang tidak dijual.' },
  { sku: 'MNM-0001', name: 'Air Mineral 600 ml', category: 'minuman-kemasan', price: 4000, stock: 300, isActive: true, description: 'Air mineral botol.' },
  { sku: 'MNM-0002', name: 'Teh Botol Melati 350 ml', category: 'minuman-kemasan', price: 6500, stock: 140, isActive: true, description: 'Teh melati manis dalam botol.' },
  { sku: 'MNM-0003', name: 'Susu UHT Cokelat 200 ml', category: 'minuman-kemasan', price: 7000, stock: 96, isActive: true, description: 'Susu UHT rasa cokelat.' },
  { sku: 'MNM-0004', name: 'Jus Jeruk 250 ml', category: 'minuman-kemasan', price: 9000, stock: 58, isActive: true, description: 'Sari buah jeruk.' },
  { sku: 'MNM-0005', name: 'Minuman Isotonik 500 ml', category: 'minuman-kemasan', price: 8500, stock: 72, isActive: true, description: 'Minuman pengganti ion tubuh.' },
];

module.exports = { CATEGORIES, CATEGORY_VALUES, SEED_PRODUCTS };
