CARA MENJALANKAN SERVER LOKAL & ONLINE UNTUK SAMUDRA HARAPAN

Langkah-langkah:
1. Buka terminal / command prompt di dalam folder projek ini (PAMERAN PANCER PACITAN).
2. Jalankan server lokal dengan perintah berikut:
   node server.js
3. Biarkan terminal tersebut tetap terbuka. Lalu, buka terminal / command prompt BARU di folder ini.
4. Hubungkan server lokal ke internet dengan perintah berikut:
   npx localtunnel --port 3000 --subdomain gizzatara

Cara Mengakses:
- Display Utama (Untuk Layar Besar / Proyektor di Laptop ini):
  Buka browser dan kunjungi: http://localhost:3000/display.html
  (Ini akan loading sangat cepat karena file 3D dimuat langsung dari dalam laptop).

- Layar Pengunjung (Untuk Menggambar di HP via Internet):
  Buka browser di HP dan kunjungi: https://gizzatara.loca.lt

Catatan Penting:
* Pastikan koneksi internet laptop stabil.
* Saat pengunjung pertama kali membuka link dari HP, mungkin akan muncul halaman peringatan gratis dari Localtunnel. Instruksikan pengunjung untuk menekan tombol "Click to Continue".
* Jika nama URL 'gizzatara' sedang dipakai orang lain atau error, Anda bisa menggantinya dengan nama lain pada perintah langkah ke-4.
