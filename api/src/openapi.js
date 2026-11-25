// Dokumentasi OpenAPI 3 untuk Warung QA API. Tampil di /api-docs,
// dan file JSON-nya (/api-docs/openapi.json) bisa di-import ke Postman.

const errorResponse = (description, code, message, fields) => ({
  description,
  content: {
    'application/json': {
      schema: { $ref: '#/components/schemas/Error' },
      example: { error: fields ? { code, message, fields } : { code, message } },
    },
  },
});

const unauthorized = errorResponse('Token tidak ada, salah, atau kedaluwarsa', 'UNAUTHORIZED', 'Sesi tidak valid. Silakan login kembali.');
const forbidden = errorResponse('Role user tidak bisa mengelola produk', 'FORBIDDEN', 'Hanya akun admin yang bisa mengelola produk.');
const notFound = errorResponse('Produk tidak ada di katalog akun ini', 'NOT_FOUND', 'Produk tidak ditemukan');
const productInvalid = errorResponse('Data produk tidak valid', 'VALIDATION_ERROR', 'Data produk belum valid. Periksa kembali isian Anda.', {
  price: 'Harga harus 1.000–10.000.000',
});
const skuConflict = errorResponse('SKU sudah dipakai di katalog akun ini', 'ALREADY_EXISTS', 'SKU sudah dipakai', { sku: 'SKU sudah dipakai' });

const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer', minimum: 1 }, example: 1 };

const productResponse = (description) => ({
  description,
  content: {
    'application/json': {
      schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Product' } } },
    },
  },
});

const dataResponse = (ref) => (description) => ({
  description,
  content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: `#/components/schemas/${ref}` } } } } },
});
const cartResponse = dataResponse('Cart');
const orderResponse = dataResponse('Order');

const userForbidden = errorResponse('Bukan admin', 'FORBIDDEN', 'Hanya akun admin yang bisa mengelola user.');
const userNotFound = errorResponse('User tidak ada / sudah kedaluwarsa', 'NOT_FOUND', 'User tidak ditemukan');
const demoProtected = errorResponse('Akun demo dilindungi', 'DEMO_PROTECTED', 'Akun demo tidak bisa diubah atau dihapus');
const userIdParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, example: 10 };
const userResponse = dataResponse('AdminUser');

