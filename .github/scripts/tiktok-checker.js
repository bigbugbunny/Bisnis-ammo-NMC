const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY;
const TIKTOK_API_KEY = process.env.TIKTOK_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function extractTikTokUsername(input) {
    if (!input) return '';
    let clean = String(input).trim();
    if (clean.includes('tiktok.com/')) {
        let parts = clean.split('tiktok.com/');
        let path = parts[1] || '';
        if (path.startsWith('@')) path = path.substring(1);
        return path.split('/')[0].split('?')[0];
    }
    if (clean.startsWith('@')) return clean.substring(1);
    return clean;
}

// Cek status live TikTok menggunakan Euler Stream API dengan Debug Log
async function checkTikTokLive(channelInput) {
    const username = extractTikTokUsername(channelInput);
    if (!username) return false;

    if (!TIKTOK_API_KEY) {
        console.warn("⚠️ TIKTOK_API_KEY belum disetel di GitHub Secrets.");
        return false;
    }

    try {
        const apiUrl = `https://api.eulerstream.com/v1/live/status?username=${username}`;
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${TIKTOK_API_KEY}`,
                'Accept': 'application/json'
            }
        });

        if (response.ok) {
            const data = await response.json();
            // Cetak isi respons mentah ke log GitHub Actions
            console.log(`🔍 Respon API Euler Stream untuk @${username}:`, JSON.stringify(data));
            
            if (data && (data.isLive === true || data.live === true || data.status === 1 || data.is_live === true || data.roomInfo)) {
                return true;
            }
        } else {
            console.log(`⚠️ API Euler Stream mengembalikan status ${response.status} untuk @${username}`);
        }
        return false;
    } catch (err) {
        console.error(`Gagal cek TikTok @${username} via Euler Stream:`, err.message);
        return false;
    }
}

async function run() {
    console.log("🔍 Memeriksa status live YouTube & TikTok otomatis...");
    
    const { data: streamers, error } = await supabase
        .from('streamers')
        .select('*');

    if (error) {
        console.error("Error database Supabase:", error.message);
        return;
    }

    if (!streamers || streamers.length === 0) {
        console.log("Tidak ada data streamer ditemukan di tabel streamers.");
        return;
    }

    for (let s of streamers) {
        const oldVideoId = s.video_id || '';
        let isLive = false;
        let activeVideoId = '';
        
        let platform = s.platform ? s.platform.toLowerCase() : '';
        if (!platform && (s.channel_id.includes('tiktok.com') || s.channel_id.startsWith('@') || s.channel_id === 'maintenance')) {
            platform = 'tiktok';
        }

        // 1. Pengecekan Platform TikTok via Euler Stream API
        if (platform === 'tiktok') {
            const isTikTokLive = await checkTikTokLive(s.channel_id);
            if (isTikTokLive) {
                isLive = true;
                activeVideoId = 'LIVE';
            }
        } 
        // 2. Pengecekan Platform YouTube
        else {
            if (s.channel_id && s.channel_id.startsWith('UC')) {
                try {
                    const channelUrl = `https://www.googleapis.com/youtube/v3/channels?part=contentDetails&id=${s.channel_id}&key=${YOUTUBE_API_KEY}`;
                    const chResponse = await fetch(channelUrl);
                    const chData = await chResponse.json();

                    if (chData.items && chData.items.length > 0) {
                        const uploadsPlaylistId = chData.items[0].contentDetails.relatedPlaylists.uploads;
                        const playlistUrl = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=1&key=${YOUTUBE_API_KEY}`;
                        const plResponse = await fetch(playlistUrl);
                        const plData = await plResponse.json();

                        if (plData.items && plData.items.length > 0) {
                            const latestVideoId = plData.items[0].snippet.resourceId.videoId;
                            const videoDetailUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,liveStreamingDetails&id=${latestVideoId}&key=${YOUTUBE_API_KEY}`;
                            const vResponse = await fetch(videoDetailUrl);
                            const vData = await vResponse.json();

                            if (vData.items && vData.items.length > 0) {
                                const videoInfo = vData.items[0];
                                if (videoInfo.snippet.liveBroadcastContent === 'live') {
                                    isLive = true;
                                    activeVideoId = latestVideoId;
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.error(`Error cek YouTube ${s.name}:`, e.message);
                }
            }
        }

        if (!isLive) {
            activeVideoId = '';
        }

        // Update status ke Supabase secara otomatis
        if (oldVideoId !== activeVideoId) {
            await supabase
                .from('streamers')
                .update({ video_id: activeVideoId })
                .eq('id', s.id);
            console.log(`✨ ${s.name} status diperbarui: ${isLive ? 'LIVE 🟢' : 'OFF 🔴'}`);
        } else {
            console.log(`- ${s.name} tetap: ${isLive ? 'LIVE' : 'OFF'}`);
        }
    }
}

run();
