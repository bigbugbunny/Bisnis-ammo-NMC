const https = require('https');

const WEBHOOK_ABSEN = "https://discordapp.com/api/webhooks/1565705764830453821/T3x3YFptOIvnKqgR1ROLIdzpjpDmpzrT1gjMtzfeCHbixQdu5z090xa7WF8tm1AMX6wG";
const WEBHOOK_INFO  = "https://discordapp.com/api/webhooks/1565756327114973195/NiHyUPNxfz6iSOiU4bM2DUIPvFMJ4bNIQwCa9i82ygng9hfvO_pBHmI-GtNQLIPYEYv0";

function kirimDiscord(url, payload) {
    return new Promise((resolve, reject) => {
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

    if (timeString === "20:30") {
        await kirimDiscord(WEBHOOK_INFO, { username: "Bapak Pemarah", content: `# Woi bro-bro sekalian! 📢 @everyone\n30 menit lagi aktivitas kota malam ini kita mulai (Pukul 21.00). Yang belum siap-siap, yuk bersiap merapat ya! 🔥` });
    } 
    else if (timeString === "20:50") {
        await kirimDiscord(WEBHOOK_INFO, { username: "Bapak Tukang Data", embeds: [{ title: "⚠️ 10 MENIT LAGI KITA MASUK KOTA (20:50)", description: `Yuk persiapkan diri kalian, sebentar lagi jam 21.00 WIB kita mulai berRP malam ini.`, color: 16776960 }] });
    }
    else if (timeString === "00:25") {
        await kirimDiscord(WEBHOOK_INFO, { username: "Bapak Dante", content: `# ⏰ **10 MENIT LAGI MENUJU FREE TIME / ISTIRAHAT** @everyone\nBersiap-siap sebentar lagi masuk jam Freetime ya kawan-kawan!` });
    }
    else if (timeString === "01:00") {
        await kirimDiscord(WEBHOOK_INFO, { username: "Ibuk Comel", content: `# 🎉 **JADWAL RP KITA BERAKHIR** @everyone\nTerima kasih banyak atas kerja keras dan dedikasinya malam ini!\n# Jangan lupa istirahat ya!` });
    } else {
        console.log(`Tidak ada jadwal alert pada pukul ${timeString}.`);
    }
}

runAlert();
