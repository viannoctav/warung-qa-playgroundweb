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

const spec = {
  openapi: '3.0.3',
  info: {
    title: 'Warung QA API',
    version: '1.0.0',
    description:
      'API playground untuk latihan API testing. Login dulu lewat `POST /api/v1/auth/login` (contoh: standard_user / Warung123!), ' +
      'salin `token`, lalu klik **Authorize** dan tempel token-nya.\n\n' +
      'Akun demo: `standard_user` (pembeli di toko admin_user), `admin_user` (kelola produk + belanja di tokonya), `locked_user` (423), `slow_user` (5 detik), `error_user` (500). ' +
      'Akun hasil registrasi ber-role admin untuk tokonya sendiri dan aktif 24 jam.\n\n' +
      'Voucher latihan: `HEMAT10`, `WARUNG25K`, `ONGKIRGRATIS`, `KADALUARSA`.',
  },
  servers: [{ url: '/', description: 'Server ini' }],
  tags: [
    { name: 'Health' },
    { name: 'Auth', description: 'Login, registrasi, profil, reset data' },
    { name: 'Products', description: 'Kelola produk (khusus admin) + gambar produk' },
    { name: 'Store', description: 'Katalog toko untuk pembeli (hanya produk aktif)' },
    { name: 'Cart', description: 'Keranjang belanja' },
    { name: 'Orders', description: 'Checkout dan riwayat pesanan' },
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
        required: ['recipientName', 'phone', 'address', 'city', 'postalCode', 'shippingMethod', 'paymentMethod'],
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
        description: 'Role user melihat toko admin_user. Role admin melihat tokonya sendiri.',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'search', in: 'query', schema: { type: 'string', maxLength: 100 } },
          { name: 'category', in: 'query', schema: { type: 'string', enum: ['kopi', 'teh', 'makanan-ringan', 'bumbu-dapur', 'minuman-kemasan'] } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['name', 'price', 'stock', 'createdAt'], default: 'name' } },
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
