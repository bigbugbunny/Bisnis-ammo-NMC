const https = require('https');

// URL Database Firebase Anda
const FIREBASE_DB_URL = "https://nmc-management-default-rtdb.firebaseio.com";

// Fungsi helper untuk mengambil data webhook dari Firebase Realtime Database via REST API
function getWebhookFromFirebase(keyName) {
    return new Promise((resolve, reject) => {
        const url = `${FIREBASE_DB_URL}/webhooks/${keyName}.json`;
        
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                try {
                    const parsed = JSON.parse(data);
                    resolve(parsed); // Mengembalikan URL webhook string
                } catch (err) {
                    reject(err);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}

function kirimDiscord(url, payload) {
    return new Promise((resolve, reject) => {
        if (!url) {
            console.error("Gagal mengirim ke Discord: URL Webhook kosong!");
            return resolve(null);
        }

        const data = JSON.stringify(payload);
        const urlObj = new URL(url);
        const options = {
            hostname: urlObj.hostname,
            path: urlObj.pathname + urlObj.search,
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        };

        const req = https.request(options, (res) => {
            let responseBody = '';
            res.on('data', (chunk) => { responseBody += chunk; });
            res.on('end', () => { resolve(responseBody); });
        });

        req.on('error', (err) => { reject(err); });
        req.write(data);
        req.end();
    });
}

async function runAlert() {
    const now = new Date();
    const optionsTime = { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', hour12: false };
    const timeString = new Intl.DateTimeFormat('en-GB', optionsTime).format(now);

    console.log(`Waktu server GitHub (WIB): ${timeString}`);

    try {
        if (timeString === "20:30") {
            const webhookUrl = await getWebhookFromFirebase('alert'); // Mengambil node webhooks/alert dari Firebase
            await kirimDiscord(webhookUrl, { username: "Bapak Pemarah", content: `# Woi bro-bro sekalian! 📢 @everyone\n30 menit lagi aktivitas kota malam ini kita mulai (Pukul 21.00). Yang belum siap-siap, yuk bersiap merapat ya! 🔥` });
            console.log("Alert 20:30 berhasil dikirim.");
        } 
        else if (timeString === "20:50") {
            const webhookUrl = await getWebhookFromFirebase('alert');
            await kirimDiscord(webhookUrl, { username: "Bapak Tukang Data", embeds: [{ title: "⚠️ 10 MENIT LAGI KITA MASUK KOTA (20:50)", description: `Yuk persiapkan diri kalian, sebentar lagi jam 21.00 WIB kita mulai berRP malam ini.`, color: 16776960 }] });
            console.log("Alert 20:50 berhasil dikirim.");
        }
        else if (timeString === "00:25") {
            const webhookUrl = await getWebhookFromFirebase('alert');
            await kirimDiscord(webhookUrl, { username: "Bapak Dante", content: `# ⏰ **10 MENIT LAGI MENUJU FREE TIME / ISTIRAHAT** @everyone\nBersiap-siap sebentar lagi masuk jam Freetime ya kawan-kawan!` });
            console.log("Alert 00:25 berhasil dikirim.");
        }
        else if (timeString === "01:00") {
            const webhookUrl = await getWebhookFromFirebase('alert');
            await kirimDiscord(webhookUrl, { username: "Ibuk Comel", content: `# 🎉 **JADWAL RP KITA BERAKHIR** @everyone\nTerima kasih banyak atas kerja keras dan dedikasinya malam ini!\n# Jangan lupa istirahat ya!` });
            console.log("Alert 01:00 berhasil dikirim.");
        } else {
            console.log(`Tidak ada jadwal alert pada pukul ${timeString}.`);
        }
    } catch (err) {
        console.error("Terjadi kesalahan saat mengambil webhook dari Firebase:", err);
    }
}

runAlert();
