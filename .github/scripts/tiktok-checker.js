const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Fungsi untuk mengambil username murni dari berbagai format URL TikTok
function extractTikTokUsername(input) {
    if (!input) return '';
    let clean = input.trim();
    // Jika user memasukkan link lengkap seperti https://tiktok.com/@username/...
    if (clean.includes('tiktok.com/@')) {
        let parts = clean.split('@')[1];
        return parts ? parts.split('/')[0].split('?')[0] : clean;
    }
    // Jika diawali dengan @
    if (clean.startsWith('@')) {
        return clean.substring(1);
    }
    return clean;
}

async function checkTikTokLive(channelInput) {
    const username = extractTikTokUsername(channelInput);
    if (!username) return false;

    try {
        const response = await fetch(`https://www.tiktok.com/@${username}/live`, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });
        const html = await response.text();
        return html.includes('"is-live":true') || (html.includes('room_id') && !html.includes('This account is private'));
    } catch (err) {
        console.error(`Gagal cek @${username}:`, err.message);
        return false;
    }
}

async function run() {
    console.log("🔍 Memeriksa status live TikTok otomatis...");
    
    const { data: streamers, error } = await supabase
        .from('streamers')
        .select('*')
        .eq('platform', 'tiktok');

    if (error || !streamers) {
        console.log("Tidak ada streamer TikTok atau error database.");
        return;
    }

    for (let s of streamers) {
        const username = extractTikTokUsername(s.channel_id);
        if (!username) continue;

        const isLive = await checkTikTokLive(s.channel_id);
        const newStatus = isLive ? 'LIVE' : '';

        if ((s.video_id === 'LIVE') !== isLive) {
            await supabase
                .from('streamers')
                .update({ video_id: newStatus })
                .eq('id', s.id);
            console.log(`✨ @${username} status diperbarui: ${isLive ? 'LIVE 🟢' : 'OFF 🔴'}`);
        } else {
            console.log(`- @${username} tetap: ${isLive ? 'LIVE' : 'OFF'}`);
        }
    }
}

run();
