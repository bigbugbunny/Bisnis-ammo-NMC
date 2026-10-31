const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

async function testDiscord() {
    if (!DISCORD_WEBHOOK_URL) {
        console.log("❌ DISCORD_WEBHOOK_URL tidak ditemukan di Secrets!");
        return;
    }

    const message = {
        content: "@everyone 🚨 **UJI COBA BERHASIL!** Bot Triad Community sudah terhubung ke Discord! 🎮🔥"
    };

    const res = await fetch(DISCORD_WEBHOOK_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(message)
    });

    if (res.ok) {
        console.log("✅ Pesan uji coba berhasil dikirim ke Discord!");
    } else {
        console.log(`❌ Gagal kirim, status: ${res.status}`);
    }
}

testDiscord();