const orderNoParam = { name: 'orderNumber', in: 'path', required: true, schema: { type: 'string' }, example: 'WQA-20261124-K7Q2ZP' };
const orderNotFound = errorResponse('Tidak ada atau bukan milik akun ini', 'NOT_FOUND', 'Pesanan tidak ditemukan');
const imageOk = { description: 'File gambar', content: { 'image/png': { schema: { type: 'string', format: 'binary' } } } };

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Warung QA API',
    version: '1.0.0',
    description:
      'API playground untuk latihan API testing. Login dulu lewat `POST /api/v1/auth/login` (contoh: standard_user / Warung123!), ' +
      'salin `token`, lalu klik **Authorize** dan tempel token-nya.\n\n' +
      'Akun demo: `standard_user` (pembeli di toko admin_user), `admin_user` (kelola produk + belanja di tokonya), `locked_user` (423), `slow_user` (5 detik), `error_user` (500). ' +
      'Akun hasil registrasi selalu ber-role user (pembeli di toko admin_user) dan aktif 24 jam. Admin hanya admin_user.\n\n' +
      'Voucher latihan: `HEMAT10`, `WARUNG25K`, `ONGKIRGRATIS`, `FLASH15`, `KADALUARSA`. Gift card: `GIFT-7788-WQA`, `GIFT-5000-WQA`. PIN WarungPay: `123456`.',
  },
  servers: [{ url: '/', description: 'Server ini' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth', description: 'Login, registrasi, profil, reset data' },
    { name: 'Products', description: 'Kelola produk (khusus admin) + gambar produk' },
    { name: 'Store', description: 'Katalog toko untuk pembeli (hanya produk aktif)' },
    { name: 'Cart', description: 'Keranjang belanja' },
    { name: 'Orders', description: 'Checkout dan riwayat pesanan' },
    { name: 'Admin Orders', description: 'Pesanan toko & ubah status (khusus admin)' },
    { name: 'Payments', description: 'WarungPay: pembayaran e-wallet latihan' },
    { name: 'Users', description: 'Kelola User (khusus admin). Akun demo hanya bisa dilihat.' },
  ],
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: {
            type: 'object',
            required: ['code', 'message'],
            properties: {
              code: { type: 'string', example: 'VALIDATION_ERROR' },
              message: { type: 'string' },
              fields: { type: 'object', additionalProperties: { type: 'string' } },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          username: { type: 'string', example: 'standard_user' },
          name: { type: 'string', example: 'Standard User' },
          role: { type: 'string', enum: ['user', 'admin'] },
        },
      },
      Product: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          sku: { type: 'string', example: 'KOP-0001' },
          name: { type: 'string', example: 'Kopi Arabika Gayo 250 g' },
          category: { type: 'string', enum: ['kopi', 'teh', 'makanan-ringan', 'bumbu-dapur', 'minuman-kemasan'] },
          price: { type: 'integer', example: 85000 },
          stock: { type: 'integer', example: 40 },
          isActive: { type: 'boolean', example: true },
          description: { type: 'string' },
          imageUrl: { type: 'string', nullable: true, example: '/api/v1/products/1/image?v=1764000000000' },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      },
      CartItem: {
        type: 'object',
        properties: {
          product: { $ref: '#/components/schemas/Product' },
          quantity: { type: 'integer', example: 2 },
          subtotal: { type: 'integer', example: 170000 },
          problem: { type: 'string', nullable: true, example: null, description: 'Terisi kalau stok kurang atau produk tidak dijual lagi' },
        },
      },
      Cart: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/CartItem' } },
          itemCount: { type: 'integer', example: 2 },
          subtotal: { type: 'integer', example: 170000 },
          hasProblem: { type: 'boolean', example: false },
        },
      },
      Summary: {
        type: 'object',
        properties: {
          itemCount: { type: 'integer', example: 2 },
          subtotal: { type: 'integer', example: 170000 },
          shippingCost: { type: 'integer', example: 10000 },
          discount: { type: 'integer', example: 17000 },
          total: { type: 'integer', example: 163000 },
          voucherCode: { type: 'string', nullable: true, example: 'HEMAT10' },
        },
      },
      CheckoutInput: {
        type: 'object',
        required: ['recipientName', 'phone', 'address', 'city', 'postalCode', 'shippingMethod', 'paymentMethod', 'shipDate'],
        properties: {
          recipientName: { type: 'string', minLength: 3, maxLength: 50, example: 'Budi Santoso' },
          phone: { type: 'string', example: '081234567890' },
          address: { type: 'string', minLength: 10, maxLength: 200, example: 'Jl. Kenanga No. 5, RT 01/RW 02' },
          city: { type: 'string', minLength: 3, maxLength: 40, example: 'Bekasi' },
          postalCode: { type: 'string', pattern: '^\\d{5}$', example: '17111' },
          notes: { type: 'string', maxLength: 200, example: 'Titip ke satpam' },
          shippingMethod: { type: 'string', enum: ['reguler', 'express', 'sameday'], example: 'reguler' },
          paymentMethod: { type: 'string', enum: ['transfer', 'ewallet', 'cod'], example: 'transfer' },
          voucherCode: { type: 'string', example: 'HEMAT10' },
          giftCardCode: { type: 'string', example: 'GIFT-7788-WQA', description: 'Gift card latihan: GIFT-7788-WQA (Rp 20.000), GIFT-5000-WQA (Rp 50.000)' },
          shipDate: { type: 'string', format: 'date', example: '2026-11-26', description: 'Hari kerja, H+1 sampai H+14 (WIB)' },
          paymentRef: { type: 'string', example: 'WPY-7K2XQ9PM', description: 'Wajib untuk ewallet: dari POST /api/v1/payments/warungpay, nominal harus sama dengan total' },
        },
      },
      OrderHistory: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['diproses', 'dikirim', 'selesai', 'dibatalkan'] },
          actor: { type: 'string', example: 'admin_user' },
          note: { type: 'string', example: 'Kurir Express (1–2 hari), resi WQA1234567890' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      StockMovement: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 512 },
          productId: { type: 'integer' },
          productName: { type: 'string' },
          change: { type: 'integer', example: -3 },
          reason: { type: 'string', enum: ['order', 'cancel', 'admin', 'restock', 'offline'] },
          ref: { type: 'string', example: 'WQA-20261124-K7Q2ZP' },
          stockAfter: { type: 'integer', example: 37 },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      Order: {
        type: 'object',
        properties: {
          orderNumber: { type: 'string', example: 'WQA-20261124-K7Q2ZP' },
          status: { type: 'string', example: 'diproses' },
          recipientName: { type: 'string' },
          phone: { type: 'string' },
          address: { type: 'string' },
          city: { type: 'string' },
          postalCode: { type: 'string' },
          notes: { type: 'string' },
          shippingMethod: { type: 'string' },
          shippingCost: { type: 'integer' },
          paymentMethod: { type: 'string' },
          voucherCode: { type: 'string' },
          giftCardCode: { type: 'string', nullable: true },
          giftCardDiscount: { type: 'integer' },
          shipDate: { type: 'string', format: 'date' },
          courier: { type: 'string', nullable: true },
          trackingNumber: { type: 'string', nullable: true },
          paymentRef: { type: 'string', nullable: true },
          cancelReason: { type: 'string', nullable: true },
          cancelNote: { type: 'string', nullable: true },
          buyer: { type: 'string', description: 'Username pembeli' },
          paymentProof: { type: 'object', nullable: true, properties: { name: { type: 'string' }, type: { type: 'string' }, size: { type: 'integer' }, uploadedAt: { type: 'string', format: 'date-time' } } },
          history: { type: 'array', items: { $ref: '#/components/schemas/OrderHistory' } },
          subtotal: { type: 'integer' },
          discount: { type: 'integer' },
          total: { type: 'integer' },
          createdAt: { type: 'string', format: 'date-time' },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                productId: { type: 'integer', nullable: true },
                sku: { type: 'string' },
                name: { type: 'string' },
                price: { type: 'integer' },
                quantity: { type: 'integer' },
                subtotal: { type: 'integer' },
              },
            },
          },
        },
      },
      AdminUser: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 10 },
          username: { type: 'string', example: 'rina_qa' },
          fullName: { type: 'string', example: 'Rina Anggraini' },
          email: { type: 'string', example: 'rina@contoh.com' },
          phone: { type: 'string', nullable: true, example: '081234567890' },
          birthDate: { type: 'string', format: 'date', nullable: true, example: '1995-08-17' },
          gender: { type: 'string', enum: ['female', 'male', 'unspecified'], nullable: true },
          role: { type: 'string', enum: ['user', 'admin'] },
          isDemo: { type: 'boolean', example: false },
          createdAt: { type: 'string', format: 'date-time' },
          expiresAt: { type: 'string', format: 'date-time', nullable: true, description: 'Akun registrasi terhapus otomatis 24 jam setelah dibuat. null untuk akun demo.' },
        },
      },
      ProductInput: {
        type: 'object',
        required: ['sku', 'name', 'category', 'price', 'stock'],
        properties: {
          sku: { type: 'string', pattern: '^[A-Za-z]{3}-\\d{4}$', example: 'KOP-0099' },
          name: { type: 'string', minLength: 3, maxLength: 80, example: 'Kopi Mandailing 250 g' },
          category: { type: 'string', enum: ['kopi', 'teh', 'makanan-ringan', 'bumbu-dapur', 'minuman-kemasan'], example: 'kopi' },
          price: { type: 'integer', minimum: 1000, maximum: 10000000, example: 75000 },
          stock: { type: 'integer', minimum: 0, maximum: 9999, example: 20 },
          isActive: { type: 'boolean', default: true },
          description: { type: 'string', maxLength: 500, example: 'Kopi arabika dari Sumatera Utara.' },
        },
      },
    },
  },
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Cek server hidup',
        responses: {
          200: {
            description: 'Server berjalan',
            content: { 'application/json': { example: { status: 'ok', app: 'Warung QA API' } } },
          },
        },
      },
    },
    '/api/v1/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Login dan dapatkan token',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'password'],
                properties: {
                  username: { type: 'string', example: 'standard_user' },
                  password: { type: 'string', example: 'Warung123!' },
                  remember: { type: 'boolean', example: false, description: 'true = token 7 hari, false = 1 jam' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login berhasil',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'object',
                      properties: {
                        token: { type: 'string' },
                        expiresIn: { type: 'integer', example: 3600 },
                        user: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
          400: errorResponse('Field kosong atau username di luar 3–30 karakter', 'VALIDATION_ERROR', 'Username dan password wajib diisi'),
          401: errorResponse('Username atau password salah', 'INVALID_CREDENTIALS', 'Username atau password salah'),
          423: errorResponse('locked_user', 'ACCOUNT_LOCKED', 'Akun ini dikunci. Hubungi admin.'),
          429: errorResponse('5 kali gagal dalam 15 menit', 'TOO_MANY_ATTEMPTS', 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.'),
          500: errorResponse('error_user', 'INTERNAL_ERROR', 'Terjadi kesalahan pada server. Coba lagi nanti.'),
        },
      },
    },
    '/api/v1/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Buat akun baru (aktif 24 jam)',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['fullName', 'username', 'email', 'phone', 'birthDate', 'gender', 'password', 'confirmPassword'],
                properties: {
                  fullName: { type: 'string', example: 'Rina Anggraini' },
                  username: { type: 'string', example: 'rina_qa' },
                  email: { type: 'string', example: 'rina@contoh.com' },
                  phone: { type: 'string', example: '081234567890' },
                  birthDate: { type: 'string', format: 'date', example: '1995-08-17' },
                  gender: { type: 'string', enum: ['female', 'male', 'unspecified'] },
                  password: { type: 'string', example: 'Rahasia1!' },
                  confirmPassword: { type: 'string', example: 'Rahasia1!' },
                },
              },
            },
          },
        },
        responses: {
          201: {
            description: 'Akun dibuat',
            content: {
              'application/json': {
                schema: { type: 'object', properties: { data: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } },
              },
            },
          },
          400: errorResponse('Data tidak valid', 'VALIDATION_ERROR', 'Data belum valid. Periksa kembali isian Anda.', {
            email: 'Format email tidak valid',
          }),
          409: errorResponse('Username atau email sudah dipakai', 'ALREADY_EXISTS', 'Username atau email sudah terdaftar', {
            username: 'Username sudah dipakai',
          }),
        },
      },
    },
    '/api/v1/me': {
      get: {
        tags: ['Auth'],
        summary: 'Profil akun yang sedang login',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Profil',
            content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/User' } } } } },
          },
          401: unauthorized,
        },
      },
    },
    '/api/v1/reset': {
      post: {
        tags: ['Auth'],
        summary: 'Reset Data: hapus keranjang & pesanan, hapus hitungan gagal login; akun admin: katalog kembali ke 24 produk awal',
        security: [{ bearerAuth: [] }],
        responses: { 204: { description: 'Data direset' }, 401: unauthorized },
      },
    },
    '/api/v1/categories': {
      get: {
        tags: ['Products'],
        summary: 'Daftar kategori produk',
        security: [{ bearerAuth: [] }],
        responses: {
          200: {
            description: 'Kategori',
            content: { 'application/json': { example: { data: [{ value: 'kopi', label: 'Kopi' }] } } },
          },
          401: unauthorized,
        },
      },
    },
    '/api/v1/products': {
      get: {
        tags: ['Products'],
        summary: 'Daftar produk dengan pencarian, filter, sort, dan pagination (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 }, description: 'Cari di nama atau SKU' },
          { name: 'category', in: 'query', schema: { type: 'string', enum: ['kopi', 'teh', 'makanan-ringan', 'bumbu-dapur', 'minuman-kemasan'] } },
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['active', 'inactive'] } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['name', 'price', 'stock', 'createdAt'], default: 'name' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', enum: [5, 10, 20, 50], default: 10 } },
        ],
        responses: {
          200: {
            description: 'Daftar produk',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    meta: {
                      type: 'object',
                      properties: {
                        page: { type: 'integer', example: 1 },
                        limit: { type: 'integer', example: 10 },
                        total: { type: 'integer', example: 24 },
                        totalPages: { type: 'integer', example: 3 },
                      },
                    },
                  },
                },
              },
            },
          },
          400: errorResponse('Parameter tidak valid', 'VALIDATION_ERROR', 'Parameter tidak valid', { limit: 'Limit harus 5, 10, 20, atau 50' }),
          401: unauthorized,
          403: forbidden,
        },
      },
      post: {
        tags: ['Products'],
        summary: 'Tambah produk (admin)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } } },
        responses: {
          201: productResponse('Produk dibuat'),
          400: productInvalid,
          401: unauthorized,
          403: forbidden,
          409: skuConflict,
        },
      },
    },
    '/api/v1/products/{id}': {
      parameters: [idParam],
      get: {
        tags: ['Products'],
        summary: 'Detail produk (admin)',
        security: [{ bearerAuth: [] }],
        responses: { 200: productResponse('Produk'), 401: unauthorized, 403: forbidden, 404: notFound },
      },
      put: {
        tags: ['Products'],
        summary: 'Ubah semua field produk (admin)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/ProductInput' } } } },
        responses: {
          200: productResponse('Produk diubah'),
          400: productInvalid,
          401: unauthorized,
          403: forbidden,
          404: notFound,
          409: skuConflict,
        },
      },
      patch: {
        tags: ['Products'],
        summary: 'Ubah sebagian field produk (admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', properties: { price: { type: 'integer' }, stock: { type: 'integer' } } }, example: { stock: 0 } } },
        },
        responses: {
          200: productResponse('Produk diubah'),
          400: productInvalid,
          401: unauthorized,
          403: forbidden,
          404: notFound,
          409: skuConflict,
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Hapus produk (admin)',
        security: [{ bearerAuth: [] }],
        responses: { 204: { description: 'Produk dihapus' }, 401: unauthorized, 403: forbidden, 404: notFound },
      },
    },
    '/api/v1/products/bulk-delete': {
      post: {
        tags: ['Products'],
        summary: 'Hapus banyak produk sekaligus (admin)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 50 } } },
              example: { ids: [1, 2, 3] },
            },
          },
        },
        responses: {
          200: { description: 'Jumlah produk yang terhapus', content: { 'application/json': { example: { data: { deleted: 3 } } } } },
          400: errorResponse('ids tidak valid', 'VALIDATION_ERROR', 'ids harus berisi 1–50 id produk', { ids: 'ids harus berisi 1–50 id produk' }),
          401: unauthorized,
          403: forbidden,
        },
      },
    },
    '/api/v1/products/{id}/image': {
      put: {
        tags: ['Products'],
        summary: 'Upload/ganti gambar produk (admin, maks 2 MB)',
        description: 'Kirim file gambar mentah sebagai body (bukan form-data). Content-Type harus image/jpeg, image/png, atau image/webp. Di Postman: Body → binary.',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        requestBody: {
          required: true,
          content: {
            'image/jpeg': { schema: { type: 'string', format: 'binary' } },
            'image/png': { schema: { type: 'string', format: 'binary' } },
            'image/webp': { schema: { type: 'string', format: 'binary' } },
          },
        },
        responses: {
          200: productResponse('Gambar tersimpan; imageUrl berubah'),
          400: errorResponse('File kosong atau isinya bukan gambar', 'VALIDATION_ERROR', 'Isi file tidak cocok dengan format gambar'),
          401: unauthorized,
          403: forbidden,
          404: notFound,
          413: errorResponse('File lebih dari 2 MB', 'PAYLOAD_TOO_LARGE', 'Ukuran gambar maksimal 2 MB'),
          415: errorResponse('Format bukan JPG/PNG/WEBP', 'UNSUPPORTED_MEDIA_TYPE', 'Format gambar harus JPG, PNG, atau WEBP'),
        },
      },
      get: {
        tags: ['Products'],
        summary: 'Ambil gambar produk (publik, tanpa token)',
        parameters: [idParam],
        responses: {
          200: { description: 'File gambar', content: { 'image/png': { schema: { type: 'string', format: 'binary' } } } },
          404: errorResponse('Produk tidak punya gambar', 'NOT_FOUND', 'Gambar tidak ditemukan'),
        },
      },
      delete: {
        tags: ['Products'],
        summary: 'Hapus gambar produk (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: {
          204: { description: 'Gambar dihapus' },
          401: unauthorized,
          403: forbidden,
          404: errorResponse('Produk atau gambarnya tidak ada', 'NOT_FOUND', 'Gambar tidak ditemukan'),
        },
      },
    },
    '/api/v1/store/products': {
      get: {
        tags: ['Store'],
        summary: 'Katalog toko (produk aktif saja)',
        description: 'Semua akun belanja di toko admin_user (admin_user sendiri juga).',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'category', in: 'query', description: 'Satu atau lebih, dipisah koma: kopi,teh', schema: { type: 'string', example: 'kopi,teh' } },
          { name: 'minPrice', in: 'query', schema: { type: 'integer', minimum: 0, maximum: 10000000 } },
          { name: 'maxPrice', in: 'query', schema: { type: 'integer', minimum: 0, maximum: 10000000 } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['name', 'price', 'stock', 'createdAt', 'featured'], default: 'name' }, description: 'featured = Pilihan admin (produk unggulan dulu)' },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'asc' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', enum: [12, 24, 48], default: 12 } },
        ],
        responses: {
          200: {
            description: 'Daftar produk + meta pagination',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/Product' } },
                    meta: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } } },
                  },
                },
              },
            },
          },
          400: errorResponse('Parameter tidak valid', 'VALIDATION_ERROR', 'Parameter tidak valid', { limit: 'Limit harus 12, 24, atau 48' }),
          401: unauthorized,
        },
      },
    },
    '/api/v1/store/products/{id}': {
      get: {
        tags: ['Store'],
        summary: 'Detail produk di toko',
        security: [{ bearerAuth: [] }],
        parameters: [idParam],
        responses: { 200: productResponse('Produk'), 401: unauthorized, 404: errorResponse('Tidak ada, nonaktif, atau toko lain', 'NOT_FOUND', 'Produk tidak ditemukan') },
      },
    },
    '/api/v1/cart': {
      get: {
        tags: ['Cart'],
        summary: 'Isi keranjang',
        security: [{ bearerAuth: [] }],
        responses: { 200: cartResponse('Keranjang'), 401: unauthorized },
      },
      delete: {
        tags: ['Cart'],
        summary: 'Kosongkan keranjang',
        security: [{ bearerAuth: [] }],
        responses: { 204: { description: 'Keranjang kosong' }, 401: unauthorized },
      },
    },
    '/api/v1/cart/items': {
      post: {
        tags: ['Cart'],
        summary: 'Tambah produk ke keranjang (jumlah digabung kalau sudah ada)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['productId'],
                properties: { productId: { type: 'integer', example: 1 }, quantity: { type: 'integer', minimum: 1, maximum: 99, default: 1 } },
              },
            },
          },
        },
        responses: {
          201: cartResponse('Keranjang terbaru'),
          400: errorResponse('Body tidak valid', 'VALIDATION_ERROR', 'Jumlah harus angka bulat 1–99', { quantity: 'Jumlah harus angka bulat 1–99' }),
          401: unauthorized,
          404: errorResponse('Produk tidak ada / nonaktif', 'NOT_FOUND', 'Produk tidak ditemukan'),
          422: errorResponse('Melebihi stok', 'INSUFFICIENT_STOCK', 'Stok tidak cukup. Sisa stok: 3', { quantity: 'Stok tidak cukup. Sisa stok: 3' }),
        },
      },
    },
    '/api/v1/cart/items/{productId}': {
      patch: {
        tags: ['Cart'],
        summary: 'Ubah jumlah',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'integer' }, example: 1 }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['quantity'], properties: { quantity: { type: 'integer', minimum: 1, maximum: 99, example: 3 } } } } },
        },
        responses: {
          200: cartResponse('Keranjang terbaru'),
          400: errorResponse('Jumlah tidak valid', 'VALIDATION_ERROR', 'Jumlah harus angka bulat 1–99'),
          401: unauthorized,
          404: errorResponse('Produk tidak ada di keranjang', 'NOT_FOUND', 'Produk tidak ada di keranjang'),
          422: errorResponse('Melebihi stok', 'INSUFFICIENT_STOCK', 'Stok tidak cukup. Sisa stok: 3'),
        },
      },
      delete: {
        tags: ['Cart'],
        summary: 'Hapus satu produk dari keranjang',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'productId', in: 'path', required: true, schema: { type: 'integer' }, example: 1 }],
        responses: { 200: cartResponse('Keranjang terbaru'), 401: unauthorized, 404: errorResponse('Produk tidak ada di keranjang', 'NOT_FOUND', 'Produk tidak ada di keranjang') },
      },
    },
    '/api/v1/checkout/preview': {
      post: {
        tags: ['Orders'],
        summary: 'Hitung ongkir, diskon voucher, dan total',
        security: [{ bearerAuth: [] }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  shippingMethod: { type: 'string', enum: ['reguler', 'express', 'sameday'], default: 'reguler' },
                  voucherCode: { type: 'string', example: 'HEMAT10' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Ringkasan', content: { 'application/json': { schema: { type: 'object', properties: { data: { $ref: '#/components/schemas/Summary' } } } } } },
          400: errorResponse('Keranjang kosong / voucher tidak bisa dipakai', 'VALIDATION_ERROR', 'Voucher sudah kedaluwarsa', { voucherCode: 'Voucher sudah kedaluwarsa' }),
          401: unauthorized,
        },
      },
    },
    '/api/v1/orders': {
      post: {
        tags: ['Orders'],
        summary: 'Checkout: buat pesanan dari isi keranjang',
        description: 'Stok berkurang dan keranjang dikosongkan dalam satu transaksi. COD hanya untuk total maksimal Rp 1.000.000.',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { $ref: '#/components/schemas/CheckoutInput' } } } },
        responses: {
          201: orderResponse('Pesanan dibuat'),
          400: errorResponse('Data tidak valid, keranjang kosong, voucher salah, atau COD di atas batas', 'VALIDATION_ERROR', 'Data checkout belum valid. Periksa kembali isian Anda.', { postalCode: 'Kode pos harus 5 angka' }),
          401: unauthorized,
          409: errorResponse('Stok dibeli orang lain saat checkout', 'STOCK_CHANGED', 'Stok berubah saat checkout. Periksa keranjang Anda lalu coba lagi.'),
          422: errorResponse('Ada produk yang stoknya kurang / tidak dijual', 'CART_PROBLEM', 'Ada produk di keranjang yang stoknya tidak cukup atau sudah tidak dijual. Periksa keranjang Anda.'),
        },
      },
      get: {
        tags: ['Orders'],
        summary: 'Riwayat pesanan akun ini (terbaru dulu)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-11-18' },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date' }, example: '2026-11-24' },
        ],
        responses: { 200: { description: 'Daftar pesanan (tanpa items, dengan itemCount)' }, 401: unauthorized },
      },
    },
    '/api/v1/orders/{orderNumber}': {
      get: {
        tags: ['Orders'],
        summary: 'Detail pesanan',
        security: [{ bearerAuth: [] }],
        parameters: [{ name: 'orderNumber', in: 'path', required: true, schema: { type: 'string' }, example: 'WQA-20261124-K7Q2ZP' }],
        responses: { 200: orderResponse('Pesanan'), 401: unauthorized, 404: errorResponse('Tidak ada atau milik akun lain', 'NOT_FOUND', 'Pesanan tidak ditemukan') },
      },
    },
    '/api/v1/users': {
      get: {
        tags: ['Users'],
        summary: 'Daftar user aktif (admin)',
        description: 'Akun demo + akun registrasi yang belum lewat 24 jam.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', description: 'Cari di username, nama, email', schema: { type: 'string', maxLength: 100 } },
          { name: 'role', in: 'query', schema: { type: 'string', enum: ['user', 'admin'] } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['demo', 'registered'] } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['username', 'fullName', 'createdAt'], default: 'createdAt' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'] }, description: 'Default desc untuk createdAt, asc untuk lainnya' },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', enum: [5, 10, 20, 50], default: 10 } },
        ],
        responses: {
          200: {
            description: 'Daftar user + meta pagination',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: { type: 'array', items: { $ref: '#/components/schemas/AdminUser' } },
                    meta: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer' }, total: { type: 'integer' }, totalPages: { type: 'integer' } } },
                  },
                },
              },
            },
          },
          400: errorResponse('Query tidak valid', 'VALIDATION_ERROR', 'Parameter tidak valid', { limit: 'Limit harus 5, 10, 20, atau 50' }),
          401: unauthorized,
          403: userForbidden,
        },
      },
    },
    '/api/v1/users/bulk-delete': {
      post: {
        tags: ['Users'],
        summary: 'Hapus banyak user (admin)',
        description: 'Ditolak semua (403) kalau ada akun demo di daftar. Id yang tidak ada diabaikan.',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: { 'application/json': { schema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'integer' }, minItems: 1, maxItems: 50, example: [10, 11] } } } } },
        },
        responses: {
          200: { description: 'Jumlah yang terhapus', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object', properties: { deleted: { type: 'integer', example: 2 } } } } } } } },
          400: errorResponse('ids tidak valid', 'VALIDATION_ERROR', 'ids harus berisi 1–50 id user'),
          401: unauthorized,
          403: errorResponse('Bukan admin / ada akun demo', 'DEMO_PROTECTED', 'Daftar berisi akun demo. Akun demo tidak bisa dihapus.'),
        },
      },
    },
    '/api/v1/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Detail user (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [userIdParam],
        responses: { 200: userResponse('User'), 401: unauthorized, 403: userForbidden, 404: userNotFound },
      },
      patch: {
        tags: ['Users'],
        summary: 'Ubah data user (admin)',
        description: 'Kirim hanya field yang mau diubah. Aturan validasi sama dengan registrasi. Field lain (role, password, dll.) ditolak 400.',
        security: [{ bearerAuth: [] }],
        parameters: [userIdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  fullName: { type: 'string', example: 'Rina Wijaya' },
                  username: { type: 'string', example: 'rina_w' },
                  email: { type: 'string', example: 'rina.w@contoh.com' },
                  phone: { type: 'string', example: '081234567890' },
                  birthDate: { type: 'string', format: 'date', example: '1995-08-17' },
                  gender: { type: 'string', enum: ['female', 'male', 'unspecified'] },
                },
              },
            },
          },
        },
        responses: {
          200: userResponse('Data terbaru'),
          400: errorResponse('Data tidak valid / field terlarang / kosong', 'VALIDATION_ERROR', 'Field tidak bisa diubah: role', { role: 'Field tidak bisa diubah: role' }),
          401: unauthorized,
          403: demoProtected,
          404: userNotFound,
          409: errorResponse('Username/email dipakai akun lain', 'ALREADY_EXISTS', 'Username atau email sudah terdaftar', { email: 'Email sudah terdaftar' }),
        },
      },
      delete: {
        tags: ['Users'],
        summary: 'Hapus user (admin)',
        description: 'Keranjang & pesanan user ikut terhapus. Token user itu langsung tidak berlaku (401).',
        security: [{ bearerAuth: [] }],
        parameters: [userIdParam],
        responses: { 204: { description: 'Terhapus' }, 401: unauthorized, 403: demoProtected, 404: userNotFound },
      },
    },
    '/api/v1/users/{id}/password': {
      put: {
        tags: ['Users'],
        summary: 'Ganti password user (admin)',
        description: 'Aturan password sama dengan registrasi. Hitungan gagal login user itu ikut dihapus.',
        security: [{ bearerAuth: [] }],
        parameters: [userIdParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['newPassword', 'confirmPassword'],
                properties: { newPassword: { type: 'string', example: 'Baru123!' }, confirmPassword: { type: 'string', example: 'Baru123!' } },
              },
            },
          },
        },
        responses: {
          200: { description: 'Berhasil', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object', properties: { message: { type: 'string', example: 'Password berhasil diubah' } } } } } } } },
          400: errorResponse('Password tidak valid', 'VALIDATION_ERROR', 'Data belum valid. Periksa kembali isian Anda.', { newPassword: 'Password minimal 8 karakter' }),
          401: unauthorized,
          403: demoProtected,
          404: userNotFound,
        },
      },
    },
    '/api/v1/orders/{orderNumber}/cancel': {
      post: {
        tags: ['Orders'],
        summary: 'Pembeli membatalkan pesanannya (hanya saat Diproses)',
        description: 'Stok dikembalikan. Alasan: stok-habis, permintaan-pembeli, alamat-tidak-valid, lainnya (note wajib).',
        security: [{ bearerAuth: [] }],
        parameters: [orderNoParam],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['reason'], properties: { reason: { type: 'string', enum: ['stok-habis', 'permintaan-pembeli', 'alamat-tidak-valid', 'lainnya'] }, note: { type: 'string', maxLength: 200 } } } } } },
        responses: {
          200: orderResponse('Pesanan dibatalkan'),
          400: errorResponse('Alasan tidak valid', 'VALIDATION_ERROR', 'Pilih alasan pembatalan', { reason: 'Pilih alasan pembatalan' }),
          401: unauthorized,
          404: orderNotFound,
          409: errorResponse('Bukan Diproses lagi', 'INVALID_TRANSITION', 'Pesanan hanya bisa dibatalkan selama statusnya Diproses'),
        },
      },
    },
    '/api/v1/orders/{orderNumber}/payment-proof': {
      put: {
        tags: ['Orders'],
        summary: 'Unggah bukti transfer (PNG/JPG maks 1 MB, pesanan transfer & Diproses)',
        description: 'Body = file mentah. Nama file opsional di header X-File-Name (URL-encoded).',
        security: [{ bearerAuth: [] }],
        parameters: [orderNoParam, { name: 'X-File-Name', in: 'header', schema: { type: 'string' }, example: 'bukti-transfer.png' }],
        requestBody: { required: true, content: { 'image/png': { schema: { type: 'string', format: 'binary' } }, 'image/jpeg': { schema: { type: 'string', format: 'binary' } } } },
        responses: {
          200: orderResponse('Pesanan dengan paymentProof'),
          400: errorResponse('File kosong / bukan gambar', 'VALIDATION_ERROR', 'Isi file tidak cocok dengan format gambar'),
          401: unauthorized,
          404: orderNotFound,
          409: errorResponse('Bukan transfer / bukan Diproses', 'NOT_ALLOWED', 'Bukti transfer hanya bisa diubah selama pesanan Diproses'),
          413: errorResponse('Lebih dari 1 MB', 'PAYLOAD_TOO_LARGE', 'File harus PNG atau JPG, maksimal 1 MB'),
          415: errorResponse('Bukan PNG/JPG', 'UNSUPPORTED_MEDIA_TYPE', 'File harus PNG atau JPG, maksimal 1 MB'),
        },
      },
      get: { tags: ['Orders'], summary: 'Lihat bukti transfer sendiri', security: [{ bearerAuth: [] }], parameters: [orderNoParam], responses: { 200: imageOk, 401: unauthorized, 404: orderNotFound } },
      delete: { tags: ['Orders'], summary: 'Hapus bukti transfer (saat Diproses)', security: [{ bearerAuth: [] }], parameters: [orderNoParam], responses: { 204: { description: 'Terhapus' }, 401: unauthorized, 404: orderNotFound, 409: errorResponse('Bukan Diproses', 'NOT_ALLOWED', 'Bukti transfer hanya bisa diubah selama pesanan Diproses') } },
    },
    '/api/v1/orders/{orderNumber}/tracking': {
      get: {
        tags: ['Orders'],
        summary: 'Lacak paket (data latihan, setelah Dikirim)',
        security: [{ bearerAuth: [] }],
        parameters: [orderNoParam],
        responses: { 200: { description: 'Kurir, resi, dan riwayat perjalanan (terbaru dulu)' }, 401: unauthorized, 404: orderNotFound, 409: errorResponse('Belum dikirim', 'NOT_SHIPPED', 'Paket belum dikirim') },
      },
    },
    '/api/v1/payments/warungpay': {
      post: {
        tags: ['Payments'],
        summary: 'Bayar dengan WarungPay (e-wallet latihan)',
        description: 'PIN latihan 123456, saldo Rp 2.000.000. Pakai paymentRef dari respons saat POST /api/v1/orders dengan paymentMethod ewallet.',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['phone', 'pin', 'amount'], properties: { phone: { type: 'string', example: '081234567890' }, pin: { type: 'string', example: '123456' }, amount: { type: 'integer', example: 229500 } } } } } },
        responses: {
          201: { description: 'Lunas', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'object', properties: { paymentRef: { type: 'string', example: 'WPY-7K2XQ9PM' }, amount: { type: 'integer' }, paidAt: { type: 'string', format: 'date-time' } } } } } } } },
          400: errorResponse('Data tidak valid', 'VALIDATION_ERROR', 'PIN harus 6 angka', { pin: 'PIN harus 6 angka' }),
          401: errorResponse('Belum login / PIN salah', 'PAYMENT_DECLINED', 'PIN salah'),
          402: errorResponse('Saldo kurang', 'INSUFFICIENT_BALANCE', 'Saldo WarungPay tidak cukup'),
        },
      },
    },
    '/api/v1/admin/orders': {
      get: {
        tags: ['Admin Orders'],
        summary: 'Pesanan toko + jumlah per status (admin)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'status', in: 'query', schema: { type: 'string', enum: ['diproses', 'dikirim', 'selesai', 'dibatalkan'] } },
          { name: 'search', in: 'query', description: 'No. pesanan atau username pembeli', schema: { type: 'string' } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['createdAt', 'total'], default: 'createdAt' } },
          { name: 'order', in: 'query', schema: { type: 'string', enum: ['asc', 'desc'], default: 'desc' } },
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', enum: [5, 10, 20, 50], default: 10 } },
        ],
        responses: { 200: { description: 'data + meta (page, limit, total, totalPages, counts per status)' }, 400: errorResponse('Query tidak valid', 'VALIDATION_ERROR', 'Parameter tidak valid'), 401: unauthorized, 403: errorResponse('Bukan admin', 'FORBIDDEN', 'Hanya akun admin yang bisa mengelola pesanan toko.') },
      },
    },
    '/api/v1/admin/orders/{orderNumber}': {
      get: { tags: ['Admin Orders'], summary: 'Detail pesanan toko + riwayat status', security: [{ bearerAuth: [] }], parameters: [orderNoParam], responses: { 200: orderResponse('Pesanan'), 401: unauthorized, 403: errorResponse('Bukan admin', 'FORBIDDEN', 'Hanya akun admin yang bisa mengelola pesanan toko.'), 404: orderNotFound } },
    },
    '/api/v1/admin/orders/{orderNumber}/status': {
      patch: {
        tags: ['Admin Orders'],
        summary: 'Ubah status pesanan',
        description: 'Boleh: diproses → dikirim (courier + trackingNumber), diproses → dibatalkan (reason, note), dikirim → selesai. Lainnya 409 INVALID_TRANSITION.',
        security: [{ bearerAuth: [] }],
        parameters: [orderNoParam],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['status'],
                properties: {
                  status: { type: 'string', enum: ['dikirim', 'selesai', 'dibatalkan'] },
                  courier: { type: 'string', enum: ['reguler', 'express', 'sameday'] },
                  trackingNumber: { type: 'string', pattern: '^[A-Z0-9]{10,20}$', example: 'WQA1234567890' },
                  reason: { type: 'string', enum: ['stok-habis', 'permintaan-pembeli', 'alamat-tidak-valid', 'lainnya'] },
                  note: { type: 'string', maxLength: 200 },
                },
              },
              examples: {
                kirim: { value: { status: 'dikirim', courier: 'express', trackingNumber: 'WQA1234567890' } },
                selesai: { value: { status: 'selesai' } },
                batal: { value: { status: 'dibatalkan', reason: 'lainnya', note: 'Pembeli salah alamat' } },
              },
            },
          },
        },
        responses: {
          200: orderResponse('Status terbaru'),
          400: errorResponse('Data tidak valid', 'VALIDATION_ERROR', 'Nomor resi harus 10–20 huruf kapital atau angka', { trackingNumber: 'Nomor resi harus 10–20 huruf kapital atau angka' }),
          401: unauthorized,
          403: errorResponse('Bukan admin', 'FORBIDDEN', 'Hanya akun admin yang bisa mengelola pesanan toko.'),
          404: orderNotFound,
          409: errorResponse('Transisi tidak boleh / berubah bersamaan', 'INVALID_TRANSITION', 'Status Dikirim tidak bisa diubah ke Dibatalkan'),
        },
      },
    },
    '/api/v1/admin/orders/{orderNumber}/payment-proof': {
      get: { tags: ['Admin Orders'], summary: 'Lihat bukti transfer pembeli', security: [{ bearerAuth: [] }], parameters: [orderNoParam], responses: { 200: imageOk, 401: unauthorized, 403: errorResponse('Bukan admin', 'FORBIDDEN', 'Hanya akun admin yang bisa mengelola pesanan toko.'), 404: orderNotFound } },
    },
    '/api/v1/products/featured': {
      get: { tags: ['Products'], summary: 'Produk unggulan (urutan Pilihan admin)', security: [{ bearerAuth: [] }], responses: { 200: { description: 'Daftar produk sesuai urutan' }, 401: unauthorized, 403: forbidden } },
      put: {
        tags: ['Products'],
        summary: 'Atur urutan produk unggulan (maks 6)',
        security: [{ bearerAuth: [] }],
        requestBody: { required: true, content: { 'application/json': { schema: { type: 'object', required: ['ids'], properties: { ids: { type: 'array', items: { type: 'integer' }, maxItems: 6, example: [1, 6, 10] } } } } } },
        responses: { 200: { description: 'Daftar terbaru' }, 400: errorResponse('Lebih dari 6 / dobel', 'VALIDATION_ERROR', 'Maksimal 6 produk unggulan'), 401: unauthorized, 403: forbidden, 404: errorResponse('Bukan produk akun ini', 'NOT_FOUND', 'Ada produk yang tidak ditemukan di katalog akun ini') },
      },
    },
    '/api/v1/stock-movements': {
      get: {
        tags: ['Products'],
        summary: 'Riwayat stok (cursor pagination, terbaru dulu)',
        description: 'Ambil halaman berikutnya dengan cursor = meta.nextCursor. nextCursor null berarti sudah habis.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'cursor', in: 'query', schema: { type: 'string' } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 } },
          { name: 'productId', in: 'query', schema: { type: 'integer' } },
          { name: 'reason', in: 'query', schema: { type: 'string', enum: ['order', 'cancel', 'admin', 'restock', 'offline'] } },
        ],
        responses: {
          200: { description: 'data + meta (total, nextCursor)', content: { 'application/json': { schema: { type: 'object', properties: { data: { type: 'array', items: { $ref: '#/components/schemas/StockMovement' } }, meta: { type: 'object', properties: { total: { type: 'integer' }, nextCursor: { type: 'string', nullable: true } } } } } } } },
          400: errorResponse('Query tidak valid', 'VALIDATION_ERROR', 'Parameter tidak valid', { cursor: 'Cursor tidak valid' }),
          401: unauthorized,
          403: forbidden,
        },
      },
    },
  },
};

// Halaman Swagger UI (aset diambil dari CDN, jadi tidak perlu library tambahan)
const swaggerHtml = `<!doctype html>
<html lang="id">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Warung QA API Docs</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5/swagger-ui-bundle.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: '/api-docs/openapi.json',
        dom_id: '#swagger-ui',
        persistAuthorization: true,
        tryItOutEnabled: true,
      });
    </script>
  </body>
</html>`;

module.exports = { spec, swaggerHtml };
